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

# VCN and Networking
resource "oci_core_vcn" "webphone_vcn" {
  compartment_id = var.compartment_ocid
  display_name   = "webphone-vcn"
  cidr_blocks    = ["10.0.0.0/16"]
  dns_label      = "webphone"

  freeform_tags = local.common_tags
}

resource "oci_core_internet_gateway" "webphone_igw" {
  compartment_id = var.compartment_ocid
  display_name   = "webphone-igw"
  vcn_id         = oci_core_vcn.webphone_vcn.id
  enabled        = true

  freeform_tags = local.common_tags
}

resource "oci_core_route_table" "webphone_rt" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.webphone_vcn.id
  display_name   = "webphone-rt"

  route_rules {
    destination       = "0.0.0.0/0"
    network_entity_id = oci_core_internet_gateway.webphone_igw.id
  }

  freeform_tags = local.common_tags
}

resource "oci_core_security_list" "webphone_security_list" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.webphone_vcn.id
  display_name   = "webphone-security-list"

  # Allow outbound internet access
  egress_security_rules {
    destination = "0.0.0.0/0"
    protocol    = "all"
  }

  # Allow SSH access
  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"

    tcp_options {
      min = 22
      max = 22
    }
  }

  # Allow HTTP access
  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"

    tcp_options {
      min = 80
      max = 80
    }
  }

  # Allow HTTPS access
  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"

    tcp_options {
      min = 443
      max = 443
    }
  }

  # Allow backend API access
  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"

    tcp_options {
      min = 3001
      max = 3001
    }
  }

  freeform_tags = local.common_tags
}

resource "oci_core_subnet" "webphone_subnet" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.webphone_vcn.id
  display_name   = "webphone-subnet"
  cidr_block     = "10.0.1.0/24"
  dns_label      = "webphonesubnet"

  route_table_id    = oci_core_route_table.webphone_rt.id
  security_list_ids = [oci_core_security_list.webphone_security_list.id]

  freeform_tags = local.common_tags
}

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

# Compute Instance for running containers
resource "oci_core_instance" "webphone_instance" {
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
  compartment_id      = var.compartment_ocid
  display_name        = "webphone-instance"
  shape               = "VM.Standard.A1.Flex"

  shape_config {
    ocpus         = 2
    memory_in_gbs = 12
  }

  create_vnic_details {
    subnet_id                 = oci_core_subnet.webphone_subnet.id
    display_name              = "webphone-vnic"
    assign_public_ip          = true
    assign_private_dns_record = true
    hostname_label            = "webphone"
  }

  source_details {
    source_type = "image"
    source_id   = data.oci_core_images.oracle_linux_arm.images[0].id
    boot_volume_size_in_gbs = 50
  }

  metadata = {
    ssh_authorized_keys = file(var.ssh_public_key_path)
    user_data = base64encode(templatefile("${path.module}/cloud-init.yml", {
      docker_compose_content = base64encode(templatefile("${path.module}/docker-compose.prod.yml", {
        registry_region     = var.region
        namespace          = data.oci_objectstorage_namespace.ns.namespace
        backend_image_tag  = "latest"
        frontend_image_tag = "latest"
        nginx_image_tag    = "latest"
        twilio_account_sid = var.twilio_numbers["don"].account_sid
        twilio_auth_token  = var.twilio_numbers["don"].auth_token
        twilio_numbers_config = jsonencode({
          for k, v in var.twilio_numbers : k => {
            number = v.phone_number
            label  = v.friendly_name
          }
        })
      }))
    }))
  }

  freeform_tags = local.common_tags
}

# Load Balancer
resource "oci_load_balancer" "webphone_lb" {
  shape          = "flexible"
  compartment_id = var.compartment_ocid
  subnet_ids     = [oci_core_subnet.webphone_subnet.id]
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

resource "oci_load_balancer_backend" "webphone_backend" {
  load_balancer_id = oci_load_balancer.webphone_lb.id
  backendset_name  = oci_load_balancer_backend_set.webphone_backend_set.name
  ip_address       = oci_core_instance.webphone_instance.private_ip
  port             = 80
  backup           = false
  drain            = false
  offline          = false
  weight           = 1
}

resource "oci_load_balancer_listener" "webphone_listener" {
  load_balancer_id         = oci_load_balancer.webphone_lb.id
  name                     = "webphone-listener"
  default_backend_set_name = oci_load_balancer_backend_set.webphone_backend_set.name
  port                     = 80
  protocol                 = "HTTP"
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

output "instance_public_ip" {
  value = oci_core_instance.webphone_instance.public_ip
}

output "load_balancer_ip" {
  value = oci_load_balancer.webphone_lb.ip_addresses[0].ip_address
}