# Deployment Guide

**Epic 005 Backend Service Refactoring - Production Deployment**

---

## Environment Configuration

### Production Environment Variables

```bash
# .env.production
NODE_ENV=production
PORT=3001
API_VERSION=v1

# Database (use managed PostgreSQL)
DATABASE_URL=postgresql://user:pass@db.example.com:5432/sovren_prod
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20
DATABASE_SSL=true

# Redis (use managed Redis)
REDIS_URL=redis://cache.example.com:6379
REDIS_PASSWORD=strong_password_here
REDIS_TLS=true

# Secrets (rotate regularly)
JWT_SECRET=<256-bit secret>
WEBHOOK_SECRET=<256-bit secret>

# Lightning (production node)
LIGHTNING_NODE_URL=https://lightning.sovren.com
LIGHTNING_MACAROON=<production macaroon>

# Monitoring
SENTRY_DSN=https://xxx@sentry.io/xxx
LOG_LEVEL=info
```

---

## Docker Build

### Multi-Stage Dockerfile

```dockerfile
# packages/backend/Dockerfile.prod
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY packages/backend ./packages/backend
COPY packages/shared ./packages/shared

# Build TypeScript
RUN npm run build

# Production image
FROM node:18-alpine

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/backend/dist ./dist

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node healthcheck.js

EXPOSE 3001

CMD ["node", "dist/server.js"]
```

### Build Commands

```bash
# Build image
docker build -f packages/backend/Dockerfile.prod \
  -t sovren-backend:latest .

# Test image locally
docker run -p 3001:3001 \
  --env-file .env.production \
  sovren-backend:latest
```

---

## Database Migration

### Production Migration Process

```bash
# 1. Backup database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# 2. Test migration on staging
DATABASE_URL=$STAGING_DB npx node-pg-migrate up

# 3. Apply to production (with downtime window)
DATABASE_URL=$PRODUCTION_DB npx node-pg-migrate up

# 4. Verify migration
psql $PRODUCTION_DB -c "SELECT version FROM pgmigrations ORDER BY id DESC LIMIT 1;"
```

---

## Health Checks

### Endpoint Configuration

```typescript
// packages/backend/src/routes/health.ts
export const healthCheck = async (req: Request, res: Response) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      lightning: await checkLightning(),
    },
  };

  const isHealthy = Object.values(health.services).every((s) => s === 'connected');

  res.status(isHealthy ? 200 : 503).json(health);
};
```

---

## Monitoring

### Metrics Collection

```typescript
import { Registry, Counter, Histogram } from 'prom-client';

export const register = new Registry();

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const paymentCreated = new Counter({
  name: 'payments_created_total',
  help: 'Total number of payments created',
  registers: [register],
});
```

---

## Scaling

### Horizontal Scaling

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  backend:
    image: sovren-backend:latest
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1'
          memory: 1G
    environment:
      - NODE_ENV=production
    depends_on:
      - postgres
      - redis
```

---

## Zero-Downtime Deployment

### Blue-Green Strategy

```bash
# 1. Deploy to "green" environment
kubectl apply -f k8s/backend-green.yaml

# 2. Wait for health checks
kubectl wait --for=condition=ready pod -l app=backend-green

# 3. Switch traffic
kubectl patch service backend -p '{"spec":{"selector":{"version":"green"}}}'

# 4. Monitor for issues
kubectl logs -f deployment/backend-green

# 5. If OK, remove old "blue" deployment
kubectl delete deployment backend-blue
```

---

## Rollback Process

```bash
# Quick rollback via service selector
kubectl patch service backend -p '{"spec":{"selector":{"version":"blue"}}}'

# Or rollback deployment
kubectl rollout undo deployment/backend

# Verify
kubectl rollout status deployment/backend
```

---

**Next**: [Troubleshooting](/docs/development/troubleshooting.md)

**Last Updated**: 2025-10-27
