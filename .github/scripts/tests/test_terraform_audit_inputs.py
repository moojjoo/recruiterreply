import base64
import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch


SPEC = importlib.util.spec_from_file_location(
    "audit_inputs", Path(__file__).resolve().parents[1] / "terraform-audit-inputs.py"
)
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)


class AuditInputsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.output = Path(self.temp.name) / "prepared"
        self.package_paths = {env: Path(self.temp.name) / f"{env}.zip" for env in ("dev", "test")}
        self.payload = b"opaque-reviewed-zip-never-executed"
        self.digest = base64.b64encode(hashlib.sha256(self.payload).digest()).decode()
        self.manifest = {
            "variables": {"enable_private_environment_identity": True},
            "packages": {
                env: {"function_name": f"recruiterreply-{env}-private-edge", "sha256_base64": self.digest}
                for env in ("dev", "test")
            },
        }
        self.metadata = Mock(return_value={"sha": self.digest, "url": "https://packages.s3.amazonaws.com/code?signature=private"})
        self.download = Mock(return_value=self.payload)

    def prepare(self):
        return AUDIT.prepare(self.manifest, self.output, self.metadata, self.download, self.package_paths)

    def test_verified_packages_produce_private_local_inputs_without_urls(self):
        destination = self.prepare()
        variables = json.loads(destination.read_text())
        self.assertTrue(variables["enable_private_environment_identity"])
        self.assertEqual(set(variables["private_edge_package_files"]), {"dev", "test"})
        for path in variables["private_edge_package_files"].values():
            self.assertEqual(Path(path).read_bytes(), self.payload)
            self.assertEqual(Path(path).stat().st_mode & 0o777, 0o600)
        self.assertEqual(self.output.stat().st_mode & 0o777, 0o700)
        self.assertEqual(destination.stat().st_mode & 0o777, 0o600)
        self.assertNotIn("signature", destination.read_text())

    def test_changed_deployed_hash_stops_before_download(self):
        self.metadata.return_value["sha"] = "changed"
        with self.assertRaises(ValueError):
            self.prepare()
        self.download.assert_not_called()
        self.assertFalse((self.output / "global.tfvars.json").exists())

    def test_tampered_bytes_do_not_produce_terraform_inputs(self):
        self.download.return_value = b"tampered"
        with self.assertRaises(ValueError):
            self.prepare()
        self.assertFalse((self.output / "global.tfvars.json").exists())
        self.assertFalse((self.output / "dev.zip").exists())

    def test_unapproved_urls_and_redirects_are_rejected(self):
        for url in ("http://packages.s3.amazonaws.com/code", "https://amazonaws.com.evil.example/code",
                    "http://169.254.169.254/", "https://user@packages.s3.amazonaws.com/code",
                    "https://packages.s3.amazonaws.com:8443/code"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                AUDIT.validate_url(url)
        redirects = AUDIT.AwsRedirects()
        with self.assertRaises(ValueError):
            redirects.redirect_request(None, None, 302, "Found", {}, "https://evil.example/code")

    def test_manifest_cannot_select_an_unrelated_function_or_output_path(self):
        self.manifest["packages"]["dev"]["function_name"] = "unrelated-production-function"
        with self.assertRaises(ValueError):
            self.prepare()
        self.metadata.assert_not_called()
        self.assertFalse(self.output.exists())

    def test_existing_output_is_never_overwritten(self):
        self.output.mkdir()
        marker = self.output / "keep"
        marker.write_text("existing")
        with self.assertRaises(FileExistsError):
            self.prepare()
        self.metadata.assert_not_called()
        self.assertEqual(marker.read_text(), "existing")

    def test_existing_package_filename_is_never_overwritten(self):
        self.package_paths["dev"].write_text("existing")
        with self.assertRaises(FileExistsError):
            self.prepare()
        self.metadata.assert_not_called()
        self.assertEqual(self.package_paths["dev"].read_text(), "existing")
        self.assertFalse(self.output.exists())

    def test_cleanup_removes_only_its_own_symlinks_even_after_target_removal(self):
        self.package_paths["dev"].symlink_to(self.output / "dev.zip")
        self.package_paths["test"].write_text("keep-existing-file")
        AUDIT.cleanup(self.output, self.package_paths)
        self.assertFalse(self.package_paths["dev"].is_symlink())
        self.assertEqual(self.package_paths["test"].read_text(), "keep-existing-file")
        self.package_paths["dev"].symlink_to(Path(self.temp.name) / "unrelated.zip")
        AUDIT.cleanup(self.output, self.package_paths)
        self.assertTrue(self.package_paths["dev"].is_symlink())

    def test_errors_do_not_disclose_signed_urls(self):
        manifest = Path(self.temp.name) / "manifest.json"
        manifest.write_text(json.dumps(self.manifest))
        stderr = io.StringIO()
        args = ["audit", "--manifest", str(manifest), "--output", str(self.output)]
        with patch("sys.argv", args), patch.object(AUDIT, "prepare", side_effect=RuntimeError("private-signed-url")), contextlib.redirect_stderr(stderr):
            self.assertEqual(AUDIT.main(), 1)
        self.assertNotIn("private-signed-url", stderr.getvalue())


if __name__ == "__main__":
    unittest.main()
