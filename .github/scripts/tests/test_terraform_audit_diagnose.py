import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "terraform-audit-diagnose.py"


class TerraformAuditDiagnoseTests(unittest.TestCase):
    def run_diagnosis(self, log):
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False) as handle:
            handle.write(log)
            path = handle.name
        try:
            result = subprocess.run(
                [sys.executable, str(SCRIPT), path],
                check=True,
                capture_output=True,
                text=True,
            )
            return result.stdout
        finally:
            Path(path).unlink(missing_ok=True)

    def test_extracts_compact_and_formatted_aws_actions(self):
        output = self.run_diagnosis(
            "AccessDeniedException: User is not authorized to perform: kms:GetKeyRotationStatus\n"
            "operation error CloudWatch Logs: ListTagsForResource, https response error StatusCode: 403\n"
            "operation error Cognito Identity Provider: DescribeResourceServer, access denied\n"
        )
        self.assertIn("AWS action denied: kms:GetKeyRotationStatus", output)
        self.assertIn("AWS action denied: logs:ListTagsForResource", output)
        self.assertIn("AWS action denied: cognito-idp:DescribeResourceServer", output)

    def test_does_not_emit_raw_denial_lines_or_untrusted_services(self):
        output = self.run_diagnosis(
            "AccessDenied: not authorized to perform: evil-service:ReadSecret for arn:aws:secretsmanager:secret\n"
        )
        self.assertIn("AWS access denied", output)
        self.assertNotIn("evil-service:ReadSecret", output)
        self.assertNotIn("arn:aws:", output)


if __name__ == "__main__":
    unittest.main()
