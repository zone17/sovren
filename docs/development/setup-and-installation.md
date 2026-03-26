# Setup and Installation Guide

**Epic 005 Backend Service Refactoring - Developer Documentation**

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Configuration](#configuration)
4. [Database Setup](#database-setup)
5. [Redis Setup](#redis-setup)
6. [Lightning Node Setup](#lightning-node-setup)
7. [NOSTR Relay Configuration](#nostr-relay-configuration)
8. [First Run](#first-run)
9. [Verification](#verification)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

| Software       | Version | Purpose            | Installation                                  |
| -------------- | ------- | ------------------ | --------------------------------------------- |
| **Node.js**    | 18+     | JavaScript runtime | [nodejs.org](https://nodejs.org/)             |
| **npm**        | 8+      | Package manager    | Included with Node.js                         |
| **PostgreSQL** | 14+     | Primary database   | [postgresql.org](https://www.postgresql.org/) |
| **Redis**      | 6+      | Caching layer      | [redis.io](https://redis.io/)                 |
| **Docker**     | 20+     | Containerization   | [docker.com](https://www.docker.com/)         |
| **Git**        | 2.30+   | Version control    | [git-scm.com](https://git-scm.com/)           |

### Optional Software

| Software                  | Version | Purpose                | Installation                                            |
| ------------------------- | ------- | ---------------------- | ------------------------------------------------------- |
| **LND**                   | 0.15+   | Lightning Network node | [lightning.engineering](https://lightning.engineering/) |
| **Visual Studio Code**    | Latest  | Recommended IDE        | [code.visualstudio.com](https://code.visualstudio.com/) |
| **TablePlus/DBeaver**     | Latest  | Database GUI           | [tableplus.com](https://tableplus.com/)                 |
| **Redis Desktop Manager** | Latest  | Redis GUI              | [redisdesktop.com](https://redisdesktop.com/)           |

### System Requirements

- **OS**: macOS, Linux, or Windows (WSL2 recommended)
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 10GB free space minimum
- **Network**: Stable internet connection for NOSTR relays and Lightning Network

---

## Environment Setup

### 1. Clone Repository

```bash
# Clone the repository
git clone https://github.com/zone17/sovren.git
cd sovren

# Verify monorepo structure
ls -la packages/
# You should see: frontend, backend, shared, testing
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# This installs dependencies for all workspace packages:
# - packages/frontend
# - packages/backend
# - packages/shared
# - packages/testing
```

### 3. Verify Installation

```bash
# Check Node.js version
node --version
# Expected: v18.0.0 or higher

# Check npm version
npm --version
# Expected: 8.0.0 or higher

# Verify workspace structure
npm run docs
# Should display documentation index
```

---

## Configuration

### Backend Configuration

#### 1. Create Environment File

```bash
cd packages/backend
cp .env.example .env
```

#### 2. Configure Environment Variables

Edit `packages/backend/.env`:

```bash
# Application
NODE_ENV=development
PORT=3001
API_VERSION=v1

# Database
DATABASE_URL=postgresql://sovren:sovren_dev_password@localhost:5432/sovren_dev
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Redis Cache
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_DB=0

# JWT Authentication
JWT_SECRET=your_super_secret_jwt_key_change_in_production
JWT_EXPIRATION=7d
REFRESH_TOKEN_EXPIRATION=30d

# NOSTR Configuration
NOSTR_RELAYS=wss://relay.damus.io,wss://nostr.wine,wss://relay.nostr.band
NOSTR_PRIVATE_KEY=your_nostr_private_key_hex

# Lightning Network
LIGHTNING_NODE_TYPE=lnd
LIGHTNING_NODE_URL=https://localhost:8080
LIGHTNING_MACAROON=your_admin_macaroon_hex
LIGHTNING_TLS_CERT_PATH=/path/to/tls.cert

# Webhooks
WEBHOOK_SECRET=your_webhook_secret_at_least_32_chars
WEBHOOK_SECRET_ROTATION=your_rotation_secret

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Feature Flags
ENABLE_LIGHTNING_PAYMENTS=true
ENABLE_NOSTR_SYNC=true
ENABLE_AI_RECOMMENDATIONS=false

# Logging
LOG_LEVEL=debug
LOG_FORMAT=json
```

#### 3. Security Best Practices

```bash
# Generate secure secrets (macOS/Linux)
openssl rand -hex 32  # For JWT_SECRET
openssl rand -hex 32  # For WEBHOOK_SECRET

# Generate NOSTR key pair (use nostr-tools)
npx nostr-keygen
```

### Frontend Configuration

```bash
cd packages/frontend
cp .env.example .env.local
```

Edit `packages/frontend/.env.local`:

```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# API
VITE_API_URL=http://localhost:3001/api/v1
VITE_WS_URL=ws://localhost:3001

# NOSTR
VITE_NOSTR_RELAYS=wss://relay.damus.io,wss://nostr.wine

# Feature Flags (mirrored from backend)
VITE_ENABLE_LIGHTNING_PAYMENTS=true
VITE_ENABLE_NOSTR_SYNC=true
VITE_ENABLE_AI_RECOMMENDATIONS=false
```

---

## Database Setup

### PostgreSQL Installation

#### macOS (Homebrew)

```bash
# Install PostgreSQL
brew install postgresql@14

# Start PostgreSQL service
brew services start postgresql@14

# Verify installation
psql --version
```

#### Linux (Ubuntu/Debian)

```bash
# Add PostgreSQL repository
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'

# Import signing key
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# Install PostgreSQL
sudo apt-get update
sudo apt-get install postgresql-14

# Start service
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### Windows (WSL2)

Follow Linux instructions or use [PostgreSQL Windows installer](https://www.postgresql.org/download/windows/).

### Database Creation

```bash
# Connect to PostgreSQL
psql postgres

# Create user and database
CREATE USER sovren WITH PASSWORD 'sovren_dev_password';
CREATE DATABASE sovren_dev OWNER sovren;

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE sovren_dev TO sovren;

# Exit psql
\q
```

### Schema Migration

```bash
cd packages/backend

# Run migrations with Supabase CLI
supabase db push

# Verify schema (connect to local or remote Supabase project)
supabase db diff
```

### Test Data Seeding

```bash
# Seed development database
npm run db:seed

# Or manually run seed script
node scripts/seed-database.js
```

---

## Redis Setup

### Redis Installation

#### macOS (Homebrew)

```bash
# Install Redis
brew install redis

# Start Redis service
brew services start redis

# Verify installation
redis-cli ping
# Expected output: PONG
```

#### Linux (Ubuntu/Debian)

```bash
# Install Redis
sudo apt-get update
sudo apt-get install redis-server

# Start service
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Verify
redis-cli ping
```

#### Docker (All Platforms)

```bash
# Run Redis in Docker
docker run -d \
  --name sovren-redis \
  -p 6379:6379 \
  -v sovren-redis-data:/data \
  redis:6-alpine \
  redis-server --appendonly yes

# Verify
docker exec sovren-redis redis-cli ping
```

### Redis Configuration

Edit `/usr/local/etc/redis.conf` (macOS) or `/etc/redis/redis.conf` (Linux):

```conf
# Bind to localhost only (development)
bind 127.0.0.1

# Set password (optional for development)
requirepass your_redis_password

# Enable persistence
appendonly yes
appendfilename "sovren-appendonly.aof"

# Memory limits
maxmemory 256mb
maxmemory-policy allkeys-lru
```

Restart Redis after configuration changes:

```bash
brew services restart redis  # macOS
sudo systemctl restart redis-server  # Linux
```

---

## Lightning Node Setup

### Option 1: Local LND Node (Recommended for Production)

#### Install LND

```bash
# macOS
brew install lnd

# Linux - Download from GitHub
wget https://github.com/lightningnetwork/lnd/releases/download/v0.15.5-beta/lnd-linux-amd64-v0.15.5-beta.tar.gz
tar -xzf lnd-linux-amd64-v0.15.5-beta.tar.gz
sudo install lnd-linux-amd64-v0.15.5-beta/lnd /usr/local/bin/
```

#### Configure LND

Create `~/.lnd/lnd.conf`:

```conf
[Application Options]
alias=sovren-node
debuglevel=info
maxpendingchannels=5
listen=localhost

[Bitcoin]
bitcoin.active=1
bitcoin.testnet=1
bitcoin.node=neutrino

[Neutrino]
neutrino.connect=testnet1-btcd.zaphq.io
neutrino.connect=testnet2-btcd.zaphq.io
```

#### Start LND

```bash
# Start LND
lnd

# Create wallet (first time only)
lncli create

# Get node info
lncli getinfo

# Generate invoice macaroon
lncli bakemacaroon --save_to=admin.macaroon \
  address:read address:write \
  invoices:read invoices:write \
  onchain:read onchain:write
```

### Option 2: Voltage Cloud (Easiest for Development)

1. Sign up at [voltage.cloud](https://voltage.cloud/)
2. Create a testnet Lightning node
3. Get REST API credentials
4. Update `.env`:

```bash
LIGHTNING_NODE_TYPE=voltage
LIGHTNING_NODE_URL=https://your-node.voltage.cloud
LIGHTNING_MACAROON=your_voltage_macaroon
```

### Option 3: LNbits Wallet (Testing Only)

1. Visit [legend.lnbits.com](https://legend.lnbits.com/)
2. Create wallet
3. Get API key
4. Update `.env`:

```bash
LIGHTNING_NODE_TYPE=lnbits
LIGHTNING_NODE_URL=https://legend.lnbits.com
LIGHTNING_API_KEY=your_lnbits_api_key
```

---

## NOSTR Relay Configuration

### Default Relays

The application uses these public relays by default:

```javascript
const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nostr.wine',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.snort.social',
];
```

### Custom Relay Setup

Update `packages/shared/src/config/relay-config.ts`:

```typescript
export const RELAY_CONFIG = {
  relays: [
    'wss://your-relay.com',
    'wss://relay.damus.io', // Fallback
  ],
  connectionTimeout: 5000,
  reconnectInterval: 3000,
  maxReconnectAttempts: 5,
};
```

### Running Your Own Relay (Advanced)

```bash
# Install nostr-rs-relay
cargo install nostr-rs-relay

# Or use Docker
docker run -d \
  --name nostr-relay \
  -p 8080:8080 \
  scsibug/nostr-rs-relay

# Configure relay URL
NOSTR_RELAYS=wss://localhost:8080
```

---

## First Run

### 1. Start Backend Services

```bash
# Option A: Using Docker Compose (Recommended)
docker-compose up -d

# Option B: Manual startup
# Terminal 1: PostgreSQL (if not running as service)
postgres -D /usr/local/var/postgres

# Terminal 2: Redis (if not running as service)
redis-server

# Terminal 3: Backend API
cd packages/backend
npm run dev
```

### 2. Start Frontend

```bash
# Terminal 4: Frontend dev server
cd packages/frontend
npm run dev

# Frontend will be available at http://localhost:3000
```

### 3. Verify All Services Running

```bash
# Check backend health
curl http://localhost:3001/api/v1/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-10-27T12:00:00.000Z",
  "services": {
    "database": "connected",
    "redis": "connected",
    "lightning": "connected"
  }
}
```

---

## Verification

### Run Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit          # Unit tests
npm run test:integration   # Integration tests
npm run test:e2e          # End-to-end tests
```

### Code Quality Checks

```bash
# Lint code
npm run lint

# Format code
npm run format:check

# Type checking
npm run type-check

# Full quality gate
npm run quality:check
```

### Build Verification

```bash
# Build backend
cd packages/backend
npm run build

# Build frontend
cd packages/frontend
npm run build

# Preview production build
npm run preview
```

---

## Troubleshooting

### Common Issues

#### Database Connection Failed

```bash
# Check PostgreSQL is running
pg_isready

# Check connection details
psql $DATABASE_URL

# Reset database
dropdb sovren_dev
createdb sovren_dev
npm run db:migrate
```

#### Redis Connection Failed

```bash
# Check Redis is running
redis-cli ping

# Check connection
redis-cli -h localhost -p 6379

# Clear cache
redis-cli FLUSHDB
```

#### Port Already in Use

```bash
# Find process using port 3001
lsof -i :3001

# Kill process
kill -9 <PID>

# Or change port in .env
PORT=3002
```

#### Node Modules Issues

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
rm -rf packages/*/node_modules
npm install
```

#### TypeScript Errors

```bash
# Clear TypeScript cache
rm -rf packages/*/tsconfig.tsbuildinfo

# Rebuild
npm run type-check
```

### Getting Help

1. Check [Troubleshooting Guide](/docs/development/troubleshooting.md)
2. Search [GitHub Issues](https://github.com/zone17/sovren/issues)
3. Ask in team Slack #engineering
4. Create new issue with `setup` label

---

## Next Steps

After successful setup:

1. Read [Development Workflow Guide](/docs/development/development-workflow.md)
2. Review [Testing Guide](/docs/development/testing-guide.md)
3. Explore [Service Development Guide](/docs/development/service-development.md)
4. Check [Contributing Guide](/docs/development/contributing.md)

---

**Last Updated**: 2025-10-27
**Epic**: Epic 005 - Backend Service Refactoring
**Story**: US-E5-039 - Developer Documentation
