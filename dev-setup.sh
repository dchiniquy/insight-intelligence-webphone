#!/bin/bash
# WebPhone Development Setup Script

set -e

echo "🚀 WebPhone Development Setup"
echo "=============================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker and Docker Compose found"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file and add your Twilio credentials before continuing:"
    echo "   - TWILIO_ACCOUNT_SID"
    echo "   - TWILIO_AUTH_TOKEN"
    echo "   - TWILIO_*_NUMBER variables"
    echo ""
    echo "Then run: docker-compose up --build"
    exit 0
else
    echo "✅ .env file found"
fi

# Check if Twilio credentials are set
if grep -q "your_twilio_account_sid" .env; then
    echo "⚠️  Please update your Twilio credentials in .env file before starting"
    echo "Edit the following variables:"
    echo "   - TWILIO_ACCOUNT_SID"
    echo "   - TWILIO_AUTH_TOKEN"
    echo "   - TWILIO_*_NUMBER variables"
    echo ""
fi

echo "🐳 Starting Docker containers..."
echo "This may take a few minutes on first run..."

# Build and start services
docker-compose up --build -d

echo ""
echo "⏳ Waiting for services to start..."
sleep 10

# Check service health
echo "🔍 Checking service status..."
docker-compose ps

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📱 Application URLs:"
echo "   Frontend:  http://localhost"
echo "   Backend:   http://localhost/api"
echo "   Health:    http://localhost/health"
echo ""
echo "🔐 Default Login:"
echo "   Email:     admin@webphone.local"
echo "   Password:  password123"
echo ""
echo "📋 Useful Commands:"
echo "   View logs:    docker-compose logs -f"
echo "   Stop:         docker-compose down"
echo "   Restart:      docker-compose restart"
echo "   Shell:        docker-compose exec backend sh"
echo ""
echo "🔧 Next Steps:"
echo "1. Configure Twilio webhook URLs (see README.md)"
echo "2. Test making calls and sending messages"
echo "3. Check the logs for any issues"