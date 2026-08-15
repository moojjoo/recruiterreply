locals {
  common_tags = merge(
    {
      Application = var.app_name
      Environment = "global"
      ManagedBy   = "terraform"
    },
    var.tags
  )
}
