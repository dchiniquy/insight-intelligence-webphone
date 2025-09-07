#!/bin/bash

# Update system
yum update -y

# Install Docker
yum install -y docker
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install AWS CLI v2 for ARM64
curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip"
yum install -y unzip
unzip awscliv2.zip
./aws/install

# Create application directory and logs directory
mkdir -p /opt/webphone/logs
cd /opt/webphone

# Configure ECR login first
aws configure set default.region ${aws_region}

# Login to ECR immediately
REPO_URL=$(echo "${backend_repo_url}" | cut -d'/' -f1)
aws ecr get-login-password --region ${aws_region} | docker login --username AWS --password-stdin $REPO_URL

# Create docker-compose.yml optimized for fast startup
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  mongodb:
    image: mongo:6-focal
    container_name: webphone-mongodb
    environment:
      - MONGO_INITDB_DATABASE=webphone
    volumes:
      - mongodb_data:/data/db
    restart: unless-stopped
    networks:
      - webphone-network

  redis:
    image: redis:7-alpine
    container_name: webphone-redis
    volumes:
      - redis_data:/data
    restart: unless-stopped
    networks:
      - webphone-network

  backend:
    image: ${backend_repo_url}:latest
    container_name: webphone-backend
    environment:
      - NODE_ENV=production
      - PORT=3001
      - MONGODB_URI=mongodb://mongodb:27017/webphone
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=your-super-secure-jwt-secret-change-this-in-production-2024
      - TWILIO_ACCOUNT_SID=${twilio_account_sid}
      - TWILIO_AUTH_TOKEN=${twilio_auth_token}
      - TWILIO_NUMBERS_CONFIG={"don":{"number":"${twilio_don_number}","type":"personal"},"demie":{"number":"${twilio_demie_number}","type":"personal"},"business":{"number":"${twilio_business_number}","type":"business"}}
    restart: unless-stopped
    networks:
      - webphone-network
    depends_on:
      - mongodb
      - redis

  frontend:
    image: ${frontend_repo_url}:latest
    container_name: webphone-frontend
    environment:
      - REACT_APP_API_URL=/api
      - REACT_APP_WS_URL=/
    restart: unless-stopped
    networks:
      - webphone-network

  nginx:
    image: nginx:alpine
    container_name: webphone-nginx
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    restart: unless-stopped
    networks:
      - webphone-network
    depends_on:
      - backend
      - frontend

volumes:
  mongodb_data:
    driver: local
  redis_data:
    driver: local

networks:
  webphone-network:
    driver: bridge
EOF

# Create nginx configuration
cat > nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend:3001;
    }
    
    upstream frontend {
        server frontend:80;
    }
    
    server {
        listen 80;
        
        # Health check endpoint (returns immediately)
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
        
        # Backend API routes
        location /api/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Forwarded-Host $host;
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
        }
        
        # Frontend routes (everything else)
        location / {
            proxy_pass http://frontend/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Forwarded-Host $host;
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
        }
    }
}
EOF

# Create optimized startup script
cat > start.sh << 'EOF'
#!/bin/bash

set -e  # Exit on error

echo "Starting webphone application..."

# Login to ECR
echo "Logging into ECR..."
REPO_URL=$(echo "${backend_repo_url}" | cut -d'/' -f1)
aws ecr get-login-password --region ${aws_region} | docker login --username AWS --password-stdin $REPO_URL

# Pull images quickly
echo "Pulling container images..."
docker-compose pull --parallel

# Start services
echo "Starting services..."
docker-compose up -d

# Brief wait then show status
echo "Services starting..."
sleep 5
docker-compose ps

echo "Webphone application startup initiated successfully"
EOF

chmod +x start.sh

# Create systemd service with better configuration
cat > /etc/systemd/system/webphone.service << EOF
[Unit]
Description=Webphone Application
Requires=docker.service
After=docker.service network.target
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/webphone
ExecStart=/opt/webphone/start.sh
ExecStop=/usr/local/bin/docker-compose down --timeout 30
TimeoutStartSec=300
TimeoutStopSec=60
User=root
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Set ownership before starting
chown -R ec2-user:ec2-user /opt/webphone

# Enable and start the service
systemctl daemon-reload
systemctl enable webphone.service

# Start the service in background and continue
echo "Starting webphone service..."
systemctl start webphone.service &

# Create log rotation
cat > /etc/logrotate.d/webphone << EOF
/opt/webphone/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 ec2-user ec2-user
}
EOF

# Wait a bit for service to initialize
sleep 10

echo "User data script completed - v2" > /var/log/user-data.log
echo "Service status:" >> /var/log/user-data.log
systemctl status webphone.service >> /var/log/user-data.log 2>&1