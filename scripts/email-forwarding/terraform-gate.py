#!/usr/bin/env python3
"""Issue #400 public-DNS plan contract. Never print a raw Terraform plan."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import time

DOMAIN = "recruiterreply.com"
ZONE = "Z03382853SGMP0RST8DJG"
GOOGLE = "google-site-verification=aC6yYtwq8VhDHCvPK9lL_QyfhMTjwyIcRSWLBiysRa0"
SPF = "v=spf1 include:amazonses.com include:spf.improvmx.com ~all"
RECORDS = {
    "aws_route53_record.apex_txt": ("TXT", [GOOGLE, SPF]),
    "aws_route53_record.mx": ("MX", ["10 mx1.improvmx.com", "20 mx2.improvmx.com"]),
}


def check_plan(plan):
    if plan.get("errored") or plan.get("complete") is not True:
        raise ValueError("incomplete plan")
    checks = plan.get("checks", [])
    if any(c.get("status") != "pass" for c in checks):
        raise ValueError("plan checks failed or unknown")
    changes = plan.get("resource_changes", [])
    if {c.get("address") for c in changes} != set(RECORDS) or len(changes) != 2:
        raise ValueError("unexpected resource set")
    for resource in changes:
        kind, records = RECORDS[resource["address"]]
        change = resource["change"]
        if change["actions"] not in (["no-op"], ["create"], ["update"]):
            raise ValueError("destructive or unexpected action")
        after = change["after"]
        if (after.get("zone_id") != ZONE or after.get("name", "").rstrip(".") != DOMAIN
                or after.get("type") != kind or after.get("ttl") != 300
                or sorted(after.get("records", [])) != sorted(records)):
            raise ValueError("unapproved DNS configuration")
        # Route 53 routing/alias policies are outside this contract.
        if any(after.get(k) for k in ("alias", "set_identifier", "weighted_routing_policy",
                                     "failover_routing_policy", "geolocation_routing_policy",
                                     "latency_routing_policy", "multivalue_answer_routing_policy",
                                     "cidr_routing_policy", "geoproximity_routing_policy", "health_check_id")):
            raise ValueError("unexpected DNS routing")
        before = change.get("before")
        if before:
            existing = set(before.get("records", []))
            allowed = {GOOGLE, SPF} if kind == "TXT" else set(records)
            if not existing.issubset(allowed) or (kind == "TXT" and GOOGLE not in existing):
                raise ValueError("existing DNS differs from reviewed baseline")
        unknown = change.get("after_unknown", {}).get("records", False)
        if unknown is True or (isinstance(unknown, list) and any(unknown)):
            raise ValueError("unknown record values")
    return True


def signature(plan):
    # Compare a fresh plan after approval, including refreshed prior state and
    # detected drift. Terraform itself also rejects stale saved-state serials.
    value = {k: plan.get(k) for k in ("resource_changes", "resource_drift", "prior_state")}
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def seal(plan_path, binary_path, manifest_path, sha, environment):
    check_plan(json.loads(Path(plan_path).read_text()))
    if environment not in ("dev", "test", "prod") or len(sha) != 40 or any(c not in "0123456789abcdef" for c in sha):
        raise ValueError("invalid execution context")
    manifest = {"sha": sha, "environment": environment, "created": int(time.time()),
                "digest": hashlib.sha256(Path(binary_path).read_bytes()).hexdigest(),
                "signature": signature(json.loads(Path(plan_path).read_text()))}
    Path(manifest_path).write_text(json.dumps(manifest))


def verify(plan_path, binary_path, manifest_path, sha, environment):
    manifest = json.loads(Path(manifest_path).read_text())
    if (manifest["sha"] != sha or manifest["environment"] != environment
            or not 0 <= time.time() - manifest["created"] <= 3600
            or manifest["digest"] != hashlib.sha256(Path(binary_path).read_bytes()).hexdigest()):
        raise ValueError("stale or mismatched reviewed plan")
    fresh = json.loads(Path(plan_path).read_text())
    check_plan(fresh)
    if manifest["signature"] != signature(fresh):
        raise ValueError("DNS or Terraform state changed after review; replan required")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("operation", choices=["check", "seal", "verify"])
    parser.add_argument("plan")
    parser.add_argument("--binary")
    parser.add_argument("--manifest")
    args = parser.parse_args()
    try:
        if args.operation == "check":
            check_plan(json.loads(Path(args.plan).read_text()))
        else:
            globals()[args.operation](args.plan, args.binary, args.manifest,
                                     os.environ["GITHUB_SHA"], os.environ["EMAIL_ENVIRONMENT"])
        print("PASS: Issue #400 DNS plan contract")
    except Exception:
        raise SystemExit("FAIL: Issue #400 DNS contract or plan binding; raw plan withheld")
