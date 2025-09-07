# Temporary Bastion Server for accessing private resources
resource "oci_core_instance" "bastion" {
  compartment_id      = var.compartment_ocid
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
  display_name        = "bastion-server"
  shape               = "VM.Standard.A1.Flex"
  
  shape_config {
    ocpus         = 1
    memory_in_gbs = 2
  }
  
  source_details {
    source_type = "image"
    source_id   = data.oci_core_images.oracle_linux_arm.images[0].id
  }
  
  create_vnic_details {
    subnet_id        = oci_core_subnet.public_subnet.id
    display_name     = "bastion-primary-vnic"
    assign_public_ip = true
    hostname_label   = "bastion"
  }
  
  metadata = {
    ssh_authorized_keys = file(var.ssh_public_key_path)
  }
  
  freeform_tags = merge(local.common_tags, {
    Name = "bastion-server"
    Type = "bastion"
  })
}

output "bastion_ip" {
  value = oci_core_instance.bastion.public_ip
}

output "bastion_ssh" {
  value = "ssh opc@${oci_core_instance.bastion.public_ip}"
}