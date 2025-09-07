FROM node:18-alpine as build

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --silent --no-audit --no-fund --frozen-lockfile

# Copy source code
COPY . .

# Build the app with optimizations
ENV GENERATE_SOURCEMAP=false
ENV INLINE_RUNTIME_CHUNK=false
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built app
COPY --from=build /app/build /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Optimized health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=2 \
  CMD wget --spider -q http://localhost/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]