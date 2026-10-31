#!/usr/bin/env python3
"""Read only public DNS/SES metadata; optionally send the three approved test messages."""
import argparse
import datetime
import importlib.util
import json
from pathlib import Path
import shlex
import subprocess
import uuid

spec = importlib.util.spec_from_file_location("gate", Path(__file__).with_name("terraform-gate.py"))
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


def aws(*args):
    return json.loads(subprocess.run(["aws", *args, "--region", "us-east-1", "--output", "json"],
                                    check=True, capture_output=True, text=True, timeout=45).stdout)


def values(record):
    return sorted(v["Value"] for v in record.get("ResourceRecords", []))


def snapshot():
    records = aws("route53", "list-resource-record-sets", "--hosted-zone-id", gate.ZONE)["ResourceRecordSets"]
    ses = aws("sesv2", "get-email-identity", "--email-identity", gate.DOMAIN)
    if ses.get("VerifiedForSendingStatus") is not True or ses.get("DkimAttributes", {}).get("Status") != "SUCCESS":
        raise ValueError("SES sending/DKIM is not healthy")
    for record in records:
        if record["Name"] == gate.DOMAIN + "." and record["Type"] in ("MX", "TXT"):
            allowed = {gate.GOOGLE, gate.SPF} if record["Type"] == "TXT" else set(gate.RECORDS["aws_route53_record.mx"][1])
            actual = {"".join(shlex.split(v)) if record["Type"] == "TXT" else v.rstrip(".") for v in values(record)}
            if not actual.issubset(allowed) or (record["Type"] == "TXT" and gate.GOOGLE not in actual):
                raise ValueError("unreviewed apex DNS baseline")
    return {"records": records, "dkim": ses["DkimAttributes"], "mail_from": ses.get("MailFromAttributes")}


def unchanged(before, after):
    def preserved(value):
        return [r for r in value["records"] if not (r["Name"] == gate.DOMAIN + "." and r["Type"] in ("MX", "TXT"))]
    if preserved(before) != preserved(after) or before["dkim"] != after["dkim"] or before["mail_from"] != after["mail_from"]:
        raise ValueError("unrelated DNS or SES configuration changed")


def authoritative(after):
    servers = next(r for r in after["records"] if r["Name"] == gate.DOMAIN + "." and r["Type"] == "NS")
    expected = {gate.DOMAIN: {"MX": gate.RECORDS["aws_route53_record.mx"][1], "TXT": [gate.GOOGLE, gate.SPF]}}
    for token in after["dkim"]["Tokens"]:
        expected[f"{token}._domainkey.{gate.DOMAIN}"] = {"CNAME": [f"{token}.dkim.amazonses.com"]}
    dmarc = next((r for r in after["records"] if r["Name"] == f"_dmarc.{gate.DOMAIN}." and r["Type"] == "TXT"), None)
    expected[f"_dmarc.{gate.DOMAIN}"] = {"TXT": ["".join(shlex.split(v)) for v in values(dmarc)] if dmarc else []}
    for server in values(servers):
        for name, types in expected.items():
            for kind, wanted in types.items():
                output = subprocess.run(["dig", "@" + server, name, kind, "+short", "+time=3", "+tries=1"],
                                        check=True, capture_output=True, text=True, timeout=10).stdout
                actual = ["".join(shlex.split(v)) if kind == "TXT" else v.rstrip(".") for v in output.splitlines()]
                if sorted(actual) != sorted(wanted):
                    raise ValueError("authoritative DNS propagation incomplete")


def send_tests():
    for alias in ("privacy", "legal", "rr400-catchall-" + uuid.uuid4().hex):
        correlation = "rr400-" + uuid.uuid4().hex
        aws("sesv2", "send-email", "--from-email-address", "no-reply@recruiterreply.com",
            "--destination", json.dumps({"ToAddresses": [f"{alias}@{gate.DOMAIN}"]}),
            "--content", json.dumps({"Simple": {"Subject": {"Data": correlation},
                "Body": {"Text": {"Data": "RecruiterReply forwarding acceptance test: " + correlation}}}}))
        print(json.dumps({"correlation": correlation, "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()}))
    print("PENDING MANUAL VERIFICATION: confirm all three correlation IDs in the destination inbox; SES acceptance is not receipt.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("snapshot")
    parser.add_argument("--compare", action="store_true")
    parser.add_argument("--send-tests", action="store_true")
    args = parser.parse_args()
    try:
        current = snapshot()
        if args.compare:
            unchanged(json.loads(Path(args.snapshot).read_text()), current)
            authoritative(current)
        else:
            Path(args.snapshot).write_text(json.dumps(current))
        if args.send_tests:
            if not args.compare:
                raise ValueError("post-apply checks required before test mail")
            send_tests()
        print("PASS: public DNS/SES metadata checks")
    except Exception:
        raise SystemExit("FAIL: DNS/SES acceptance check; raw responses withheld")
