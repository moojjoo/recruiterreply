#!/usr/bin/env python3
"""RecruiterReply EC2 backend-image retention. Dry-run by default.

Policy-based apply can require a preview digest to prevent stale approval.
"""
import argparse
import fcntl
import hashlib
import json
import pathlib
import subprocess
import sys

DEFAULT_REPO = "178522450316.dkr.ecr.us-east-1.amazonaws.com/recruiterreply-backend"
LOCK = "/tmp/recruiterreply-docker-deploy.lock"
POLICY_LIMITS = {"dev": 10, "test": 5, "prod": 4}


def docker(*args):
    return subprocess.check_output(["docker", *args], text=True).strip()


def inspect_images():
    ids = list(dict.fromkeys(docker("image", "ls", "-aq", "--no-trunc").splitlines()))
    return json.loads(docker("image", "inspect", *ids)) if ids else []


def referenced_images():
    ids = docker("ps", "-aq", "--no-trunc").splitlines()
    return {c["Image"] for c in json.loads(docker("inspect", *ids))} if ids else set()


def disk_metrics():
    usage = subprocess.check_output(["df", "-Pk", "/"], text=True).splitlines()[-1].split()
    return {
        "root_total_kb": int(usage[1]),
        "root_used_kb": int(usage[2]),
        "root_available_kb": int(usage[3]),
        "root_used_percent": int(usage[4].rstrip("%")),
        "docker_system_df": docker("system", "df"),
    }


def plan(images, referenced, repo, keep):
    backend = [i for i in images if any(t.startswith(repo + ":") for t in (i.get("RepoTags") or []))]
    backend.sort(key=lambda i: (i["Created"], i["Id"]), reverse=True)
    pinned = [i for i in backend if i["Id"] in referenced]
    available = [i for i in backend if i["Id"] not in referenced]
    retained = available[:max(0, keep - len(pinned))]
    return backend, pinned, retained, available[len(retained):]


def load_policy(path):
    try:
        policy = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"cannot read retention policy: {error}") from error
    if not isinstance(policy, dict) or set(policy) != set(POLICY_LIMITS):
        raise ValueError("retention policy must contain exactly dev, test, and prod")
    for environment, limit in POLICY_LIMITS.items():
        values = policy[environment]
        if not isinstance(values, list) or not values:
            raise ValueError(f"retention policy {environment} history must be a non-empty list")
        if len(values) > limit:
            raise ValueError(f"retention policy {environment} exceeds limit {limit}")
        if len(values) != len(set(values)) or any(
                not isinstance(value, str) or len(value) != 40
                or any(character not in "0123456789abcdef" for character in value)
                for value in values):
            raise ValueError(f"retention policy {environment} contains invalid commit SHAs")
    return policy


def plan_with_policy(images, referenced, repo, policy):
    backend = [i for i in images if any(t.startswith(repo + ":") for t in (i.get("RepoTags") or []))]
    backend.sort(key=lambda i: (i["Created"], i["Id"]), reverse=True)
    pinned = [i for i in backend if i["Id"] in referenced]
    approved_tags = {f"{repo}:{sha}" for values in policy.values() for sha in values}
    retained = [i for i in backend if i["Id"] not in referenced
                and approved_tags.intersection(i.get("RepoTags") or [])]
    protected_ids = {i["Id"] for i in pinned + retained}
    candidates = [i for i in backend if i["Id"] not in protected_ids]
    return backend, pinned, retained, candidates


def plan_digest(repo, policy, pinned, retained, candidates):
    def image_state(images):
        return sorted(
            ({"id": image["Id"], "tags": target_tags(image, repo)} for image in images),
            key=lambda image: (image["id"], image["tags"]),
        )

    payload = {"repository": repo, "policy": policy,
               "pinned": image_state(pinned),
               "retained": image_state(retained),
               "candidates": image_state(candidates)}
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def target_tags(image, repo):
    return sorted(t for t in (image.get("RepoTags") or []) if t.startswith(repo + ":"))


def remove_candidates(candidates, repo):
    removed_tags = []
    skipped = []
    failures = []
    for image in candidates:
        image_id = image["Id"]
        if image_id in referenced_images():
            skipped.append({"image": image_id, "reason": "newly_referenced"})
            continue
        try:
            current = json.loads(docker("image", "inspect", image_id))[0]
        except subprocess.CalledProcessError:
            skipped.append({"image": image_id, "reason": "missing"})
            continue
        if set(current.get("RepoTags") or []) != set(image.get("RepoTags") or []):
            skipped.append({"image": image_id, "reason": "tags_changed"})
            continue
        for tag in target_tags(current, repo):
            if image_id in referenced_images():
                skipped.append({"image": image_id, "reason": "newly_referenced"})
                break
            result = subprocess.run(["docker", "image", "rm", tag], text=True, capture_output=True)
            if result.returncode:
                failures.append({"image": image_id, "tag": tag, "error": result.stderr.strip()})
                break
            removed_tags.append(tag)
    return removed_tags, skipped, failures


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default=DEFAULT_REPO)
    parser.add_argument("--keep", type=int, default=10)
    parser.add_argument("--policy-file")
    parser.add_argument("--expected-plan-digest")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if args.keep < 1 or not args.repo or ":" in args.repo:
        parser.error("--keep must be >= 1 and --repo must be an untagged repository")
    # File lock prevents concurrent invocations of this script. Deployers must
    # also acquire this exact host-level lock before enabling unattended --apply.
    with open(LOCK, "a+") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("ERROR: deployment/cleanup lock busy; aborting", file=sys.stderr)
            return 2
        before = disk_metrics()
        images = inspect_images()
        policy = None
        if args.policy_file:
            try:
                policy = load_policy(args.policy_file)
            except ValueError as error:
                print(f"ERROR: {error}", file=sys.stderr)
                return 2
            backend, pinned, retained, candidates = plan_with_policy(
                images, referenced_images(), args.repo, policy)
        else:
            backend, pinned, retained, candidates = plan(
                images, referenced_images(), args.repo, args.keep)
        digest = plan_digest(args.repo, policy, pinned, retained, candidates)
        if args.expected_plan_digest and args.expected_plan_digest != digest:
            print("ERROR: current cleanup plan does not match the approved preview digest",
                  file=sys.stderr)
            return 2
        print(f"Backend images: {len(backend)}")
        print(f"Protected container images: {len(pinned)}")
        print(f"Retained policy images: {len(retained)}")
        print(f"Cleanup candidates: {len(candidates)}")
        for image in candidates:
            print("CANDIDATE", image["Id"], *target_tags(image, args.repo))
        print("PLAN", json.dumps({"repository": args.repo, "policy": policy,
            "plan_digest": digest, "protected_images": len(pinned),
            "retained_images": len(pinned) + len(retained),
            "candidate_images": len(candidates)}, sort_keys=True))
        if not args.apply:
            print("PREVIEW ONLY — nothing deleted.")
            after = disk_metrics()
            print("SUMMARY", json.dumps({"mode": "preview", "repository": args.repo,
                "backend_images": len(backend), "protected_images": len(pinned),
                "retained_images": len(pinned) + len(retained), "candidate_images": len(candidates),
                "policy": policy, "plan_digest": digest,
                "before": before, "after": after}, sort_keys=True))
            return 0
        # Apply remains manual and re-checks references immediately before removal.
        removed, skipped, failures = remove_candidates(candidates, args.repo)
        after = disk_metrics()
        summary = {"mode": "apply", "repository": args.repo, "policy": policy,
            "plan_digest": digest, "removed_tags": removed,
            "skipped": skipped, "failures": failures, "before": before, "after": after}
        print("SUMMARY", json.dumps(summary, sort_keys=True))
        if failures:
            print(f"ERROR: {len(failures)} image removal(s) failed", file=sys.stderr)
            return 1
        print("Cleanup finished.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
