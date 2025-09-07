# VCN
resource "oci_core_virtual_network" "vcn" {
  compartment_id = var.compartment_ocid
  cidr_blocks    = ["10.0.0.0/16"]
  display_name   = "twilio-vcn"
  dns_label      = "twilio"
  
  freeform_tags = local.common_tags
}

# Internet Gateway
resource "oci_core_internet_gateway" "igw" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_virtual_network.vcn.id
  display_name   = "twilio-igw"
  enabled        = true
  
  freeform_tags = local.common_tags
}

# Route Table for Public Subnet
resource "oci_core_route_table" "public_route" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_virtual_network.vcn.id
  display_name   = "public-route-table"
  
  route_rules {
    destination       = "0.0.0.0/0"
    network_entity_id = oci_core_internet_gateway.igw.id
  }
  
  freeform_tags = local.common_tags
}

# NAT Gateway for Private Subnet
resource "oci_core_nat_gateway" "nat" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_virtual_network.vcn.id
  display_name   = "twilio-nat"
  
  freeform_tags = local.common_tags
}

# Route Table for Private Subnet
resource "oci_core_route_table" "private_route" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_virtual_network.vcn.id
  display_name   = "private-route-table"
  
  route_rules {
    destination       = "0.0.0.0/0"
    network_entity_id = oci_core_nat_gateway.nat.id
  }
  
  freeform_tags = local.common_tags
}

# Security List for Public Subnet
resource "oci_core_security_list" "public_security" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_virtual_network.vcn.id
  display_name   = "public-security-list"
  
  # Allow all outbound traffic
  egress_security_rules {
    destination = "0.0.0.0/0"
    protocol    = "all"
  }
  
  # SSH (port 22)
  ingress_security_rules {
    protocol = "6"  # TCP
    source   = "0.0.0.0/0"
    tcp_options {
      min = 22
      max = 22
    }
  }
  
  # HTTP (port 80)
  ingress_security_rules {
    protocol = "6"  # TCP
    source   = "0.0.0.0/0"
    tcp_options {
      min = 80
      max = 80
    }
  }
  
  # HTTPS (port 443)
  ingress_security_rules {
    protocol = "6"  # TCP
    source   = "0.0.0.0/0"
    tcp_options {
      min = 443
      max = 443
    }
  }
  
  # Backend API (port 3001)
  ingress_security_rules {
    protocol = "6"  # TCP
    source   = "0.0.0.0/0"
    tcp_options {
      min = 3001
      max = 3001
    }
  }
  
  # WebSocket (port 8080)
  ingress_security_rules {
    protocol = "6"  # TCP
    source   = "0.0.0.0/0"
    tcp_options {
      min = 8080
      max = 8080
    }
  }
  
  freeform_tags = local.common_tags
}

# Security List for Private Subnet
resource "oci_core_security_list" "private_security" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_virtual_network.vcn.id
  display_name   = "private-security-list"
  
  # Allow all outbound traffic
  egress_security_rules {
    destination = "0.0.0.0/0"
    protocol    = "all"
  }
  
  # SSH (port 22) from public subnet for bastion access
  ingress_security_rules {
    protocol = "6"  # TCP
    source   = "10.0.6.0/24"  # Public subnet CIDR
    tcp_options {
      min = 22
      max = 22
    }
  }
  
  # HTTP (port 80) from entire VCN (temporary for debugging)
  ingress_security_rules {
    protocol = "6"  # TCP
    source   = "10.0.0.0/16"  # Entire VCN CIDR
    tcp_options {
      min = 80
      max = 80
    }
  }
  
  # ICMP for ping/troubleshooting
  ingress_security_rules {
    protocol = "1"  # ICMP
    source   = "10.0.6.0/24"  # Public subnet CIDR
  }
  
  # MongoDB (port 27017) from public subnet
  ingress_security_rules {
    protocol = "6"  # TCP
    source   = "10.0.6.0/24"  # Public subnet CIDR
    tcp_options {
      min = 27017
      max = 27017
    }
  }
  
  # Redis (port 6379) from public subnet
  ingress_security_rules {
    protocol = "6"  # TCP
    source   = "10.0.6.0/24"  # Public subnet CIDR
    tcp_options {
      min = 6379
      max = 6379
    }
  }
  
  freeform_tags = local.common_tags
}

# Public Subnet (AD-1)
resource "oci_core_subnet" "public_subnet" {
  compartment_id      = var.compartment_ocid
  vcn_id              = oci_core_virtual_network.vcn.id
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
  cidr_block          = "10.0.6.0/24"
  display_name        = "public-subnet-ad1"
  dns_label           = "publicad1"
  route_table_id      = oci_core_route_table.public_route.id
  
  security_list_ids = [oci_core_security_list.public_security.id]
  
  freeform_tags = local.common_tags
}

# Public Subnet (AD-2)
resource "oci_core_subnet" "public_subnet_ad2" {
  compartment_id      = var.compartment_ocid
  vcn_id              = oci_core_virtual_network.vcn.id
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[1].name
  cidr_block          = "10.0.5.0/24"
  display_name        = "public-subnet-ad2"
  dns_label           = "publicad2"
  route_table_id      = oci_core_route_table.public_route.id
  
  security_list_ids = [oci_core_security_list.public_security.id]
  
  freeform_tags = local.common_tags
}

# Private Subnet for Database
resource "oci_core_subnet" "private_subnet" {
  compartment_id             = var.compartment_ocid
  vcn_id                     = oci_core_virtual_network.vcn.id
  availability_domain        = data.oci_identity_availability_domains.ads.availability_domains[0].name
  cidr_block                 = "10.0.2.0/24"
  display_name               = "private-subnet"
  dns_label                  = "private"
  route_table_id             = oci_core_route_table.private_route.id
  prohibit_public_ip_on_vnic = true
  
  security_list_ids = [oci_core_security_list.private_security.id]
  
  freeform_tags = local.common_tags
}

# Output network information
output "vcn_id" {
  value = oci_core_virtual_network.vcn.id
}

output "public_subnet_id" {
  value = oci_core_subnet.public_subnet.id
}

output "public_subnet_ad2_id" {
  value = oci_core_subnet.public_subnet_ad2.id
}

output "private_subnet_id" {
  value = oci_core_subnet.private_subnet.id
}