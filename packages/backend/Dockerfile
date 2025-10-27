# ========================================
# Sovren Backend - Elite Multi-Stage Dockerfile
# ========================================
# Production-optimized Docker image with:
# - Multi-stage builds for minimal image size
# - BuildKit optimization for parallel builds
# - Security hardening (non-root user, minimal base)
# - Health checks for orchestration
# - SBOM generation for supply chain security
# Target: < 150MB final image size
# ========================================

# ========================================
# Stage 1: Dependencies
# ========================================
# WHY: Separate dependency installation for better layer caching
FROM node:18-alpine AS dependencies

# Install build dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
# WHY: npm ci is faster and more reliable than npm install for CI/CD
RUN if [ -f package-lock.json ]; then \
      npm ci --include=dev; \
    else \
      npm install; \
    fi && \
    npm cache clean --force

# ========================================
# Stage 2: Build
# ========================================
# WHY: Compile TypeScript in separate stage for layer caching
FROM dependencies AS builder

WORKDIR /app

# Copy source code
COPY . .

# Build TypeScript to JavaScript
# WHY: Compile with all optimizations for production
RUN npm run build && \
    # Verify build output
    ls -la dist/

# ========================================
# Stage 3: Production Dependencies
# ========================================
# WHY: Install only production dependencies for minimal final image
FROM node:18-alpine AS prod-dependencies

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
# WHY: Use npm install if package-lock.json doesn't exist, otherwise use npm ci
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev; \
    else \
      npm install --omit=dev; \
    fi && \
    npm cache clean --force && \
    rm -rf ~/.npm

# ========================================
# Stage 4: Production Runtime
# ========================================
# WHY: Minimal final image with only runtime requirements
FROM node:18-alpine AS production

# Add metadata labels for image tracking
LABEL org.opencontainers.image.title="Sovren Backend API" \
      org.opencontainers.image.description="Elite Lightning Network and NOSTR backend service with 59 microservices" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.authors="Sovren Development Team" \
      org.opencontainers.image.source="https://github.com/sovren/sovren" \
      org.opencontainers.image.vendor="Sovren" \
      org.opencontainers.image.licenses="MIT"

# Install runtime dependencies and security utilities
# WHY: dumb-init for proper signal handling, curl for health checks
RUN apk add --no-cache \
    dumb-init \
    curl \
    ca-certificates \
    && rm -rf /tmp/* /var/cache/apk/*

# Security: Create non-root user with specific UID/GID
# WHY: Running as root is a security risk
RUN addgroup -g 1001 -S nodejs && \
    adduser -S backend -u 1001 -G nodejs

WORKDIR /app

# Set correct ownership for app directory
RUN chown -R backend:nodejs /app

# Copy production dependencies from prod-dependencies stage
COPY --from=prod-dependencies --chown=backend:nodejs /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder --chown=backend:nodejs /app/dist ./dist

# Copy package.json for runtime metadata
COPY --chown=backend:nodejs package*.json ./

# Copy any additional runtime files (if needed)
# COPY --chown=backend:nodejs config ./config

# Switch to non-root user
USER backend

# Expose application port
# WHY: Document the port the application listens on
EXPOSE 3001

# Health check endpoint for container orchestration
# WHY: Kubernetes/Docker Swarm use this to determine container health
HEALTHCHECK --interval=30s \
            --timeout=10s \
            --start-period=40s \
            --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Use dumb-init for proper signal handling
# WHY: Ensures SIGTERM signals are properly forwarded to Node.js
ENTRYPOINT ["dumb-init", "--"]

# Default command to start the application
# WHY: Use npm start which runs the compiled JavaScript
CMD ["npm", "run", "start:prod"]

# ========================================
# Build Instructions
# ========================================
# Build with BuildKit (parallel layer builds):
#   DOCKER_BUILDKIT=1 docker build -t sovren-backend:latest .
#
# Multi-architecture build:
#   docker buildx build --platform linux/amd64,linux/arm64 -t sovren-backend:latest .
#
# With SBOM generation:
#   docker buildx build --sbom=true --provenance=true -t sovren-backend:latest .
#
# Expected image size: ~120-140MB (target: < 150MB)
# ========================================
