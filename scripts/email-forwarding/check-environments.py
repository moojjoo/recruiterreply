#!/usr/bin/env python3
"""Fail before AWS OIDC if required GitHub environment gates are absent."""
import json
import os
import subprocess


def get(path):
    return json.loads(subprocess.run(["gh", "api", path], check=True, capture_output=True, text=True, timeout=30).stdout)


def validate(environment, policies, require_review):
    rules = environment.get("protection_rules", [])
    if environment.get("deployment_branch_policy", {}).get("custom_branch_policies") is not True:
        raise ValueError("explicit main branch restriction required")
    branches = policies.get("branch_policies", [])
    if len(branches) != 1 or branches[0].get("name") != "main" or branches[0].get("type") != "branch":
        raise ValueError("only main may deploy")
    if require_review:
        review = next((r for r in rules if r.get("type") == "required_reviewers"), {})
        if not review.get("reviewers") or environment.get("can_admins_bypass") is not False:
            raise ValueError("reviewer gate with admin bypass disabled required")


if __name__ == "__main__":
    try:
        selected = os.environ["EMAIL_ENVIRONMENT"]
        if selected not in ("dev", "test", "prod"):
            raise ValueError("unknown environment")
        names = [(f"terraform-email-{selected}-plan", selected != "dev")]
        if os.environ.get("EMAIL_OPERATION") == "email-apply":
            if selected != "prod":
                raise ValueError("shared apex DNS requires Production apply")
            names.append(("terraform-email-prod-apply", True))
        repo = os.environ["GITHUB_REPOSITORY"]
        for name, review in names:
            path = f"repos/{repo}/environments/{name}"
            validate(get(path), get(path + "/deployment-branch-policies"), review)
        print("PASS: GitHub environment approval and main-branch gates")
    except Exception:
        raise SystemExit("FAIL: required Issue #400 protected environments are missing or unverifiable; no AWS authentication attempted")
