#!/usr/bin/env python3
"""RecruiterReply EC2 backend-image retention. Dry-run by default.

WARNING: --apply is manual-only until all deployment paths share this lock.
"""
import argparse
import fcntl
import json
import subprocess
import sys

DEFAULT_REPO = "178522450316.dkr.ecr.us-east-1.amazonaws.com/recruiterreply-backend"
LOCK = "/tmp/recruiterreply-docker-deploy.lock"


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
        backend, pinned, retained, candidates = plan(images, referenced_images(), args.repo, args.keep)
        print(f"Backend images: {len(backend)}")
        print(f"Protected container images: {len(pinned)}")
        print(f"Retained rollback images: {len(retained)}")
        print(f"Cleanup candidates: {len(candidates)}")
        for image in candidates:
            print("CANDIDATE", image["Id"], *target_tags(image, args.repo))
        if not args.apply:
            print("PREVIEW ONLY — nothing deleted.")
            after = disk_metrics()
            print("SUMMARY", json.dumps({"mode": "preview", "repository": args.repo,
                "backend_images": len(backend), "protected_images": len(pinned),
                "retained_images": len(pinned) + len(retained), "candidate_images": len(candidates),
                "before": before, "after": after}, sort_keys=True))
            return 0
        # Manual operation only; do not enable unattended apply until every
        # deployment/rollback path cooperates with LOCK and pins promotion SHAs.
        removed, skipped, failures = remove_candidates(candidates, args.repo)
        after = disk_metrics()
        summary = {"mode": "apply", "repository": args.repo, "removed_tags": removed,
            "skipped": skipped, "failures": failures, "before": before, "after": after}
        print("SUMMARY", json.dumps(summary, sort_keys=True))
        if failures:
            print(f"ERROR: {len(failures)} image removal(s) failed", file=sys.stderr)
            return 1
        print("Cleanup finished.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
