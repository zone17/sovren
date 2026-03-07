# Sovren Infrastructure Documentation

**Status**: Production Ready (FREE Tier Optimized)
**Cost**: $0/month (within free tier limits)
**Last Updated**: 2025-10-27

## Executive Summary

This infrastructure provides production-grade multi-environment support for the Sovren platform using **100% FREE tier resources**. All infrastructure is defined as code using Terraform, ensuring reproducibility, version control, and infrastructure documentation.

### Key Features

- **Zero Cost**: All resources use free tier offerings (Supabase, Upstash, Railway, Vercel)
- **Multi-Environment**: Development, Staging, Production with production parity
- **Infrastructure as Code**: 100% Terraform-managed infrastructure
- **High Availability**: 2 replicas per service in production (zero-downtime deployments)
- **Security First**: SSL/TLS everywhere, secure cookies, Helmet headers, rate limiting
- **Automated Promotion**: GitHub Actions workflow for staging → production promotion

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    SOVREN INFRASTRUCTURE                         │
│                   (FREE TIER - $0/MONTH)                         │
└─────────────────────────────────────────────────────────────────┘

  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
  │  DEVELOPMENT    │   │    STAGING      │   │   PRODUCTION    │
  │   (Local)       │   │  (Cloud/Free)   │   │  (Cloud/Free)   │
  └─────────────────┘   └─────────────────┘   └─────────────────┘
         │                       │                       │
         ├───────────────────────┼───────────────────────┤
         │                       │                       │
  ┌──────▼──────┐        ┌──────▼──────┐        ┌──────▼──────┐
  │   Frontend  │        │   Frontend  │        │   Frontend  │
  │  localhost  │        │   Vercel    │        │   Vercel    │
  │   :3000     │        │   Preview   │        │  Production │
  └─────────────┘        └─────────────┘        └─────────────┘
         │                       │                       │
  ┌──────▼──────┐        ┌──────▼──────┐        ┌──────▼──────┐
  │   Backend   │        │   Backend   │        │   Backend   │
  │   Docker    │        │   Railway   │        │   Railway   │
  │  Compose    │        │  (1 replica)│        │ (2 replicas)│
  └─────────────┘        └─────────────┘        └─────────────┘
         │                       │                       │
         ├───────────────────────┴───────────────────────┤
         │                                               │
  ┌──────▼──────┐                                ┌──────▼──────┐
  │  PostgreSQL │                                │    Redis    │
  │   Supabase  │                                │   Upstash   │
  │  Free Tier  │                                │  Free Tier  │
  │  500MB DB   │                                │ 10K cmds/day│
  └─────────────┘                                └─────────────┘
```

## Directory Structure

```
infrastructure/
├── modules/                    # Reusable Terraform modules
│   ├── database/              # PostgreSQL (Supabase) configuration
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── redis/                 # Redis (Upstash) configuration
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── backend-services/      # Docker container configuration
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   └── monitoring/            # Monitoring and alerting (future)
│
├── environments/              # Environment-specific configurations
│   ├── staging/
│   │   ├── main.tf           # Staging infrastructure
│   │   ├── variables.tf      # Staging variables
│   │   └── terraform.tfvars.example
│   └── production/
│       ├── main.tf           # Production infrastructure
│       ├── variables.tf      # Production variables
│       └── terraform.tfvars.example
│
├── scripts/                   # Automation scripts
│   ├── setup-staging-db.sh   # Staging database setup
│   └── setup-production-db.sh # Production database setup
│
└── README.md                  # This file
```

## Environment Specifications

### Development (Local)

**Purpose**: Local development and testing
**Infrastructure**: Docker Compose
**Cost**: $0 (runs on developer machine)

| Resource     | Configuration                             |
| ------------ | ----------------------------------------- |
| **Frontend** | Vite dev server (localhost:3000)          |
| **Backend**  | Docker Compose (localhost:4000)           |
| **Database** | Local PostgreSQL (localhost:5432)         |
| **Redis**    | Local Redis (localhost:6379)              |
| **Logging**  | Debug level, pretty print                 |
| **Features** | All features enabled (beta + debug tools) |

### Staging

**Purpose**: Production parity testing before production deployment
**Infrastructure**: Cloud services (FREE tier)
**Cost**: $0/month

| Resource     | Configuration                     | Free Tier Details                     |
| ------------ | --------------------------------- | ------------------------------------- |
| **Frontend** | Vercel Preview                    | Unlimited deployments                 |
| **Backend**  | Railway.app                       | $5/month credit                       |
| **Database** | Supabase                          | 500MB storage, unlimited API requests |
| **Redis**    | Upstash                           | 10,000 commands/day, 256MB memory     |
| **Logging**  | Debug level                       | For testing visibility                |
| **Features** | Beta enabled, debug tools enabled | Testing environment                   |
| **Replicas** | 1 per service                     | Sufficient for testing                |
| **SSL/TLS**  | Enforced                          | Production parity                     |

### Production

**Purpose**: Live environment serving real users
**Infrastructure**: Cloud services (FREE tier) with high availability
**Cost**: $0/month

| Resource     | Configuration                 | Free Tier Details                     |
| ------------ | ----------------------------- | ------------------------------------- |
| **Frontend** | Vercel Production             | Unlimited deployments                 |
| **Backend**  | Railway.app                   | $5/month credit                       |
| **Database** | Supabase                      | 500MB storage, unlimited API requests |
| **Redis**    | Upstash                       | 10,000 commands/day, 256MB memory     |
| **Logging**  | Error level only              | Reduced noise                         |
| **Features** | Beta DISABLED, debug DISABLED | Security + performance                |
| **Replicas** | 2 per service                 | High availability                     |
| **SSL/TLS**  | Enforced                      | Security requirement                  |
| **CDN**      | Vercel CDN                    | Global edge network                   |

## Getting Started

### Prerequisites

1. **Terraform** (v1.0+): [Install Terraform](https://www.terraform.io/downloads)
2. **PostgreSQL Client** (psql): For database setup scripts
3. **Node.js** (v20+): For migration scripts
4. **GitHub Account**: For GHCR and secrets management

### Required Accounts (All FREE)

1. **Supabase**: [Sign up](https://supabase.com) - PostgreSQL database
2. **Upstash**: [Sign up](https://upstash.com) - Redis caching
3. **Railway.app**: [Sign up](https://railway.app) - Backend hosting
4. **Vercel**: [Sign up](https://vercel.com) - Frontend hosting

### 1. Clone and Setup

```bash
# Clone repository
git clone https://github.com/your-org/sovren.git
cd sovren/infrastructure

# Install dependencies
npm install
```

### 2. Configure Staging Environment

```bash
# Navigate to staging environment
cd environments/staging

# Copy example terraform.tfvars
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars with your staging credentials
vim terraform.tfvars

# Initialize Terraform
terraform init

# Review planned changes
terraform plan

# Apply infrastructure
terraform apply
```

### 3. Setup Staging Database

```bash
# Set database connection string
export DATABASE_URL_STAGING="postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres"

# Run database setup script
cd ../../scripts
./setup-staging-db.sh
```

### 4. Configure Production Environment

```bash
# Navigate to production environment
cd ../environments/production

# Copy example terraform.tfvars
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars with your production credentials
vim terraform.tfvars

# Initialize Terraform
terraform init

# Review planned changes (CAREFULLY!)
terraform plan

# Apply infrastructure (with confirmation)
terraform apply
```

### 5. Setup Production Database

```bash
# Set database connection string
export DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres"

# Run database setup script (with safety prompts)
cd ../../scripts
./setup-production-db.sh
```

## Infrastructure Modules

### Database Module

**Provider**: Supabase (FREE tier: 500MB storage, unlimited API requests)

**Features**:

- Automatic schema creation (app, auth, storage)
- PostgreSQL extensions (uuid-ossp, pgcrypto, pg_stat_statements)
- SSL/TLS enforced
- Automatic backups (7 days retention)
- Connection pooling

**Usage**:

```hcl
module "database" {
  source = "../../modules/database"

  database_url           = var.database_url
  database_name          = "sovren_production"
  environment            = "production"
  backup_enabled         = true
  backup_retention_days  = 7
  max_connections        = 100

  tags = local.common_tags
}
```

### Redis Module

**Provider**: Upstash (FREE tier: 10,000 commands/day, 256MB memory)

**Features**:

- Environment-specific cache profiles
- Automatic eviction policies (LRU/LFU)
- Connection pooling
- TLS support
- TTL configuration

**Usage**:

```hcl
module "redis" {
  source = "../../modules/redis"

  redis_url             = var.redis_url
  redis_password        = var.redis_password
  environment           = "production"
  max_memory            = "256mb"
  eviction_policy       = "allkeys-lfu"
  default_ttl           = 7200
  enable_persistence    = true
  connection_pool_size  = 20

  tags = local.common_tags
}
```

### Backend Services Module

**Provider**: Railway.app (FREE: $5/month credit)

**Features**:

- Environment-specific resource limits
- Health check configuration
- GHCR integration
- Blue-green deployment support
- Auto-scaling configuration (paid tier)

**Usage**:

```hcl
module "backend_services" {
  source = "../../modules/backend-services"

  environment         = "production"
  repository_owner    = "your-github-org"
  ghcr_registry       = "ghcr.io"
  enable_auto_scaling = false  # Not available in free tier

  services = {
    api = {
      image_tag         = "production-latest"
      cpu_limit         = "1.0"
      memory_limit      = "1024m"
      replicas          = 2
      health_check_path = "/health"
    }
  }

  tags = local.common_tags
}
```

## Environment Configuration Files

Application-level environment configurations are in `/config/environments/`:

- `development.ts` - Local development configuration
- `staging.ts` - Staging environment configuration
- `production.ts` - Production environment configuration
- `index.ts` - Configuration selector and validation

**Usage in Application**:

```typescript
import config from '@/config/environments';

console.log(config.api.url); // Auto-selects based on NODE_ENV
console.log(config.database.poolSize);
console.log(config.redis.ttl);
```

## Environment Promotion Workflow

Promote validated changes from staging to production using GitHub Actions:

### Manual Promotion

```bash
# Via GitHub Actions UI
1. Go to Actions → Promote Environment
2. Select "from: staging" and "to: production"
3. Click "Run workflow"
4. Approve deployment in production environment
```

### Automated Checks

The promotion workflow includes:

1. ✅ Validate staging environment health
2. ✅ Run staging tests
3. ✅ Check metrics (error rate, response time, uptime)
4. ✅ Create promotion tag
5. ✅ Deploy to production
6. ✅ Run database migrations
7. ✅ Verify production deployment
8. ✅ Monitor for 30 minutes
9. ✅ Auto-rollback on failure

## Database Setup Scripts

### Staging Database Setup

```bash
export DATABASE_URL_STAGING="postgresql://..."
./infrastructure/scripts/setup-staging-db.sh
```

**What it does**:

- Creates database and schemas
- Installs PostgreSQL extensions
- Runs migrations
- Seeds test data
- Configures staging-specific settings
- Verifies setup

### Production Database Setup

```bash
export DATABASE_URL="postgresql://..."
./infrastructure/scripts/setup-production-db.sh
```

**What it does**:

- Creates database and schemas
- Installs PostgreSQL extensions
- Runs migrations (NO TEST DATA)
- Configures production-specific settings
- Creates initial backup
- Verifies setup
- Includes safety prompts

## Environment Validation Tests

Run environment validation tests to ensure proper configuration:

```bash
# Validate staging configuration
npm run test:environments -- staging.test.ts

# Validate production configuration
npm run test:environments -- production.test.ts

# Validate all environments
npm run test:environments
```

**Test Coverage**:

- ✅ Environment identity and isolation
- ✅ API configuration (endpoints, timeouts, retries)
- ✅ Database configuration (pool size, SSL, timeouts)
- ✅ Redis configuration (TTL, eviction policy)
- ✅ Logging levels
- ✅ Feature flags
- ✅ Security settings (CORS, cookies, Helmet)
- ✅ Monitoring configuration
- ✅ Production parity (staging vs production)

## Cost Breakdown

### Monthly Infrastructure Cost: $0

| Service         | Usage                         | Cost         |
| --------------- | ----------------------------- | ------------ |
| **Supabase**    | 500MB database, unlimited API | $0           |
| **Upstash**     | 10,000 Redis commands/day     | $0           |
| **Railway.app** | $5 monthly credit             | $0           |
| **Vercel**      | Unlimited deployments         | $0           |
| **GitHub**      | Actions (2,000 minutes/month) | $0           |
| **GHCR**        | 500MB storage                 | $0           |
| **Total**       |                               | **$0/month** |

### Free Tier Limits

**Supabase**:

- 500MB database storage
- Unlimited API requests
- 50,000 monthly active users
- 2GB file storage
- 7 days backup retention

**Upstash**:

- 10,000 commands/day
- 256MB memory
- 20 connections max
- Regional deployment

**Railway**:

- $5/month credit (renewable)
- 512MB memory per service
- Shared CPU
- Community support

**Vercel**:

- Unlimited deployments
- 100GB bandwidth
- Global CDN
- Automatic HTTPS

## Security Best Practices

### 1. Secrets Management

**DO**:

- Store secrets in GitHub Secrets
- Use environment-specific secrets (e.g., `DATABASE_URL_STAGING`)
- Rotate secrets regularly
- Use `.tfvars` files (never commit them!)

**DON'T**:

- Commit `.tfvars` files to git
- Hardcode secrets in code
- Share secrets in Slack/email
- Use same secrets across environments

### 2. Database Security

- ✅ SSL/TLS enforced for all connections
- ✅ Strong passwords (32+ characters)
- ✅ Connection pooling limits
- ✅ Statement timeouts configured
- ✅ Automated backups enabled

### 3. Network Security

- ✅ HTTPS only for all external connections
- ✅ Secure cookies in production
- ✅ Helmet security headers
- ✅ Rate limiting enabled
- ✅ CORS properly configured

### 4. Application Security

- ✅ No debug tools in production
- ✅ Error-only logging in production
- ✅ No beta features in production
- ✅ Environment isolation
- ✅ Input validation

## Monitoring and Observability

### Health Checks

All services expose health check endpoints:

- `/health` - Overall service health
- `/ready` - Ready to receive traffic
- `/live` - Process is alive

### Monitoring Configuration

**Staging**:

- Sentry error tracking (100% sample rate)
- Performance monitoring enabled
- Debug logging enabled
- Verbose error messages

**Production**:

- Sentry error tracking (10% sample rate for cost optimization)
- Performance monitoring enabled
- Error-only logging
- Sanitized error messages

### Metrics to Monitor

1. **Application Metrics**:
   - Request rate
   - Error rate (target: < 1%)
   - Response time P95 (target: < 500ms)
   - Concurrent users

2. **Database Metrics**:
   - Connection pool usage
   - Query duration
   - Slow queries
   - Storage usage

3. **Redis Metrics**:
   - Command rate (stay under 10K/day)
   - Memory usage (stay under 256MB)
   - Hit rate
   - Evictions

## Troubleshooting

### Terraform Issues

**Problem**: `terraform init` fails
**Solution**: Check Terraform version (>=1.0), run with `-upgrade` flag

**Problem**: `terraform apply` fails with auth error
**Solution**: Verify database credentials in `terraform.tfvars`

### Database Issues

**Problem**: Cannot connect to database
**Solution**: Check SSL requirement, verify connection string format

**Problem**: Connection pool exhausted
**Solution**: Increase `max_connections` (within free tier limit)

### Redis Issues

**Problem**: Redis connection fails
**Solution**: Verify URL format (`redis://` vs `rediss://` for TLS)

**Problem**: Commands rate limit exceeded
**Solution**: Optimize cache strategy, increase TTLs, reduce cache writes

### Deployment Issues

**Problem**: Health checks failing
**Solution**: Check service logs, verify environment variables

**Problem**: Database migrations fail
**Solution**: Check migration scripts, verify database permissions

## Maintenance

### Weekly Tasks

- [ ] Review Sentry errors
- [ ] Check free tier usage (database storage, Redis commands)
- [ ] Review performance metrics

### Monthly Tasks

- [ ] Rotate database passwords
- [ ] Review and clean up old Docker images
- [ ] Update dependencies
- [ ] Review GitHub Actions usage

### Quarterly Tasks

- [ ] Full security audit
- [ ] Load testing
- [ ] Disaster recovery drill
- [ ] Documentation review

## Support and Resources

### Documentation

- [Terraform Documentation](https://www.terraform.io/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Upstash Documentation](https://docs.upstash.com)
- [Railway Documentation](https://docs.railway.app)
- [Vercel Documentation](https://vercel.com/docs)

### Internal Resources

- `docs/deployment/` - Deployment guides
- `docs/architecture/` - Architecture diagrams
- `docs/troubleshooting/` - Common issues and solutions

### Getting Help

- Open an issue on GitHub
- Contact DevOps team
- Check internal wiki

## Contributing

When making infrastructure changes:

1. **Test Locally**: Validate with `terraform plan`
2. **Test in Staging**: Apply changes to staging first
3. **Verify**: Run environment validation tests
4. **Document**: Update this README and relevant docs
5. **Review**: Get infrastructure review
6. **Deploy**: Promote to production via workflow

## License

This infrastructure code is proprietary to Sovren. Unauthorized copying or distribution is prohibited.

---

**Last Updated**: 2025-10-27
**Maintained By**: DevOps Team
**Version**: 1.0.0
