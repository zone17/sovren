# Docker Compose Quick Start Guide

## Overview

This guide provides a quick start for using the Sovren Docker Compose configuration, which orchestrates 12 services across 7 isolated networks for a complete development environment.

## Prerequisites

- Docker Desktop installed and running
- Docker Compose v2.0 or higher
- At least 8GB RAM and 4 CPU cores available
- 20GB free disk space

## Quick Start

### 1. Environment Setup

```bash
# Clone the repository
git clone <repository-url>
cd Sovren

# Copy environment configuration
cp docker-compose.env .env

# Edit environment variables (required)
vi .env
```

### 2. Start Development Environment

```bash
# Start full development stack
./scripts/docker-compose-manager.sh start development

# Or use minimal setup for basic development
./scripts/docker-compose-manager.sh start minimal
```

### 3. Verify Services

```bash
# Check service status
./scripts/docker-compose-manager.sh status

# Check service health
./scripts/docker-compose-manager.sh health
```

### 4. Access Services

Once started, you can access:

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **Nginx Proxy**: http://localhost:80
- **Grafana**: http://localhost:3000 (admin/admin123)
- **Prometheus**: http://localhost:9090
- **Mailhog**: http://localhost:8025
- **MCP Gateway**: http://localhost:3000

## Available Profiles

### Minimal Profile

```bash
./scripts/docker-compose-manager.sh start minimal
```

- PostgreSQL + Redis only
- Ideal for basic development

### Development Profile

```bash
./scripts/docker-compose-manager.sh start development
```

- Full development stack
- All services with development tools

### Testing Profile

```bash
./scripts/docker-compose-manager.sh start testing
```

- Includes test databases
- Isolated testing environment

### Production Profile

```bash
./scripts/docker-compose-manager.sh start production
```

- Production-ready configuration
- Monitoring and observability

### Monitoring Profile

```bash
./scripts/docker-compose-manager.sh start monitoring
```

- Prometheus + Grafana + Fluent Bit
- Comprehensive observability

## Common Commands

### Service Management

```bash
# Start services
./scripts/docker-compose-manager.sh start <profile>

# Stop services
./scripts/docker-compose-manager.sh stop

# Restart services
./scripts/docker-compose-manager.sh restart <profile>

# View logs
./scripts/docker-compose-manager.sh logs <service>

# Open shell in service
./scripts/docker-compose-manager.sh shell <service>
```

### Development Commands

```bash
# Build specific service
./scripts/docker-compose-manager.sh build <service>

# Run tests
./scripts/docker-compose-manager.sh test

# Monitor resources
./scripts/docker-compose-manager.sh status
```

### Maintenance Commands

```bash
# Create backup
./scripts/docker-compose-manager.sh backup

# Restore from backup
./scripts/docker-compose-manager.sh restore <backup-file>

# Clean up resources
./scripts/docker-compose-manager.sh clean

# Reset environment
./scripts/docker-compose-manager.sh reset
```

## Troubleshooting

### Port Conflicts

If you encounter port conflicts:

```bash
# Check what's using the port
lsof -i :3001

# Stop conflicting services
sudo systemctl stop <service>
```

### Service Won't Start

```bash
# Check logs
./scripts/docker-compose-manager.sh logs <service>

# Validate configuration
./scripts/docker-compose-manager.sh validate

# Reset and try again
./scripts/docker-compose-manager.sh reset
./scripts/docker-compose-manager.sh start development
```

### Performance Issues

```bash
# Check resource usage
docker stats

# Optimize resources
docker system prune -a
./scripts/docker-compose-manager.sh clean
```

## Development Workflow

### 1. Daily Development

```bash
# Start development environment
./scripts/docker-compose-manager.sh start development

# Make code changes (hot reloading enabled)
# Edit files in packages/backend/src or packages/frontend/src

# View logs if needed
./scripts/docker-compose-manager.sh logs backend
./scripts/docker-compose-manager.sh logs frontend
```

### 2. Testing

```bash
# Start testing environment
./scripts/docker-compose-manager.sh start testing

# Run tests
./scripts/docker-compose-manager.sh test

# Or run specific tests
docker-compose exec backend npm test
docker-compose exec frontend npm test
```

### 3. Debugging

```bash
# Open shell in service
./scripts/docker-compose-manager.sh shell backend

# Debug with logs
./scripts/docker-compose-manager.sh logs backend -f

# Check service health
./scripts/docker-compose-manager.sh health
```

## Environment Variables

Key environment variables to configure:

```env
# General
NODE_ENV=development
LOG_LEVEL=debug

# Database
DATABASE_URL=postgresql://sovren:password@postgres:5432/sovren_dev

# External Services
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Authentication
JWT_SECRET=your-jwt-secret

# Lightning Network
LNBITS_API_URL=https://your-lnbits-instance.com
LNBITS_ADMIN_KEY=your-admin-key

# NOSTR
NOSTR_RELAYS=wss://relay.damus.io,wss://relay.primal.net
```

## Advanced Usage

### Custom Network Configuration

```bash
# View network configuration
docker network ls

# Inspect specific network
docker network inspect sovren-network
```

### Volume Management

```bash
# View volumes
docker volume ls

# Backup specific volume
docker run --rm -v postgres_data:/data -v $(pwd)/backup:/backup ubuntu tar czf /backup/postgres.tar.gz /data

# Restore volume
docker run --rm -v postgres_data:/data -v $(pwd)/backup:/backup ubuntu tar xzf /backup/postgres.tar.gz -C /
```

### Resource Monitoring

```bash
# View resource usage
docker stats

# Monitor specific service
docker stats sovren-backend-dev

# View detailed container info
docker inspect sovren-backend-dev
```

## Best Practices

1. **Always use profiles** for different environments
2. **Monitor resource usage** to avoid system slowdown
3. **Use backup/restore** for data protection
4. **Check logs regularly** for debugging
5. **Keep environment variables secure**
6. **Update regularly** with `docker-compose pull`

## Getting Help

- Check the comprehensive documentation: `docs/deployment/docker-compose-documentation.md`
- View troubleshooting guide: `docs/deployment/docker-compose-troubleshooting.md`
- Run help command: `./scripts/docker-compose-manager.sh help`
- Check validation report: `docs/validation-reports/us-205-docker-compose-validation-report.md`

## Support

For issues or questions:

1. Check the documentation
2. Review the troubleshooting guide
3. Check service logs
4. Validate configuration
5. Reset and try again

This Docker Compose configuration provides a production-ready development environment with all the tools needed for Sovren development.
