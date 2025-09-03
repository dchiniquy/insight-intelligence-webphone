#!/bin/bash

# Deployment script for Insight Intelligence WebPhone
# This script builds, pushes, and deploys the application to OCI

set -e  # Exit on any error

echo "🚀 Starting deployment process..."

# Configuration
REGISTRY_URL="us-phoenix-1.ocir.io"
NAMESPACE="axoxnwhj7c1a"
IMAGE_TAG="${IMAGE_TAG:-latest}"
APP_SERVER="137.131.4.94"
SSH_KEY="$HOME/.ssh/oci_vm_key"

# Check prerequisites
if [ ! -f "$SSH_KEY" ]; then
    echo "❌ SSH key not found at $SSH_KEY"
    exit 1
fi

if [ ! -f "terraform.tfvars" ] && [ ! -f "terraform/terraform.tfvars" ]; then
    echo "❌ terraform.tfvars not found"
    exit 1
fi

echo "✅ Prerequisites checked"

# Step 1: Build Docker images
echo "📦 Building Docker images..."

docker build -t insight-intelligence-webphone-backend:latest ./backend
docker build -t insight-intelligence-webphone-frontend:latest ./frontend  
docker build -t insight-intelligence-webphone-nginx:latest ./nginx

# Step 2: Tag images for OCIR
echo "🏷️ Tagging images for OCIR..."

docker tag insight-intelligence-webphone-backend:latest $REGISTRY_URL/$NAMESPACE/insight-intelligence-webphone/backend:$IMAGE_TAG
docker tag insight-intelligence-webphone-frontend:latest $REGISTRY_URL/$NAMESPACE/insight-intelligence-webphone/frontend:$IMAGE_TAG
docker tag insight-intelligence-webphone-nginx:latest $REGISTRY_URL/$NAMESPACE/insight-intelligence-webphone/nginx:$IMAGE_TAG

# Step 3: Push to OCIR (assumes docker login already done)
echo "📤 Pushing images to OCIR..."

docker push $REGISTRY_URL/$NAMESPACE/insight-intelligence-webphone/backend:$IMAGE_TAG
docker push $REGISTRY_URL/$NAMESPACE/insight-intelligence-webphone/frontend:$IMAGE_TAG
docker push $REGISTRY_URL/$NAMESPACE/insight-intelligence-webphone/nginx:$IMAGE_TAG

# Step 4: Deploy to server
echo "🚢 Deploying to app server..."

# Copy production docker-compose
scp -i "$SSH_KEY" docker-compose.prod.yml opc@$APP_SERVER:/tmp/docker-compose.yml

# Copy production environment file  
scp -i "$SSH_KEY" .env.prod opc@$APP_SERVER:/tmp/.env

# Deploy on server
ssh -i "$SSH_KEY" opc@$APP_SERVER << 'EOF'
    cd /opt/webphone-app
    
    # Stop current services
    docker compose down 2>/dev/null || true
    
    # Update docker-compose file
    sudo mv /tmp/docker-compose.yml .
    sudo mv /tmp/.env .
    sudo chown opc:opc docker-compose.yml .env
    
    # Pull latest images
    docker compose pull
    
    # Start services
    docker compose up -d
    
    # Wait a moment for services to start
    sleep 10
    
    # Show status
    docker compose ps
EOF

# Step 5: Verify deployment
echo "🔍 Verifying deployment..."

sleep 5
HTTP_STATUS=$(curl -o /dev/null -s -w "%{http_code}" http://$APP_SERVER/health)

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Deployment successful! Application is running at http://$APP_SERVER"
    echo "📱 Frontend: http://$APP_SERVER"
    echo "🔗 Webhooks: http://$APP_SERVER/webhooks/{voice|sms}/{don|demie|business}"
else
    echo "❌ Deployment verification failed (HTTP $HTTP_STATUS)"
    exit 1
fi

echo "🎉 Deployment complete!"