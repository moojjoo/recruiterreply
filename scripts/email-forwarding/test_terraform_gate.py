import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("gate", Path(__file__).with_name("terraform-gate.py"))
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


def plan():
    return {"complete": True, "resource_changes": [
        {"address": address, "change": {"actions": ["create"], "before": None,
         "after": {"name": gate.DOMAIN, "zone_id": gate.ZONE, "type": kind,
                   "records": records.copy(), "ttl": 300}}}
        for address, (kind, records) in gate.RECORDS.items()]}


class PlanTests(unittest.TestCase):
    def test_approved_dns(self):
        self.assertTrue(gate.check_plan(plan()))

    def test_unrelated_resource(self):
        value = plan()
        value["resource_changes"].append({"address": "aws_iam_role.admin"})
        with self.assertRaises(ValueError):
            gate.check_plan(value)

    def test_replacements_deletes_wrong_zone_or_values(self):
        for field, invalid in [("actions", ["delete", "create"]), ("actions", ["delete"]),
                               ("zone_id", "OTHER"), ("records", [gate.SPF]),
                               ("name", "api.recruiterreply.com"), ("alias", [{}])]:
            value = plan()
            change = value["resource_changes"][0]["change"]
            (change if field == "actions" else change["after"])[field] = invalid
            with self.assertRaises(ValueError, msg=field):
                gate.check_plan(value)

    def test_preserves_existing_txt(self):
        value = plan()
        change = value["resource_changes"][0]["change"]
        change.update(actions=["update"], before={"records": [gate.GOOGLE]})
        self.assertTrue(gate.check_plan(value))
        change["before"]["records"].append("unreviewed-verification=preserve-me")
        with self.assertRaises(ValueError):
            gate.check_plan(value)

    def test_known_record_elements_are_not_unknown(self):
        value = plan()
        value["resource_changes"][0]["change"]["after_unknown"] = {"records": [False, False]}
        self.assertTrue(gate.check_plan(value))

    def test_unknown_and_incomplete(self):
        value = plan()
        value["complete"] = False
        with self.assertRaises(ValueError):
            gate.check_plan(value)
        value = plan()
        value["resource_changes"][0]["change"]["after_unknown"] = {"records": True}
        with self.assertRaises(ValueError):
            gate.check_plan(value)

    def test_artifact_binding_and_drift(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, binary, manifest = root / "plan.json", root / "plan.bin", root / "manifest.json"
            source.write_text(json.dumps(plan()))
            binary.write_bytes(b"reviewed-plan")
            sha = "a" * 40
            gate.seal(source, binary, manifest, sha, "prod")
            gate.verify(source, binary, manifest, sha, "prod")
            for wrong_sha, environment in [("b" * 40, "prod"), (sha, "test")]:
                with self.assertRaises(ValueError):
                    gate.verify(source, binary, manifest, wrong_sha, environment)
            original = manifest.read_text()
            meta = json.loads(original)
            meta["created"] -= 3601
            manifest.write_text(json.dumps(meta))
            with self.assertRaises(ValueError):
                gate.verify(source, binary, manifest, sha, "prod")
            manifest.write_text(original)
            changed = plan()
            changed["prior_state"] = {"values": {"changed": True}}
            source.write_text(json.dumps(changed))
            with self.assertRaises(ValueError):
                gate.verify(source, binary, manifest, sha, "prod")
            source.write_text(json.dumps(plan()))
            binary.write_bytes(b"tampered")
            with self.assertRaises(ValueError):
                gate.verify(source, binary, manifest, sha, "prod")


if __name__ == "__main__":
    unittest.main()
