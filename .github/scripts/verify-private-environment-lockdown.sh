#!/usr/bin/env bash
set -euo pipefail
# Read-only CloudFront check; requires cloudfront:GetDistribution.
for pair in 'dev E2JWU1TLDA6YRS false' 'test E2IGR9MYMWVQFI false' 'prod EHWW9BKSSF64L true'; do
  read -r env id expected <<< "$pair"
  actual=$(aws cloudfront get-distribution --id "$id" --query 'Distribution.DistributionConfig.Enabled' --output text)
  status=$(aws cloudfront get-distribution --id "$id" --query 'Distribution.Status' --output text)
  echo "$env: enabled=$actual status=$status"
  if [[ "${actual,,}" != "$expected" || "$status" != 'Deployed' ]]; then
    echo "ERROR: unexpected CloudFront state for $env" >&2
    exit 1
  fi
done
