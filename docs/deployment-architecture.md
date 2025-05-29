# Full-Stack Deployment Architecture

## Overview

Sovren requires deployment of **multiple components**:
- **Frontend**: React/Vite SPA
- **Backend**: Express.js API server  
- **Database**: PostgreSQL with Prisma ORM
- **Shared**: Common utilities and types

## 🏗️ Recommended Architecture

### **Frontend Deployment: Vercel**
- **Platform**: Vercel (optimized for React/Vite)
- **Type**: Static site with CDN
- **URL**: `https://sovren.dev`
- **Staging**: `https://staging.sovren.dev`

### **Backend Deployment: Railway**
- **Platform**: Railway (Node.js + PostgreSQL)
- **Type**: Containerized Express.js app
- **URL**: `https://api.sovren.dev`
- **Staging**: `https://staging-api.sovren.dev`

### **Database: PostgreSQL on Railway**
- **Platform**: Railway PostgreSQL
- **Type**: Managed PostgreSQL instance
- **Features**: Automatic backups, scaling, monitoring

## 🚀 Deployment Options Comparison

### Option 1: Vercel + Railway (Recommended)

#### ✅ **Pros**
- **Best performance** for frontend (Vercel CDN)
- **Easy backend deployment** (Railway handles containers)
- **Integrated database** (PostgreSQL on Railway)
- **Simple CI/CD** integration
- **Cost-effective** for startups

#### ❌ **Cons**
- **Two platforms** to manage
- **Cross-platform** environment variables

#### **Cost**: ~$10-25/month

---

### Option 2: Vercel Serverless Full-Stack

#### ✅ **Pros**
- **Single platform** (Vercel only)
- **Serverless scaling**
- **Integrated deployment**

#### ❌ **Cons**
- **Serverless limitations** (cold starts, timeouts)
- **Database** requires external service
- **More complex** Express.js adaptation

#### **Cost**: ~$20-40/month

---

### Option 3: Railway Full-Stack

#### ✅ **Pros**
- **Single platform**
- **Traditional deployment** model
- **Full control** over backend
- **Integrated database**

#### ❌ **Cons**
- **Less optimized** frontend delivery
- **No global CDN** for frontend

#### **Cost**: ~$15-30/month

## 🎯 Recommended Setup: Vercel + Railway

### Frontend (Vercel)
```yaml
Platform: Vercel
Framework: Vite
Build Command: npm run build
Output Directory: dist
Environment Variables:
  - VITE_API_URL=https://api.sovren.dev
  - VITE_ENVIRONMENT=production
```

### Backend (Railway)
```yaml
Platform: Railway
Runtime: Node.js 18
Build Command: npm run build
Start Command: npm start
Environment Variables:
  - DATABASE_URL=[Railway PostgreSQL URL]
  - NODE_ENV=production
  - JWT_SECRET=[Generated Secret]
```

### Database (Railway PostgreSQL)
```yaml
Platform: Railway PostgreSQL 14
Features:
  - Automatic backups
  - Connection pooling
  - Monitoring dashboard
  - Vertical scaling
```

## 🔧 Implementation Steps

### Step 1: Backend Deployment (Railway)

1. **Create Railway Account**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login to Railway
   railway login
   ```

2. **Deploy Backend**
   ```bash
   cd packages/backend
   
   # Initialize Railway project
   railway init
   
   # Add PostgreSQL database
   railway add postgresql
   
   # Deploy backend
   railway up
   ```

3. **Configure Environment Variables**
   ```bash
   # Set environment variables in Railway dashboard
   NODE_ENV=production
   JWT_SECRET=[generate-secure-secret]
   DATABASE_URL=[auto-generated-by-railway]
   ```

### Step 2: Frontend Deployment (Vercel)

1. **Configure Frontend**
   ```bash
   cd packages/frontend
   
   # Connect to Vercel
   vercel --prod
   ```

2. **Set Environment Variables**
   ```bash
   # In Vercel dashboard
   VITE_API_URL=https://your-backend.railway.app
   VITE_ENVIRONMENT=production
   ```

### Step 3: Update CI/CD Pipeline

Update deployment workflows to handle both services:

```yaml
# .github/workflows/ci.yml
jobs:
  deploy-backend:
    name: 🚀 Deploy Backend (Railway)
    runs-on: ubuntu-latest
    # Railway deployment steps
    
  deploy-frontend:
    name: 🚀 Deploy Frontend (Vercel)  
    runs-on: ubuntu-latest
    needs: deploy-backend
    # Vercel deployment steps
```

## 🔗 Service Communication

### API Routes Configuration

**Frontend (Vercel)**
```javascript
// vite.config.ts
export default defineConfig({
  define: {
    'process.env.VITE_API_URL': JSON.stringify(
      process.env.VITE_API_URL || 'http://localhost:3001'
    )
  }
});
```

**Backend (Railway)**
```javascript
// CORS configuration
app.use(cors({
  origin: [
    'https://sovren.dev',
    'https://staging.sovren.dev',
    'http://localhost:5173' // dev
  ]
}));
```

### Environment Variables

#### **Frontend (.env)**
```bash
VITE_API_URL=https://api.sovren.dev
VITE_FEATURE_FLAGS_URL=https://api.sovren.dev/feature-flags
VITE_ENVIRONMENT=production
```

#### **Backend (.env)**
```bash
DATABASE_URL=postgresql://user:pass@host:port/db
NODE_ENV=production
PORT=3001
JWT_SECRET=your-super-secure-secret
CORS_ORIGIN=https://sovren.dev,https://staging.sovren.dev
```

## 🔄 Updated CI/CD Pipeline

### Complete Deployment Flow

```mermaid
graph TD
    A[Code Push] --> B{Branch?}
    B -->|Feature| C[Backend Tests]
    B -->|Develop| D[Backend Tests + Deploy Staging]
    B -->|Main| E[Backend Tests + Deploy Production]
    
    C --> F[Frontend Tests]
    D --> G[Frontend Tests + Deploy Staging]
    E --> H[Frontend Tests + Deploy Production]
    
    F --> I[Preview Deployment]
    G --> J[Staging Environment]
    H --> K[Production Environment]
    
    J --> L[Integration Tests]
    K --> M[Health Checks]
    L --> N[Notifications]
    M --> N
```

### Environment URLs

```yaml
Development:
  Frontend: http://localhost:5173
  Backend: http://localhost:3001
  Database: Local PostgreSQL

Staging:
  Frontend: https://staging.sovren.dev
  Backend: https://staging-api.sovren.dev  
  Database: Railway PostgreSQL (staging)

Production:
  Frontend: https://sovren.dev
  Backend: https://api.sovren.dev
  Database: Railway PostgreSQL (production)
```

## 🛡️ Security Considerations

### Frontend Security
- **HTTPS enforcement** (automatic with Vercel)
- **Content Security Policy** headers
- **Environment variable** protection (VITE_ prefix)

### Backend Security  
- **Environment variables** in Railway
- **Database connection** encryption
- **API rate limiting** and authentication
- **CORS policy** properly configured

### Database Security
- **Connection pooling** via Railway
- **Automated backups** 
- **Access control** via environment variables
- **SSL connections** enforced

## 📊 Monitoring & Health Checks

### Health Check Endpoints

**Backend Health Check**
```javascript
// GET /api/v1/health
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00Z",
  "database": "connected",
  "version": "1.0.0"
}
```

**Frontend Health Check**
```javascript
// Service Worker or monitoring script
fetch('/api/v1/health')
  .then(response => response.json())
  .then(data => console.log('Backend health:', data.status));
```

### Monitoring Setup

```yaml
Frontend Monitoring:
  - Vercel Analytics (Core Web Vitals)
  - Lighthouse CI (Performance)
  - Error tracking (Sentry integration)

Backend Monitoring:
  - Railway metrics (CPU, Memory, Response time)
  - Database monitoring (Connection pool, Query performance)  
  - API monitoring (Uptime, Error rates)
```

## 💰 Cost Breakdown

### Monthly Costs (Estimated)

```yaml
Railway (Backend + Database):
  Developer Plan: $5/month
  Pro Plan: $20/month (production recommended)

Vercel (Frontend):
  Pro Plan: $20/month (team features)
  Hobby: Free (limited)

Total Monthly Cost: $25-40/month
```

### Cost Optimization

- **Start with hobby/developer plans**
- **Monitor usage** and scale as needed
- **Use staging environments** efficiently
- **Optimize bundle sizes** to reduce bandwidth

## 🚀 Getting Started

### Quick Start Commands

```bash
# 1. Backend setup (Railway)
cd packages/backend
npm install -g @railway/cli
railway login
railway init
railway add postgresql
railway up

# 2. Frontend setup (Vercel)  
cd packages/frontend
npm install -g vercel
vercel login
vercel --prod

# 3. Update environment variables in both platforms
# 4. Test deployments
# 5. Configure custom domains
```

### Next Steps

1. **Follow the Railway setup guide** (to be created)
2. **Configure Vercel** (existing guide)
3. **Update CI/CD workflows** for both platforms
4. **Set up monitoring** and alerting
5. **Configure domains** and SSL certificates

---

*This architecture provides scalable, cost-effective deployment for the full Sovren stack.* 