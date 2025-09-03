#!/bin/bash
# Database Server Setup Script

set -e
exec > >(tee /var/log/setup_db.log) 2>&1

echo "=== Starting WebPhone Database Server Setup ==="

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

# Create database directory
echo "Creating database directory..."
sudo mkdir -p /opt/webphone-db/{mongodb,redis,backups}
sudo chown -R opc:opc /opt/webphone-db
cd /opt/webphone-db

# Create Docker Compose for databases
echo "Creating database Docker Compose configuration..."
cat << 'COMPOSE' > docker-compose.yml
version: '3.8'

services:
  mongodb:
    image: mongo:7-jammy
    container_name: webphone-mongodb
    restart: unless-stopped
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: webphone
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
      MONGO_INITDB_DATABASE: webphone-app
    volumes:
      - ./mongodb/data:/data/db
      - ./mongodb/configdb:/data/configdb
      - ./backups:/backups
      - ./mongodb/init:/docker-entrypoint-initdb.d:ro
    networks:
      - db-network
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 30s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  redis:
    image: redis:7-alpine
    container_name: webphone-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - ./redis/data:/data
      - ./redis/conf:/usr/local/etc/redis
    networks:
      - db-network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 30s
      timeout: 3s
      retries: 5
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

networks:
  db-network:
    driver: bridge

volumes:
  mongodb_data:
  mongodb_configdb:
  redis_data:
COMPOSE

# Create environment file for databases
echo "Creating database environment configuration..."
cat << ENV > .env
# Database passwords (auto-generated)
MONGO_ROOT_PASSWORD=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 32)
ENV

# Create MongoDB initialization script
echo "Creating MongoDB initialization script..."
mkdir -p mongodb/init
cat << 'INIT' > mongodb/init/01-create-app-user.js
// Create application user with limited permissions
db = db.getSiblingDB('webphone-app');

db.createUser({
  user: 'webphone-app',
  pwd: 'APP_USER_PASSWORD_PLACEHOLDER',
  roles: [
    {
      role: 'readWrite',
      db: 'webphone-app'
    }
  ]
});

// Create indexes for better performance
db.users.createIndex({ "username": 1 }, { unique: true });
db.users.createIndex({ "email": 1 }, { unique: true });
db.calls.createIndex({ "userId": 1, "timestamp": -1 });
db.messages.createIndex({ "userId": 1, "timestamp": -1 });
db.messages.createIndex({ "twilioNumber": 1, "timestamp": -1 });

print('Database initialization completed');
INIT

# Replace placeholder with actual password
APP_USER_PASSWORD=$(openssl rand -base64 32)
sed -i "s/APP_USER_PASSWORD_PLACEHOLDER/$APP_USER_PASSWORD/g" mongodb/init/01-create-app-user.js
echo "MONGO_APP_PASSWORD=$APP_USER_PASSWORD" >> .env

# Create backup script
echo "Creating backup script..."
cat << 'BACKUP' | sudo tee /usr/local/bin/backup-webphone-db
#!/bin/bash
set -e

BACKUP_DIR="/opt/webphone-db/backups"
DATE=$(date +%Y%m%d_%H%M%S)

echo "Starting database backup at $(date)"

cd /opt/webphone-db

# MongoDB backup
echo "Backing up MongoDB..."
docker exec webphone-mongodb mongodump \
  --username webphone \
  --password $(grep MONGO_ROOT_PASSWORD .env | cut -d'=' -f2) \
  --authenticationDatabase admin \
  --db webphone-app \
  --archive="/backups/mongodb_backup_$DATE.archive" \
  --gzip

# Redis backup
echo "Backing up Redis..."
docker exec webphone-redis redis-cli \
  --rdb /data/redis_backup_$DATE.rdb \
  --pass $(grep REDIS_PASSWORD .env | cut -d'=' -f2)

cp redis/data/redis_backup_$DATE.rdb backups/

# Cleanup old backups (keep last 7 days)
find $BACKUP_DIR -name "*.archive" -mtime +7 -delete
find $BACKUP_DIR -name "*.rdb" -mtime +7 -delete

echo "Database backup completed at $(date)"
BACKUP

sudo chmod +x /usr/local/bin/backup-webphone-db

# Create restore script
echo "Creating restore script..."
cat << 'RESTORE' | sudo tee /usr/local/bin/restore-webphone-db
#!/bin/bash
set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <backup_date_string>"
    echo "Available backups:"
    ls -1 /opt/webphone-db/backups/ | grep archive
    exit 1
fi

BACKUP_DATE=$1
BACKUP_DIR="/opt/webphone-db/backups"

cd /opt/webphone-db

echo "Restoring MongoDB from backup $BACKUP_DATE..."
docker exec webphone-mongodb mongorestore \
  --username webphone \
  --password $(grep MONGO_ROOT_PASSWORD .env | cut -d'=' -f2) \
  --authenticationDatabase admin \
  --archive="/backups/mongodb_backup_$BACKUP_DATE.archive" \
  --gzip \
  --drop

echo "Database restore completed"
RESTORE

sudo chmod +x /usr/local/bin/restore-webphone-db

# Create monitoring script
cat << 'MONITOR' | sudo tee /usr/local/bin/monitor-webphone-db
#!/bin/bash
# Database health monitoring

check_mongodb() {
    if docker exec webphone-mongodb mongosh --quiet --eval "db.adminCommand('ping').ok" > /dev/null 2>&1; then
        echo "$(date): MongoDB: HEALTHY"
        return 0
    else
        echo "$(date): MongoDB: UNHEALTHY"
        return 1
    fi
}

check_redis() {
    if docker exec webphone-redis redis-cli ping > /dev/null 2>&1; then
        echo "$(date): Redis: HEALTHY"
        return 0
    else
        echo "$(date): Redis: UNHEALTHY"  
        return 1
    fi
}

cd /opt/webphone-db

echo "=== Database Health Check ==="
check_mongodb
check_redis

# Check disk space
echo "Disk usage:"
df -h /opt/webphone-db
echo "=========================="
MONITOR

sudo chmod +x /usr/local/bin/monitor-webphone-db

# Setup log rotation for database logs
echo "Setting up log rotation..."
cat << 'LOGROTATE' | sudo tee /etc/logrotate.d/webphone-db
/var/lib/docker/containers/*/*-json.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 0644 root root
    postrotate
        docker kill --signal="SIGUSR1" webphone-mongodb 2>/dev/null || true
        docker kill --signal="SIGUSR1" webphone-redis 2>/dev/null || true
    endscript
}
LOGROTATE

# Add monitoring and backups to crontab
echo "Setting up scheduled tasks..."
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/monitor-webphone-db >> /opt/webphone-db/monitor.log 2>&1") | crontab -
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-webphone-db >> /opt/webphone-db/backup.log 2>&1") | crontab -

# Start the database services
echo "Starting database services..."
docker compose up -d

# Wait for databases to be ready
echo "Waiting for databases to initialize..."
sleep 30

# Verify databases are running
echo "Verifying database deployment..."
docker compose ps
docker compose logs --tail=20

echo "=== WebPhone Database Server Setup Complete ==="
echo "MongoDB: Available on port 27017"
echo "Redis: Available on port 6379" 
echo "Monitoring: /usr/local/bin/monitor-webphone-db"
echo "Backup: /usr/local/bin/backup-webphone-db"
echo "Restore: /usr/local/bin/restore-webphone-db <backup_date>"