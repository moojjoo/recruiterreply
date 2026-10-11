#!/usr/bin/env bash
# Read-only preflight for issue #288. No secrets or email addresses are printed.
set -euo pipefail
REGION="${AWS_REGION:-us-east-1}"
INSTANCE_ID="${INSTANCE_ID:-i-0dbe396e361ea6d56}"
command -v aws >/dev/null
command -v jq >/dev/null
echo "SES account status ($REGION)"
aws sesv2 get-account --region "$REGION" --query '{ProductionAccess:ProductionAccessEnabled,SendingEnabled:SendingEnabled}' --output json
echo "Shared EC2 instance profile"
aws ec2 describe-instances --region "$REGION" --instance-ids "$INSTANCE_ID" --query 'Reservations[].Instances[].{InstanceId:InstanceId,State:State.Name,InstanceProfile:IamInstanceProfile.Arn}' --output json
for env in dev test prod; do
  secret="recruiterreply/$env/backend-app-secrets"
  echo "=== $env: Secrets Manager metadata ==="
  aws secretsmanager describe-secret --region "$REGION" --secret-id "$secret" --query '{Name:Name,LastChangedDate:LastChangedDate}' --output json
  # Never display secret values; only presence/boolean of required configuration.
  aws secretsmanager get-secret-value --region "$REGION" --secret-id "$secret" --query SecretString --output text |
    jq -r --arg env "$env" '
      def value($k): .[$k] // (if ($k | contains(":")) then getpath($k | split(":")) else null end);
      {environment:$env,
       emailEnabledConfigured:(value("PasswordRecovery:EmailEnabled") != null),
       senderConfigured:((value("PasswordRecovery:FromEmail") // "") | tostring | length > 0),
       pepperConfigured:((value("PasswordRecovery:CodePepper") // "") | tostring | length >= 32),
       frontendUrlConfigured:((value("Frontend:BaseUrl") // "") | tostring | length > 0)}'
done
echo "Read-only check complete. Verify the effective runtime settings, sender identity, IAM and migration before enabling delivery."
