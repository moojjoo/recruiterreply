"""Classify Terraform errors without emitting raw Terraform logs or sensitive identifiers."""
import re
import sys

with open(sys.argv[1], encoding="utf-8", errors="replace") as handle:
    log = handle.read()

patterns = [
    ("AWS access denied", r"(?i)(accessdenied|unauthorizedoperation|not authorized to perform|access denied)"),
    ("Required Terraform variable missing", r"(?i)(no value for required variable|input variable .* is not set)"),
    ("Terraform provider configuration error", r"(?i)(provider configuration not present|invalid provider configuration|failed to configure provider)"),
    ("Terraform state/backend error", r"(?i)(failed to load state|error loading state|error acquiring the state lock|failed to get existing workspaces)"),
    ("AWS resource not found", r"(?i)(resourcenotfoundexception|nosuchbucket|no such resource)"),
    ("Terraform expression/configuration error", r"(?i)(invalid reference|unsupported argument|invalid function argument)"),
]
matches = [name for name, pattern in patterns if re.search(pattern, log)]
for name in matches or ["Unclassified Terraform plan error; inspect securely outside Actions"]:
    print("::error::Sanitized audit diagnosis: " + name)
