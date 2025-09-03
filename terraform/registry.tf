# OCI Container Registry (OCIR) Setup
resource "oci_artifacts_container_repository" "backend" {
  compartment_id = var.compartment_ocid
  display_name   = "insight-intelligence-webphone/backend"
  
  is_immutable = false
  is_public    = false
  
  readme {
    content = "# Insight Intelligence WebPhone Backend\nNode.js backend API for multi-number Twilio management"
    format  = "text/markdown"
  }
  
  freeform_tags = local.common_tags
}

resource "oci_artifacts_container_repository" "frontend" {
  compartment_id = var.compartment_ocid
  display_name   = "insight-intelligence-webphone/frontend"
  
  is_immutable = false
  is_public    = false
  
  readme {
    content = "# Insight Intelligence WebPhone Frontend\nReact PWA for managing multiple Twilio numbers"
    format  = "text/markdown"
  }
  
  freeform_tags = local.common_tags
}

resource "oci_artifacts_container_repository" "nginx" {
  compartment_id = var.compartment_ocid
  display_name   = "insight-intelligence-webphone/nginx"
  
  is_immutable = false
  is_public    = false
  
  readme {
    content = "# Insight Intelligence WebPhone Nginx\nReverse proxy and SSL termination for WebPhone app"
    format  = "text/markdown"
  }
  
  freeform_tags = local.common_tags
}

# Create auth token for Docker registry access
resource "oci_identity_auth_token" "docker_registry" {
  description = "Docker registry auth token for WebPhone app"
  user_id     = var.user_ocid
  
  lifecycle {
    create_before_destroy = true
  }
}

# Dynamic group for instances to pull images
resource "oci_identity_dynamic_group" "app_instances" {
  compartment_id = var.tenancy_ocid
  name           = "insight-intelligence-webphone-instances"
  description    = "Dynamic group for WebPhone app compute instances"
  
  matching_rule = "Any {instance.compartment.id = '${var.compartment_ocid}'}"
  
  freeform_tags = local.common_tags
}

# IAM policy for instances to pull from OCIR
resource "oci_identity_policy" "ocir_pull" {
  compartment_id = var.compartment_ocid
  name           = "insight-intelligence-webphone-ocir-policy"
  description    = "Allow WebPhone instances to pull from OCIR"
  
  statements = [
    "Allow dynamic-group ${oci_identity_dynamic_group.app_instances.name} to read repos in compartment id ${var.compartment_ocid}",
    "Allow dynamic-group ${oci_identity_dynamic_group.app_instances.name} to read objectstorage-namespaces in compartment id ${var.compartment_ocid}"
  ]
}

# Output OCIR details
output "ocir_details" {
  value = {
    registry_url   = "${var.region}.ocir.io"
    namespace      = data.oci_objectstorage_namespace.ns.namespace
    backend_repo   = "${var.region}.ocir.io/${data.oci_objectstorage_namespace.ns.namespace}/insight-intelligence-webphone/backend"
    frontend_repo  = "${var.region}.ocir.io/${data.oci_objectstorage_namespace.ns.namespace}/insight-intelligence-webphone/frontend"
    nginx_repo     = "${var.region}.ocir.io/${data.oci_objectstorage_namespace.ns.namespace}/insight-intelligence-webphone/nginx"
  }
  description = "OCIR registry details for the WebPhone app"
}

output "docker_login_command" {
  value = "docker login ${var.region}.ocir.io -u '${data.oci_objectstorage_namespace.ns.namespace}/${var.ocir_username}' -p '${oci_identity_auth_token.docker_registry.token}'"
  description = "Docker login command for OCIR"
  sensitive = true
}