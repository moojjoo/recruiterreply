locals {
  tags = merge({ Application = var.app_name, ManagedBy = "terraform", Component = "observability" }, var.tags)
}

resource "aws_cloudwatch_log_group" "backend" {
  for_each          = var.environments
  name              = "/recruiterreply/${each.key}/backend"
  retention_in_days = each.value
  skip_destroy      = true
  tags              = merge(local.tags, { Environment = each.key })
}

resource "aws_cloudwatch_log_metric_filter" "unhandled_errors" {
  for_each       = var.environments
  name           = "recruiterreply-${each.key}-unhandled-errors"
  log_group_name = aws_cloudwatch_log_group.backend[each.key].name
  pattern        = "{ $.EventName = \"UnhandledRequestException\" }"

  metric_transformation {
    name      = "UnhandledRequestException"
    namespace = "RecruiterReply/${each.key}"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "unhandled_errors" {
  for_each            = var.environments
  alarm_name          = "recruiterreply-${each.key}-unhandled-errors"
  alarm_description   = "Sustained unhandled application exceptions in ${each.key}."
  namespace           = "RecruiterReply/${each.key}"
  metric_name         = aws_cloudwatch_log_metric_filter.unhandled_errors[each.key].metric_transformation[0].name
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  datapoints_to_alarm = 1
  threshold           = each.key == "prod" ? 5 : 10
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.alert_topic_arn == null ? [] : [var.alert_topic_arn]
  tags                = merge(local.tags, { Environment = each.key })
}
