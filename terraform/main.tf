terraform {
  required_version = ">= 1.0"
  
  backend "oci" {
    bucket              = "terraform-state-insight-intelligence-webphone"
    namespace           = "axoxnwhj7c1a"
    key                 = "terraform.tfstate"
    config_file_profile = "DEFAULT"
  }
  
  required_providers {
    oci = {
      source  = "oracle/oci"
      version = "~> 5.0"
    }
  }
}

provider "oci" {
  tenancy_ocid     = var.tenancy_ocid
  user_ocid        = var.user_ocid
  fingerprint      = var.fingerprint
  private_key_path = var.private_key_path
  region           = var.region
}

# Get namespace for OCIR
data "oci_objectstorage_namespace" "ns" {
  compartment_id = var.compartment_ocid
}

data "oci_identity_availability_domains" "ads" {
  compartment_id = var.compartment_ocid
}

# Get latest Oracle Linux 8 image
data "oci_core_images" "oracle_linux_arm" {
  compartment_id           = var.compartment_ocid
  operating_system         = "Oracle Linux"
  operating_system_version = "8"
  shape                    = "VM.Standard.A1.Flex"
  state                    = "AVAILABLE"
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}

# Using existing networking infrastructure from network.tf
# - VCN: oci_core_virtual_network.vcn
# - Internet Gateway: oci_core_internet_gateway.igw  
# - NAT Gateway: oci_core_nat_gateway.nat
# - Public Route Table: oci_core_route_table.public_route
# - Private Route Table: oci_core_route_table.private_route
# - Public Security List: oci_core_security_list.public_security
# - Private Security List: oci_core_security_list.private_security
# - Public Subnet: oci_core_subnet.public_subnet
# - Private Subnet: oci_core_subnet.private_subnet

# Using existing subnets from network.tf
# Public subnet: oci_core_subnet.public_subnet 
# Private subnet: oci_core_subnet.private_subnet

# Container Registry Repository
resource "oci_artifacts_container_repository" "webphone_backend_repo" {
  compartment_id   = var.compartment_ocid
  display_name     = "webphone/backend"
  is_immutable     = false
  is_public        = false

  freeform_tags = local.common_tags
}

resource "oci_artifacts_container_repository" "webphone_frontend_repo" {
  compartment_id   = var.compartment_ocid
  display_name     = "webphone/frontend"
  is_immutable     = false
  is_public        = false

  freeform_tags = local.common_tags
}


# OCI Certificate Service approach requires manual steps in console
# For now, using provided SSL certificate variables for immediate SSL setup
# To use OCI Certificate Service:
# 1. Create certificate manually in OCI Console
# 2. Complete domain validation
# 3. Reference the certificate ID here

# Load Balancer
resource "oci_load_balancer" "webphone_lb" {
  shape          = "flexible"
  compartment_id = var.compartment_ocid
  subnet_ids     = [oci_core_subnet.public_subnet.id, oci_core_subnet.public_subnet_ad2.id]
  display_name   = "webphone-lb"

  shape_details {
    minimum_bandwidth_in_mbps = 10
    maximum_bandwidth_in_mbps = 100
  }

  freeform_tags = local.common_tags
}

resource "oci_load_balancer_backend_set" "webphone_backend_set" {
  name             = "webphone-backend-set"
  load_balancer_id = oci_load_balancer.webphone_lb.id
  policy           = "ROUND_ROBIN"

  health_checker {
    port                = "80"
    protocol            = "HTTP"
    response_body_regex = ".*"
    url_path            = "/health"
  }
}

# Backend is already configured in the backend_set resource above

# HTTP Listener 
resource "oci_load_balancer_listener" "webphone_http_listener" {
  load_balancer_id         = oci_load_balancer.webphone_lb.id
  name                     = "webphone-http-listener"
  default_backend_set_name = oci_load_balancer_backend_set.webphone_backend_set.name
  port                     = 80
  protocol                 = "HTTP"
}

# Load Balancer Certificate (using provided SSL variables or uploaded manually)
resource "oci_load_balancer_certificate" "webphone_lb_cert" {
  count            = var.domain_name != "" && var.ssl_certificate != "" ? 1 : 0
  load_balancer_id = oci_load_balancer.webphone_lb.id
  certificate_name = "webphone-ssl-cert"
  
  lifecycle {
    create_before_destroy = true
  }
  
  # Use provided SSL certificate variables (can be updated after manual certificate creation)
  ca_certificate     = var.ssl_ca_certificate
  private_key        = var.ssl_private_key
  public_certificate = var.ssl_certificate
}

# HTTPS Listener with SSL (conditional - only if SSL certificate is provided)
resource "oci_load_balancer_listener" "webphone_https_listener" {
  count                    = var.domain_name != "" && var.ssl_certificate != "" ? 1 : 0
  load_balancer_id         = oci_load_balancer.webphone_lb.id
  name                     = "webphone-https-listener"
  default_backend_set_name = oci_load_balancer_backend_set.webphone_backend_set.name
  port                     = 443
  protocol                 = "HTTP"
  
  ssl_configuration {
    certificate_name        = oci_load_balancer_certificate.webphone_lb_cert[0].certificate_name
    verify_peer_certificate = false
  }
}

# Outputs
output "namespace" {
  value = data.oci_objectstorage_namespace.ns.namespace
}

output "backend_repository_url" {
  value = "${var.region}.ocir.io/${data.oci_objectstorage_namespace.ns.namespace}/${oci_artifacts_container_repository.webphone_backend_repo.display_name}"
}

output "frontend_repository_url" {
  value = "${var.region}.ocir.io/${data.oci_objectstorage_namespace.ns.namespace}/${oci_artifacts_container_repository.webphone_frontend_repo.display_name}"
}

output "backend_server_details" {
  value = {
    private_ip = oci_core_instance.app_server.private_ip
    # No public IP since it's in private subnet
  }
}

output "load_balancer_ip" {
  value = oci_load_balancer.webphone_lb.ip_address_details[0].ip_address
}