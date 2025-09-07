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

# Install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip"
yum install -y unzip
unzip awscliv2.zip
./aws/install

# Create simple test web server for debugging
mkdir -p /opt/webphone
cd /opt/webphone

# Create a simple nginx container that just returns 200 for testing
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    container_name: webphone-nginx
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    restart: unless-stopped
EOF

# Create simple nginx configuration that always returns healthy
cat > nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    server {
        listen 80;
        
        location / {
            access_log off;
            return 200 "Webphone app is starting...\n";
            add_header Content-Type text/plain;
        }
        
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
EOF

# Start simple service
docker-compose up -d

# Create systemd service for automatic startup
cat > /etc/systemd/system/webphone.service << EOF
[Unit]
Description=Webphone Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/webphone
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

# Enable and start the service
systemctl daemon-reload
systemctl enable webphone.service
systemctl start webphone.service

# Set ownership
chown -R ec2-user:ec2-user /opt/webphone

echo "Debug user data script completed" > /var/log/user-data.log
echo "Service status:" >> /var/log/user-data.log
systemctl status webphone.service >> /var/log/user-data.log