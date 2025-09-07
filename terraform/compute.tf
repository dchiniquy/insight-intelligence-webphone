# Compute Instances for WebPhone App

# Application Server VM
resource "oci_core_instance" "app_server" {
  compartment_id      = var.compartment_ocid
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
  display_name        = "webphone-app-server"
  shape               = "VM.Standard.A1.Flex"
  
  shape_config {
    ocpus         = 2
    memory_in_gbs = 12
  }
  
  source_details {
    source_type = "image"
    source_id   = data.oci_core_images.oracle_linux_arm.images[0].id
  }
  
  create_vnic_details {
    subnet_id        = oci_core_subnet.private_subnet.id
    display_name     = "app-primary-vnic"
    assign_public_ip = false  # Private subnet, no public IP
    hostname_label   = "webphone-app"
  }
  
  metadata = {
    ssh_authorized_keys = file(var.ssh_public_key_path)
    user_data = base64encode(templatefile("${path.module}/scripts/setup_app.sh", {
      ocir_url         = "${var.region}.ocir.io"
      ocir_namespace   = data.oci_objectstorage_namespace.ns.namespace
      ocir_username    = var.ocir_username
      auth_token       = oci_identity_auth_token.docker_registry.token
      backend_image    = "${var.region}.ocir.io/${data.oci_objectstorage_namespace.ns.namespace}/insight-intelligence-webphone/backend"
      frontend_image   = "${var.region}.ocir.io/${data.oci_objectstorage_namespace.ns.namespace}/insight-intelligence-webphone/frontend"
      nginx_image      = "${var.region}.ocir.io/${data.oci_objectstorage_namespace.ns.namespace}/insight-intelligence-webphone/nginx"
      db_host          = oci_core_instance.db_server.private_ip
      twilio_numbers   = jsonencode(var.twilio_numbers)
      domain_name      = var.domain_name
    }))
  }
  
  freeform_tags = merge(local.common_tags, {
    Name = "webphone-app-server"
    Type = "application"
  })
}

# Database Server VM
resource "oci_core_instance" "db_server" {
  compartment_id      = var.compartment_ocid
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
  display_name        = "webphone-db-server"
  shape               = "VM.Standard.A1.Flex"
  
  shape_config {
    ocpus         = 2
    memory_in_gbs = 12
  }
  
  source_details {
    source_type = "image"
    source_id   = "ocid1.image.oc1.phx.aaaaaaaa2v4dnyc7cymsycu4awjlpt7tegv32ikpzinlpukisbsotjrekqea"
  }
  
  create_vnic_details {
    subnet_id        = oci_core_subnet.private_subnet.id
    display_name     = "db-primary-vnic"
    assign_public_ip = false
    hostname_label   = "webphone-db"
  }
  
  metadata = {
    ssh_authorized_keys = file(var.ssh_public_key_path)
    user_data          = base64encode(file("${path.module}/scripts/setup_db.sh"))
  }
  
  freeform_tags = merge(local.common_tags, {
    Name = "webphone-db-server"
    Type = "database"
  })
}

# Outputs
output "app_server_details" {
  value = {
    public_ip  = oci_core_instance.app_server.public_ip
    private_ip = oci_core_instance.app_server.private_ip
    ssh_command = "ssh opc@${oci_core_instance.app_server.public_ip}"
  }
  description = "Application server connection details"
}

output "db_server_details" {
  value = {
    private_ip = oci_core_instance.db_server.private_ip
    ssh_command = "ssh -J opc@${oci_core_instance.app_server.public_ip} opc@${oci_core_instance.db_server.private_ip}"
  }
  description = "Database server connection details (via jump host)"
}

output "webhook_urls" {
  value = {
    for key, num in var.twilio_numbers : key => {
      voice_webhook = var.domain_name != "" ? "https://${var.domain_name}/webhooks/voice/${key}" : "http://${oci_core_instance.app_server.public_ip}/webhooks/voice/${key}"
      sms_webhook = var.domain_name != "" ? "https://${var.domain_name}/webhooks/sms/${key}" : "http://${oci_core_instance.app_server.public_ip}/webhooks/sms/${key}"
      status_callback = var.domain_name != "" ? "https://${var.domain_name}/webhooks/status/${key}" : "http://${oci_core_instance.app_server.public_ip}/webhooks/status/${key}"
    }
  }
  description = "Configure these webhook URLs in your Twilio Console for each number"
  sensitive = true
}