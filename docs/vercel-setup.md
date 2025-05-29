# Vercel Setup & Integration Guide

## Overview

This guide walks you through connecting Sovren to Vercel for automated deployments, configuring environment variables, and setting up the CI/CD pipeline integration.

## 🚀 Initial Vercel Setup

### Step 1: Connect to Vercel

```bash
# Navigate to frontend package
cd packages/frontend

# Login to Vercel (opens browser)
vercel login

# Initialize Vercel project
vercel
```

**During `vercel` initialization:**
1. **Set up and deploy**: `Y`
2. **Which scope**: Choose your personal account or team
3. **Link to existing project**: `N` (we're creating new)
4. **Project name**: `sovren` (or your preferred name)
5. **Directory**: `./` (current directory - packages/frontend)
6. **Override settings**: `Y`

### Step 2: Configure Project Settings

The CLI will ask for overrides:
```bash
? Override the settings? [y/N] y
? Which framework preset? Other
? Build Command: npm run build
? Output Directory: dist
? Development Command: npm run dev
```

### Step 3: Get Project Information

After successful setup, get your project details:
```bash
# Get project info
vercel project ls

# Note down:
# - Project ID (starts with prj_)
# - Team/Organization ID (starts with team_)
```

## 🔐 GitHub Secrets Configuration

Add these secrets to your GitHub repository (`Settings > Secrets and Variables > Actions`):

### Required Secrets

```bash
# Vercel Token (get from https://vercel.com/account/tokens)
VERCEL_TOKEN=<your-vercel-token>

# Vercel Organization ID 
VERCEL_ORG_ID=<your-org-id>

# Vercel Project ID
VERCEL_PROJECT_ID=<your-project-id>

# Optional: Slack webhook for notifications
SLACK_WEBHOOK=<your-slack-webhook-url>

# Optional: Codecov token for coverage
CODECOV_TOKEN=<your-codecov-token>
```

### How to Get Each Secret

#### 1. **VERCEL_TOKEN**
1. Go to [Vercel Account Tokens](https://vercel.com/account/tokens)
2. Click "Create Token"
3. Name: `GitHub Actions - Sovren`
4. Scope: Select your account/team
5. Expiration: No expiration (or set as preferred)
6. Copy the generated token

#### 2. **VERCEL_ORG_ID**
```bash
# Method 1: From CLI
vercel project ls
# Look for "orgId" in the output

# Method 2: From project settings
# Go to Project Settings > General > Project ID section
```

#### 3. **VERCEL_PROJECT_ID**
```bash
# Method 1: From CLI  
vercel project ls
# Look for "id" in the output

# Method 2: From Vercel dashboard
# Go to your project > Settings > General
# Find "Project ID" section
```

## 🌐 Domain Configuration

### Custom Domains Setup

1. **Go to Vercel Dashboard** → Your Project → Domains
2. **Add domains:**
   - Production: `sovren.dev`
   - Staging: `staging.sovren.dev`

3. **Configure DNS:**
   ```
   # Add these records to your DNS provider:
   
   # For sovren.dev (production)
   Type: CNAME
   Name: @
   Value: cname.vercel-dns.com
   
   # For staging.sovren.dev  
   Type: CNAME
   Name: staging
   Value: cname.vercel-dns.com
   ```

### Environment-Specific Deployments

Create deployment aliases in `vercel.json`:
```json
{
  "alias": [
    "sovren.dev",
    "staging.sovren.dev"
  ]
}
```

## 🔧 Environment Variables

### In Vercel Dashboard

Go to **Project Settings > Environment Variables** and add:

#### Production Environment
```bash
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.sovren.dev
NEXT_PUBLIC_FEATURE_FLAGS_URL=https://api.sovren.dev/feature-flags
NEXT_PUBLIC_ENVIRONMENT=production
```

#### Preview Environment  
```bash
NODE_ENV=development
NEXT_PUBLIC_API_URL=https://staging-api.sovren.dev
NEXT_PUBLIC_FEATURE_FLAGS_URL=https://staging-api.sovren.dev/feature-flags
NEXT_PUBLIC_ENVIRONMENT=preview
```

#### Development Environment
```bash
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_FEATURE_FLAGS_URL=http://localhost:3001/feature-flags
NEXT_PUBLIC_ENVIRONMENT=development
```

## 🧪 Testing the Integration

### Manual Deployment Test

```bash
# Test from local environment
cd packages/frontend
vercel --prod

# Check deployment
vercel ls
```

### GitHub Actions Test

1. **Push to feature branch** → Should create preview deployment
2. **Push to develop branch** → Should deploy to staging
3. **Push to main branch** → Should deploy to production

### Verify Deployments

```bash
# Check deployment status
curl -I https://sovren.dev
curl -I https://staging.sovren.dev

# Test health endpoints (once backend is deployed)
curl https://sovren.dev/api/v1/health
curl https://staging.sovren.dev/api/v1/health
```

## 🔄 CI/CD Pipeline Integration

### Workflow Files Updated

The following workflows are configured for Vercel:

#### 1. **Main CI/CD** (`.github/workflows/ci.yml`)
- **Preview deployments** for pull requests
- **Staging deployments** for develop branch
- **Production deployments** for main branch

#### 2. **Release Management** (`.github/workflows/release.yml`)
- **Versioned deployments** with proper tagging
- **Environment-specific** release deployments

#### 3. **Performance Monitoring** (`.github/workflows/performance.yml`)
- **Lighthouse audits** on deployed URLs
- **Load testing** against live environments

### GitHub Actions Integration

The workflows use these Vercel actions:
```yaml
- name: Deploy to Vercel
  uses: amondnet/vercel-action@v25
  with:
    vercel-token: ${{ secrets.VERCEL_TOKEN }}
    vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
    vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
    working-directory: ./packages/frontend
    vercel-args: '--prod'  # for production deployments
```

## 🔍 Monitoring & Debugging

### Vercel Analytics

Enable analytics in your Vercel dashboard:
1. Go to **Project Settings > Analytics**
2. Enable **Vercel Analytics**
3. Configure **Core Web Vitals** tracking

### Deployment Logs

```bash
# View deployment logs
vercel logs [deployment-url]

# View function logs
vercel logs --follow

# Check build logs in GitHub Actions
# Go to Actions tab > Select workflow run > View logs
```

### Common Issues & Solutions

#### **Build Failures**
```bash
# Check build locally first
npm run build

# Verify Vercel configuration
vercel dev

# Check environment variables
vercel env ls
```

#### **Deployment Timeouts**
- Increase function timeout in `vercel.json`
- Optimize build process
- Check for large dependencies

#### **Environment Variable Issues**
```bash
# List all environment variables
vercel env ls

# Add missing variables
vercel env add [NAME] [VALUE] [ENVIRONMENT]

# Remove old variables  
vercel env rm [NAME] [ENVIRONMENT]
```

## 🛡️ Security Best Practices

### 1. **Secure Headers** (Already configured in `vercel.json`)
- Content Security Policy
- HTTPS enforcement
- XSS protection
- Frame protection

### 2. **Environment Separation**
- Different API endpoints per environment
- Separate feature flag configurations
- Isolated databases and services

### 3. **Access Control**
- Limit Vercel team access
- Rotate API tokens regularly
- Use preview deployments for testing

## 📊 Performance Optimization

### Build Optimization

```json
// In vercel.json
{
  "functions": {
    "packages/frontend/src/functions/*.ts": {
      "maxDuration": 10
    }
  },
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ]
}
```

### Caching Strategy

```json
// Add to vercel.json
{
  "headers": [
    {
      "source": "/static/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

## 🚀 Deployment Commands

### Production Deployment
```bash
# Automatic via GitHub Actions
git push origin main

# Manual deployment
cd packages/frontend
vercel --prod
```

### Staging Deployment  
```bash
# Automatic via GitHub Actions
git push origin develop

# Manual deployment
vercel --target staging
```

### Preview Deployment
```bash
# Automatic via GitHub Actions (PR)
# Manual deployment
vercel
```

## 📝 Troubleshooting Checklist

Before reaching out for help, verify:

- [ ] **Vercel CLI installed and authenticated**
- [ ] **Project connected to correct Vercel account**
- [ ] **All GitHub secrets configured correctly**
- [ ] **Domain configuration complete**
- [ ] **Environment variables set in Vercel**
- [ ] **Build process works locally**
- [ ] **Latest code pushed to correct branch**

## 📞 Support Resources

- **Vercel Documentation**: [https://vercel.com/docs](https://vercel.com/docs)
- **GitHub Actions**: [https://docs.github.com/en/actions](https://docs.github.com/en/actions)
- **Team Support**: #deployment Slack channel
- **Emergency**: Create GitHub issue with `deployment` label

---

*Last Updated: $(date)*  
*Next Review: When deployment issues occur or quarterly* 