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
known_services = {
    "acm", "cloudfront", "ec2", "ecr", "iam", "kms", "route53",
    "s3", "secretsmanager", "ssm", "sts", "cognito-idp",
    "logs", "elasticloadbalancing", "autoscaling", "rds",
}
service_aliases = {
    "cloudwatch logs": "logs",
    "cognito identity provider": "cognito-idp",
    "cognito idp": "cognito-idp",
}
denied_actions = set()
action_pattern = re.compile(
    r"(?i)\b((?:cloudwatch\s+logs|cognito(?:[-\s]+identity)?(?:[-\s]+provider|[-\s]+idp)|[a-z][a-z0-9-]*))"
    r"\s*:\s*([A-Za-z][A-Za-z0-9*]*)\b"
)
compact_action_pattern = re.compile(
    r"(?i)(?:not authorized to perform|unauthorized to perform)\s*:\s*"
    r"([a-z][a-z0-9-]*)\s*:\s*([A-Za-z][A-Za-z0-9*]*)\b"
)
for line in log.splitlines():
    if not re.search(r"(?i)(accessdenied|unauthorizedoperation|not authorized to perform|access denied|operation error|statuscode\s*:\s*403)", line):
        continue
    for service, operation in action_pattern.findall(line):
        normalized_service = service_aliases.get(re.sub(r"\s+", " ", service.strip().lower()), service.strip().lower())
        if normalized_service in known_services:
            denied_actions.add(f"{normalized_service}:{operation}")
    for service, operation in compact_action_pattern.findall(line):
        if service.lower() in known_services:
            denied_actions.add(f"{service.lower()}:{operation}")
for action in sorted(denied_actions):
    print("::error::AWS action denied: " + action)
if "AWS access denied" in matches and not denied_actions:
    print("::notice::AWS denied request found, but no IAM action name was present in the denial text.")
