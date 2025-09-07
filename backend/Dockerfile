FROM node:18-alpine

# Install curl for health checks
RUN apk add --no-cache curl

WORKDIR /app

# Install dependencies with optimizations
COPY package*.json ./
RUN npm ci --only=production --silent --no-audit --no-fund \
    && npm cache clean --force

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001 \
    && mkdir -p /app/logs /app/uploads /app/temp \
    && chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3001

# Optimized health check with shorter intervals
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=2 \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["node", "src/server.js"]