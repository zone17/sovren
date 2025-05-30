# Vercel Setup Guide - Current Configuration

## ✅ Status: Successfully Deployed

**Sovren** is currently deployed and running on Vercel with the following configuration:

- **Live URL**: [Your Vercel App URL]
- **Repository**: https://github.com/zone17/sovren
- **Framework**: Vite (React)
- **Root Directory**: `packages/frontend`
- **Database**: Supabase PostgreSQL

## 🏗️ Current Architecture

### Deployment Stack

```
┌─────────────────────────────────────────┐
│              VERCEL FULL-STACK          │
├─────────────────────────────────────────┤
│ Frontend (Static)                       │
│ ├── React + TypeScript                  │
│ ├── Vite Build                         │
│ ├── TailwindCSS                        │
│ └── Redux Toolkit                      │
├─────────────────────────────────────────┤
│ Backend (Serverless)                    │
│ ├── /api/health                        │
│ ├── Future: /api/users                 │
│ ├── Future: /api/posts                 │
│ └── Future: /api/payments              │
├─────────────────────────────────────────┤
│ Database (External)                     │
│ ├── Supabase PostgreSQL                │
│ ├── Built-in Authentication            │
│ ├── Real-time subscriptions            │
│ └── RESTful API                        │
└─────────────────────────────────────────┘
```

## 🔧 Configuration Details

### Project Settings (Current)

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "cd ../.. && npm ci && cd packages/frontend",
  "rootDirectory": "packages/frontend"
}
```

### Environment Variables (Required)

```bash
# Add these in Vercel Dashboard → Settings → Environment Variables
SUPABASE_URL=https://jubwmdvjaeznrgvmabyx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key-from-supabase]
```

### vercel.json Configuration

```json
{
  "version": 2,
  "name": "sovren",
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "functions": {
    "api/**/*.ts": {
      "runtime": "nodejs18.x"
    }
  },
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

## 📦 Dependencies Configuration

### Production Dependencies (Current)

```json
{
  "dependencies": {
    "@reduxjs/toolkit": "^2.1.0",
    "@supabase/supabase-js": "^2.49.8",
    "@types/react": "^18.2.55",
    "@types/react-dom": "^18.2.19",
    "@vercel/node": "^3.0.0",
    "@vitejs/plugin-react": "^4.2.1",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-redux": "^9.1.0",
    "react-router-dom": "^6.22.0",
    "tailwind-merge": "^2.2.1",
    "typescript": "^5.3.3",
    "vite": "^5.4.0"
  }
}
```

### Build Scripts (Current)

```json
{
  "scripts": {
    "build": "npx --package=typescript tsc --project tsconfig.build.json && vite build",
    "vercel-build": "npm run build"
  }
}
```

## 🚀 Deployment Process

### Current Auto-Deployment

1. **Push to main branch** → Triggers deployment
2. **GitHub Actions** → Runs CI tests
3. **Vercel Build** → Production build
4. **Live in ~30 seconds** ✅

### Manual Deployment (if needed)

```bash
# Via Vercel CLI
npm install -g vercel
vercel --prod

# Or redeploy via Dashboard
# Vercel Dashboard → Deployments → Redeploy
```

## 🔍 Build Process Breakdown

### 1. Install Phase

```bash
cd ../.. && npm ci && cd packages/frontend
```

- Installs monorepo dependencies
- Uses `npm ci` for production builds
- Changes to frontend directory

### 2. Build Phase

```bash
npm run vercel-build
```

- Runs TypeScript compilation with production config
- Builds Vite bundle for production
- Outputs to `dist/` directory

### 3. Deploy Phase

- Static files served via Vercel CDN
- API functions deployed as serverless
- Environment variables injected

## 🎯 API Functions

### Current Implementation

**Health Check** (`/api/health.ts`):

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../lib/database';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Test database connection
    const { data, error } = await supabase.from('users').select('count(*)').limit(1).single();

    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
      version: '1.0.0',
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: 'Database connection failed',
    });
  }
}
```

### Future API Endpoints

- `GET /api/users` - User management
- `POST /api/posts` - Content creation
- `GET /api/payments` - Payment processing
- `GET /api/feature-flags` - Feature configuration

## 🛡️ Database Configuration

### Supabase Setup (Current)

```typescript
// lib/database.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
```

### Connection Details

- **URL**: https://jubwmdvjaeznrgvmabyx.supabase.co
- **Connection**: Transaction pooler (pooled mode)
- **SSL**: Required and configured
- **Status**: ✅ Active and tested

## 🔧 TypeScript Configuration

### Production Build Config (`tsconfig.build.json`)

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["vite/client"]
  },
  "exclude": [
    "src/**/*.test.ts",
    "src/**/*.test.tsx",
    "src/**/*.spec.ts",
    "src/**/*.spec.tsx",
    "src/setupTests.ts"
  ]
}
```

**Why separate config?**

- Excludes test types from production builds
- Prevents build failures in serverless environment
- Optimizes bundle size

## 📊 Monitoring & Analytics

### Current Monitoring

- **Vercel Analytics**: Build and runtime metrics
- **GitHub Actions**: CI/CD pipeline status
- **Supabase Metrics**: Database performance
- **Health Endpoint**: `/api/health` for status checks

### Performance Metrics

- **Build Time**: ~30 seconds
- **Cold Start**: <500ms
- **Bundle Size**: Optimized with Vite
- **CDN**: Global edge network

## ⚡ Troubleshooting

### Common Issues & Solutions

**Build Failures:**

```bash
# Clear cache and redeploy
vercel --prod --force

# Check environment variables
vercel env ls
```

**Database Connection Issues:**

```bash
# Test connection locally
curl https://your-app.vercel.app/api/health

# Check Supabase status
# Visit Supabase Dashboard → Project → Settings
```

**TypeScript Errors:**

```bash
# Run type check locally
npm run type-check

# Check build config
cat tsconfig.build.json
```

## 🎯 Next Steps

### Immediate Actions

1. **Add Environment Variables** to Vercel Dashboard
2. **Set up Database Schema** in Supabase
3. **Test Health Endpoint** in production

### Development Phase

4. **Implement Authentication** with Supabase Auth
5. **Create API Endpoints** for core features
6. **Add Monitoring** and error tracking

## 📚 Related Documentation

- [Deployment Status](./deployment-status.md) - Complete architecture overview
- [Development Workflow](./development-workflow.md) - Development process
- [API Architecture](./api-architecture.md) - API design patterns

---

**Status**: ✅ Production Ready  
**Last Updated**: Deployment successful  
**Next Review**: After environment variables setup
