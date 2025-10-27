# Sovren Docker Deployment Guide

**Status**: Production-Ready
**Version**: 1.0.0
**Last Updated**: 2024-10-27

## Overview

This guide covers the complete Docker deployment architecture for Sovren's backend services. Our implementation follows cutting-edge best practices with multi-stage builds, multi-architecture support, comprehensive security scanning, and blue-green deployment capabilities.

## Table of Contents

1. [Architecture](#architecture)
2. [Quick Start](#quick-start)
3. [Building Images](#building-images)
4. [Security Scanning](#security-scanning)
5. [Deployment Strategies](#deployment-strategies)
6. [CI/CD Integration](#cicd-integration)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

## Architecture

### Multi-Stage Build Strategy

Our Dockerfile uses a 4-stage build process for optimal image size and security:

```
Stage 1: Dependencies    → Install all dependencies (including dev)
Stage 2: Build          → Compile TypeScript to JavaScript
Stage 3: Prod Deps      → Install only production dependencies
Stage 4: Production     → Minimal runtime image
```

**Benefits**:
- Final image size: ~120-140MB (target: <150MB)
- No source code or dev dependencies in production
- Cached layers for faster rebuilds
- Non-root user for security

### Supported Architectures

- `linux/amd64` (x86_64)
- `linux/arm64` (ARM64/v8)

## Quick Start

### Prerequisites

- Docker 20.10+ with BuildKit support
- Docker Compose 2.0+
- 4GB RAM minimum
- 10GB disk space

### Local Development

```bash
# Start all services with hot-reload
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f backend-dev

# Access services
# - Backend API: http://localhost:3001
# - Frontend: http://localhost:5173
# - PostgreSQL: localhost:5432
# - Redis: localhost:6379
# - Mailhog UI: http://localhost:8025

# Stop services
docker-compose -f docker-compose.dev.yml down
```

### Production Deployment

```bash
# Start production stack
docker-compose -f docker-compose.prod.yml up -d

# Check health status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f backend-blue

# Stop services
docker-compose -f docker-compose.prod.yml down
```

## Building Images

### Using the Build Script (Recommended)

```bash
# Build for current architecture
./scripts/docker/build.sh -n sovren-backend -t v1.0.0

# Build multi-architecture
./scripts/docker/build.sh -t v1.0.0 -p multi

# Build and push to registry
./scripts/docker/build.sh -t v1.0.0 -p multi --push

# Development build
./scripts/docker/build.sh -m development -t dev
```

### Manual Build with Docker Buildx

```bash
# Enable BuildKit
export DOCKER_BUILDKIT=1

# Build for single platform
docker buildx build \
  --platform linux/amd64 \
  --tag ghcr.io/sovren/sovren-backend:latest \
  --file packages/backend/Dockerfile \
  packages/backend

# Build for multiple platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag ghcr.io/sovren/sovren-backend:latest \
  --push \
  --file packages/backend/Dockerfile \
  packages/backend
```

### Build with SBOM and Provenance

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag ghcr.io/sovren/sovren-backend:v1.0.0 \
  --sbom=true \
  --provenance=true \
  --push \
  --file packages/backend/Dockerfile \
  packages/backend
```

## Security Scanning

### Automated Security Scanning

```bash
# Run comprehensive security scan
./scripts/docker/security-scan.sh sovren-backend:latest
```

This generates:
- Vulnerability reports (SARIF, JSON)
- SBOM in CycloneDX and SPDX formats
- Secret detection results
- Misconfiguration analysis
- Layer analysis

### Manual Trivy Scanning

```bash
# Vulnerability scan
trivy image --severity HIGH,CRITICAL sovren-backend:latest

# Generate SARIF report
trivy image \
  --severity HIGH,CRITICAL \
  --format sarif \
  --output trivy-results.sarif \
  sovren-backend:latest

# SBOM generation
trivy image --format cyclonedx sovren-backend:latest > sbom.json
```

### Image Signing with Cosign

```bash
# Install Cosign
curl -sL https://github.com/sigstore/cosign/releases/download/v2.2.1/cosign-linux-amd64 \
  -o /usr/local/bin/cosign && chmod +x /usr/local/bin/cosign

# Sign image (keyless)
cosign sign --yes ghcr.io/sovren/sovren-backend:v1.0.0

# Verify signature
cosign verify \
  --certificate-identity-regexp="https://github.com/sovren" \
  --certificate-oidc-issuer=https://token.actions.githubusercontent.com \
  ghcr.io/sovren/sovren-backend:v1.0.0
```

## Deployment Strategies

### Blue-Green Deployment

1. **Deploy to Green Environment**:
   ```bash
   # Start green environment with new version
   docker-compose -f docker-compose.prod.yml --profile blue-green up -d backend-green
   ```

2. **Health Check Validation**:
   ```bash
   # Verify green environment health
   docker-compose -f docker-compose.prod.yml exec backend-green \
     curl http://localhost:3001/health

   # Check readiness
   docker-compose -f docker-compose.prod.yml exec backend-green \
     curl http://localhost:3001/ready
   ```

3. **Traffic Switch**:
   Update load balancer (Nginx) configuration to route traffic to green.

4. **Rollback if Needed**:
   ```bash
   # Switch back to blue
   # Update Nginx config to route to blue
   # Restart Nginx
   docker-compose -f docker-compose.prod.yml restart nginx
   ```

5. **Cleanup**:
   ```bash
   # Stop old blue environment
   docker-compose -f docker-compose.prod.yml stop backend-blue
   ```

### Rolling Update

```bash
# Update with zero downtime (Docker Swarm/Kubernetes)
docker service update \
  --image ghcr.io/sovren/sovren-backend:v1.0.0 \
  --update-parallelism 1 \
  --update-delay 30s \
  sovren-backend
```

## CI/CD Integration

### GitHub Actions Workflow

The workflow `.github/workflows/docker-build-push.yml` automatically:

1. Builds multi-architecture images on push to `main`
2. Pushes to GitHub Container Registry (GHCR)
3. Signs images with Cosign (keyless)
4. Generates SLSA provenance
5. Runs Trivy security scans
6. Validates image size (<150MB)
7. Uploads SARIF to GitHub Security

### Manual Workflow Trigger

```bash
# Trigger deployment via GitHub CLI
gh workflow run docker-build-push.yml \
  -f environment=production \
  -f deploy_strategy=blue
```

### Required Secrets

Set these in GitHub repository settings:

```bash
# No secrets required for GHCR with GITHUB_TOKEN
# GITHUB_TOKEN is automatically provided

# Optional: For private registries
DOCKER_USERNAME=your-username
DOCKER_PASSWORD=your-token
```

## Health Checks

### Available Endpoints

| Endpoint | Purpose | Status Codes |
|----------|---------|--------------|
| `/health` | General health status | 200: Healthy |
| `/ready` | Readiness for traffic | 200: Ready, 503: Not ready |
| `/live` | Liveness check | 200: Alive |

### Testing Health Checks

```bash
# General health
curl http://localhost:3001/health

# Readiness
curl http://localhost:3001/ready

# Liveness
curl http://localhost:3001/live
```

### Kubernetes Probes

```yaml
livenessProbe:
  httpGet:
    path: /live
    port: 3001
  initialDelaySeconds: 40
  periodSeconds: 30
  timeoutSeconds: 10
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /ready
    port: 3001
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

## Troubleshooting

### Build Issues

**Error: Image size exceeds target**
```bash
# Analyze layers
docker history sovren-backend:latest --human

# Check what's taking space
docker run --rm -it sovren-backend:latest du -sh /*
```

**Error: Build fails on ARM64**
```bash
# Ensure QEMU is set up
docker run --rm --privileged multiarch/qemu-user-static --reset -p yes

# Rebuild with verbose output
DOCKER_BUILDKIT=1 docker buildx build \
  --platform linux/arm64 \
  --progress=plain \
  --file packages/backend/Dockerfile \
  packages/backend
```

### Runtime Issues

**Container fails health check**
```bash
# Check logs
docker logs sovren-backend-prod

# Exec into container
docker exec -it sovren-backend-prod sh

# Test health endpoint manually
docker exec sovren-backend-prod curl http://localhost:3001/health
```

**Permission denied errors**
```bash
# Verify non-root user
docker exec sovren-backend-prod whoami
# Should output: backend

# Check file permissions
docker exec sovren-backend-prod ls -la /app
```

### Performance Issues

**Slow builds**
```bash
# Enable BuildKit cache
export DOCKER_BUILDKIT=1

# Use buildx with cache
docker buildx build \
  --cache-from type=local,src=/tmp/.buildx-cache \
  --cache-to type=local,dest=/tmp/.buildx-cache \
  --file packages/backend/Dockerfile \
  packages/backend
```

**High memory usage**
```bash
# Check container stats
docker stats sovren-backend-prod

# Set memory limits
docker run -m 1g --memory-reservation 512m sovren-backend:latest
```

## Best Practices

### Image Tagging Strategy

```bash
# Version tags
ghcr.io/sovren/sovren-backend:v1.0.0
ghcr.io/sovren/sovren-backend:v1.0
ghcr.io/sovren/sovren-backend:v1

# Git commit SHA
ghcr.io/sovren/sovren-backend:main-abc123

# Latest (main branch only)
ghcr.io/sovren/sovren-backend:latest

# Environment tags
ghcr.io/sovren/sovren-backend:staging
ghcr.io/sovren/sovren-backend:production

# Blue-green deployment
ghcr.io/sovren/sovren-backend:blue
ghcr.io/sovren/sovren-backend:green
```

### Layer Caching Optimization

1. **Order matters**: Copy package files before source code
2. **Use .dockerignore**: Exclude unnecessary files
3. **BuildKit cache**: Enable for faster rebuilds
4. **Multi-stage builds**: Separate build and runtime

### Security Hardening

- ✅ Run as non-root user (UID 1001)
- ✅ Use minimal base image (Alpine)
- ✅ No secrets in image
- ✅ Read-only filesystem where possible
- ✅ Drop unnecessary capabilities
- ✅ Regular vulnerability scanning
- ✅ Image signing with Cosign

### Resource Management

```yaml
# Docker Compose resource limits
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 2G
    reservations:
      cpus: '1.0'
      memory: 1G
```

## Monitoring and Observability

### Container Metrics

```bash
# Real-time stats
docker stats sovren-backend-prod

# Historical metrics
docker inspect sovren-backend-prod | jq '.[0].State'
```

### Log Management

```bash
# View logs
docker logs -f sovren-backend-prod

# Export logs
docker logs sovren-backend-prod > backend.log 2>&1

# JSON logging (for log aggregation)
docker logs --tail 100 sovren-backend-prod | jq '.'
```

## References

- [Dockerfile Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [BuildKit Documentation](https://github.com/moby/buildkit)
- [Trivy Documentation](https://aquasecurity.github.io/trivy/)
- [Cosign Documentation](https://docs.sigstore.dev/cosign/overview/)
- [SLSA Framework](https://slsa.dev/)

## Support

For issues or questions:
- GitHub Issues: https://github.com/sovren/sovren/issues
- Documentation: `/docs`
- Team Contact: devops@sovren.app
