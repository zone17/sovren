# Docker Development Environment Troubleshooting Guide

## Overview

This guide provides comprehensive troubleshooting information for the Sovren Docker development environment, including common issues, solutions, performance optimization, and best practices.

## Quick Reference

### Common Commands

```bash
# Check service status
node scripts/docker-dev-scripts.js status

# View logs
node scripts/docker-dev-scripts.js logs [service] [-f]

# Restart services
node scripts/docker-dev-scripts.js restart

# Clean up environment
node scripts/docker-dev-scripts.js clean

# Reset environment (destructive)
node scripts/docker-dev-scripts.js reset
```

### Service Names

- `backend-dev` - Backend API service
- `frontend-dev` - Frontend Vite development server
- `postgres-dev` - PostgreSQL database
- `redis-dev` - Redis cache
- `nginx-dev` - Nginx reverse proxy
- `mailhog-dev` - Email testing service

## Common Issues and Solutions

### 1. Container Startup Issues

#### Problem: Container fails to start

**Symptoms:**

- Service shows as "Exit 1" or "Exit 125"
- Error messages in logs
- Health checks failing

**Solutions:**

1. **Check container logs:**

   ```bash
   node scripts/docker-dev-scripts.js logs backend-dev
   ```

2. **Verify environment variables:**

   ```bash
   # Check if .env.development exists
   ls -la packages/backend/.env.development
   ls -la packages/frontend/.env.development
   ```

3. **Rebuild images:**

   ```bash
   node scripts/docker-dev-scripts.js build
   ```

4. **Check Docker daemon:**
   ```bash
   docker info
   systemctl status docker  # Linux
   ```

#### Problem: Port conflicts

**Symptoms:**

- "Port already in use" errors
- Services can't bind to ports

**Solutions:**

1. **Check port usage:**

   ```bash
   lsof -i :3001  # Backend port
   lsof -i :5173  # Frontend port
   lsof -i :5432  # PostgreSQL port
   ```

2. **Stop conflicting services:**

   ```bash
   # Kill processes using ports
   kill -9 $(lsof -t -i:3001)
   ```

3. **Modify port mappings in docker-compose.dev.yml:**
   ```yaml
   backend-dev:
     ports:
       - '3002:3001' # Use different host port
   ```

### 2. Database Connection Issues

#### Problem: Cannot connect to PostgreSQL

**Symptoms:**

- Connection refused errors
- Database migration failures
- Backend health checks failing

**Solutions:**

1. **Check database container status:**

   ```bash
   docker-compose -f docker-compose.dev.yml ps postgres-dev
   ```

2. **Verify database credentials:**

   ```bash
   # Check environment variables
   docker-compose -f docker-compose.dev.yml exec postgres-dev env | grep POSTGRES
   ```

3. **Test database connection:**

   ```bash
   docker-compose -f docker-compose.dev.yml exec postgres-dev psql -U sovren_dev -d sovren_development -c "SELECT 1;"
   ```

4. **Reset database:**
   ```bash
   # Remove database volume
   docker-compose -f docker-compose.dev.yml down -v
   # Recreate database
   node scripts/docker-dev-scripts.js start
   ```

#### Problem: Database migrations fail

**Solutions:**

1. **Check migration files:**

   ```bash
   ls -la packages/backend/src/database/
   ```

2. **Run migrations manually:**

   ```bash
   node scripts/docker-dev-scripts.js db migrate
   ```

3. **Check database schema:**
   ```bash
   node scripts/docker-dev-scripts.js db shell
   \dt  # List tables
   \d table_name  # Describe table
   ```

### 3. Hot Reloading Issues

#### Problem: File changes not reflected

**Symptoms:**

- Changes to source files don't trigger rebuilds
- Frontend/backend doesn't reload automatically

**Solutions:**

1. **Check volume mounts:**

   ```bash
   docker-compose -f docker-compose.dev.yml exec backend-dev ls -la /app/src
   ```

2. **Verify file watching environment variables:**

   ```bash
   docker-compose -f docker-compose.dev.yml exec backend-dev env | grep CHOKIDAR
   ```

3. **Restart services with volume refresh:**

   ```bash
   docker-compose -f docker-compose.dev.yml down
   docker-compose -f docker-compose.dev.yml up -d
   ```

4. **Check file permissions:**
   ```bash
   # Ensure proper ownership
   sudo chown -R $(whoami):$(whoami) packages/
   ```

#### Problem: Vite HMR not working

**Solutions:**

1. **Check Vite configuration:**

   ```typescript
   // vite.config.ts
   export default {
     server: {
       host: '0.0.0.0',
       port: 5173,
       hmr: {
         port: 24678,
         host: 'localhost',
       },
     },
   };
   ```

2. **Verify WebSocket connection:**
   ```bash
   # Check if WebSocket port is accessible
   curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:24678
   ```

### 4. Performance Issues

#### Problem: Slow container startup

**Solutions:**

1. **Optimize Docker images:**

   ```dockerfile
   # Use more specific base images
   FROM node:18-alpine

   # Layer caching optimization
   COPY package*.json ./
   RUN npm ci --only=production
   ```

2. **Use volume caching:**

   ```yaml
   volumes:
     - ./src:/app/src:delegated # Use delegated for performance
     - node_modules:/app/node_modules # Named volume for node_modules
   ```

3. **Increase Docker resources:**
   ```bash
   # Check Docker resource limits
   docker info | grep -E "(CPUs|Memory)"
   ```

#### Problem: High memory usage

**Solutions:**

1. **Monitor container resources:**

   ```bash
   node scripts/docker-dev-scripts.js monitor
   ```

2. **Limit container memory:**

   ```yaml
   backend-dev:
     deploy:
       resources:
         limits:
           memory: 512M
         reservations:
           memory: 256M
   ```

3. **Optimize application code:**
   ```javascript
   // Implement proper cleanup
   process.on('SIGTERM', () => {
     server.close(() => {
       process.exit(0);
     });
   });
   ```

### 5. Network Issues

#### Problem: Service-to-service communication fails

**Solutions:**

1. **Check network configuration:**

   ```bash
   docker network ls
   docker network inspect sovren-dev
   ```

2. **Verify service discovery:**

   ```bash
   # Test connectivity between services
   docker-compose -f docker-compose.dev.yml exec backend-dev ping postgres-dev
   ```

3. **Check firewall rules:**
   ```bash
   # Disable firewall temporarily for testing
   sudo ufw disable  # Ubuntu
   sudo systemctl stop firewalld  # CentOS/RHEL
   ```

#### Problem: External API calls fail

**Solutions:**

1. **Check DNS resolution:**

   ```bash
   docker-compose -f docker-compose.dev.yml exec backend-dev nslookup google.com
   ```

2. **Verify proxy settings:**

   ```bash
   # Check if behind corporate proxy
   env | grep -i proxy
   ```

3. **Update Docker daemon configuration:**
   ```json
   // /etc/docker/daemon.json
   {
     "dns": ["8.8.8.8", "8.8.4.4"]
   }
   ```

## Performance Optimization

### 1. Container Image Optimization

#### Multi-stage builds

```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/server.js"]
```

#### Layer caching optimization

```dockerfile
# Copy dependency files first
COPY package*.json ./
RUN npm ci --only=production

# Copy source code later
COPY src ./src
```

### 2. Volume Performance

#### Use appropriate volume types

```yaml
volumes:
  # Fast for read-heavy workloads
  - ./src:/app/src:delegated

  # Use named volumes for node_modules
  - node_modules:/app/node_modules

  # Cached volumes for write-heavy workloads
  - ./logs:/app/logs:cached
```

#### Optimize file watching

```yaml
environment:
  - CHOKIDAR_USEPOLLING=true
  - CHOKIDAR_INTERVAL=1000
  - WATCHPACK_POLLING=true
```

### 3. Resource Management

#### Set appropriate limits

```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 1G
    reservations:
      cpus: '0.5'
      memory: 512M
```

#### Optimize garbage collection

```yaml
environment:
  - NODE_OPTIONS="--max-old-space-size=1024"
```

## Security Best Practices

### 1. Container Security

#### Use non-root users

```dockerfile
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
USER nextjs
```

#### Minimal base images

```dockerfile
FROM node:18-alpine  # Prefer Alpine Linux
```

#### Regular security updates

```bash
# Update base images regularly
docker pull node:18-alpine
node scripts/docker-dev-scripts.js build
```

### 2. Network Security

#### Isolate networks

```yaml
networks:
  sovren-dev:
    driver: bridge
    internal: true # For internal services
```

#### Use secrets management

```yaml
secrets:
  db_password:
    file: ./secrets/db_password.txt
```

### 3. Environment Security

#### Secure environment variables

```bash
# Use .env files with proper permissions
chmod 600 packages/backend/.env.development
```

#### Avoid hardcoded secrets

```typescript
// Use environment variables
const dbPassword = process.env.DB_PASSWORD;
```

## Monitoring and Debugging

### 1. Container Health Monitoring

#### Health check implementation

```yaml
healthcheck:
  test: ['CMD', 'curl', '-f', 'http://localhost:3001/api/health']
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

#### Resource monitoring

```bash
# Continuous monitoring
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
```

### 2. Log Management

#### Structured logging

```typescript
const logger = {
  info: (message: string, metadata?: any) => {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        message,
        ...metadata,
      })
    );
  },
};
```

#### Log aggregation

```yaml
logging:
  driver: 'json-file'
  options:
    max-size: '100m'
    max-file: '3'
```

### 3. Performance Profiling

#### Enable profiling

```typescript
// Add to package.json
"scripts": {
  "profile": "node --prof dist/server.js"
}
```

#### Memory profiling

```bash
# Generate heap snapshots
docker-compose -f docker-compose.dev.yml exec backend-dev npm run heap-snapshot
```

## Development Workflow

### 1. Daily Development

#### Start development environment

```bash
# Start core services
node scripts/docker-dev-scripts.js start core

# Check status
node scripts/docker-dev-scripts.js status

# View logs
node scripts/docker-dev-scripts.js logs -f
```

#### Code changes workflow

1. Edit source code
2. Watch for automatic reloads
3. Test changes
4. Commit changes

#### Database operations

```bash
# Run migrations
node scripts/docker-dev-scripts.js db migrate

# Seed data
node scripts/docker-dev-scripts.js db seed

# Access database shell
node scripts/docker-dev-scripts.js db shell
```

### 2. Testing

#### Run tests

```bash
# Run all tests
node scripts/docker-dev-scripts.js test

# Run specific test suite
docker-compose -f docker-compose.dev.yml exec backend-dev npm run test:unit
```

#### Integration testing

```bash
# Start testing profile
node scripts/docker-dev-scripts.js start testing

# Run integration tests
docker-compose -f docker-compose.dev.yml --profile testing exec test-runner npm run test:integration
```

### 3. Debugging

#### Access container shells

```bash
# Backend container
node scripts/docker-dev-scripts.js shell backend-dev

# Frontend container
node scripts/docker-dev-scripts.js shell frontend-dev

# Database container
node scripts/docker-dev-scripts.js shell postgres-dev
```

#### Debug Node.js applications

```bash
# Enable debug mode
docker-compose -f docker-compose.dev.yml exec backend-dev node --inspect-brk=0.0.0.0:9229 dist/server.js
```

## Backup and Recovery

### 1. Data Backup

#### Automated backups

```bash
# Create backup
node scripts/docker-dev-scripts.js backup

# Backup specific service
node scripts/docker-dev-scripts.js db backup
```

#### Manual backup

```bash
# Database backup
docker-compose -f docker-compose.dev.yml exec postgres-dev pg_dump -U sovren_dev sovren_development > backup.sql

# Volume backup
docker run --rm -v sovren_postgres_dev_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz /data
```

### 2. Environment Recovery

#### Reset environment

```bash
# Complete reset (destructive)
node scripts/docker-dev-scripts.js reset

# Soft reset
node scripts/docker-dev-scripts.js clean
node scripts/docker-dev-scripts.js start
```

#### Restore from backup

```bash
# Restore database
cat backup.sql | docker-compose -f docker-compose.dev.yml exec -T postgres-dev psql -U sovren_dev -d sovren_development
```

## Advanced Configuration

### 1. Custom Configurations

#### Environment-specific settings

```yaml
# docker-compose.dev.yml
services:
  backend-dev:
    environment:
      - NODE_ENV=development
      - DEBUG=sovren:*
      - LOG_LEVEL=debug
```

#### Override configurations

```yaml
# docker-compose.override.yml
version: '3.8'
services:
  backend-dev:
    environment:
      - CUSTOM_CONFIG=value
```

### 2. Development Tools Integration

#### VS Code integration

```json
// .vscode/settings.json
{
  "docker.defaultRegistry": "localhost:5000",
  "docker.attachShellCommand.linuxContainer": "/bin/sh"
}
```

#### IDE debugging

```json
// .vscode/launch.json
{
  "type": "node",
  "request": "attach",
  "name": "Docker: Attach to Node",
  "address": "localhost",
  "port": 9229,
  "localRoot": "${workspaceFolder}/packages/backend",
  "remoteRoot": "/app"
}
```

## Emergency Procedures

### 1. Container Recovery

#### Unresponsive containers

```bash
# Force restart
docker-compose -f docker-compose.dev.yml restart backend-dev

# Force stop and remove
docker-compose -f docker-compose.dev.yml kill backend-dev
docker-compose -f docker-compose.dev.yml rm -f backend-dev
```

#### Corrupted volumes

```bash
# Remove corrupted volume
docker volume rm sovren_postgres_dev_data

# Recreate from backup
docker run --rm -v sovren_postgres_dev_data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres_backup.tar.gz -C /data
```

### 2. System Recovery

#### Docker daemon issues

```bash
# Restart Docker daemon
sudo systemctl restart docker

# Clean Docker system
docker system prune -af
docker volume prune -f
```

#### Host system issues

```bash
# Check disk space
df -h

# Check memory usage
free -h

# Check system logs
journalctl -u docker.service
```

## Contact and Support

For additional help or to report issues:

1. Check the [development documentation](./docker-development-configuration.md)
2. Review container logs for error messages
3. Check the [GitHub issues](https://github.com/sovren/sovren/issues) for known problems
4. Contact the development team via Slack or email

## Related Documentation

- [Docker Development Configuration](./docker-development-configuration.md)
- [Build System Usage Guide](./build-system-usage-guide.md)
- [API Architecture](../api/api-architecture.md)
- [Security Guide](../security/docker-security-guide.md)
