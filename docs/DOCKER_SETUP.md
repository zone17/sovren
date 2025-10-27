# 🐳 Sovren Docker Infrastructure - Elite Setup Guide

## 📋 Quick Start

### Prerequisites

- Docker 24.0+ and Docker Compose V2
- Node.js 18+ (for local development)
- Git

### 1. Clone and Setup Environment

```bash
# Clone repository
git clone https://github.com/your-org/sovren.git
cd sovren

# Copy environment configuration
cp env.example .env

# Edit environment variables
nano .env
```

### 2. Development Environment (30 seconds)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Access application
open http://localhost:8080
```

### 3. Production Deployment

```bash
# Production environment
docker-compose -f docker-compose.prod.yml up -d

# SSL certificate setup
docker-compose -f docker-compose.prod.yml exec certbot \
  certonly --webroot --webroot-path=/var/www/certbot \
  --email your-email@domain.com --agree-tos \
  --no-eff-email -d your-domain.com
```

## 🏗️ Architecture Overview

### Development Stack

```
┌─────────────────────────────────────────────────┐
│                 Development                     │
├─────────────────────────────────────────────────┤
│ Frontend: React + Vite (Port 5173)            │
│ Backend: Node.js + Express (Port 3001)        │
│ Nginx: Reverse Proxy (Port 8080)              │
│ Redis: Caching (Port 6379)                    │
│ PostgreSQL: Database (Port 5432)              │
│ Mailhog: Email Testing (Port 8025)            │
└─────────────────────────────────────────────────┘
```

### Production Stack

```
┌─────────────────────────────────────────────────┐
│                 Production                      │
├─────────────────────────────────────────────────┤
│ Load Balancer: Nginx + SSL (Ports 80/443)     │
│ Frontend: Nginx + Static Files (Port 8080)    │
│ Backend: Node.js API (Port 3001)              │
│ Redis: Production Cache                        │
│ Monitoring: Prometheus + Grafana              │
│ Logging: Fluentd + Centralized Logs          │
│ SSL: Automated Let's Encrypt                  │
└─────────────────────────────────────────────────┘
```

## 🚀 Services Configuration

### Backend Service

**Image**: Multi-stage Node.js Alpine
**Security**:

- Non-root user (UID 1001)
- Minimal attack surface
- Health checks enabled
- Secret management

**Features**:

- TypeScript compilation
- Hot reload in development
- Production optimization
- Graceful shutdown

### Frontend Service

**Image**: Multi-stage React + Nginx
**Optimization**:

- Gzip compression
- Static asset caching
- Security headers
- SPA routing support

**Performance**:

- Asset optimization
- CDN-ready
- Mobile-first
- Progressive loading

### Redis Service

**Configuration**:

- Memory-optimized
- Persistence enabled
- Security hardened
- Monitoring ready

### Monitoring Stack

**Prometheus**: Metrics collection
**Grafana**: Visualization dashboards
**Fluentd**: Log aggregation
**Health Checks**: Automated monitoring

## 📝 Environment Configuration

### Required Variables

```bash
# Core Application
NODE_ENV=development|production
PORT=3001
LOG_LEVEL=debug|info|warn|error

# Supabase Integration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Lightning Network
LNBITS_API_URL=https://your-lnbits-instance.com
LNBITS_ADMIN_KEY=your-admin-key
LNBITS_INVOICE_READ_KEY=your-invoice-key

# NOSTR Protocol
NOSTR_RELAYS=wss://relay1.com,wss://relay2.com
NOSTR_PRIVATE_KEY=your-hex-private-key

# Security
JWT_SECRET=your-jwt-secret-256-bits
SESSION_SECRET=your-session-secret
```

### Production-Specific Variables

```bash
# Domain & SSL
DOMAIN=your-domain.com
SSL_EMAIL=admin@your-domain.com

# Performance
CONTAINER_MEMORY_LIMIT=1024m
CONTAINER_CPU_LIMIT=1.0

# Monitoring
GRAFANA_PASSWORD=secure-password
SENTRY_DSN=your-sentry-dsn
```

## 🔧 Development Workflow

### Starting Development

```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View service logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Hot Reload Development

```bash
# Backend changes auto-reload
# Edit files in packages/backend/src/

# Frontend changes auto-reload
# Edit files in packages/frontend/src/

# View real-time logs
docker-compose logs -f
```

### Database Operations

```bash
# Run migrations
docker-compose exec backend npm run db:migrate

# Seed development data
docker-compose exec backend npm run db:seed

# Access PostgreSQL
docker-compose exec postgres psql -U sovren -d sovren_dev
```

### Testing in Containers

```bash
# Run backend tests
docker-compose exec backend npm test

# Run frontend tests
docker-compose exec frontend npm test

# Run E2E tests
docker-compose exec frontend npm run test:e2e
```

## 🚀 Production Deployment

### 1. Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin
```

### 2. Application Deployment

```bash
# Clone and configure
git clone https://github.com/your-org/sovren.git
cd sovren

# Production environment
cp env.example .env
nano .env  # Configure production values

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

### 3. SSL Certificate Setup

```bash
# Initial certificate
docker-compose -f docker-compose.prod.yml run --rm certbot \
  certonly --webroot --webroot-path=/var/www/certbot \
  --email ${SSL_EMAIL} --agree-tos --no-eff-email -d ${DOMAIN}

# Auto-renewal cron job
echo "0 12 * * * /usr/local/bin/docker-compose -f /path/to/sovren/docker-compose.prod.yml run --rm certbot renew" | sudo crontab -
```

### 4. Monitoring Setup

```bash
# Access Grafana
open http://your-domain.com:3000
# Login: admin / ${GRAFANA_PASSWORD}

# Access Prometheus
open http://your-domain.com:9090

# Import Sovren dashboards
curl -o grafana-dashboard.json https://raw.githubusercontent.com/your-org/sovren/main/monitoring/grafana-dashboard.json
```

## 🛠️ Management Commands

### Service Management

```bash
# Start services
docker-compose up -d [service-name]

# Stop services
docker-compose down

# Restart service
docker-compose restart [service-name]

# Update service
docker-compose pull [service-name]
docker-compose up -d [service-name]
```

### Scaling Services

```bash
# Scale backend
docker-compose up -d --scale backend=3

# Scale frontend
docker-compose up -d --scale frontend=2
```

### Backup & Recovery

```bash
# Backup volumes
docker run --rm -v sovren_redis_data:/data -v $(pwd):/backup alpine tar czf /backup/redis-backup.tar.gz -C /data .

# Restore volumes
docker run --rm -v sovren_redis_data:/data -v $(pwd):/backup alpine tar xzf /backup/redis-backup.tar.gz -C /data
```

## 🔍 Monitoring & Debugging

### Health Checks

```bash
# Check all services
docker-compose ps

# Test health endpoints
curl http://localhost:3001/health  # Backend
curl http://localhost:8080/health  # Frontend
```

### Log Management

```bash
# View real-time logs
docker-compose logs -f

# Filter by service
docker-compose logs -f backend

# Export logs
docker-compose logs > sovren-logs.txt
```

### Performance Monitoring

```bash
# Container stats
docker stats

# Resource usage
docker-compose top

# System resources
docker system df
```

## 🚨 Troubleshooting

### Common Issues

#### Port Conflicts

```bash
# Check port usage
sudo netstat -tulpn | grep :3001

# Stop conflicting services
sudo systemctl stop apache2
sudo systemctl stop nginx
```

#### Memory Issues

```bash
# Increase Docker memory
# Docker Desktop: Settings > Resources > Memory > 4GB+

# Check container memory
docker stats --no-stream
```

#### Permission Issues

```bash
# Fix file permissions
sudo chown -R $USER:$USER .
chmod +x scripts/*.sh
```

#### Database Connection

```bash
# Test Supabase connection
docker-compose exec backend node -e "
  const { createClient } = require('@supabase/supabase-js');
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  console.log('Supabase client created successfully');
"
```

### Performance Optimization

#### Build Optimization

```bash
# Clear build cache
docker builder prune

# Multi-stage build verification
docker-compose build --no-cache

# Image size analysis
docker images | grep sovren
```

#### Runtime Optimization

```bash
# Container resource limits
docker update --memory=1g --cpus=1.0 container-name

# Network optimization
docker network ls
docker network inspect sovren_sovren-network
```

### Security Hardening

```bash
# Scan for vulnerabilities
docker scout cves sovren-backend:latest

# Update base images
docker-compose pull
docker-compose up -d --force-recreate

# Security audit
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image sovren-backend:latest
```

## 📚 Advanced Configuration

### Custom Networks

```bash
# Create custom network
docker network create --driver bridge \
  --subnet=172.22.0.0/16 \
  --gateway=172.22.0.1 \
  sovren-custom
```

### Volume Management

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect sovren_redis_data

# Backup volume
docker run --rm -v sovren_redis_data:/source -v $(pwd):/backup \
  alpine tar czf /backup/volume-backup.tar.gz -C /source .
```

### Multi-Environment Setup

```bash
# Development
docker-compose -f docker-compose.yml up -d

# Staging
docker-compose -f docker-compose.staging.yml up -d

# Production
docker-compose -f docker-compose.prod.yml up -d
```

## 🎯 Performance Benchmarks

### Expected Performance

- **Startup Time**: < 60 seconds (all services)
- **Memory Usage**: < 2GB (development)
- **CPU Usage**: < 50% (normal load)
- **Response Time**: < 200ms (API endpoints)

### Load Testing

```bash
# Install artillery
npm install -g artillery

# Run load test
artillery quick --count 100 --num 10 http://localhost:3001/health
```

## 📖 Additional Resources

- [Docker Best Practices](https://docs.docker.com/develop/best-practices/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [Container Security Guide](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)
- [Monitoring with Prometheus](https://prometheus.io/docs/guides/go-application/)

---

**🏆 Elite Docker Infrastructure Complete**
_Production-ready containerization with security, monitoring, and scalability_

**Last Updated**: 2024-12-16
**Version**: 1.0.0
**Status**: Production Ready
