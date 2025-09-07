variable "tenancy_ocid" {
  description = "OCI Tenancy OCID"
  type        = string
}

variable "user_ocid" {
  description = "OCI User OCID"
  type        = string
}

variable "compartment_ocid" {
  description = "OCI Compartment OCID"
  type        = string
}

variable "fingerprint" {
  description = "OCI API Key Fingerprint"
  type        = string
}

variable "region" {
  description = "OCI Region"
  type        = string
}

variable "private_key_path" {
  description = "Path to OCI API private key"
  type        = string
  default     = "~/.oci/oci_api_key.pem"
}

variable "ssh_public_key_path" {
  description = "Path to SSH public key for VM access"
  type        = string
  default     = "~/.ssh/oci_vm_key.pub"
}

variable "ocir_username" {
  description = "Username for OCIR (usually your email)"
  type        = string
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = ""
}

variable "twilio_numbers" {
  description = "Twilio phone numbers configuration"
  type = map(object({
    phone_number    = string
    friendly_name   = string
    account_sid     = string
    auth_token      = optional(string)
    api_key        = optional(string)
    api_secret     = optional(string)
    twiml_app_sid  = optional(string)
    capabilities = object({
      voice = bool
      sms   = bool
      mms   = bool
    })
  }))
  sensitive = true
}

variable "ssl_certificate" {
  description = "SSL certificate content (PEM format)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "ssl_private_key" {
  description = "SSL private key content (PEM format)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "ssl_ca_certificate" {
  description = "SSL CA certificate content (PEM format)"
  type        = string
  default     = ""
  sensitive   = true
}

locals {
  common_tags = {
    Project     = "twilio-multi-app"
    Environment = "production"
    ManagedBy   = "terraform"
  }
}