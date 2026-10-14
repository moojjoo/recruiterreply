"""Unit tests for the image retention selection algorithm (no Docker required)."""
import importlib.util
import pathlib
import unittest

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


if __name__ == "__main__":
    unittest.main()
