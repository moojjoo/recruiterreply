"""Unit tests for the image retention selection algorithm (no Docker required)."""
import importlib.util
import pathlib
import subprocess
import sys
import unittest
from unittest import mock

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "recruiterreply-image-prune.py"
spec = importlib.util.spec_from_file_location("image_prune", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class RetentionTests(unittest.TestCase):
    def image(self, n, tags=None):
        return {"Id": f"sha256:{n:064x}", "Created": f"2026-10-{n:02d}T00:00:00Z",
                "RepoTags": tags if tags is not None else [f"example/backend:{n}"]}

    def test_retains_ten_and_protects_active(self):
        images = [self.image(n) for n in range(1, 16)]
        active = {images[0]["Id"], images[1]["Id"]}
        backend, pinned, rollback, candidates = module.plan(images, active, "example/backend", 10)
        self.assertEqual((len(backend), len(pinned), len(rollback), len(candidates)), (15, 2, 8, 5))
        self.assertFalse(active.intersection(i["Id"] for i in candidates))

    def test_over_ten_protected_keeps_all(self):
        images = [self.image(n) for n in range(1, 16)]
        _, pinned, rollback, candidates = module.plan(images, {i["Id"] for i in images[:12]}, "example/backend", 10)
        self.assertEqual((len(pinned), len(rollback), len(candidates)), (12, 0, 3))

    def test_only_target_repository(self):
        images = [self.image(1, ["postgres:16"]), self.image(2, ["example/backend:2", "another:latest"])]
        backend, _, _, candidates = module.plan(images, set(), "example/backend", 10)
        self.assertEqual(len(backend), 1)
        self.assertEqual(len(candidates), 0)

    def test_stopped_container_reference_is_protected(self):
        images = [self.image(n) for n in range(1, 12)]
        stopped = {images[0]["Id"]}
        _, pinned, _, candidates = module.plan(images, stopped, "example/backend", 10)
        self.assertEqual([i["Id"] for i in pinned], [images[0]["Id"]])
        self.assertNotIn(images[0]["Id"], {i["Id"] for i in candidates})

    def test_target_tags_preserve_unrelated_tag(self):
        image = self.image(1, ["example/backend:old", "postgres:preserve"])
        self.assertEqual(module.target_tags(image, "example/backend"), ["example/backend:old"])

    @mock.patch.object(module, "referenced_images", return_value={"sha256:1"})
    def test_new_reference_skips_removal(self, _references):
        candidate = {"Id": "sha256:1", "RepoTags": ["example/backend:old"]}
        removed, skipped, failures = module.remove_candidates([candidate], "example/backend")
        self.assertEqual(removed, [])
        self.assertEqual(skipped[0]["reason"], "newly_referenced")
        self.assertEqual(failures, [])

    @mock.patch.object(module, "docker")
    @mock.patch.object(module, "referenced_images", return_value=set())
    @mock.patch.object(module.subprocess, "run")
    def test_partial_failure_returns_structured_failure(self, run, _references, docker):
        candidate = {"Id": "sha256:1", "RepoTags": ["example/backend:old"]}
        docker.return_value = '[{"Id":"sha256:1","RepoTags":["example/backend:old"]}]'
        run.return_value = subprocess.CompletedProcess([], 1, "", "docker failed")
        _, _, failures = module.remove_candidates([candidate], "example/backend")
        self.assertEqual(failures[0]["error"], "docker failed")

    @mock.patch.object(module, "docker", side_effect=subprocess.CalledProcessError(1, ["docker"]))
    def test_unexpected_docker_failure_propagates(self, _docker):
        with self.assertRaises(subprocess.CalledProcessError):
            module.inspect_images()

    @mock.patch.object(module, "disk_metrics", return_value={"root_used_percent": 25})
    @mock.patch.object(module, "referenced_images", return_value=set())
    @mock.patch.object(module, "inspect_images", return_value=[])
    @mock.patch.object(module.fcntl, "flock")
    @mock.patch("builtins.open", mock.mock_open())
    def test_dry_run_never_removes_images(self, _flock, _images, _references, _metrics):
        with mock.patch.object(sys, "argv", [str(SCRIPT)]), \
             mock.patch.object(module, "remove_candidates") as remove:
            self.assertEqual(module.main(), 0)
            remove.assert_not_called()

    @mock.patch.object(module.fcntl, "flock", side_effect=BlockingIOError)
    @mock.patch("builtins.open", mock.mock_open())
    def test_busy_shared_lock_fails_closed(self, _flock):
        with mock.patch.object(sys, "argv", [str(SCRIPT)]):
            self.assertEqual(module.main(), 2)

    @mock.patch.object(module, "docker", side_effect=subprocess.CalledProcessError(1, ["docker"]))
    @mock.patch.object(module, "referenced_images", return_value=set())
    def test_missing_image_is_skipped(self, _references, _docker):
        candidate = {"Id": "sha256:gone", "RepoTags": ["example/backend:old"]}
        _, skipped, failures = module.remove_candidates([candidate], "example/backend")
        self.assertEqual(skipped[0]["reason"], "missing")
        self.assertEqual(failures, [])

    def test_workflow_preview_is_locked_and_post_health_check(self):
        root = SCRIPT.parents[1]
        workflow = (root / ".github/workflows/promote.yml").read_text()
        helper = (root / "scripts/push_ec2_env.sh").read_text()
        lock = "/tmp/recruiterreply-docker-deploy.lock"
        self.assertIn(lock, workflow)
        self.assertIn(lock, helper)
        self.assertNotIn("docker image prune -f", workflow)
        self.assertLess(workflow.index("Backend health check failed"),
                        workflow.index("- name: Preview backend image retention"))
        self.assertIn('grep -q \'^SUMMARY .*"mode": "preview"\'', workflow)
        self.assertEqual(workflow.count("recruiterreply-image-prune --repo"), 1)
        self.assertNotIn("recruiterreply-image-prune --apply", workflow)


if __name__ == "__main__":
    unittest.main()
