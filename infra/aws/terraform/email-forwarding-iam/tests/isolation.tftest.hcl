mock_provider "aws" {
  mock_data "aws_caller_identity" {
    defaults = {
      account_id = "178522450316"
    }
  }
}

run "environment_and_write_isolation" {
  command = plan

  assert {
    condition = alltrue([for name, role in aws_iam_role.email_forwarding :
      jsondecode(role.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:aud"] == "sts.amazonaws.com" &&
      jsondecode(role.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:sub"] == ["repo:moojjoo/recruiterreply:environment:terraform-email-${local.email_forwarding_environments[name]}"]
    ])
    error_message = "OIDC trust must bind the exact repo/environment and STS audience, rejecting wrong subjects."
  }

  assert {
    condition = alltrue([for name, policy in aws_iam_role_policy.email_forwarding :
      name == "Prod" || !strcontains(policy.policy, "route53:ChangeResourceRecordSets") &&
      !strcontains(policy.policy, "s3:PutObject") && !strcontains(policy.policy, "ses:SendEmail")
    ])
    error_message = "Dev, Test and Production planning roles must not mutate DNS/state or send email."
  }

  assert {
    condition = (
      strcontains(aws_iam_role_policy.email_forwarding["Prod"].policy, "route53:ChangeResourceRecordSets") &&
      !strcontains(aws_iam_role_policy.email_forwarding["Prod"].policy, "iam:") &&
      !strcontains(aws_iam_role_policy.email_forwarding["Prod"].policy, "secretsmanager:") &&
      !strcontains(aws_iam_role_policy.email_forwarding["Prod"].policy, "s3:DeleteObjectVersion")
    )
    error_message = "Apply may mutate approved DNS, but cannot administer IAM, read secrets or delete state history."
  }
}
