terraform {
  required_version = ">= 1.0"
  
  backend "s3" {
    bucket = "terraform-state-insight-intelligence-webphone"
    key    = "simple-terraform.tfstate"
    region = "us-west-2"
    encrypt = true
  }
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]
  
  filter {
    name   = "name"
    values = ["al2023-ami-*-arm64"]
  }
  
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# VPC - reuse existing
data "aws_vpc" "main" {
  id = "vpc-034f1e20f11b4ed11"
}

data "aws_subnets" "public" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.main.id]
  }
  
  filter {
    name   = "tag:Type"
    values = ["Public"]
  }
}

# Security Groups
resource "aws_security_group" "simple_app" {
  name_prefix = "webphone-simple"
  vpc_id      = data.aws_vpc.main.id
  description = "Security group for simple webphone app"

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  ingress {
    from_port   = 3001
    to_port     = 3001
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}

# ECR Repositories (reuse existing)
data "aws_ecr_repository" "backend" {
  name = "webphone/backend"
}

data "aws_ecr_repository" "frontend" {
  name = "webphone/frontend"
}

# IAM Role (reuse existing)
data "aws_iam_role" "instance_role" {
  name = "webphone-instance-role"
}

data "aws_iam_instance_profile" "instance_profile" {
  name = "webphone-instance-profile"
}

# Single EC2 Instance
resource "aws_instance" "webphone_app" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = "t4g.medium"  # Slightly bigger for single instance
  key_name              = "webphone-debug"
  vpc_security_group_ids = [aws_security_group.simple_app.id]
  subnet_id             = tolist(data.aws_subnets.public.ids)[0]
  iam_instance_profile  = data.aws_iam_instance_profile.instance_profile.name
  
  user_data = base64encode(templatefile("${path.module}/simple-user-data.sh", {
    backend_repo_url       = data.aws_ecr_repository.backend.repository_url
    frontend_repo_url      = data.aws_ecr_repository.frontend.repository_url
    aws_region            = var.aws_region
    twilio_account_sid    = var.twilio_account_sid
    twilio_auth_token     = var.twilio_auth_token
    twilio_don_number     = var.twilio_don_number
    twilio_demie_number   = var.twilio_demie_number
    twilio_business_number = var.twilio_business_number
  }))

  tags = merge(local.common_tags, {
    Name = "webphone-simple-app"
  })
  
  lifecycle {
    create_before_destroy = true
  }
}

# Load Balancer (reuse existing)
data "aws_lb" "webphone" {
  name = "webphone-alb"
}

# Target Group for single instance
resource "aws_lb_target_group" "simple" {
  name     = "webphone-simple-tg"
  port     = 3001
  protocol = "HTTP"
  vpc_id   = data.aws_vpc.main.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  tags = local.common_tags
}

# Target Group Attachment
resource "aws_lb_target_group_attachment" "simple" {
  target_group_arn = aws_lb_target_group.simple.arn
  target_id        = aws_instance.webphone_app.id
  port             = 3001
}

# Update Load Balancer Listener
resource "aws_lb_listener" "simple_http" {
  load_balancer_arn = data.aws_lb.webphone.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.simple.arn
  }
}

# Local values
locals {
  common_tags = {
    Environment = "production"
    Project     = "webphone-simple"
    ManagedBy   = "terraform"
  }
}