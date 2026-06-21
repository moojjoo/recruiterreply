variable "name_prefix" {
  type = string
}

variable "subnet_id" {
  type = string
}

variable "ec2_security_group_id" {
  type = string
}

variable "instance_type" {
  type = string
}

variable "ami_id" {
  type = string
}

variable "key_name" {
  type    = string
  default = null
}

variable "root_volume_size" {
  type = number
}

variable "user_data" {
  type = string
}

variable "enable_public_ip" {
  type    = bool
  default = true
}
