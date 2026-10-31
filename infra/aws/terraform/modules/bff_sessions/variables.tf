variable "app_name" {
  type = string
}

variable "environments" {
  type = set(string)
}

variable "tags" {
  type    = map(string)
  default = {}
}
