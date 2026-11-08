"""Static regression tests for the shared-EC2 deployment safety contract."""
import pathlib
import re
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
PROMOTE = (ROOT / ".github/workflows/promote.yml").read_text()
COMPOSE = (ROOT / "infra/aws/docker-compose.multi-env.yml").read_text()
HELPER = (ROOT / "scripts/push_ec2_env.sh").read_text()
PREFLIGHT = (ROOT / "scripts/recruiterreply-host-preflight.sh").read_text()
RUNBOOK = (ROOT / "docs/SHARED_EC2_OPERATIONS_RUNBOOK.md").read_text()


class SharedEc2SafetyTests(unittest.TestCase):
    def test_all_environment_service_and_database_boundaries_are_explicit(self):
        for environment, port in (("dev", "5001"), ("test", "5002"), ("prod", "5003")):
            self.assertIn(f"container_name: recruiterreply-backend-{environment}", COMPOSE)
            self.assertIn(f'127.0.0.1:{port}:5000', COMPOSE)
            self.assertIn(f"Database=recruiterreply_{environment}", COMPOSE)
            self.assertIn(f"awslogs-stream: backend-{environment}", COMPOSE)

    def test_promotion_preflight_precedes_pull_and_targets_one_backend(self):
        self.assertIn("recruiterreply-host-preflight.sh", PROMOTE)
        self.assertLess(PROMOTE.index("recruiterreply-host-preflight.sh"), PROMOTE.index("docker compose --env-file"))
        self.assertIn("pull \\($backend_service)", PROMOTE)
        self.assertIn("up -d \\($backend_service)", PROMOTE)
        self.assertNotIn("docker compose down", PROMOTE)
        self.assertNotIn("docker image prune -f", PROMOTE)

    def test_every_compose_mutation_path_uses_the_shared_lock(self):
        lock = "/tmp/recruiterreply-docker-deploy.lock"
        self.assertIn(lock, PROMOTE)
        self.assertIn(lock, HELPER)
        self.assertLess(HELPER.index("flock -w 600"), HELPER.index("docker compose"))

    def test_preflight_is_fail_closed_and_environment_scoped(self):
        self.assertIn("dev|test|prod", PREFLIGHT)
        self.assertIn("used_percent < MAX_DISK_USED_PERCENT", PREFLIGHT)
        self.assertIn("available_memory_kb >= MIN_AVAILABLE_MEMORY_MB * 1024", PREFLIGHT)
        self.assertIn("load_per_cpu", PREFLIGHT)
        self.assertIn("config --services", PREFLIGHT)
        self.assertIn("grep -Fxq \"$TARGET_SERVICE\"", PREFLIGHT)
        self.assertIn("grep -Fxq postgres", PREFLIGHT)

    def test_runbook_defines_observability_and_split_decision_thresholds(self):
        for term in ("CPU", "memory", "disk", "EBS", "database", "latency", "restart", "lock"):
            self.assertRegex(RUNBOOK, re.compile(term, re.IGNORECASE))
        for threshold in ("80%", "85%", "90%", "15 minutes"):
            self.assertIn(threshold, RUNBOOK)
        self.assertIn("must not automatically provision", RUNBOOK)


if __name__ == "__main__":
    unittest.main()
