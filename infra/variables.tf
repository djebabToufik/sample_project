variable "region" {
  description = "AWS region of the demo"
  type        = string
  default     = "eu-central-1"
}

variable "domain" {
  description = "Public name of the demo (an A record pointing to the elastic IP)"
  type        = string
  default     = "demo.opensourceoeesoftware.com"
}

variable "github_repository" {
  description = "owner/name of the repository allowed to deploy"
  type        = string
  default     = "djebabToufik/sample_project"
}

variable "instance_type" {
  description = "EC2 type; x86_64, like the published images"
  type        = string
  default     = "t3a.small"
}

variable "demo_username" {
  description = "Shared demo account, shown on the login page"
  type        = string
  default     = "demo"
}

variable "demo_password" {
  description = "Password of the demo account (public on purpose)"
  type        = string
  default     = "oee-demo"
}

variable "budget_email" {
  description = "Who gets the monthly budget alerts"
  type        = string
  default     = "djebab.toufik@gmail.com"
}

variable "monthly_budget_usd" {
  description = "Monthly cost limit for the alerts"
  type        = number
  default     = 25
}
