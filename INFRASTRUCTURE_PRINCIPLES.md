# Infrastructure Principles

## Immutable Infrastructure Pattern

**CRITICAL**: We always follow immutable infrastructure patterns for this project. No modifications should be made to running servers or containers in production.

### Core Principles

1. **Never modify running infrastructure**
   - No SSH into production servers to install packages
   - No manual configuration changes on running instances
   - No direct file modifications on deployed servers

2. **All changes through code**
   - Infrastructure changes via Terraform
   - Application changes via container images
   - Configuration changes via environment variables or config files in repositories

3. **Deployment is replacement, not modification**
   - Deploy new container images, don't update running containers
   - Create new infrastructure, don't modify existing infrastructure
   - Use blue-green or rolling deployments for zero-downtime updates

### Implementation Guidelines

#### ✅ CORRECT Approaches:

**SSL/TLS Configuration:**
- Use OCI Load Balancer with managed SSL certificates
- Use Cloudflare for SSL termination
- Build SSL certificates into container images during CI/CD

**Package Installation:**
- Add dependencies to Dockerfile
- Build new container image
- Deploy new image

**Configuration Changes:**
- Update docker-compose files
- Update Terraform configurations
- Update environment variables in deployment scripts

**Server Updates:**
- Create new server instances via Terraform
- Deploy applications to new instances
- Switch traffic to new instances
- Destroy old instances

#### ❌ INCORRECT Approaches:

**SSL/TLS Configuration:**
- SSH into server and install certbot
- Manually configure nginx on running server
- Add certificate files directly to running containers

**Package Installation:**
- SSH into server and run `dnf install` or `apt install`
- Install tools directly on production servers
- Modify running containers with `docker exec`

**Configuration Changes:**
- Edit configuration files on running servers
- Manually restart services
- Apply patches directly to production

### Benefits of Immutable Infrastructure

1. **Predictability**: Every deployment is identical
2. **Reliability**: No configuration drift between environments
3. **Rollback**: Easy to revert to previous known-good state
4. **Scaling**: Easy to create identical instances
5. **Security**: Reduced attack surface, no persistent changes
6. **Compliance**: Clear audit trail of all changes

### Emergency Exception Protocol

If emergency changes are required:

1. **Document the change** immediately in a GitHub issue
2. **Apply the same change to code** within 24 hours
3. **Redeploy from code** to ensure consistency
4. **Destroy and recreate** the modified infrastructure when possible

### Architecture Patterns We Follow

#### Container Strategy:
- **Stateless application containers** - can be destroyed and recreated at any time
- **External persistent storage** - databases and files in external volumes/services
- **Configuration via environment** - no baked-in configuration that can't be changed

#### Infrastructure Strategy:
- **Infrastructure as Code (Terraform)** - all infrastructure defined in version control
- **Managed services** - prefer OCI managed services over self-hosted when possible
- **Load balancers for SSL** - terminate SSL at infrastructure level, not application level

#### Deployment Strategy:
- **Blue-Green deployments** - maintain two identical environments
- **Container registries** - use OCIR for versioned container images
- **Automated rollback** - ability to quickly revert to previous version

### Project-Specific Applications

#### SSL Implementation:
- **CHOSEN**: OCI Load Balancer with SSL termination
- **WHY**: Fully managed, auto-renewal, no server modifications required
- **HOW**: Terraform configures load balancer, DNS points to load balancer IP

#### Database Strategy:
- **CHOSEN**: Containerized MongoDB with external volumes
- **WHY**: Predictable, version-controlled, easy backup/restore
- **HOW**: Docker volumes for persistence, init scripts for schema

#### Secrets Management:
- **CHOSEN**: Environment variables from secure .env files
- **WHY**: No secrets baked into containers, easy rotation
- **HOW**: Copy .env.prod during deployment, never commit secrets to git

### Monitoring Compliance

Track these metrics to ensure immutable infrastructure compliance:

- **Server uptime**: Servers should be replaced regularly, not run for months
- **Container age**: Application containers should be replaced with each deployment
- **SSH connections**: Should be zero or only for troubleshooting/monitoring
- **Package installations**: Should only occur in Dockerfile builds, not on running systems

### Tools and Technologies

#### Approved for Immutable Infrastructure:
- **Terraform**: Infrastructure provisioning and management
- **Docker**: Container image building and deployment
- **OCI Services**: Managed services (Load Balancer, Certificate Management, etc.)
- **Git**: Version control for all infrastructure and application code
- **CI/CD Pipelines**: Automated testing and deployment

#### Discouraged Patterns:
- **Configuration management tools** (Ansible, Puppet, Chef) on production
- **Manual server administration**
- **In-place updates or patches**
- **Mutable infrastructure management**

---

**Remember**: If you can't reproduce the exact same environment from code alone, you're not following immutable infrastructure principles.

Last Updated: September 3, 2025