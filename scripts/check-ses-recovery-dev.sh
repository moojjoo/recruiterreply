#!/usr/bin/env bash
# Read-only Dev preflight. Requires aws CLI credentials and jq. Never prints secret values.
set -euo pipefail
REGION="${AWS_REGION:-us-east-1}"
SENDER="${SES_FROM_EMAIL:-}"
if [[ -z "$SENDER" ]]; then
  echo "BLOCKED: set SES_FROM_EMAIL to the intended verified sender address"; exit 2
fi
echo "Checking SES v2 in region $REGION (read-only)"
aws sts get-caller-identity --query '{Account:Account,Arn:Arn}' --output json
identity=$(aws sesv2 get-email-identity --region "$REGION" --email-identity "$SENDER" --output json) || {
  echo "BLOCKED: sender identity missing or permission denied in SES region"; exit 2;
}
echo "$identity" | jq '{VerifiedForSendingStatus,VerificationStatus:.VerificationStatus,DKIMStatus:.DkimAttributes.Status}'
verified=$(echo "$identity" | jq -r '.VerifiedForSendingStatus // false')
if [[ "$verified" != "true" ]]; then echo "BLOCKED: sender identity not verified for sending"; exit 2; fi
account=$(aws sesv2 get-account --region "$REGION" --output json) || {
  echo "BLOCKED: cannot inspect SES account sending status"; exit 2;
}
echo "$account" | jq '{ProductionAccessEnabled, SendingEnabled, EnforcementStatus, SendQuota}'
production=$(echo "$account" | jq -r '.ProductionAccessEnabled // false')
if [[ "$production" != "true" ]]; then
  echo "SES SANDBOX: recipient address must also be verified in this SES region."
fi
echo "NEXT: verify EC2 instance-role ses:SendEmail on sender identity; confirm Dev Secrets Manager config, migration and rollback plan."
echo "No email sent. No IAM, secrets or AWS resources changed."
