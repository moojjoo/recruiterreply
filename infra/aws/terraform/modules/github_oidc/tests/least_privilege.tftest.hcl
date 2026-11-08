mock_provider "aws" {
  mock_data "aws_caller_identity" {
    defaults = {
      account_id = "178522450316"
    }
  }
}

run "exact_environment_trust" {
  command = apply

  variables {
    name_prefix         = "recruiterreply"
    github_repo         = "moojjoo/recruiterreply"
    aws_account_id      = "178522450316"
    aws_region          = "us-east-1"
    github_environments = ["dev", "test", "prod"]
    frontend_bucket_names = {
      dev  = "recruiterreply-dev-frontend-178522450316"
      test = "recruiterreply-test-frontend-178522450316"
      prod = "recruiterreply-prod-frontend-4d2e1c61dac86c486324f7f490"
    }
    cloudfront_distribution_ids = {
      dev  = "E2JWU1TLDA6YRS"
      test = "E2IGR9MYMWVQFI"
      prod = "EHWW9BKSSF64L"
    }
    ec2_instance_id = "i-0dbe396e361ea6d56"
  }

  assert {
    condition = toset(jsondecode(aws_iam_role.github_actions.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:sub"]) == toset([
      "repo:moojjoo/recruiterreply:environment:dev",
      "repo:moojjoo/recruiterreply:environment:test",
      "repo:moojjoo/recruiterreply:environment:prod",
    ])
    error_message = "OIDC trust must allow only the exact approved environment subjects."
  }

  assert {
    condition     = !strcontains(aws_iam_role.github_actions.assume_role_policy, "repo:moojjoo/recruiterreply:*")
    error_message = "OIDC trust must not accept arbitrary repository subjects."
  }
}

run "least_privilege_deployment_policy" {
  command = apply

  variables {
    name_prefix         = "recruiterreply"
    github_repo         = "moojjoo/recruiterreply"
    aws_account_id      = "178522450316"
    aws_region          = "us-east-1"
    github_environments = ["dev", "test", "prod"]
    frontend_bucket_names = {
      dev  = "recruiterreply-dev-frontend-178522450316"
      test = "recruiterreply-test-frontend-178522450316"
      prod = "recruiterreply-prod-frontend-4d2e1c61dac86c486324f7f490"
    }
    cloudfront_distribution_ids = {
      dev  = "E2JWU1TLDA6YRS"
      test = "E2IGR9MYMWVQFI"
      prod = "EHWW9BKSSF64L"
    }
    ec2_instance_id = "i-0dbe396e361ea6d56"
  }

  assert {
    condition = alltrue([
      !strcontains(aws_iam_role_policy.github_actions_deploy.policy, "eks:"),
      !strcontains(aws_iam_role_policy.github_actions_deploy.policy, "secretsmanager:"),
      !strcontains(aws_iam_role_policy.github_actions_deploy.policy, "iam:PassRole"),
      !strcontains(aws_iam_role_policy.github_actions_deploy.policy, "ecr:CreateRepository"),
    ])
    error_message = "Deployment policy must not retain EKS, secret reads, PassRole, or repository-creation permissions."
  }

  assert {
    condition = alltrue([
      strcontains(aws_iam_role_policy.github_actions_deploy.policy, "recruiterreply-backend"),
      strcontains(aws_iam_role_policy.github_actions_deploy.policy, "recruiterreply-dev-frontend-178522450316"),
      strcontains(aws_iam_role_policy.github_actions_deploy.policy, "E2JWU1TLDA6YRS"),
      strcontains(aws_iam_role_policy.github_actions_deploy.policy, "i-0dbe396e361ea6d56"),
      strcontains(aws_iam_role_policy.github_actions_deploy.policy, "AWS-RunShellScript"),
    ])
    error_message = "Deployment policy must name the approved RecruiterReply resources."
  }

  assert {
    condition = alltrue([
      for statement in jsondecode(aws_iam_role_policy.github_actions_deploy.policy).Statement :
      statement.Resource == "*" ? contains(["EcrPushPull", "SsmCommandStatus", "SsmHostDiscovery"], statement.Sid) : true
    ])
    error_message = "Only AWS-required ECR auth and SSM read/discovery statements may use wildcard resources."
  }

  assert {
    condition = anytrue([
      for statement in jsondecode(aws_iam_role_policy.github_actions_deploy.policy).Statement :
      statement.Sid == "SsmCommandStatus" && statement.Resource == "*" && contains(statement.Action, "ssm:GetCommandInvocation")
    ])
    error_message = "GetCommandInvocation must use the AWS-required wildcard resource scope."
  }
}
