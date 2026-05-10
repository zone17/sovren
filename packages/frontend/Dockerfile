# Multi-stage production Dockerfile for Sovren Frontend
# Following elite engineering standards with Nginx optimization

# Stage 1: Build React application
FROM node:26-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files for better Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci --include=dev && npm cache clean --force

# Copy source code
COPY . .

# Build optimized production bundle
RUN npm run build

# Stage 2: Production Nginx server
FROM nginx:alpine AS runtime

# Install security updates
RUN apk update && apk upgrade && \
    apk add --no-cache curl && \
    rm -rf /var/cache/apk/*

# Copy built application from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create non-root user for Nginx
RUN addgroup -g 1001 -S nginx-app && \
    adduser -S nginx-app -u 1001 -G nginx-app

# Set proper permissions
RUN chown -R nginx-app:nginx-app /usr/share/nginx/html && \
    chown -R nginx-app:nginx-app /var/cache/nginx && \
    chown -R nginx-app:nginx-app /var/log/nginx && \
    chown -R nginx-app:nginx-app /etc/nginx/conf.d

# Create directories for Nginx with proper permissions
RUN touch /var/run/nginx.pid && \
    chown nginx-app:nginx-app /var/run/nginx.pid

# Switch to non-root user
USER nginx-app

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]

# Metadata labels
LABEL org.opencontainers.image.title="Sovren Frontend"
LABEL org.opencontainers.image.description="Elite React frontend with Nginx optimization"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.authors="Sovren Development Team"
LABEL org.opencontainers.image.source="https://github.com/sovren/frontend"
