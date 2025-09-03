# WebPhone - Multi-Number Twilio Application

A containerized web application for managing multiple Twilio phone numbers with separate configurations for personal, business, and testing use cases. Built with Node.js, React, and deployed on Oracle Cloud Infrastructure (OCI).

## 🚀 Quick Start

### Prerequisites

- **Docker** and **Docker Compose** installed
- **Node.js 18+** (for local development outside containers)
- **Twilio Account** with phone numbers
- **OCI Account** (for production deployment)

### 1. Clone and Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd insight-intelligence-webphone

# Copy environment template
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `.env` file with your Twilio credentials:

```bash
# Required: Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here

# Required: Your Twilio Phone Numbers
TWILIO_DON_NUMBER=+15551234567
TWILIO_DEMIE_NUMBER=+15551234568  
TWILIO_BUSINESS_NUMBER=+15551234569

# Development URLs
BASE_URL=http://localhost
```

### 3. Start Development Environment

```bash
# Build and start all services
docker-compose up --build

# Or run in background
docker-compose up --build -d
```

### 4. Access the Application

- **Frontend**: http://localhost
- **Backend API**: http://localhost/api
- **Database**: MongoDB on localhost:27017, Redis on localhost:6379

### 5. Login

Use the default admin account:
- **Email**: `admin@webphone.local`
- **Password**: `password123`

## 📋 Development Workflow

### Local Development (Without Docker)

If you prefer to run services individually:

#### Backend Development

```bash
cd backend

# Install dependencies
npm install

# Set environment variables
export MONGODB_URI="mongodb://localhost:27017/webphone-app"
export REDIS_URL="redis://localhost:6379"
export NODE_ENV=development
export JWT_SECRET=your-dev-jwt-secret
export SESSION_SECRET=your-dev-session-secret

# Start development server
npm run dev

# Backend will run on http://localhost:3001
```

#### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Set environment variables
export REACT_APP_API_URL=http://localhost:3001/api
export REACT_APP_WS_URL=ws://localhost:3001

# Start development server
npm start

# Frontend will run on http://localhost:3000
```

#### Database Setup

```bash
# Start MongoDB and Redis with Docker
docker run -d --name webphone-mongodb -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=webphone \
  -e MONGO_INITDB_ROOT_PASSWORD=dev-password-123 \
  mongo:7-jammy

docker run -d --name webphone-redis -p 6379:6379 \
  redis:7-alpine redis-server --requirepass dev-redis-123
```

## 🔧 Project Structure

```
insight-intelligence-webphone/
├── backend/                 # Node.js API server
│   ├── src/
│   │   ├── controllers/     # API route controllers
│   │   ├── models/         # MongoDB models
│   │   ├── routes/         # Express routes
│   │   ├── services/       # Business logic (Twilio, etc.)
│   │   ├── middleware/     # Auth, validation, etc.
│   │   └── config/         # Database, logging config
│   ├── package.json
│   └── Dockerfile
├── frontend/               # React PWA
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── store/         # Redux store and slices
│   │   ├── services/      # API client
│   │   └── utils/         # Helper functions
│   ├── public/
│   ├── package.json
│   └── Dockerfile
├── nginx/                  # Reverse proxy configuration
│   ├── conf.d/
│   ├── nginx.conf
│   └── Dockerfile
├── terraform/              # OCI infrastructure as code
│   ├── compute.tf         # VM instances
│   ├── network.tf         # VCN, subnets, security
│   ├── registry.tf        # OCIR container registry
│   └── scripts/           # Server setup scripts
├── docker-compose.yml      # Local development stack
├── .env.example           # Environment template
└── README.md
```

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Calls
- `GET /api/calls` - List calls
- `POST /api/calls` - Make a new call
- `GET /api/calls/:id` - Get call details
- `GET /api/calls/stats` - Call statistics

### Messages
- `GET /api/messages` - List messages
- `POST /api/messages` - Send message
- `GET /api/messages/threads` - Get conversation threads
- `GET /api/messages/conversation/:twilioNumber/:otherNumber` - Get conversation

### Webhooks (Twilio)
- `POST /webhooks/voice/:numberKey` - Voice call webhooks
- `POST /webhooks/sms/:numberKey` - SMS webhooks
- `POST /webhooks/status/:numberKey` - Status callbacks

## 📱 Multi-Number Configuration

The application supports three Twilio number configurations:

- **`don`**: Personal number
- **`demie`**: Secondary personal/family number  
- **`business`**: Business/professional number

Each number has separate:
- Webhook endpoints
- Call/message routing
- Configuration settings

## 🔐 Environment Variables

### Required Variables

```bash
# Twilio Credentials
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token

# Phone Numbers
TWILIO_DON_NUMBER=+1234567890
TWILIO_DEMIE_NUMBER=+1234567891
TWILIO_BUSINESS_NUMBER=+1234567892

# Application URLs
BASE_URL=http://localhost           # For development
DOMAIN_NAME=your-domain.com        # For production (optional)
```

### Optional Variables

```bash
# Database
MONGODB_URI=mongodb://localhost:27017/webphone-app
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your-jwt-secret
SESSION_SECRET=your-session-secret

# Node Environment
NODE_ENV=development
PORT=3001

# Frontend
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_WS_URL=ws://localhost:3001
```

## 🐳 Docker Commands

```bash
# Start all services
docker-compose up --build

# Start in background
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild specific service
docker-compose build backend
docker-compose up backend

# Shell into container
docker-compose exec backend sh
docker-compose exec frontend sh

# Database access
docker-compose exec mongodb mongosh -u webphone -p dev-password-123
docker-compose exec redis redis-cli
```

## 🧪 Testing

### Backend Tests

```bash
cd backend
npm test
```

### Frontend Tests

```bash
cd frontend
npm test
```

### API Testing

```bash
# Health check
curl http://localhost/api/health

# Login
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"admin@webphone.local","password":"password123"}'
```

## 🚀 Production Deployment

### OCI Infrastructure

The project includes Terraform configurations for OCI deployment:

```bash
cd terraform

# Initialize Terraform
terraform init

# Plan deployment
terraform plan

# Deploy infrastructure
terraform apply

# Get connection details
terraform output
```

### Build and Push to OCIR

```bash
# Login to OCI Container Registry
docker login us-phoenix-1.ocir.io -u 'namespace/username' -p 'auth-token'

# Build and tag images
docker build -t us-phoenix-1.ocir.io/namespace/insight-intelligence-webphone/backend:latest ./backend
docker build -t us-phoenix-1.ocir.io/namespace/insight-intelligence-webphone/frontend:latest ./frontend
docker build -t us-phoenix-1.ocir.io/namespace/insight-intelligence-webphone/nginx:latest ./nginx

# Push images
docker push us-phoenix-1.ocir.io/namespace/insight-intelligence-webphone/backend:latest
docker push us-phoenix-1.ocir.io/namespace/insight-intelligence-webphone/frontend:latest
docker push us-phoenix-1.ocir.io/namespace/insight-intelligence-webphone/nginx:latest
```

### Automated Deployment

Use the provided deployment script for one-command deployment:

```bash
# Ensure you have .env.prod configured with production values
cp .env.prod.example .env.prod
# Edit .env.prod with actual values

# Login to OCIR first
docker login us-phoenix-1.ocir.io -u 'axoxnwhj7c1a/drchiniquy@gmail.com' -p 'your-auth-token'

# Deploy everything
./deploy.sh
```

### Manual Deployment

```bash
# SSH to app server
ssh opc@137.131.4.94

# Navigate to app directory
cd /opt/webphone-app

# Stop services, pull latest images, and restart
docker compose down
docker compose pull
docker compose up -d
```

## ⚡ Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 80, 3000, 3001, 27017, 6379 are available
2. **Database connection**: Check MongoDB/Redis containers are running
3. **Twilio webhooks**: Ensure webhook URLs are configured in Twilio Console
4. **Build failures**: Delete node_modules and package-lock.json, then reinstall

### Logs and Monitoring

```bash
# Application logs
docker-compose logs backend
docker-compose logs frontend
docker-compose logs mongodb

# Database monitoring (on servers)
/usr/local/bin/monitor-webphone-db
/usr/local/bin/monitor-webphone

# Backup database
/usr/local/bin/backup-webphone-db
```

### Database Access

```bash
# MongoDB shell
docker-compose exec mongodb mongosh -u webphone -p dev-password-123

# Redis CLI
docker-compose exec redis redis-cli -a dev-redis-123

# View collections
use webphone-app
show collections
db.users.find()
```

## 🔗 Webhook Configuration

After deployment, configure these webhook URLs in your Twilio Console:

### Don's Number
- Voice: `http://your-domain/webhooks/voice/don`
- SMS: `http://your-domain/webhooks/sms/don`
- Status: `http://your-domain/webhooks/status/don`

### Demie's Number
- Voice: `http://your-domain/webhooks/voice/demie`
- SMS: `http://your-domain/webhooks/sms/demie`
- Status: `http://your-domain/webhooks/status/demie`

### Business Number
- Voice: `http://your-domain/webhooks/voice/business`
- SMS: `http://your-domain/webhooks/sms/business`
- Status: `http://your-domain/webhooks/status/business`

## 📚 Additional Resources

- [Twilio API Documentation](https://www.twilio.com/docs/api)
- [React Documentation](https://react.dev)
- [Node.js Documentation](https://nodejs.org/docs)
- [MongoDB Documentation](https://docs.mongodb.com)
- [OCI Documentation](https://docs.oracle.com/en-us/iaas/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes and test locally
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details