#!/usr/bin/env python3
"""RecruiterReply EC2 backend-image retention. Dry-run by default.

WARNING: --apply is manual-only until all deployment paths share this lock.
"""
import argparse
import fcntl
import json
import os
import subprocess
import sys

DEFAULT_REPO = "178522450316.dkr.ecr.us-east-1.amazonaws.com/recruiterreply-backend"
LOCK = "/var/lock/recruiterreply-docker-deploy.lock"


def docker(*args):
    return subprocess.check_output(["docker", *args], text=True).strip()


def inspect_images():
    ids = list(dict.fromkeys(docker("image", "ls", "-aq", "--no-trunc").splitlines()))
    return json.loads(docker("image", "inspect", *ids)) if ids else []


def referenced_images():
    ids = docker("ps", "-aq", "--no-trunc").splitlines()
    return {c["Image"] for c in json.loads(docker("inspect", *ids))} if ids else set()


def plan(images, referenced, repo, keep):
    backend = [i for i in images if any(t.startswith(repo + ":") for t in (i.get("RepoTags") or []))]
    backend.sort(key=lambda i: (i["Created"], i["Id"]), reverse=True)
    pinned = [i for i in backend if i["Id"] in referenced]
    available = [i for i in backend if i["Id"] not in referenced]
    retained = available[:max(0, keep - len(pinned))]
    return backend, pinned, retained, available[len(retained):]


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
        images = inspect_images()
        backend, pinned, retained, candidates = plan(images, referenced_images(), args.repo, args.keep)
        print(f"Backend images: {len(backend)}")
        print(f"Protected container images: {len(pinned)}")
        print(f"Retained rollback images: {len(retained)}")
        print(f"Cleanup candidates: {len(candidates)}")
        for image in candidates:
            tags = [t for t in image.get("RepoTags") or [] if t.startswith(args.repo + ":")]
            print("CANDIDATE", image["Id"], *tags)
        if not args.apply:
            print("PREVIEW ONLY — nothing deleted.")
            return 0
        # Manual operation only; do not enable unattended apply until every
        # deployment/rollback path cooperates with LOCK and pins promotion SHAs.
        for image in candidates:
            image_id = image["Id"]
            if image_id in referenced_images():
                print("SKIP newly referenced", image_id)
                continue
            try:
                current = json.loads(docker("image", "inspect", image_id))[0]
            except subprocess.CalledProcessError:
                print("SKIP missing image", image_id)
                continue
            if set(current.get("RepoTags") or []) != set(image.get("RepoTags") or []):
                print("SKIP changed tags", image_id)
                continue
            for tag in [t for t in current.get("RepoTags") or [] if t.startswith(args.repo + ":")]:
                if image_id in referenced_images():
                    print("SKIP newly referenced", image_id)
                    break
                # Never force-remove; Docker will reject referenced images.
                subprocess.run(["docker", "image", "rm", tag], check=True)
        print("Cleanup finished.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
