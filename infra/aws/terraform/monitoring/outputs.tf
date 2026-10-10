output "sns_topic_arn" {
  value       = aws_sns_topic.alerts.arn
  description = "Alert topic; recipient must confirm email subscription."
}

output "alarm_names" {
  value = [
    aws_cloudwatch_metric_alarm.status.alarm_name,
    aws_cloudwatch_metric_alarm.cpu.alarm_name,
    aws_cloudwatch_metric_alarm.memory.alarm_name,
    aws_cloudwatch_metric_alarm.disk.alarm_name
  ]
}
