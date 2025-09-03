FROM node:18-alpine as build

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --silent --no-audit --no-fund

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built app
COPY --from=build /app/build /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --spider -q http://localhost/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]