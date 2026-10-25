# One EC2 instance runs the whole stack (docker compose) behind Caddy. No SSH: port 22 stays
# closed and commands reach the server through AWS Systems Manager.

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
  filter {
    name   = "default-for-az"
    values = ["true"]
  }
}

# Latest Amazon Linux 2023 for x86_64 (the images are built for amd64).
data "aws_ssm_parameter" "al2023" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

resource "aws_security_group" "demo" {
  name        = "oee-demo"
  description = "Public demo: HTTP (certificate check, redirect) and HTTPS only"
  vpc_id      = data.aws_vpc.default.id
}

resource "aws_vpc_security_group_ingress_rule" "web" {
  for_each = {
    http-ipv4  = { port = 80, ip_protocol = "tcp", cidr = "0.0.0.0/0" }
    https-ipv4 = { port = 443, ip_protocol = "tcp", cidr = "0.0.0.0/0" }
    http3-ipv4 = { port = 443, ip_protocol = "udp", cidr = "0.0.0.0/0" }
  }
  security_group_id = aws_security_group.demo.id
  from_port         = each.value.port
  to_port           = each.value.port
  ip_protocol       = each.value.ip_protocol
  cidr_ipv4         = each.value.cidr
  description       = each.key
}

resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.demo.id
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
  description       = "Images, packages, certificates, Systems Manager"
}

resource "aws_instance" "demo" {
  ami                    = data.aws_ssm_parameter.al2023.value
  instance_type          = var.instance_type
  subnet_id              = sort(data.aws_subnets.default.ids)[0]
  vpc_security_group_ids = [aws_security_group.demo.id]
  iam_instance_profile   = aws_iam_instance_profile.server.name

  # Prepares the server once (Docker, secrets, nightly reset); deploys come from the workflow.
  user_data = templatefile("${path.module}/user-data.sh.tftpl", {
    domain          = var.domain
    demo_username   = var.demo_username
    demo_password   = var.demo_password
    compose_version = "5.6.1"
  })

  # Burst credits only: a busy CPU slows down instead of adding costs.
  credit_specification {
    cpu_credits = "standard"
  }

  metadata_options {
    http_tokens = "required" # IMDSv2 only
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = 20
    encrypted   = true
  }

  tags = {
    Name = "oee-demo"
  }

  lifecycle {
    # A newer AMI or a changed first-boot script must not replace the running server.
    ignore_changes = [ami, user_data]
  }
}

resource "aws_eip" "demo" {
  domain   = "vpc"
  instance = aws_instance.demo.id

  tags = {
    Name = "oee-demo"
  }
}
