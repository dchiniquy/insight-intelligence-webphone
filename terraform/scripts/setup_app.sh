#!/bin/bash
# Application Server Setup Script

set -e
exec > >(tee /var/log/setup_app.log) 2>&1

echo "=== Starting WebPhone App Server Setup ==="

# Wait for cloud-init to complete
while [ ! -f /var/lib/cloud/instance/boot-finished ]; do
  echo "Waiting for cloud-init to finish..."
  sleep 5
done

# Update system
echo "Updating system packages..."
sudo dnf update -y

# Install Docker
echo "Installing Docker..."
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker opc

# Install OCI CLI for instance principal authentication
echo "Installing OCI CLI..."
sudo dnf install -y python36-oci-cli

# Create application directory
echo "Creating application directory..."
sudo mkdir -p /opt/webphone-app/{data,logs,ssl,config}
sudo chown -R opc:opc /opt/webphone-app
cd /opt/webphone-app

# Setup OCIR authentication
echo "Setting up OCIR authentication..."
cat << 'SCRIPT' | sudo tee /usr/local/bin/ocir-login
#!/bin/bash
# Login to OCIR using auth token
echo '${auth_token}' | docker login ${ocir_url} \
  -u '${ocir_namespace}/${ocir_username}' \
  --password-stdin

echo "OCIR login successful"
SCRIPT

sudo chmod +x /usr/local/bin/ocir-login

# Create environment file
echo "Creating environment configuration..."
cat << 'ENV' > .env
# Node Environment
NODE_ENV=production
PORT=3001

# Database Configuration
MONGODB_URI=mongodb://${db_host}:27017/webphone-app
REDIS_URL=redis://${db_host}:6379

# Security
SESSION_SECRET=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)

# Twilio Numbers Configuration
TWILIO_NUMBERS_CONFIG='${twilio_numbers}'

# Domain Configuration
DOMAIN_NAME=${domain_name}

# OCIR Configuration
OCIR_URL=${ocir_url}
OCIR_NAMESPACE=${ocir_namespace}

# Application URLs
BACKEND_IMAGE=${backend_image}
FRONTEND_IMAGE=${frontend_image}
NGINX_IMAGE=${nginx_image}
ENV

# Create Docker Compose configuration
echo "Creating Docker Compose configuration..."
cat << 'COMPOSE' > docker-compose.yml
version: '3.8'

services:
  backend:
    image: ${backend_image}:latest
    container_name: webphone-backend
    restart: unless-stopped
    ports:
      - "3001:3001"
    env_file: .env
    volumes:
      - ./data:/app/data
      - ./logs/backend:/app/logs
    networks:
      - webphone-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  frontend:
    image: ${frontend_image}:latest
    container_name: webphone-frontend
    restart: unless-stopped
    ports:
      - "3000:80"
    environment:
      - REACT_APP_API_URL=http://backend:3001/api
      - REACT_APP_WS_URL=ws://backend:3001
    depends_on:
      backend:
        condition: service_healthy
    networks:
      - webphone-network
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  nginx:
    image: ${nginx_image}:latest
    container_name: webphone-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./ssl:/etc/nginx/ssl:ro
      - ./logs/nginx:/var/log/nginx
    depends_on:
      - backend
      - frontend
    networks:
      - webphone-network
    healthcheck:
      test: ["CMD", "nginx", "-t"]
      interval: 30s
      timeout: 10s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

networks:
  webphone-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.25.0.0/16

volumes:
  backend_data:
  backend_logs:
  nginx_logs:
COMPOSE

# Create update script
echo "Creating update script..."
cat << 'UPDATE' | sudo tee /usr/local/bin/update-webphone
#!/bin/bash
set -e

echo "Starting WebPhone app update..."

# Login to OCIR
/usr/local/bin/ocir-login

# Navigate to app directory
cd /opt/webphone-app

# Pull latest images
echo "Pulling latest images..."
docker compose pull

# Update containers with zero-downtime deployment
echo "Updating containers..."
docker compose up -d --remove-orphans

# Wait for health checks
echo "Waiting for services to be healthy..."
sleep 30

# Verify services are running
echo "Verifying deployment..."
docker compose ps
docker compose logs --tail=50

# Clean up old images
docker image prune -af

echo "Update completed successfully!"
UPDATE

sudo chmod +x /usr/local/bin/update-webphone

# Create monitoring script
cat << 'MONITOR' | sudo tee /usr/local/bin/monitor-webphone
#!/bin/bash
# Health monitoring script

check_service() {
    local service_name=$1
    if docker compose ps | grep -q "$service_name.*Up.*healthy"; then
        echo "$(date): $service_name: HEALTHY"
        return 0
    else
        echo "$(date): $service_name: UNHEALTHY"
        # Could trigger alerts here
        return 1
    fi
}

cd /opt/webphone-app

echo "=== WebPhone Health Check ==="
check_service "webphone-backend"
check_service "webphone-frontend" 
check_service "webphone-nginx"

# Check disk space
df -h /opt/webphone-app
echo "=========================="
MONITOR

sudo chmod +x /usr/local/bin/monitor-webphone

# Setup log directories
mkdir -p logs/{backend,frontend,nginx}

# Setup log rotation
echo "Setting up log rotation..."
cat << 'LOGROTATE' | sudo tee /etc/logrotate.d/webphone-app
/opt/webphone-app/logs/*/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 opc opc
    sharedscripts
    postrotate
        docker exec webphone-backend kill -USR1 1 2>/dev/null || true
        docker exec webphone-nginx nginx -s reopen 2>/dev/null || true
    endscript
}
LOGROTATE

# Add monitoring to crontab
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/monitor-webphone >> /opt/webphone-app/logs/monitor.log 2>&1") | crontab -

# Initial setup - login to OCIR
echo "Performing initial OCIR login..."
/usr/local/bin/ocir-login

# Create a simple index.html for now (until containers are built)
echo "Creating temporary landing page..."
mkdir -p /tmp/nginx-temp
cat << 'HTML' > /tmp/nginx-temp/index.html
<!DOCTYPE html>
<html>
<head>
    <title>WebPhone App - Initializing</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
        .status { color: #007bff; }
    </style>
</head>
<body>
    <h1>WebPhone App</h1>
    <p class="status">Infrastructure deployed successfully!</p>
    <p>Waiting for application containers to be built and deployed...</p>
    <p>Server IP: $(curl -s http://169.254.169.254/opc/v1/vnics/ | python3 -c "import sys, json; print(json.load(sys.stdin)[0]['publicIp'])" 2>/dev/null || echo 'Detecting...')</p>
</body>
</html>
HTML

# Serve temporary page with nginx
docker run -d \
  --name temp-nginx \
  --restart unless-stopped \
  -p 80:80 \
  -v /tmp/nginx-temp:/usr/share/nginx/html:ro \
  nginx:alpine

echo "=== WebPhone App Server Setup Complete ==="
echo "Server is ready for container deployment"
echo "Access temporary page at: http://$(curl -s http://169.254.169.254/opc/v1/vnics/ | python3 -c "import sys, json; print(json.load(sys.stdin)[0]['publicIp'])" 2>/dev/null)"
echo "Next steps:"
echo "1. Build and push your application containers to OCIR"
echo "2. Run: /usr/local/bin/update-webphone"