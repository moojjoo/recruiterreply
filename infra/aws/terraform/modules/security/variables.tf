variable "name_prefix" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "allowed_ssh_cidrs" {
  type = list(string)
}

variable "public_ingress_cidrs" {
  type = list(string)
}
