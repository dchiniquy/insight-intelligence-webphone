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

# Create application directory
mkdir -p /opt/webphone
cd /opt/webphone

# Configure ECR login
aws configure set default.region ${aws_region}

# Login to ECR
REPO_URL=$(echo "${backend_repo_url}" | cut -d'/' -f1)
aws ecr get-login-password --region ${aws_region} | docker login --username AWS --password-stdin $REPO_URL

# Create simplified docker-compose.yml - backend serves frontend directly
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
      - ./init-db:/docker-entrypoint-initdb.d:ro
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

  app:
    image: ${backend_repo_url}:simple
    container_name: webphone-app
    environment:
      - NODE_ENV=production
      - PORT=3001
      - MONGODB_URI=mongodb://mongodb:27017/webphone
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=your-super-secure-jwt-secret-change-this-in-production-2024
      - FRONTEND_URL=http://webphone-alb-1096969446.us-west-2.elb.amazonaws.com
      - TWILIO_ACCOUNT_SID=${twilio_account_sid}
      - TWILIO_AUTH_TOKEN=${twilio_auth_token}
      - TWILIO_NUMBERS_CONFIG={"don":{"number":"${twilio_don_number}","type":"personal"},"demie":{"number":"${twilio_demie_number}","type":"personal"},"business":{"number":"${twilio_business_number}","type":"business"}}
    ports:
      - "3001:3001"
    restart: unless-stopped
    networks:
      - webphone-network
    depends_on:
      - mongodb
      - redis
    volumes:
      - frontend_build:/app/public

  # Sidecar container to extract frontend files
  frontend:
    image: ${frontend_repo_url}:latest
    container_name: webphone-frontend
    volumes:
      - frontend_build:/tmp/build
    networks:
      - webphone-network
    command: sh -c "cp -r /usr/share/nginx/html/* /tmp/build/ && tail -f /dev/null"
    depends_on:
      - app

volumes:
  mongodb_data:
    driver: local
  redis_data:
    driver: local
  frontend_build:
    driver: local

networks:
  webphone-network:
    driver: bridge
EOF

# Create MongoDB initialization directory
mkdir -p init-db

# Create admin user initialization script
cat > init-db/01-create-admin.js << 'EOF'
// MongoDB initialization script to create default admin user
db = db.getSiblingDB('webphone');

// Create admin user for development
const adminExists = db.users.findOne({ email: 'admin@webphone.local' });

if (!adminExists) {
  db.users.insertOne({
    username: 'admin',
    email: 'admin@webphone.local',
    password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj5w7UjnzQCy', // hashed 'password123'
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    phone: '+15551234567',
    preferences: {
      theme: 'auto',
      notifications: {
        email: true,
        push: true,
        sms: false
      },
      defaultTwilioNumber: 'don'
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  print('Admin user created: admin@webphone.local / password123');
} else {
  print('Admin user already exists');
}

// Create indexes for better performance
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.calls.createIndex({ userId: 1, createdAt: -1 });
db.calls.createIndex({ callSid: 1 }, { unique: true });
db.calls.createIndex({ twilioNumber: 1, createdAt: -1 });
db.messages.createIndex({ userId: 1, createdAt: -1 });
db.messages.createIndex({ messageSid: 1 }, { unique: true });
db.messages.createIndex({ twilioNumber: 1, createdAt: -1 });
db.messages.createIndex({ 'thread.threadId': 1, createdAt: 1 });

print('Database indexes created successfully');
EOF

# Create startup script
cat > start.sh << 'EOF'
#!/bin/bash

set -e

echo "Starting simple webphone application..."

# Login to ECR
echo "Logging into ECR..."
REPO_URL=$(echo "${backend_repo_url}" | cut -d'/' -f1)
aws ecr get-login-password --region ${aws_region} | docker login --username AWS --password-stdin $REPO_URL

# Pull images
echo "Pulling container images..."
docker-compose pull

# Start services
echo "Starting services..."
docker-compose up -d

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 30

# Show status
docker-compose ps

echo "Simple webphone application started successfully"
echo "Application will be available on port 3001"
EOF

chmod +x start.sh

# Create systemd service
cat > /etc/systemd/system/webphone-simple.service << EOF
[Unit]
Description=Simple Webphone Application
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

# Set ownership
chown -R ec2-user:ec2-user /opt/webphone

# Enable and start the service
systemctl daemon-reload
systemctl enable webphone-simple.service

# Start the service
echo "Starting webphone-simple service..."
systemctl start webphone-simple.service

# Wait for startup
sleep 30

echo "Simple deployment completed" > /var/log/user-data.log
systemctl status webphone-simple.service >> /var/log/user-data.log 2>&1