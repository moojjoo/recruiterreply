'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const workflows = path.resolve(__dirname, '../../workflows');
const audit = fs.readFileSync(path.join(workflows, 'terraform-readonly-audit.yml'), 'utf8');
const promotion = fs.readFileSync(path.join(workflows, 'promote-test.yml'), 'utf8');
const auditPolicy = fs.readFileSync(
  path.resolve(__dirname, '../../../infra/aws/terraform/global/terraform_audit_role.tf'),
  'utf8',
);
const rr709PlanSummary = fs.readFileSync(
  path.resolve(__dirname, '../rr709-dev-plan-summary.cjs'),
  'utf8',
);
const frontendOutputs = fs.readFileSync(
  path.resolve(__dirname, '../../../infra/aws/terraform/modules/frontend/outputs.tf'),
  'utf8',
);
const privateEnvironmentIdentity = fs.readFileSync(
  path.resolve(__dirname, '../../../infra/aws/terraform/global/private_environment_identity.tf'),
  'utf8',
);

test('Terraform audit uses Node 24 actions and a deliberate runner pin', () => {
  assert.match(audit, /runs-on:\s*ubuntu-24\.04/);
  assert.match(audit, /hashicorp\/setup-terraform@[0-9a-f]{40} # v4/);
  assert.match(audit, /aws-actions\/configure-aws-credentials@[0-9a-f]{40} # v6/);
  assert.doesNotMatch(audit, /hashicorp\/setup-terraform@v3/);
  assert.doesNotMatch(audit, /aws-actions\/configure-aws-credentials@v4/);
});

test('Terraform audit preserves native detailed exit codes in both jobs', () => {
  const setupSteps = audit.match(
    /- uses: hashicorp\/setup-terraform@[0-9a-f]{40} # v4\n\s+with:\n\s+terraform_version: '1\.14\.3'\n\s+terraform_wrapper: false/g,
  ) || [];
  assert.equal(setupSteps.length, 2);

  for (const exitCode of [0, 1, 2]) {
    const result = spawnSync(
      'bash',
      ['-c', 'terraform() { return "$1"; }; set +e; terraform "$NATIVE_EXIT"; code=$?; printf "%s" "$code"'],
      {encoding: 'utf8', env: {...process.env, NATIVE_EXIT: String(exitCode)}},
    );
    assert.equal(result.status, 0);
    assert.equal(result.stdout, String(exitCode));
  }
});

test('RR-709 proceeds to the exact-three-create gate only for exit code 2', () => {
  assert.match(audit, /if \[ "\$plan_code" -ne 2 \]; then[\s\S]*exit 1[\s\S]*terraform show -json "\$PLAN_FILE" \| node/);

  for (const exitCode of [0, 1, 2]) {
    const result = spawnSync(
      'bash',
      ['-c', 'terraform() { return "$1"; }; set +e; terraform "$NATIVE_EXIT"; code=$?; set -e; if [ "$code" -ne 2 ]; then exit 9; fi; printf gate'],
      {encoding: 'utf8', env: {...process.env, NATIVE_EXIT: String(exitCode)}},
    );
    if (exitCode === 2) {
      assert.equal(result.status, 0);
      assert.equal(result.stdout, 'gate');
    } else {
      assert.equal(result.status, 9);
      assert.equal(result.stdout, '');
    }
  }
});

test('read-only OIDC and no-apply safeguards remain intact', () => {
  assert.match(audit, /id-token:\s*write/);
  assert.match(audit, /environment:\s*terraform-readonly-audit/);
  assert.match(audit, /terraform plan -refresh-only[^\n]*-lock=false[^\n]*-detailed-exitcode/);
  assert.match(audit, /terraform plan -input=false -lock=false -detailed-exitcode/);
  assert.match(audit, /TF_LOG=TRACE terraform plan -refresh-only/);
  assert.match(audit, /TF_LOG=TRACE terraform plan -input=false/);
  assert.doesNotMatch(audit, /terraform\s+apply/);
  assert.doesNotMatch(audit, /-auto-approve/);
  assert.doesNotMatch(audit, /upload-artifact/);
});

test('RR-709 audit mode is manual, immutable and create-only', () => {
  assert.match(audit, /^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(audit, /^\s+(?:push|pull_request):/m);
  assert.match(audit, /rr709-dev-native-login:/);
  assert.match(audit, /test "\$GITHUB_REF" = "refs\/heads\/main"/);
  assert.match(audit, /\[\[ "\$EXPECTED_SHA" =~ \^\[0-9a-f\]\{40\}\$ \]\]/);
  assert.match(audit, /test "\$GITHUB_SHA" = "\$EXPECTED_SHA"/);
  assert.match(audit, /test "\$\(git rev-parse HEAD\)" = "\$EXPECTED_SHA"/);
  assert.match(audit, /DEV_NATIVE_APP_COGNITO_CERTIFICATE_ARN/);
  assert.match(audit, /-lock=false/);
  assert.doesNotMatch(audit, /-target=/);
  assert.match(audit, /rr709-dev-plan-summary\.cjs/);
  assert.match(rr709PlanSummary, /module\.private_environment_identity\["dev"\]\.aws_cognito_user_pool_domain\.application_managed\[0\]/);
  assert.match(rr709PlanSummary, /aws_route53_record\.application_managed_login\["dev"\]/);
  assert.match(rr709PlanSummary, /module\.cognito_bff\["dev"\]\.aws_cognito_managed_login_branding\.bff\[0\]/);

  const trust = audit.indexOf('- name: Verify immutable trusted dispatch');
  const oidc = audit.lastIndexOf('- name: Authenticate read-only AWS audit role');
  assert.ok(trust >= 0 && oidc > trust, 'trust validation must precede OIDC credentials');
});

test('RR-709 managed-login checks use Terraform-supported set equality', () => {
  assert.doesNotMatch(privateEnvironmentIdentity, /\bsetequals\s*\(/);
  assert.match(
    privateEnvironmentIdentity,
    /toset\(keys\(var\.private_environment_application_managed_login_domains\)\)\s*==\s*toset\(keys\(var\.private_environment_application_managed_login_certificate_arns\)\)/,
  );
  assert.match(
    privateEnvironmentIdentity,
    /toset\(keys\(var\.private_environment_application_managed_login_domains\)\)\s*==\s*var\.cognito_bff_managed_login_branding_environments/,
  );
});

test('Test promotion no longer invokes the Node 20 AWS action', () => {
  assert.match(promotion, /aws-actions\/configure-aws-credentials@[0-9a-f]{40} # v6/);
  assert.doesNotMatch(promotion, /aws-actions\/configure-aws-credentials@v4/);
});

test('Terraform audit policy grants only the required metadata reads', () => {
  assert.match(auditPolicy, /"cognito-idp:DescribeResourceServer"/);
  assert.match(auditPolicy, /sid\s*=\s*"ReadManagedCertificateTags"[\s\S]*"acm:ListTagsForCertificate"[\s\S]*module\.frontend\.certificate_arns/);
  assert.match(auditPolicy, /sid\s*=\s*"ReadManagedBffSessionKeyPolicies"[\s\S]*"kms:GetKeyPolicy"[\s\S]*"kms:GetKeyRotationStatus"[\s\S]*"kms:ListResourceTags"[\s\S]*data\.aws_kms_alias\.terraform_audit_bff_session/);
  assert.match(auditPolicy, /sid\s*=\s*"ListRegionalCloudWatchLogGroups"[\s\S]*"logs:DescribeLogGroups"[\s\S]*aws:RequestedRegion/);
  assert.match(auditPolicy, /sid\s*=\s*"ReadRegionalCloudWatchMetricFilters"[\s\S]*"logs:DescribeMetricFilters"[\s\S]*log-group:\*/);
  assert.match(frontendOutputs, /output "certificate_arns"/);
});

test('Terraform audit policy does not gain write or sensitive-data access', () => {
  assert.doesNotMatch(auditPolicy, /logs:(?:Put|Create|Delete)/);
  assert.doesNotMatch(auditPolicy, /kms:(?:Decrypt|Encrypt|GenerateDataKey)/);
  assert.doesNotMatch(auditPolicy, /cognito-idp:(?:Admin|ListUsers)/);
  assert.doesNotMatch(auditPolicy, /acm:(?:Import|Request|Delete)/);
});
