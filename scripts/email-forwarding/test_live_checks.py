import copy
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


live = module("live", "live-check.py")
environments = module("environments", "check-environments.py")


class EnvironmentTests(unittest.TestCase):
    def test_explicit_main_and_review_required(self):
        environment = {"deployment_branch_policy": {"custom_branch_policies": True},
                       "can_admins_bypass": False,
                       "protection_rules": [{"type": "required_reviewers", "reviewers": [{"id": 1}]}]}
        policy = {"branch_policies": [{"name": "main", "type": "branch"}]}
        environments.validate(environment, policy, True)
        for bad in ({"branch_policies": []}, {"branch_policies": [{"name": "*", "type": "branch"}]},
                    {"branch_policies": [{"name": "main", "type": "tag"}]}):
            with self.assertRaises(ValueError):
                environments.validate(environment, bad, True)
        for key, bad in (("can_admins_bypass", True), ("protection_rules", [])):
            changed = copy.deepcopy(environment)
            changed[key] = bad
            with self.assertRaises(ValueError):
                environments.validate(changed, policy, True)


class LiveTests(unittest.TestCase):
    def test_detects_unrelated_dns_or_ses_change(self):
        before = {"records": [{"Name": "api.recruiterreply.com.", "Type": "A", "TTL": 300}],
                  "dkim": {"Status": "SUCCESS"}, "mail_from": {"BehaviorOnMxFailure": "USE_DEFAULT_VALUE"}}
        after = copy.deepcopy(before)
        after["records"].append({"Name": "recruiterreply.com.", "Type": "MX"})
        live.unchanged(before, after)
        for key in ("records", "dkim", "mail_from"):
            changed = copy.deepcopy(after)
            changed[key] = [] if key == "records" else {"changed": True}
            with self.assertRaises(ValueError):
                live.unchanged(before, changed)

    def test_sending_is_limited_to_published_and_generated_addresses(self):
        with patch.object(live, "aws", return_value={}) as aws, patch("builtins.print"):
            live.send_tests()
        self.assertEqual(aws.call_count, 3)
        recipients = [call.args[call.args.index("--destination") + 1] for call in aws.call_args_list]
        self.assertEqual(recipients[:2], ['{"ToAddresses": ["privacy@recruiterreply.com"]}',
                                      '{"ToAddresses": ["legal@recruiterreply.com"]}'])
        self.assertIn('rr400-catchall-', recipients[2])


if __name__ == "__main__":
    unittest.main()
