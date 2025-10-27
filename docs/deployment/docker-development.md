# Docker Development Environment

## Overview

The Sovren Docker development environment provides a complete, containerized development setup that ensures consistency across all team members' machines. This environment includes all necessary services for local development with hot reloading, debugging capabilities, and service integration.

## Prerequisites

### Required Software

- **Docker Desktop**: Version 4.0 or higher
- **Docker Compose**: Version 2.0 or higher (included with Docker Desktop)
- **Git**: For repository management

### System Requirements

- **RAM**: Minimum 8GB, recommended 16GB
- **Disk Space**: At least 10GB free space
- **CPU**: Multi-core processor recommended
- **OS**: macOS, Windows 10/11, or Linux

### Verification

Check that Docker is properly installed:

```bash
docker --version
docker-compose --version
```

## Quick Start

### 1. Environment Setup

```bash
# Clone the repository (if not already done)
git clone <repository-url>
cd sovren

# Copy environment template
cp env.example .env

# Edit environment variables
nano .env  # or use your preferred editor
```

### 2. Start Development Environment

```bash
# Build and start all services
./scripts/docker-dev.sh start

# Or manually with docker-compose
docker-compose up -d
```

### 3. Access Services

Once started, services are available at:

- **Frontend**: http://localhost:5173 (Vite dev server)
- **Backend API**: http://localhost:3001 (Express server)
- **Nginx Proxy**: http://localhost:8080 (Production-like routing)
- **Redis**: localhost:6379
- **PostgreSQL**: localhost:5432
- **Mailhog**: http://localhost:8025 (Email testing)

## Service Architecture

### Core Services

#### Frontend (React + Vite)

- **Container**: `sovren-frontend-dev`
- **Port**: 5173
- **Hot Reloading**: Enabled via volume mounts
- **Build Tool**: Vite with TypeScript
- **Features**:
  - Real-time code updates
  - TypeScript compilation
  - Tailwind CSS processing
  - Component hot reloading

#### Backend (Node.js + Express)

- **Container**: `sovren-backend-dev`
- **Port**: 3001 (app), 9229 (debugger)
- **Hot Reloading**: Enabled via nodemon
- **Runtime**: Node.js 18 Alpine
- **Features**:
  - TypeScript compilation on-the-fly
  - Debug port for IDE integration
  - Automatic restart on file changes
  - Environment variable injection

#### Database Services

- **Redis**: Caching and session storage
- **PostgreSQL**: Primary database (optional, can use Supabase)

#### Supporting Services

- **Nginx**: Reverse proxy for production-like routing
- **Mailhog**: Email testing and debugging

## Development Workflow

### Daily Development

```bash
# Start development environment
./scripts/docker-dev.sh start

# View logs for all services
./scripts/docker-dev.sh logs

# View logs for specific service
./scripts/docker-dev.sh logs backend

# Execute commands in containers
./scripts/docker-dev.sh exec backend npm test
./scripts/docker-dev.sh exec frontend npm run lint

# Stop environment when done
./scripts/docker-dev.sh stop
```

### Code Changes

1. **Frontend Changes**: Edit files in `packages/frontend/src/`

   - Changes are automatically reflected via Vite HMR
   - TypeScript compilation happens in real-time
   - Browser automatically refreshes on save

2. **Backend Changes**: Edit files in `packages/backend/src/`
   - Nodemon automatically restarts the server
   - TypeScript compilation happens on restart
   - API endpoints are immediately available

### Testing

```bash
# Run all tests
./scripts/docker-dev.sh test

# Run specific package tests
./scripts/docker-dev.sh exec backend npm test
./scripts/docker-dev.sh exec frontend npm test

# Run tests in watch mode
./scripts/docker-dev.sh exec backend npm run test:watch
```

### Debugging

#### Backend Debugging

1. **VS Code Setup**:

   ```json
   // .vscode/launch.json
   {
     "version": "0.2.0",
     "configurations": [
       {
         "name": "Attach to Backend",
         "type": "node",
         "request": "attach",
         "port": 9229,
         "address": "localhost",
         "localRoot": "${workspaceFolder}/packages/backend",
         "remoteRoot": "/app",
         "skipFiles": ["<node_internals>/**"]
       }
     ]
   }
   ```

2. **Start debugging session**:
   - Set breakpoints in your code
   - Run the "Attach to Backend" configuration
   - Trigger API calls to hit breakpoints

#### Frontend Debugging

- Use browser developer tools
- React Developer Tools extension
- Redux DevTools (if using Redux)

## Environment Configuration

### Environment Variables

Configure in `.env` file:

```bash
# Database Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Authentication
JWT_SECRET=your_jwt_secret

# Lightning Network
LNBITS_API_URL=your_lnbits_url
LNBITS_ADMIN_KEY=your_admin_key
LNBITS_INVOICE_READ_KEY=your_read_key

# NOSTR Configuration
NOSTR_RELAYS=wss://relay1.com,wss://relay2.com

# Development Settings
NODE_ENV=development
LOG_LEVEL=debug
```

### Service Configuration

#### Custom Nginx Configuration

Edit `nginx-dev.conf` to modify routing:

- API routes: `/api/*` → Backend service
- Static assets: Cached appropriately
- WebSocket support: For HMR and real-time features

#### Redis Configuration

Edit `redis.conf` for custom Redis settings:

- Memory limits
- Persistence settings
- Security configuration

## Volume Mounts

### Source Code Volumes

- `./packages/frontend/src:/app/src:cached` - Frontend source with caching
- `./packages/backend/src:/app/src:cached` - Backend source with caching

### Configuration Volumes

- `./packages/frontend/package.json:/app/package.json:ro` - Read-only package config
- `./nginx-dev.conf:/etc/nginx/nginx.conf:ro` - Nginx configuration

### Data Volumes

- `backend_node_modules` - Persistent backend dependencies
- `frontend_node_modules` - Persistent frontend dependencies
- `redis_data` - Redis data persistence
- `postgres_data` - PostgreSQL data persistence

## Troubleshooting

### Common Issues

#### Port Conflicts

```bash
# Check what's using a port
lsof -i :5173
lsof -i :3001

# Kill processes using ports
kill -9 <PID>
```

#### Container Build Issues

```bash
# Clean build (removes cache)
./scripts/docker-dev.sh clean
./scripts/docker-dev.sh build

# Rebuild specific service
docker-compose build --no-cache frontend
```

#### Volume Mount Issues

```bash
# Reset volumes
docker-compose down -v
docker-compose up -d

# Check volume mounts
docker-compose exec frontend ls -la /app/src
```

#### Permission Issues (Linux/macOS)

```bash
# Fix ownership issues
sudo chown -R $USER:$USER packages/
```

### Performance Optimization

#### For macOS

- Use `:cached` volume mount option (already configured)
- Allocate sufficient RAM to Docker Desktop (8GB+)
- Enable file sharing for project directory

#### For Windows

- Use WSL2 backend for Docker Desktop
- Store project files in WSL2 filesystem
- Configure proper line endings (LF)

#### For Linux

- Use native Docker installation
- Configure user namespaces if needed
- Optimize volume mount options

### Logs and Monitoring

#### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Last N lines
docker-compose logs --tail=50 frontend
```

#### Container Status

```bash
# Service status
./scripts/docker-dev.sh status

# Detailed container info
docker-compose ps
docker stats
```

#### Health Checks

All services include health checks:

- **Frontend**: HTTP check on port 5173
- **Backend**: HTTP check on `/health` endpoint
- **Redis**: Redis ping command
- **PostgreSQL**: Database connection check

## Advanced Usage

### Custom Commands

```bash
# Install new package in backend
./scripts/docker-dev.sh exec backend npm install lodash
./scripts/docker-dev.sh exec backend npm install --save-dev @types/lodash

# Install new package in frontend
./scripts/docker-dev.sh exec frontend npm install react-query

# Run database migrations
./scripts/docker-dev.sh exec backend npm run migrate

# Generate API documentation
./scripts/docker-dev.sh exec backend npm run docs:generate
```

### Multi-Stage Development

```bash
# Run only core services
docker-compose up -d backend frontend redis

# Add additional services later
docker-compose up -d postgres mailhog
```

### Integration Testing

```bash
# Run integration tests
./scripts/docker-dev.sh exec backend npm run test:integration

# Run E2E tests
./scripts/docker-dev.sh exec frontend npm run test:e2e
```

## Best Practices

### Development Workflow

1. **Start fresh daily**: `./scripts/docker-dev.sh clean && ./scripts/docker-dev.sh start`
2. **Use service-specific logs**: Monitor only relevant services during development
3. **Regular cleanup**: Clean unused images and volumes weekly
4. **Environment sync**: Keep `.env` file updated with team changes

### Code Organization

1. **Hot reload friendly**: Structure code to maximize hot reload efficiency
2. **Environment awareness**: Use environment variables for configuration
3. **Container-agnostic**: Write code that works both in containers and locally

### Resource Management

1. **Monitor resource usage**: Use `docker stats` to monitor container resource usage
2. **Optimize builds**: Use `.dockerignore` files to exclude unnecessary files
3. **Cleanup regularly**: Remove unused containers, images, and volumes

## Migration from Local Development

### Moving from Local to Docker

1. **Backup local environment**: Export databases, save configurations
2. **Update dependencies**: Ensure package.json files are current
3. **Configure environment**: Set up `.env` file with proper values
4. **Test incrementally**: Start with one service at a time
5. **Validate functionality**: Ensure all features work in containerized environment

### IDE Integration

- **VS Code**: Use Dev Containers extension for full container development
- **WebStorm**: Configure Docker integration for debugging and testing
- **Vim/Neovim**: Use remote editing capabilities with container integration

---

**Last Updated:** December 2024
**Version:** 1.0
**Next Review:** March 2025
