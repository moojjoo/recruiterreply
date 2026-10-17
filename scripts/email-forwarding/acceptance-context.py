"""Bind an acceptance-only retry to an actual applied run and its public baseline."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys


def check_source(run, jobs, workflow_id):
    if (run.get("repository", {}).get("full_name") != "moojjoo/recruiterreply"
            or run.get("workflow_id") != workflow_id or run.get("event") != "workflow_dispatch"
            or run.get("head_branch") != "main" or not re.fullmatch(r"[a-f0-9]{40}", run.get("head_sha", ""))
            or not isinstance(run.get("run_attempt"), int) or run["run_attempt"] < 1):
        raise ValueError("Unapproved source run")
    apply_jobs = [j for j in jobs.get("jobs", []) if j.get("name") == "email-apply"]
    if len(apply_jobs) != 1 or apply_jobs[0].get("status") != "completed":
        raise ValueError("No completed apply job")
    steps = {s["name"]: s.get("conclusion") for s in apply_jobs[0].get("steps", [])}
    for name in ("Reject stale plans and apply only reviewed binary",
                 "Verify authoritative DNS and existing SES configuration"):
        if steps.get(name) != "success":
            raise ValueError("Source deployment not verified")
    return run["head_sha"]


def check_artifact(directory, sha):
    directory = Path(directory)
    manifest = json.loads((directory / "manifest.json").read_text())
    if (manifest.get("sha") != sha or manifest.get("environment") != "prod"
            or manifest.get("digest") != hashlib.sha256((directory / "reviewed.tfplan").read_bytes()).hexdigest()):
        raise ValueError("Source artifact mismatch")
    # No Terraform commands are run: only the authenticated original baseline is used.
    baseline = json.loads((directory / "baseline.json").read_text())
    if not isinstance(baseline.get("records"), list) or "dkim" not in baseline or "mail_from" not in baseline:
        raise ValueError("Invalid public baseline")


def get(path):
    return json.loads(subprocess.run(["gh", "api", path], check=True, capture_output=True,
                                    text=True, timeout=30).stdout)


def main():
    source = os.environ.get("SOURCE_RUN", "")
    if not re.fullmatch(r"[1-9][0-9]{0,19}", source):
        raise ValueError("Invalid source run")
    repo = "repos/moojjoo/recruiterreply"
    run = get(f"{repo}/actions/runs/{source}")
    workflow = get(f"{repo}/actions/workflows/email-forwarding.yml")
    attempt = run.get("run_attempt")
    jobs = get(f"{repo}/actions/runs/{source}/attempts/{attempt}/jobs?per_page=100")
    sha = check_source(run, jobs, workflow["id"])
    subprocess.run(["git", "merge-base", "--is-ancestor", sha, os.environ["GITHUB_SHA"]],
                   check=True, capture_output=True, timeout=30)
    if len(sys.argv) == 2:
        check_artifact(sys.argv[1], sha)
    else:
        with open(os.environ["GITHUB_OUTPUT"], "a") as output:
            output.write(f"run_id={source}\nartifact=issue-400-plan-{source}-{attempt}\n")
    print("PASS: verified source deployment" + (" and original artifact binding." if len(sys.argv) == 2 else "."))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        raise SystemExit("FAIL: acceptance source or artifact is unverified; raw metadata withheld")
