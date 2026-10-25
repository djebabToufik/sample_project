output "public_ip" {
  description = "Point the domain's A record here"
  value       = aws_eip.demo.public_ip
}

output "dns_record" {
  description = "The DNS record to create at the domain's provider"
  value       = "${var.domain}  A  ${aws_eip.demo.public_ip}"
}

output "instance_id" {
  description = "GitHub variable DEMO_INSTANCE_ID"
  value       = aws_instance.demo.id
}

output "deploy_role_arn" {
  description = "GitHub variable AWS_DEPLOY_ROLE_ARN"
  value       = aws_iam_role.deploy.arn
}
