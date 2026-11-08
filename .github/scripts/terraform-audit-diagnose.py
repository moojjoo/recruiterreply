"""Classify Terraform errors without emitting raw Terraform logs or identifiers."""
import re
import sys

KNOWN_SERVICES = {
    "acm", "autoscaling", "cloudfront", "cloudwatch", "cognito-idp", "ec2",
    "ecr", "elasticloadbalancing", "iam", "kms", "logs", "rds", "route53",
    "s3", "secretsmanager", "ssm", "sts", "dynamodb", "budgets",
}
SERVICE_ALIASES = {
    "cloudwatch logs": "logs",
    "cognito identity provider": "cognito-idp",
    "cognito idp": "cognito-idp",
}
ACTION = r"[A-Z][A-Za-z0-9*]*"


def normalize_service(value):
    value = re.sub(r"\s+", " ", value.strip().lower())
    return SERVICE_ALIASES.get(value, value)


def extract_denied_actions(log):
    """Return only allowlisted IAM actions found in denial/403 diagnostics."""
    denied = set()
    explicit = re.compile(
        rf"(?i)\b((?:cloudwatch\s+logs|cognito(?:[-\s]+identity)?(?:[-\s]+provider|[-\s]+idp)|[a-z][a-z0-9-]*))"
        rf"\s*:\s*({ACTION})\b"
    )
    compact = re.compile(
        rf"(?i)(?:not authorized to perform|unauthorized to perform)\s*:\s*"
        rf"([a-z][a-z0-9-]*)\s*:\s*({ACTION})\b"
    )
    structured = re.compile(
        rf"(?i)(?:service|aws_service)\s*[=:]\s*[\"']?([a-z][a-z0-9-]*)[\"']?"
        rf"[^\n]*(?:operation|api|action|aws_operation)\s*[=:]\s*[\"']?({ACTION})"
    )
    action_field = re.compile(rf"(?i)\bAction\s*[=:]\s*([a-z][a-z0-9-]*)[:/]({ACTION})\b")

    for line in log.splitlines():
        if not re.search(
            r"(?i)(accessdenied|unauthorizedoperation|not authorized to perform|access denied|"
            r"operation error|statuscode\s*[=:]\s*403|status_code\s*[=:]\s*403|http(?:_status)?\s*[=:]\s*403)",
            line,
        ):
            continue
        candidates = explicit.findall(line) + compact.findall(line) + structured.findall(line)
        candidates += action_field.findall(line)
        for service, operation in candidates:
            service = normalize_service(service)
            if service in KNOWN_SERVICES and re.fullmatch(ACTION, operation):
                denied.add(f"{service}:{operation}")
    return denied


def diagnose(log):
    patterns = [
        ("AWS access denied", r"(?i)(accessdenied|unauthorizedoperation|not authorized to perform|access denied)"),
        ("Required Terraform variable missing", r"(?i)(no value for required variable|input variable .* is not set)"),
        ("Terraform provider configuration error", r"(?i)(provider configuration not present|invalid provider configuration|failed to configure provider)"),
        ("Terraform state/backend error", r"(?i)(failed to load state|error loading state|error acquiring the state lock|failed to get existing workspaces)"),
        ("AWS resource not found", r"(?i)(resourcenotfoundexception|nosuchbucket|no such resource)"),
        ("Terraform expression/configuration error", r"(?i)(invalid reference|unsupported argument|invalid function argument)"),
    ]
    matches = [name for name, pattern in patterns if re.search(pattern, log)]
    return matches or ["Unclassified Terraform plan error; inspect securely outside Actions"], extract_denied_actions(log)


def main(path):
    with open(path, encoding="utf-8", errors="replace") as handle:
        log = handle.read()
    matches, denied_actions = diagnose(log)
    for name in matches:
        print("::error::Sanitized audit diagnosis: " + name)
    for action in sorted(denied_actions):
        print("::error::AWS action denied: " + action)
    if "AWS access denied" in matches and not denied_actions:
        print("::notice::AWS denied request found, but no IAM action name was present in the denial text.")


if __name__ == "__main__":
    main(sys.argv[1])
