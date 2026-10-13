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

# Extract only AWS IAM action names from explicit authorization-denied messages.
# Never emit full error lines: they may contain ARNs, resource identifiers, or secrets.
denied_actions = set()
for line in log.splitlines():
    if not re.search(r"(?i)(accessdenied|unauthorizedoperation|not authorized to perform|access denied)", line):
        continue
    for action in re.findall(r"\b([a-z][a-z0-9-]*:[A-Z][A-Za-z0-9*]*)\b", line):
        service, operation = action.split(":", 1)
        if service in {
            "acm", "cloudfront", "ec2", "ecr", "iam", "kms", "route53",
            "s3", "secretsmanager", "ssm", "sts", "cognito-idp",
            "logs", "elasticloadbalancing", "autoscaling", "rds"
        } and re.match(r"^[A-Za-z][A-Za-z0-9*]*$", operation):
            denied_actions.add(action)
for action in sorted(denied_actions):
    print("::error::AWS action denied: " + action)
if "AWS access denied" in matches and not denied_actions:
    print("::notice::AWS denied request found, but no IAM action name was present in the denial text.")
