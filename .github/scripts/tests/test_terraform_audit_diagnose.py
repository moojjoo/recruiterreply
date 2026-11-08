import unittest

import importlib.util
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "terraform-audit-diagnose.py"
SPEC = importlib.util.spec_from_file_location("terraform_audit_diagnose", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
diagnose = MODULE.diagnose
extract_denied_actions = MODULE.extract_denied_actions


class TerraformAuditDiagnoseTests(unittest.TestCase):
    def test_extracts_provider_and_trace_actions(self):
        log = "\n".join([
            "operation error CloudWatch Logs: DescribeMetricFilters, status code: 403",
            "status_code=403 aws_service=KMS aws_operation=ListResourceTags",
            "AccessDenied: User is not authorized to perform: evil-service:ReadSecret",
        ])
        self.assertEqual(
            extract_denied_actions(log),
            {"kms:ListResourceTags", "logs:DescribeMetricFilters"},
        )

    def test_diagnosis_never_emits_raw_identifiers(self):
        matches, actions = diagnose(
            "AccessDenied for arn:aws:secretsmanager:private and evil-service:ReadSecret"
        )
        self.assertEqual(matches, ["AWS access denied"])
        self.assertEqual(actions, set())


if __name__ == "__main__":
    unittest.main()
