# Insight Intelligence WebPhone - Multi-Number Twilio Application

## Project Overview

A containerized web application for managing multiple Twilio phone numbers with separate configurations for personal, business, and testing use cases. The application is deployed on Oracle Cloud Infrastructure (OCI) using their free tier ARM instances.

## Architecture

### High-Level Design
- **Frontend**: React PWA (Progressive Web App) for mobile-friendly interface
- **Backend**: Node.js API with Express framework
- **Database**: MongoDB for persistent data, Redis for caching/sessions
- **Proxy**: Nginx for reverse proxy and SSL termination
- **Infrastructure**: OCI compute instances with containerized deployment
- **Registry**: OCI Container Registry (OCIR) for Docker images

### Multi-Number Support
The application supports at least 3 distinct Twilio number configurations:
- **don**: Personal number configuration
- **demie**: Secondary personal/family number
- **business**: Business/professional number

Each number has separate webhook endpoints and can have different configurations.

## Infrastructure Deployed

### Network Infrastructure
- **VCN**: `10.0.0.0/16` CIDR block
- **Public Subnet**: `10.0.1.0/24` (for app server with public access)
- **Private Subnet**: `10.0.2.0/24` (for database server, private only)
- **Internet Gateway**: Public internet access
- **NAT Gateway**: Private subnet outbound access
- **Security Lists**: Configured for web traffic, SSH, database ports

### Compute Resources
- **App Server**: 
  - Instance: `webphone-app-server`
  - Shape: `VM.Standard.A1.Flex` (2 OCPUs, 12GB RAM)
  - Public IP: `137.131.4.94`
  - Private IP: `10.0.1.117`
  - SSH: `ssh opc@137.131.4.94`

- **Database Server**:
  - Instance: `webphone-db-server` 
  - Shape: `VM.Standard.A1.Flex` (2 OCPUs, 12GB RAM)
  - Private IP: `10.0.2.176`
  - SSH: `ssh -J opc@137.131.4.94 opc@10.0.2.176`

### Container Registry (OCIR)
- **Registry URL**: `us-phoenix-1.ocir.io`
- **Namespace**: `axoxnwhj7c1a`
- **Repositories**:
  - `insight-intelligence-webphone/backend`
  - `insight-intelligence-webphone/frontend` 
  - `insight-intelligence-webphone/nginx`

### Authentication
- **Docker Login**: `docker login us-phoenix-1.ocir.io -u 'axoxnwhj7c1a/drchiniquy@gmail.com' -p '<auth-token>'`
- **Dynamic Group**: `insight-intelligence-webphone-instances`
- **IAM Policy**: Allows instances to pull from OCIR

## Webhook Configuration

### Webhook URLs (for Twilio Console)
```json
{
  "don": {
    "voice_webhook": "http://137.131.4.94/webhooks/voice/don",
    "sms_webhook": "http://137.131.4.94/webhooks/sms/don", 
    "status_callback": "http://137.131.4.94/webhooks/status/don"
  },
  "demie": {
    "voice_webhook": "http://137.131.4.94/webhooks/voice/demie",
    "sms_webhook": "http://137.131.4.94/webhooks/sms/demie",
    "status_callback": "http://137.131.4.94/webhooks/status/demie"
  },
  "business": {
    "voice_webhook": "http://137.131.4.94/webhooks/voice/business", 
    "sms_webhook": "http://137.131.4.94/webhooks/sms/business",
    "status_callback": "http://137.131.4.94/webhooks/status/business"
  }
}
```

## Server Setup (Completed)

### Database Server Configuration
- **Services**: MongoDB (port 27017), Redis (port 6379)
- **Docker Compose**: Configured with health checks and logging
- **Backup System**: 
  - Daily automated backups at 2 AM
  - Backup script: `/usr/local/bin/backup-webphone-db`
  - Restore script: `/usr/local/bin/restore-webphone-db`
- **Monitoring**: Health checks every 5 minutes via cron
- **Security**: Auto-generated passwords, limited user permissions

### Application Server Configuration  
- **Docker Setup**: Docker CE with compose plugin
- **OCIR Integration**: Automated login script
- **Application Structure**: `/opt/webphone-app/`
- **Services**: Backend (port 3001), Frontend (port 3000), Nginx (ports 80/443)
- **Monitoring**: Health monitoring script
- **Updates**: `/usr/local/bin/update-webphone` for zero-downtime deployments
- **Temporary Page**: Currently serving placeholder at `http://137.131.4.94`

## Technology Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Cache**: Redis for sessions and temporary data
- **Authentication**: JWT tokens
- **Twilio**: SDK for call/SMS management

### Frontend
- **Framework**: React
- **Type**: Progressive Web App (PWA)
- **Mobile Support**: iPhone-optimized interface
- **Build Tool**: Create React App or Vite
- **State Management**: Context API or Redux Toolkit

### Infrastructure
- **Cloud Provider**: Oracle Cloud Infrastructure (OCI)
- **Containerization**: Docker with Docker Compose
- **Reverse Proxy**: Nginx
- **SSL**: Let's Encrypt (to be configured)
- **Monitoring**: Custom health check scripts

## Development Workflow

### Container Build Process
1. **Local Development**: Develop application locally
2. **Container Build**: Build Docker images for backend, frontend, nginx
3. **Push to OCIR**: Upload images to container registry
4. **Deploy**: Run update script on app server to pull latest images

### Deployment Commands
```bash
# Login to OCIR
docker login us-phoenix-1.ocir.io -u 'axoxnwhj7c1a/drchiniquy@gmail.com' -p '<auth-token>'

# Build and tag images
docker build -t us-phoenix-1.ocir.io/axoxnwhj7c1a/insight-intelligence-webphone/backend:latest ./backend
docker build -t us-phoenix-1.ocir.io/axoxnwhj7c1a/insight-intelligence-webphone/frontend:latest ./frontend  
docker build -t us-phoenix-1.ocir.io/axoxnwhj7c1a/insight-intelligence-webphone/nginx:latest ./nginx

# Push images
docker push us-phoenix-1.ocir.io/axoxnwhj7c1a/insight-intelligence-webphone/backend:latest
docker push us-phoenix-1.ocir.io/axoxnwhj7c1a/insight-intelligence-webphone/frontend:latest
docker push us-phoenix-1.ocir.io/axoxnwhj7c1a/insight-intelligence-webphone/nginx:latest

# Deploy on server
ssh opc@137.131.4.94 "sudo /usr/local/bin/update-webphone"
```

## File Structure

### Terraform Infrastructure
```
terraform/
├── main.tf              # Provider and backend configuration
├── variables.tf         # Variable definitions  
├── terraform.tfvars     # Variable values (gitignored)
├── network.tf           # VCN, subnets, gateways, security
├── compute.tf           # VM instances and setup scripts
├── registry.tf          # OCIR repositories and IAM
└── scripts/
    ├── setup_app.sh     # Application server setup
    └── setup_db.sh      # Database server setup
```

### Application Structure (To Be Created)
```
insight-intelligence-webphone/
├── backend/             # Node.js API
├── frontend/            # React PWA
├── nginx/               # Reverse proxy configuration
├── docker-compose.yml   # Local development
└── kubernetes/          # Future K8s deployment (optional)
```

## Current Status

### ✅ Completed (Phase 1 - Infrastructure & Application)
- [x] OCI account setup and CLI configuration
- [x] SSH key generation and OCI configuration  
- [x] Terraform backend with OCI Object Storage
- [x] Network infrastructure deployment (VCN, subnets, security lists)
- [x] OCIR repositories creation (backend, frontend, nginx)
- [x] Compute instances deployment (app server: 137.131.4.94, db server)
- [x] Database server setup (MongoDB + Redis) 
- [x] Application server Docker setup
- [x] IAM policies for container registry access
- [x] **Full application development** (Node.js backend, React frontend, nginx)
- [x] **Docker containerization** (all services containerized)
- [x] **Production deployment pipeline** (build, push, deploy)
- [x] **OCIR integration** (automated image push/pull)
- [x] **Application deployed and running** at http://137.131.4.94
- [x] **Twilio integration configured** (credentials, multi-number support)
- [x] **Webhook endpoints active** (/webhooks/{voice|sms}/{don|demie|business})
- [x] **nginx configuration fixed** (frontend port routing corrected)
- [x] **Deployment automation** (deploy.sh script, docker-compose.prod.yml)
- [x] **Redeployment testing** (verified full pipeline works)

### 🔄 Current Phase (Phase 2 - DevOps & Production)
- [ ] **GitHub Actions CI/CD** (automated build/deploy on git push)  
- [ ] **Custom domain setup** (DNS configuration with AWS Route53)
- [ ] **SSL certificates** (Let's Encrypt with automatic renewal)
- [ ] **Production monitoring** (logging, alerting, health checks)
- [ ] **Twilio webhook configuration** (update phone numbers in console)

### 🎯 Future Enhancements
- [ ] Custom domain setup (if domain_name provided)
- [ ] Advanced monitoring and alerting
- [ ] Automated CI/CD pipeline
- [ ] Load balancing for high availability
- [ ] Database backups to OCI Object Storage
- [ ] WebRTC integration for browser calling

## Key Design Decisions Made

1. **Containerized Deployment**: Chose Docker over direct package installation for easier updates and consistency
2. **OCI over AWS/Azure**: Using OCI free tier for cost optimization
3. **OCIR over Docker Hub**: Using OCI's native container registry for better integration
4. **2-VM Architecture**: Separate app and database servers for security and resource optimization
5. **ARM Instances**: Using A1.Flex shape for better price/performance on free tier
6. **Multi-Number Support**: Built-in routing for different Twilio number configurations
7. **PWA Approach**: Mobile-first design for iPhone compatibility
8. **JWT Authentication**: Stateless authentication for scalability

## Environment Configuration

### Terraform Variables
```hcl
# Required OCI Configuration
tenancy_ocid     = "ocid1.tenancy.oc1..aaaaaaaa2wyymtgm7egokg3zhavn7faqyrvlwk3a6zqkqommamjtszibctba"
user_ocid        = "ocid1.user.oc1..aaaaaaaadm6bhi7ha5cfrs4oifcmfpkrn3372splkgx4entzleqnzowskyua"  
compartment_ocid = "ocid1.tenancy.oc1..aaaaaaaa2wyymtgm7egokg3zhavn7faqyrvlwk3a6zqkqommamjtszibctba"
fingerprint      = "f6:a7:7c:14:85:5e:3e:4d:97:b4:eb:bb:87:89:1b:73"
private_key_path = "/Users/donchiniquy/.oci/oci_api_key.pem"
region           = "us-phoenix-1"
ssh_public_key_path = "/Users/donchiniquy/.ssh/oci_vm_key.pub"
ocir_username    = "drchiniquy@gmail.com"

# Twilio Configuration
twilio_numbers = {
  don      = { number = "+1234567890", type = "personal" }
  demie    = { number = "+1234567891", type = "personal" }  
  business = { number = "+1234567892", type = "business" }
}

# Optional Domain (empty for IP-based access)
domain_name = ""
```

## Troubleshooting

### Common Issues
1. **OCI CLI Authentication**: Ensure API key path is absolute in `~/.oci/config`
2. **Terraform Backend**: Use OCI native backend, not S3-compatible 
3. **Container Registry**: Must login to OCIR before pushing images
4. **SSH Access**: Database server only accessible via jump host (app server)

### Log Locations
- **Setup Logs**: `/var/log/setup_app.log`, `/var/log/setup_db.log`
- **Application Logs**: `/opt/webphone-app/logs/`
- **Database Logs**: `/opt/webphone-db/`
- **Monitor Logs**: `/opt/webphone-{app,db}/monitor.log`

This document serves as the single source of truth for the project architecture, current status, and next steps.