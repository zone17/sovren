# Deployment Troubleshooting Guide

*Elite Engineering Documentation - Sovren Platform*

## Table of Contents

1. [Overview](#overview)
2. [Common Issues & Solutions](#common-issues--solutions)
3. [Root Cause Analysis](#root-cause-analysis)
4. [Prevention Strategies](#prevention-strategies)
5. [Emergency Procedures](#emergency-procedures)
6. [Forensic Investigation](#forensic-investigation)

## Overview

This guide documents the comprehensive solution to deployment failures that occurred during the Sovren platform development. It serves as both a troubleshooting reference and a learning resource for future engineers.

### Timeline of Issues Resolved

1. **Competing Vercel Configurations** - Multiple `vercel.json` files
2. **Babel Plugin Dependencies** - External dependencies causing build failures
3. **Performance Monitoring Crashes** - Runtime JavaScript errors
4. **React Router Conflicts** - Nested router configurations

---

## Common Issues & Solutions

### 🚨 Issue #1: Function Runtimes Error

**Error Message:**
```
Function Runtimes must have a valid version
```

**Root Cause:**
- Multiple `vercel.json` configuration files
- Frontend config attempted to use invalid runtime `"nodejs18.x"`
- Vercel couldn't determine configuration precedence

**Solution:**
```bash
# Remove competing configuration
rm packages/frontend/vercel.json

# Use single root configuration with proper precedence
# Root vercel.json handles all deployment settings
```

**Why This Works:**
- Eliminates configuration conflicts
- Establishes Single Source of Truth pattern
- Vercel reads root config with clear precedence rules

### 🚨 Issue #2: Babel Plugin Build Failure

**Error Message:**
```
Cannot find package 'babel-plugin-transform-react-remove-prop-types'
```

**Root Cause:**
- External babel plugin in devDependencies
- Vercel production builds don't install devDependencies
- Plugin tried to access during production optimization

**Solution:**
```typescript
// Remove external babel dependencies
// Use native Vite optimizations instead

// Before (problematic)
babel: {
  plugins: [
    'babel-plugin-transform-react-remove-prop-types'
  ]
}

// After (modern approach)
react({
  babel: {
    plugins: [
      // No external babel plugins needed
      // Vite handles optimizations natively
    ]
  }
})
```

**Why This Works:**
- Modern Vite handles prop-types removal natively
- Eliminates external dependencies
- esbuild optimizations are faster and more reliable

### 🚨 Issue #3: Performance Monitoring Runtime Error

**Error Message:**
```
TypeError: Cannot read properties of undefined (reading 'good')
```

**Root Cause:**
- Performance monitoring tried to access thresholds for unknown metrics
- `PERFORMANCE_THRESHOLDS[unknownMetric]` returned `undefined`
- Accessing `undefined.good` threw runtime error

**Solution:**
```typescript
// Add intelligent fallback system
private getSafeRating(metricName: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  // Check if metric exists in thresholds
  if (metricName in PERFORMANCE_THRESHOLDS) {
    return this.getRating(metricName as keyof typeof PERFORMANCE_THRESHOLDS, value);
  }

  // Intelligent fallbacks based on metric type
  if (metricName.includes('API')) {
    return value <= 1000 ? 'good' : value <= 3000 ? 'needs-improvement' : 'poor';
  }
  // ... other intelligent fallbacks
}
```

**Why This Works:**
- Prevents undefined property access
- Maintains monitoring functionality
- Provides intelligent defaults for unknown metrics

### 🚨 Issue #4: React Router Nested Conflicts

**Error Message:**
```
Router error in router-Doq8aAwY.js
```

**Root Cause:**
- `BrowserRouter` components in both `main.tsx` and `App.tsx`
- Nested routers cause context conflicts
- React Router v6 strict mode enforcement

**Solution:**
```typescript
// Remove nested router from App.tsx
// Keep single BrowserRouter in main.tsx with future flags

// main.tsx
<BrowserRouter
  future={{
    v7_startTransition: true,
    v7_relativeSplatPath: true,
  }}
>
  <App />
</BrowserRouter>

// App.tsx (no BrowserRouter wrapper)
<Routes>
  <Route path="/" element={<Home />} />
  {/* ... other routes */}
</Routes>
```

**Why This Works:**
- Single router architecture prevents conflicts
- Future flags ensure React Router v7 compatibility
- Cleaner component hierarchy

---

## Root Cause Analysis

### Configuration Management

**Problem:** Lack of configuration governance led to competing settings.

**Analysis:**
1. **Multiple Sources of Truth**: Root and frontend `vercel.json` files
2. **No Validation**: No pre-commit checks for configuration conflicts
3. **Poor Documentation**: Configuration precedence unclear

**Solution Implemented:**
- Single Source of Truth pattern
- Configuration governance with `.vercelrc.json`
- Pre-commit hooks with validation
- Comprehensive documentation

### Dependency Management

**Problem:** External dependencies not properly categorized for production builds.

**Analysis:**
1. **Build vs Runtime**: Babel plugins needed at build time but in devDependencies
2. **Modern Alternatives**: Native tools (Vite/esbuild) available
3. **Bundle Optimization**: External dependencies increased bundle size

**Solution Implemented:**
- Eliminate external babel dependencies
- Use native Vite optimizations
- Modern esbuild for faster builds

### Error Handling

**Problem:** Insufficient error boundaries and null checking.

**Analysis:**
1. **Runtime Crashes**: Single undefined access crashed entire app
2. **Poor Fallbacks**: No graceful degradation for unknown metrics
3. **No Recovery**: Errors propagated to crash user experience

**Solution Implemented:**
- Comprehensive null checking
- Intelligent fallback systems
- Error boundaries with recovery mechanisms

---

## Prevention Strategies

### 1. Configuration Governance

```typescript
// .vercelrc.json - Configuration governance
{
  "monorepo": {
    "type": "yarn-workspaces",
    "deploymentStrategy": "single-source-of-truth"
  }
}
```

### 2. Pre-commit Validation

```bash
# .husky/pre-commit
#!/usr/bin/env sh
echo "🔍 Validating Vercel configuration..."

validate_vercel_config() {
  if [ -f "vercel.json" ] && [ -f "packages/frontend/vercel.json" ]; then
    echo "❌ ERROR: Multiple vercel.json files detected"
    exit 1
  fi
}

validate_vercel_config
```

### 3. Elite Deployment Verification

```javascript
// packages/frontend/scripts/verify-deployment.js
#!/usr/bin/env node

function runPreDeploymentChecks() {
  console.log('🔍 ELITE DEPLOYMENT VERIFICATION STARTING...');

  // Test production build
  execSync('npm run build', { stdio: 'inherit' });

  // Validate bundle sizes
  validateBundleSizes();

  // Check for missing dependencies
  checkDependencies();

  // Validate configuration files
  validateConfigurations();
}
```

### 4. Intelligent Error Handling

```typescript
// Safe rating with fallbacks
private getSafeRating(metricName: string, value: number) {
  try {
    if (metricName in PERFORMANCE_THRESHOLDS) {
      return this.getRating(metricName, value);
    }
    return this.getIntelligentFallback(metricName, value);
  } catch (error) {
    console.warn(`Rating error for ${metricName}:`, error);
    return 'needs-improvement'; // Safe default
  }
}
```

---

## Emergency Procedures

### Immediate Deployment Failure Response

1. **Check Build Logs**
   ```bash
   # Look for specific error patterns
   grep -E "(Cannot find|undefined|TypeError)" build.log
   ```

2. **Verify Configuration**
   ```bash
   # Check for competing configurations
   find . -name "vercel.json" -type f
   ```

3. **Test Local Build**
   ```bash
   cd packages/frontend
   npm run verify-deployment
   ```

4. **Emergency Rollback**
   ```bash
   git revert HEAD --no-edit
   git push origin main
   ```

### Runtime Error Response

1. **Check Browser Console**
   - Look for JavaScript errors
   - Identify error stack trace
   - Note affected functionality

2. **Performance Monitoring**
   ```bash
   # Check if monitoring is causing issues
   grep -r "getRating\|getMetricsSummary" src/
   ```

3. **Router Issues**
   ```bash
   # Check for nested routers
   grep -r "BrowserRouter" src/
   ```

---

## Forensic Investigation

### Git History Analysis

```bash
# Investigate when issues were introduced
git log --oneline --grep="vercel"
git log --oneline --grep="babel"
git log --oneline --grep="router"

# Find when configurations diverged
git show 7cd7e5c:packages/frontend/vercel.json
```

### Dependency Analysis

```bash
# Check dependency conflicts
npm ls babel-plugin-transform-react-remove-prop-types
npm audit
npm outdated
```

### Bundle Analysis

```bash
# Analyze bundle composition
npm run build:analyze
npx vite-bundle-analyzer dist/assets/*.js
```

### Performance Investigation

```typescript
// Debug performance monitoring
const performanceReport = getPerformanceReport();
console.log('Performance metrics:', performanceReport.summary);
console.log('Poor performance:', performanceReport.poorPerformance);
```

---

## Best Practices for Future Development

### 1. Configuration Management
- **Single Source of Truth**: Only modify root `vercel.json`
- **Validation**: Use pre-commit hooks for config validation
- **Documentation**: Update `.vercelrc.json` for governance

### 2. Dependency Management
- **Modern Tools**: Prefer native tools over external dependencies
- **Production Dependencies**: Ensure build-time dependencies are properly categorized
- **Regular Audits**: Run `npm audit` and `npm outdated` regularly

### 3. Error Handling
- **Defensive Programming**: Add null checks and fallbacks
- **Error Boundaries**: Implement comprehensive error boundaries
- **Graceful Degradation**: Ensure partial functionality during errors

### 4. Testing Strategy
- **Local Verification**: Always test builds locally first
- **Comprehensive Testing**: Test both development and production builds
- **Deployment Verification**: Use verification scripts before deployment

### 5. Monitoring & Observability
- **Real-time Monitoring**: Implement performance monitoring
- **Error Tracking**: Use Sentry for production error tracking
- **Analytics**: Track Core Web Vitals and user experience metrics

---

## Contact & Support

For questions about this troubleshooting guide or deployment issues:

1. **Check Documentation**: Review this guide and `docs/MONOREPO_ARCHITECTURE.md`
2. **Run Diagnostics**: Use `npm run verify-deployment` script
3. **Git History**: Investigate similar issues with `git log --grep="[keyword]"`
4. **Escalation**: Create detailed issue with error logs and reproduction steps

---

*This guide represents elite engineering practices with comprehensive documentation, forensic analysis, and proactive prevention strategies. It ensures future engineers can quickly diagnose and resolve deployment issues while understanding the architectural decisions behind the solutions.*
