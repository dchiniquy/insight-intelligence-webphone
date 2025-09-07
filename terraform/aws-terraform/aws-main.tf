terraform {
  required_version = ">= 1.0"
  
  backend "s3" {
    bucket = "terraform-state-insight-intelligence-webphone"
    key    = "terraform.tfstate"
    region = "us-west-2"
    # Enable this after creating the S3 bucket manually
    # dynamodb_table = "terraform-locks"
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

# VPC
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.common_tags, {
    Name = "webphone-vpc"
  })
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "webphone-igw"
  })
}

# Public Subnets
resource "aws_subnet" "public" {
  count = 2

  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.${count.index + 1}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = merge(local.common_tags, {
    Name = "webphone-public-subnet-${count.index + 1}"
    Type = "Public"
  })
}

# Private Subnets
resource "aws_subnet" "private" {
  count = 2

  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 10}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = merge(local.common_tags, {
    Name = "webphone-private-subnet-${count.index + 1}"
    Type = "Private"
  })
}

# NAT Gateway
resource "aws_eip" "nat" {
  domain = "vpc"

  tags = merge(local.common_tags, {
    Name = "webphone-nat-eip"
  })

  depends_on = [aws_internet_gateway.main]
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id

  tags = merge(local.common_tags, {
    Name = "webphone-nat"
  })

  depends_on = [aws_internet_gateway.main]
}

# Route Tables
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(local.common_tags, {
    Name = "webphone-public-rt"
  })
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = merge(local.common_tags, {
    Name = "webphone-private-rt"
  })
}

# Route Table Associations
resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count = length(aws_subnet.private)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# Security Groups
resource "aws_security_group" "alb" {
  name_prefix = "webphone-alb"
  vpc_id      = aws_vpc.main.id
  description = "Security group for Application Load Balancer"

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "webphone-alb-sg"
  })
}

resource "aws_security_group" "app_server" {
  name_prefix = "webphone-app"
  vpc_id      = aws_vpc.main.id
  description = "Security group for application servers"

  ingress {
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "webphone-app-sg"
  })
}

# ECR Repositories
resource "aws_ecr_repository" "webphone_backend" {
  name                 = "webphone/backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.common_tags
}

resource "aws_ecr_repository" "webphone_frontend" {
  name                 = "webphone/frontend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.common_tags
}

# IAM Role for EC2 instances to access ECR
resource "aws_iam_role" "webphone_instance_role" {
  name = "webphone-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "webphone_ecr_policy" {
  name = "webphone-ecr-policy"
  role = aws_iam_role.webphone_instance_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer",
          "ecr:GetAuthorizationToken"
        ]
        Resource = "*"
      }
    ]
  })
}

# Attach SSM managed policy for Session Manager access
resource "aws_iam_role_policy_attachment" "webphone_ssm_policy" {
  role       = aws_iam_role.webphone_instance_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "webphone_instance_profile" {
  name = "webphone-instance-profile"
  role = aws_iam_role.webphone_instance_role.name

  tags = local.common_tags
}

# ACM Certificate
resource "aws_acm_certificate" "webphone" {
  count = var.domain_name != "" ? 1 : 0

  domain_name       = var.domain_name
  validation_method = "DNS"

  subject_alternative_names = [
    "*.${var.domain_name}"
  ]

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(local.common_tags, {
    Name = "webphone-ssl-cert"
  })
}

# Application Load Balancer
resource "aws_lb" "webphone" {
  name               = "webphone-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = false

  tags = local.common_tags
}

resource "aws_lb_target_group" "webphone" {
  name     = "webphone-tg"
  port     = 80
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

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

# HTTP Listener (forwards app requests, redirects others to HTTPS)
resource "aws_lb_listener" "webphone_http" {
  load_balancer_arn = aws_lb.webphone.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.webphone.arn
  }
}


# HTTPS Listener
resource "aws_lb_listener" "webphone_https" {
  count = var.domain_name != "" ? 1 : 0

  load_balancer_arn = aws_lb.webphone.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
  certificate_arn   = aws_acm_certificate.webphone[0].arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.webphone.arn
  }

  depends_on = [aws_acm_certificate_validation.webphone]
}

# Certificate validation (requires Route 53)
resource "aws_acm_certificate_validation" "webphone" {
  count = var.domain_name != "" && var.use_route53 ? 1 : 0

  certificate_arn         = aws_acm_certificate.webphone[0].arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]

  timeouts {
    create = "5m"
  }
}

# Route 53 (optional - only if managing DNS in AWS)
resource "aws_route53_zone" "main" {
  count = var.domain_name != "" && var.use_route53 ? 1 : 0

  name = var.domain_name

  tags = local.common_tags
}

resource "aws_route53_record" "cert_validation" {
  for_each = var.domain_name != "" && var.use_route53 ? {
    for dvo in aws_acm_certificate.webphone[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = aws_route53_zone.main[0].zone_id
}

resource "aws_route53_record" "webphone" {
  count = var.domain_name != "" && var.use_route53 ? 1 : 0

  zone_id = aws_route53_zone.main[0].zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_lb.webphone.dns_name
    zone_id                = aws_lb.webphone.zone_id
    evaluate_target_health = true
  }
}

# Launch Template for EC2 instances
resource "aws_launch_template" "webphone" {
  name_prefix   = "webphone"
  image_id      = data.aws_ami.amazon_linux.id
  instance_type = "t4g.small"
  key_name      = "webphone-debug"

  vpc_security_group_ids = [aws_security_group.app_server.id]

  iam_instance_profile {
    name = aws_iam_instance_profile.webphone_instance_profile.name
  }

  user_data = base64encode(templatefile("${path.module}/user_data.sh", {
    backend_repo_url       = aws_ecr_repository.webphone_backend.repository_url
    frontend_repo_url      = aws_ecr_repository.webphone_frontend.repository_url
    aws_region            = var.aws_region
    twilio_account_sid    = var.twilio_account_sid
    twilio_auth_token     = var.twilio_auth_token
    twilio_don_number     = var.twilio_don_number
    twilio_demie_number   = var.twilio_demie_number
    twilio_business_number = var.twilio_business_number
  }))

  tag_specifications {
    resource_type = "instance"
    tags = merge(local.common_tags, {
      Name = "webphone-app-server"
    })
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Auto Scaling Group
resource "aws_autoscaling_group" "webphone" {
  name                = "webphone-asg"
  vpc_zone_identifier = aws_subnet.private[*].id
  target_group_arns   = [aws_lb_target_group.webphone.arn]
  health_check_type   = "ELB"
  health_check_grace_period = 300

  min_size         = 1
  max_size         = 3
  desired_capacity = 2

  launch_template {
    id      = aws_launch_template.webphone.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "webphone-asg-instance"
    propagate_at_launch = true
  }

  dynamic "tag" {
    for_each = local.common_tags
    content {
      key                 = tag.key
      value               = tag.value
      propagate_at_launch = true
    }
  }
}

# Get latest Amazon Linux 2023 AMI
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

# Local values
locals {
  common_tags = {
    Environment = "production"
    Project     = "webphone"
    ManagedBy   = "terraform"
  }
}