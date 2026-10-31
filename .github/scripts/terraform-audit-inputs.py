"""Prepare private audit-only inputs; never execute or extract downloaded ZIPs."""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import urllib.parse
import urllib.request


MAX_PACKAGE_BYTES = 50 * 1024 * 1024
# Preserve the reviewed Terraform filename inputs; runner-specific paths would
# otherwise cause synthetic Lambda updates and downstream CloudFront changes.
PACKAGE_PATHS = {
    "dev": Path("/tmp/recruiterreply-edge-dev-356-v2.zip"),
    "test": Path("/tmp/recruiterreply-test-edge.zip"),
}


def validate_url(url):
    parsed = urllib.parse.urlsplit(url)
    if (parsed.scheme != "https" or parsed.username or parsed.password
            or parsed.port not in (None, 443)
            or not (parsed.hostname or "").endswith(".amazonaws.com")):
        raise ValueError("Unapproved package URL")


class AwsRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        validate_url(newurl)
        return super().redirect_request(request, fp, code, msg, headers, newurl)


def download(url):
    validate_url(url)
    opener = urllib.request.build_opener(AwsRedirects())
    with opener.open(url, timeout=30) as response:
        data = response.read(MAX_PACKAGE_BYTES + 1)
    if len(data) > MAX_PACKAGE_BYTES:
        raise ValueError("Oversized package")
    return data


def describe(function_name):
    result = subprocess.run(
        ["aws", "lambda", "get-function", "--function-name", function_name,
         "--query", "{sha:Configuration.CodeSha256,url:Code.Location}", "--output", "json"],
        capture_output=True, text=True, check=True, timeout=30,
    )
    return json.loads(result.stdout)


def prepare(manifest, output, get_metadata=describe, get_bytes=download, package_paths=None):
    if set(manifest) != {"variables", "packages"} or set(manifest["packages"]) != {"dev", "test"}:
        raise ValueError("Invalid audit manifest")
    variables = dict(manifest["variables"])
    if "private_edge_package_files" in variables:
        raise ValueError("Package paths must be generated locally")
    # Fail before fetching anything if the reviewed package allowlist is malformed.
    for env, package in manifest["packages"].items():
        if (set(package) != {"function_name", "sha256_base64"}
                or package["function_name"] != f"recruiterreply-{env}-private-edge"
                or len(base64.b64decode(package["sha256_base64"], validate=True)) != 32):
            raise ValueError("Invalid package allowlist")
    package_paths = PACKAGE_PATHS if package_paths is None else package_paths
    if any(path.exists() or path.is_symlink() for path in package_paths.values()):
        raise FileExistsError("Audit package filename already exists")
    output = Path(output).resolve()
    output.mkdir(mode=0o700, parents=False, exist_ok=False)
    paths = {}
    for env, package in manifest["packages"].items():
        metadata = get_metadata(package["function_name"])
        if metadata["sha"] != package["sha256_base64"]:
            raise ValueError("Deployed package differs from reviewed checksum")
        validate_url(metadata["url"])
        data = get_bytes(metadata["url"])
        actual = base64.b64encode(hashlib.sha256(data).digest()).decode()
        if len(data) > MAX_PACKAGE_BYTES or actual != package["sha256_base64"]:
            raise ValueError("Package integrity check failed")
        path = output / f"{env}.zip"
        with path.open("xb") as handle:
            path.chmod(0o600)
            handle.write(data)
        package_paths[env].symlink_to(path)
        paths[env] = str(package_paths[env])
    variables["private_edge_package_files"] = paths
    destination = output / "global.tfvars.json"
    with destination.open("x") as handle:
        destination.chmod(0o600)
        json.dump(variables, handle)
    return destination


def cleanup(output, package_paths=None):
    output = Path(output).resolve()
    package_paths = PACKAGE_PATHS if package_paths is None else package_paths
    for env, path in package_paths.items():
        if path.is_symlink() and path.readlink() == output / f"{env}.zip":
            path.unlink()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--cleanup", action="store_true")
    args = parser.parse_args()
    try:
        if args.cleanup:
            cleanup(args.output)
            return 0
        prepare(json.loads(Path(args.manifest).read_text()), args.output)
    except Exception:
        # AWS errors may include signed download URLs. Never echo exceptions.
        print("::error::Audit input preparation failed; check reviewed metadata, package checksums and read permissions.", file=sys.stderr)
        return 1
    print("Global audit inputs prepared; Dev/Test edge ZIP checksums verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
