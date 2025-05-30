# Vercel Full-Stack Setup Guide

## Overview

Deploy the complete Sovren application on Vercel using:

- **Frontend**: React/Vite static site
- **Backend**: Serverless API functions
- **Database**: External PostgreSQL (Neon/PlanetScale)

## 🎯 Why Vercel Full-Stack?

### ✅ **Advantages**

- **Single platform** - easier management
- **Cost-effective** - free tier available
- **Automatic scaling** - serverless functions
- **Zero server maintenance**
- **Unified CI/CD** pipeline
- **Global CDN** for frontend
- **Built-in analytics** and monitoring

### 💰 **Cost Comparison**

```
Vercel Full-Stack:
├── Hobby Plan: FREE (perfect for MVP)
├── Pro Plan: $20/month (scaling phase)
├── Database: FREE (Neon/PlanetScale free tier)
└── Total: $0-20/month

vs Railway + Vercel:
├── Railway: $20/month
├── Vercel: $20/month
└── Total: $40/month
```

## 🏗️ Project Structure

### Backend Conversion Strategy

Convert Express.js routes to Vercel API functions:

```
packages/backend/src/
├── routes/
│   ├── auth.ts        → api/auth/[...auth].ts
│   ├── users.ts       → api/users/[...users].ts
│   ├── payments.ts    → api/payments/[...payments].ts
│   └── health.ts      → api/health.ts
├── middleware/        → shared utilities
├── models/           → shared with frontend
└── utils/            → shared utilities
```

## 🔧 Implementation Steps

### Step 1: Database Setup (Neon PostgreSQL)

1. **Create Neon Account** (free tier)

   ```bash
   # Go to https://neon.tech
   # Create account and new project
   # Note the connection string
   ```

2. **Update Prisma Configuration**

   ```bash
   cd packages/backend

   # Update DATABASE_URL in .env
   DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/sovren?sslmode=require"

   # Run migrations
   npx prisma migrate deploy
   npx prisma generate
   ```

### Step 2: Convert Backend to API Routes

Create API functions in the frontend package:

```bash
cd packages/frontend
mkdir -p api/{auth,users,payments}
```

**Example API Function** (`api/health.ts`):

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
}
```

**Dynamic API Routes** (`api/users/[...users].ts`):

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { users } = req.query;
  const path = Array.isArray(users) ? users : [];

  try {
    switch (req.method) {
      case 'GET':
        if (path.length === 0) {
          // GET /api/users - list users
          const allUsers = await prisma.user.findMany();
          return res.status(200).json({ data: allUsers });
        } else {
          // GET /api/users/[id] - get specific user
          const user = await prisma.user.findUnique({
            where: { id: path[0] },
          });
          return res.status(200).json({ data: user });
        }

      case 'POST':
        // POST /api/users - create user
        const newUser = await prisma.user.create({
          data: req.body,
        });
        return res.status(201).json({ data: newUser });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

### Step 3: Update Package Configuration

**Update `packages/frontend/package.json`**:

```json
{
  "dependencies": {
    "@prisma/client": "^5.10.0",
    "@sovren/shared": "*",
    "@vercel/node": "^3.0.0"
  },
  "scripts": {
    "vercel-build": "prisma generate && npm run build"
  }
}
```

**Update `packages/frontend/vercel.json`**:

```json
{
  "version": 2,
  "name": "sovren",
  "framework": "vite",
  "buildCommand": "npm run vercel-build",
  "outputDirectory": "dist",
  "functions": {
    "api/**/*.ts": {
      "runtime": "nodejs18.x"
    }
  },
  "env": {
    "DATABASE_URL": "@database_url",
    "JWT_SECRET": "@jwt_secret",
    "NODE_ENV": "production"
  }
}
```

### Step 4: Environment Variables Setup

In **Vercel Dashboard** → Project → Settings → Environment Variables:

```bash
# Database
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/sovren?sslmode=require

# Authentication
JWT_SECRET=your-super-secure-jwt-secret-here

# Application
NODE_ENV=production
VITE_API_URL=/api
VITE_ENVIRONMENT=production

# Feature Flags (if using external service)
LAUNCHDARKLY_SDK_KEY=your-key-here
```

### Step 5: Shared Code Organization

Move shared backend utilities to be accessible by API functions:

```bash
# Create shared utilities in frontend
mkdir -p packages/frontend/lib/{auth,database,utils}

# Copy essential backend code
cp packages/backend/src/middleware/* packages/frontend/lib/utils/
cp packages/backend/src/utils/* packages/frontend/lib/utils/
```

**Database utility** (`lib/database.ts`):

```typescript
import { PrismaClient } from '@prisma/client';

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma = global.__prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}
```

### Step 6: Update CI/CD Pipeline

**Simplified `.github/workflows/ci.yml`**:

```yaml
name: 🚀 Vercel Full-Stack CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  build-and-test:
    name: 🧪 Build & Test
    runs-on: ubuntu-latest

    steps:
      - name: 📥 Checkout
        uses: actions/checkout@v4

      - name: 🔧 Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18.x'
          cache: 'npm'

      - name: 📦 Install dependencies
        run: npm ci

      - name: 🔍 Lint and type check
        run: |
          npm run lint
          npm run type-check

      - name: 🧪 Run tests
        run: npm run test:ci

      - name: 🏗️ Build application
        run: npm run build

  deploy:
    name: 🚀 Deploy to Vercel
    runs-on: ubuntu-latest
    needs: build-and-test
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop'

    steps:
      - name: 📥 Checkout
        uses: actions/checkout@v4

      - name: 🚀 Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./packages/frontend
          vercel-args: ${{ github.ref == 'refs/heads/main' && '--prod' || '' }}
```

## 🔗 Frontend API Integration

**Update API calls in React components**:

```typescript
// Before (separate backend)
const API_BASE = process.env.VITE_API_URL || 'http://localhost:3001';

// After (Vercel full-stack)
const API_BASE = '/api';

// Usage remains the same
const response = await fetch(`${API_BASE}/users`);
```

## 🚀 Deployment Process

### Initial Setup

```bash
# 1. Setup Neon database
# 2. Configure environment variables in Vercel
# 3. Deploy

cd packages/frontend
vercel --prod
```

### Automatic Deployments

- **Push to `main`** → Production deployment
- **Push to `develop`** → Preview deployment
- **Pull requests** → Preview deployment with unique URL

## 📊 Monitoring & Debugging

### Vercel Function Logs

```bash
# View function logs
vercel logs --follow

# View specific function
vercel logs api/users
```

### Database Monitoring

- **Neon Dashboard** for database metrics
- **Vercel Analytics** for function performance
- **Vercel Functions** tab for execution logs

## 🛡️ Security Best Practices

### API Security

```typescript
// Rate limiting middleware
import rateLimit from './lib/utils/rateLimit';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Apply rate limiting
  await rateLimit(req, res);

  // Authentication check
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Your API logic here
}
```

### Environment Security

- Use Vercel's encrypted environment variables
- Rotate secrets regularly
- Separate staging/production environments

## 🎯 Migration Checklist

- [ ] **Database**: Set up Neon PostgreSQL
- [ ] **API Routes**: Convert Express routes to Vercel functions
- [ ] **Environment Variables**: Configure in Vercel dashboard
- [ ] **Dependencies**: Update package.json
- [ ] **CI/CD**: Simplify workflow to single platform
- [ ] **Testing**: Update API endpoints in tests
- [ ] **Documentation**: Update API documentation

## 💡 Pro Tips

1. **Cold Starts**: Use connection pooling for database
2. **Bundle Size**: Keep API functions lightweight
3. **Caching**: Use Vercel's edge caching for static data
4. **Monitoring**: Enable Vercel Analytics and error tracking

---

**Result**: Single-platform, cost-effective full-stack deployment on Vercel! 🎉
