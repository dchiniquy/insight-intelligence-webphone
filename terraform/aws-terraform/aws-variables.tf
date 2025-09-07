variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-west-2"
}

variable "domain_name" {
  description = "Domain name for SSL certificate (e.g., webphone.insightintelligence.io)"
  type        = string
  default     = "webphone.insightintelligence.io"
}

variable "use_route53" {
  description = "Whether to use Route 53 for DNS management and automatic certificate validation"
  type        = bool
  default     = false
}

variable "twilio_account_sid" {
  description = "Twilio Account SID"
  type        = string
  sensitive   = true
}

variable "twilio_auth_token" {
  description = "Twilio Auth Token"
  type        = string
  sensitive   = true
}

variable "twilio_phone_numbers" {
  description = "List of Twilio phone numbers"
  type        = list(string)
  default     = []
}

variable "twilio_don_number" {
  description = "Twilio phone number for Don"
  type        = string
  default     = ""
}

variable "twilio_demie_number" {
  description = "Twilio phone number for Demie"
  type        = string
  default     = ""
}

variable "twilio_business_number" {
  description = "Twilio phone number for Business"
  type        = string
  default     = ""
}