# OCI to AWS Migration Plan

## Phase 1: Destroy OCI Resources

### Prerequisites
1. Backup any important data from OCI instances
2. Export container images from OCI Container Registry to local or DockerHub
3. Document current DNS settings pointing to OCI load balancer

### Destruction Order (to avoid dependency issues)
```bash
# 1. Stop the running terraform apply first
terraform apply -auto-approve -parallelism=1  # Let current apply finish or cancel

# 2. Remove SSL certificate resources first (if they exist)
terraform state list | grep certificate
terraform destroy -target=oci_load_balancer_certificate.webphone_lb_cert -auto-approve

# 3. Destroy load balancer listeners
terraform destroy -target=oci_load_balancer_listener.webphone_https_listener -auto-approve
terraform destroy -target=oci_load_balancer_listener.webphone_http_listener -auto-approve

# 4. Destroy load balancer backend set and backends
terraform destroy -target=oci_load_balancer_backend_set.webphone_backend_set -auto-approve

# 5. Destroy load balancer
terraform destroy -target=oci_load_balancer.webphone_lb -auto-approve

# 6. Destroy compute instances
terraform destroy -target=oci_core_instance.app_server -auto-approve
terraform destroy -target=oci_core_instance.bastion -auto-approve

# 7. Destroy container repositories
terraform destroy -target=oci_artifacts_container_repository.webphone_backend_repo -auto-approve
terraform destroy -target=oci_artifacts_container_repository.webphone_frontend_repo -auto-approve

# 8. Destroy networking (subnets, route tables, gateways)
terraform destroy -target=oci_core_subnet.public_subnet -auto-approve
terraform destroy -target=oci_core_subnet.public_subnet_ad2 -auto-approve
terraform destroy -target=oci_core_subnet.private_subnet -auto-approve
terraform destroy -target=oci_core_route_table.private_route -auto-approve
terraform destroy -target=oci_core_route_table.public_route -auto-approve
terraform destroy -target=oci_core_nat_gateway.nat -auto-approve
terraform destroy -target=oci_core_internet_gateway.igw -auto-approve

# 9. Destroy security lists and VCN
terraform destroy -target=oci_core_security_list.private_security -auto-approve
terraform destroy -target=oci_core_security_list.public_security -auto-approve
terraform destroy -target=oci_core_virtual_network.vcn -auto-approve

# 10. Final cleanup - destroy everything else
terraform destroy -auto-approve
```

## Phase 2: AWS Infrastructure Setup

### AWS Equivalent Architecture
```
OCI Resource                    →  AWS Equivalent
────────────────────────────────────────────────────────
VCN                            →  VPC
Internet Gateway               →  Internet Gateway  
NAT Gateway                    →  NAT Gateway
Public/Private Subnets         →  Public/Private Subnets
Security Lists                 →  Security Groups
Load Balancer (flexible)       →  Application Load Balancer
Container Registry (OCIR)      →  Amazon ECR
VM.Standard.A1.Flex instances  →  EC2 instances (t3.medium/large)
Oracle Linux 8                →  Amazon Linux 2023
```

### AWS Advantages for SSL
- **AWS Certificate Manager (ACM)**: Free SSL certificates with automatic renewal
- **Route 53**: Integrated DNS with automatic certificate validation
- **No free tier limitations** on SSL certificates
- **Automatic certificate deployment** to load balancers

## Phase 3: AWS Terraform Configuration

### Key AWS Resources Needed
1. **VPC and Networking**
   - VPC with public/private subnets across 2 AZs
   - Internet Gateway and NAT Gateway
   - Route tables and security groups

2. **Container Services**
   - Amazon ECR repositories for frontend/backend
   - ECS Fargate or EC2 instances for container hosting

3. **Load Balancing and SSL**
   - Application Load Balancer
   - ACM certificate for webphone.insightintelligence.io
   - Route 53 hosted zone (if needed)

4. **Compute**
   - EC2 instances or ECS Fargate tasks
   - Auto Scaling Groups for high availability

### Estimated AWS Costs
- **Application Load Balancer**: ~$18/month
- **EC2 t3.medium instances** (2): ~$30/month
- **NAT Gateway**: ~$32/month  
- **Data transfer**: Variable
- **ECR storage**: ~$1-5/month
- **Route 53**: ~$1/month per hosted zone

**Total: ~$80-90/month** (vs OCI free tier limitations)

## Phase 4: Migration Steps

1. **Prepare AWS environment**
   - Set up AWS CLI and credentials
   - Create new Terraform configuration for AWS
   - Set up ECR repositories

2. **Container migration**
   - Pull images from OCI Container Registry
   - Tag and push to Amazon ECR
   - Update docker-compose files for AWS ECR URLs

3. **DNS migration**
   - Create ACM certificate for domain
   - Deploy AWS infrastructure
   - Update DNS records to point to AWS ALB
   - Verify SSL is working properly

4. **Cleanup**
   - Destroy OCI resources once AWS is verified working
   - Remove OCI Terraform state and configuration

## Implementation Commands

### 1. Stop Current OCI Apply and Destroy Resources
```bash
# Check if terraform is still running
ps aux | grep terraform

# If needed, cancel the current apply (Ctrl+C if running in foreground)

# Execute the destruction plan
cd /path/to/terraform
terraform destroy -auto-approve
```

### 2. Set Up AWS Infrastructure  
```bash
# Copy AWS configuration files (already created)
# - aws-main.tf
# - aws-variables.tf  
# - aws-outputs.tf
# - user_data.sh
# - aws-terraform.tfvars.example

# Configure AWS credentials
aws configure

# Create S3 bucket for Terraform state (manual step)
aws s3 mb s3://terraform-state-insight-intelligence-webphone --region us-west-2
aws s3api put-bucket-versioning --bucket terraform-state-insight-intelligence-webphone --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket terraform-state-insight-intelligence-webphone --server-side-encryption-configuration '{
  "Rules": [
    {
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }
  ]
}'

# Copy and configure variables
cp aws-terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your actual values

# Initialize and deploy AWS infrastructure
terraform init
terraform plan
terraform apply
```

### 3. Container Migration
```bash
# Login to OCI Container Registry (if images still exist)
docker login ${region}.ocir.io

# Pull existing images  
docker pull ${oci_backend_repo_url}:latest
docker pull ${oci_frontend_repo_url}:latest

# Tag for AWS ECR
docker tag ${oci_backend_repo_url}:latest ${aws_backend_repo_url}:latest
docker tag ${oci_frontend_repo_url}:latest ${aws_frontend_repo_url}:latest

# Login to AWS ECR
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin ${aws_account_id}.dkr.ecr.us-west-2.amazonaws.com

# Push to AWS ECR
docker push ${aws_backend_repo_url}:latest  
docker push ${aws_frontend_repo_url}:latest
```

### 4. SSL Certificate Validation
```bash
# Get certificate validation records
terraform output ssl_setup_instructions

# Add the DNS validation records to your DNS provider
# Certificate will be automatically validated once DNS records are added

# Check certificate status
aws acm describe-certificate --certificate-arn $(terraform output certificate_arn)
```

### 5. Update DNS
```bash
# Update your DNS provider to point webphone.insightintelligence.io to:
terraform output load_balancer_dns_name

# Create CNAME record:
# webphone.insightintelligence.io -> [load_balancer_dns_name]
```

## Next Steps
1. **IMMEDIATE**: Stop current OCI apply and execute destruction plan
2. **Set up AWS credentials** and S3 backend bucket  
3. **Deploy AWS infrastructure** using provided Terraform configuration
4. **Migrate container images** from OCI to AWS ECR
5. **Validate SSL certificate** by adding DNS records
6. **Update DNS** to point to AWS load balancer  
7. **Test functionality** and verify HTTPS is working

## Files Created
- `aws-main.tf` - Complete AWS infrastructure
- `aws-variables.tf` - Variable definitions  
- `aws-outputs.tf` - Output values
- `user_data.sh` - EC2 initialization script
- `aws-terraform.tfvars.example` - Configuration template

## Advantages of AWS Setup
✅ **Free SSL certificates** via AWS Certificate Manager
✅ **Automatic certificate renewal**  
✅ **No free tier SSL limitations**
✅ **Better load balancer with health checks**
✅ **Auto scaling capability**
✅ **Integrated DNS with Route 53 (optional)**
✅ **Professional-grade container registry (ECR)**