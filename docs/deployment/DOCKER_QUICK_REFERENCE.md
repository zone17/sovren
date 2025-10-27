# Docker Quick Reference Guide

**Last Updated**: 2025-10-27
**For**: Sovren Backend Deployment

---

## Quick Commands

### Local Development

```bash
# Start all services
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f backend-dev

# Restart backend
docker-compose -f docker-compose.dev.yml restart backend-dev

# Stop all services
docker-compose -f docker-compose.dev.yml down

# Clean volumes (WARNING: deletes data)
docker-compose -f docker-compose.dev.yml down -v
```

### Building Images

```bash
# Quick build (current architecture)
./scripts/docker/build.sh -t dev

# Production build
./scripts/docker/build.sh -t v1.0.0

# Multi-architecture build
./scripts/docker/build.sh -t v1.0.0 -p multi

# Build and push to GHCR
./scripts/docker/build.sh -t v1.0.0 -p multi --push
```

### Security Scanning

```bash
# Scan local image
./scripts/docker/security-scan.sh sovren-backend:latest

# Scan specific version
./scripts/docker/security-scan.sh sovren-backend:v1.0.0

# View scan results
cat security-reports/security-summary.md
```

### Production Deployment

```bash
# Deploy blue environment
docker-compose -f docker-compose.prod.yml up -d backend-blue

# Deploy green environment (blue-green)
docker-compose -f docker-compose.prod.yml --profile blue-green up -d backend-green

# Check health
curl http://localhost:3001/health
curl http://localhost:3001/ready
curl http://localhost:3001/live

# View logs
docker-compose -f docker-compose.prod.yml logs -f backend-blue

# Stop environment
docker-compose -f docker-compose.prod.yml down
```

### Docker Commands

```bash
# List images
docker images

# Remove image
docker rmi sovren-backend:dev

# List containers
docker ps -a

# Stop container
docker stop sovren-backend-dev

# Remove container
docker rm sovren-backend-dev

# View container logs
docker logs -f sovren-backend-dev

# Execute command in container
docker exec -it sovren-backend-dev sh

# Inspect container
docker inspect sovren-backend-dev

# Check container stats
docker stats sovren-backend-dev
```

---

## Health Check Endpoints

| Endpoint | Purpose | Status Codes |
|----------|---------|--------------|
| `/health` | General health | 200: Healthy |
| `/ready` | Ready for traffic | 200: Ready, 503: Not ready |
| `/live` | Process alive | 200: Alive |

### Testing Health Checks

```bash
# General health
curl http://localhost:3001/health | jq

# Readiness
curl http://localhost:3001/ready | jq

# Liveness
curl http://localhost:3001/live | jq
```

---

## Image Tagging Strategy

```bash
# Version tags
ghcr.io/sovren/sovren-backend:v1.0.0    # Semantic version
ghcr.io/sovren/sovren-backend:v1.0      # Minor version
ghcr.io/sovren/sovren-backend:v1        # Major version

# Commit SHA
ghcr.io/sovren/sovren-backend:main-abc123

# Latest
ghcr.io/sovren/sovren-backend:latest

# Environment
ghcr.io/sovren/sovren-backend:staging
ghcr.io/sovren/sovren-backend:production

# Blue-green
ghcr.io/sovren/sovren-backend:blue
ghcr.io/sovren/sovren-backend:green
```

---

## GitHub Actions

### Trigger Workflows

```bash
# Manual trigger with GitHub CLI
gh workflow run docker-build-push.yml \
  -f environment=production \
  -f deploy_strategy=blue

# View workflow runs
gh run list --workflow=docker-build-push.yml

# View workflow logs
gh run view --log
```

### Workflow Triggers

- **Automatic**: Push to `main` or `develop`
- **Manual**: GitHub UI or `gh workflow run`
- **PR**: Build only (no push)

---

## Troubleshooting

### Build Fails

```bash
# Check Docker version
docker --version

# Enable verbose output
DOCKER_BUILDKIT=1 docker build \
  --progress=plain \
  -f packages/backend/Dockerfile \
  packages/backend

# Check build context size
du -sh packages/backend
```

### Container Won't Start

```bash
# Check logs
docker logs sovren-backend-dev

# Check health
docker inspect sovren-backend-dev | jq '.[0].State.Health'

# Exec into container
docker exec -it sovren-backend-dev sh

# Check environment variables
docker exec sovren-backend-dev env
```

### Image Too Large

```bash
# Analyze layers
docker history sovren-backend:latest --human

# Check what's taking space
docker run --rm -it sovren-backend:latest du -sh /*

# Rebuild with --no-cache
docker build --no-cache -f packages/backend/Dockerfile packages/backend
```

### Performance Issues

```bash
# Check container stats
docker stats sovren-backend-prod

# Check resource limits
docker inspect sovren-backend-prod | jq '.[0].HostConfig.Memory'

# Prune unused resources
docker system prune -a
```

---

## Environment Variables

### Required (Production)

```bash
# Database
DATABASE_URL=postgresql://...
POSTGRES_USER=sovren_user
POSTGRES_PASSWORD=***
POSTGRES_DB=sovren

# Redis
REDIS_URL=redis://redis:6379

# Supabase
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=***
SUPABASE_SERVICE_ROLE_KEY=***

# Security
JWT_SECRET=***

# Lightning Network
LNBITS_URL=https://...
LNBITS_API_KEY=***
LNBITS_WALLET_ID=***
LIGHTNING_WEBHOOK_SECRET=***
```

### Optional

```bash
# Monitoring
SENTRY_DSN=https://...
LOG_LEVEL=info

# Features
ENABLE_LIGHTNING_WEBHOOKS=true
ENABLE_LNURL_PAY=true
ENABLE_LIGHTNING_ADDRESSES=true

# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=***
SMTP_PASSWORD=***
```

---

## Service Ports

| Service | Port | Purpose |
|---------|------|---------|
| Backend API | 3001 | HTTP API |
| Frontend Dev | 5173 | Vite dev server |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Cache |
| Mailhog UI | 8025 | Email testing |
| Mailhog SMTP | 1025 | Email receiving |
| Nginx | 80/443 | Load balancer |
| Prometheus | 9090 | Metrics |
| Grafana | 3000 | Dashboards |

---

## Docker Compose Profiles

```bash
# Start with specific profile
docker-compose -f docker-compose.dev.yml --profile tools up -d

# Available profiles
# - tools: Development tools container
# - testing: Test runner container
# - blue-green: Green environment for production
```

---

## Security Best Practices

1. **Never commit secrets** - Use .env files
2. **Scan regularly** - Run security scans before deploy
3. **Update base images** - Rebuild monthly
4. **Use non-root** - Always run as non-root user
5. **Sign images** - Use Cosign for production
6. **SBOM generation** - Generate for compliance
7. **Vulnerability tracking** - Monitor GitHub Security tab

---

## Common Workflows

### Development Workflow

1. Start services: `docker-compose -f docker-compose.dev.yml up -d`
2. Make code changes (hot-reload enabled)
3. View logs: `docker-compose -f docker-compose.dev.yml logs -f backend-dev`
4. Test endpoints: `curl http://localhost:3001/health`
5. Stop services: `docker-compose -f docker-compose.dev.yml down`

### Release Workflow

1. Build: `./scripts/docker/build.sh -t v1.2.0`
2. Scan: `./scripts/docker/security-scan.sh sovren-backend:v1.2.0`
3. Test locally: `docker run -p 3001:3001 sovren-backend:v1.2.0`
4. Push: `./scripts/docker/build.sh -t v1.2.0 --push`
5. Deploy: Trigger GitHub Actions workflow

### Blue-Green Deployment

1. Deploy to green: `docker-compose -f docker-compose.prod.yml --profile blue-green up -d backend-green`
2. Health check: `curl http://localhost:3001/health`
3. Switch traffic: Update Nginx config
4. Monitor: Check logs and metrics
5. Cleanup: `docker-compose -f docker-compose.prod.yml stop backend-blue`

---

## Useful Aliases

Add to your `.bashrc` or `.zshrc`:

```bash
# Docker Compose aliases
alias dc='docker-compose'
alias dcdev='docker-compose -f docker-compose.dev.yml'
alias dcprod='docker-compose -f docker-compose.prod.yml'
alias dclogs='docker-compose logs -f'
alias dcup='docker-compose up -d'
alias dcdown='docker-compose down'

# Docker aliases
alias dps='docker ps'
alias dpsa='docker ps -a'
alias di='docker images'
alias dlogs='docker logs -f'
alias dexec='docker exec -it'
alias dstats='docker stats'

# Sovren-specific
alias sovren-build='./scripts/docker/build.sh'
alias sovren-scan='./scripts/docker/security-scan.sh'
alias sovren-dev='dcdev up -d && dcdev logs -f backend-dev'
```

---

## Links & Resources

- [Full Docker Guide](./DOCKER_GUIDE.md)
- [Epic 006 Plan](../refactoring/EPIC-006-deployment-automation.md)
- [Implementation Summary](../implementation-summaries/EPIC-006-US-E6-001-002-DOCKER-IMPLEMENTATION.md)
- [Build Script](../../scripts/docker/build.sh)
- [Security Scan Script](../../scripts/docker/security-scan.sh)

---

**Need Help?**
- Check logs: `docker logs -f <container-name>`
- Inspect container: `docker inspect <container-name> | jq`
- Full guide: [DOCKER_GUIDE.md](./DOCKER_GUIDE.md)
- GitHub Issues: https://github.com/sovren/sovren/issues
