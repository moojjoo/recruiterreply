import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from test_live_checks import module

context = module("acceptance_context", "acceptance-context.py")
SHA = "a" * 40


class AcceptanceContextTests(unittest.TestCase):
    def fixture(self):
        return ({"repository": {"full_name": "moojjoo/recruiterreply"}, "workflow_id": 123,
                 "event": "workflow_dispatch", "head_branch": "main", "head_sha": SHA,
                 "run_attempt": 1},
                {"jobs": [{"name": "email-apply", "status": "completed", "steps": [
                    {"name": "Reject stale plans and apply only reviewed binary", "conclusion": "success"},
                    {"name": "Verify authoritative DNS and existing SES configuration", "conclusion": "success"},
                    {"name": "Verify provider forwarding is ready", "conclusion": "failure"}]}]})

    def test_accepts_applied_source_even_when_later_provider_readiness_failed(self):
        run, jobs = self.fixture()
        self.assertEqual(context.check_source(run, jobs, 123), SHA)

    def test_rejects_other_sources_and_unfinished_or_unverified_deployments(self):
        for field, value in (("repository", {"full_name": "other/repo"}), ("workflow_id", 456),
                             ("event", "pull_request"), ("head_branch", "feature"),
                             ("head_sha", "invalid"), ("run_attempt", 0)):
            run, jobs = self.fixture()
            run[field] = value
            with self.assertRaises(ValueError):
                context.check_source(run, jobs, 123)
        for field, value in (("status", "in_progress"), ("steps", [])):
            run, jobs = self.fixture()
            jobs["jobs"][0][field] = value
            with self.assertRaises(ValueError):
                context.check_source(run, jobs, 123)
        for step in range(2):
            for conclusion in ("skipped", "failure"):
                run, jobs = self.fixture()
                jobs["jobs"][0]["steps"][step]["conclusion"] = conclusion
                with self.assertRaises(ValueError):
                    context.check_source(run, jobs, 123)
        run, jobs = self.fixture()
        jobs["jobs"].append(copy.deepcopy(jobs["jobs"][0]))
        with self.assertRaises(ValueError):
            context.check_source(run, jobs, 123)

    def test_artifact_requires_original_binary_commit_production_and_baseline(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "reviewed.tfplan").write_bytes(b"original")
            manifest = {"sha": SHA, "environment": "prod", "digest": hashlib.sha256(b"original").hexdigest()}
            baseline = {"records": [], "dkim": {}, "mail_from": None}
            (root / "manifest.json").write_text(json.dumps(manifest))
            (root / "baseline.json").write_text(json.dumps(baseline))
            context.check_artifact(root, SHA)
            for field, value in (("sha", "b" * 40), ("environment", "dev"), ("digest", "tampered")):
                (root / "manifest.json").write_text(json.dumps({**manifest, field: value}))
                with self.assertRaises(ValueError):
                    context.check_artifact(root, SHA)
            (root / "manifest.json").write_text(json.dumps(manifest))
            (root / "baseline.json").write_text('{}')
            with self.assertRaises(ValueError):
                context.check_artifact(root, SHA)


if __name__ == "__main__":
    unittest.main()
