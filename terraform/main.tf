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

output "namespace" {
  value = data.oci_objectstorage_namespace.ns.namespace
}