# Build System Troubleshooting Guide

## Quick Reference

This guide provides solutions for common build system issues and debugging techniques. For immediate help, use the diagnostic commands below.

## Diagnostic Commands

```bash
# Quick diagnostics
npm run build:clean && npm run build    # Clean build
npm run build:analyze                   # Bundle analysis
npm run build:report                    # Performance report
npm run bundle:size                     # Budget validation

# Debug specific issues
npm run build:profile                   # Performance profiling
npm run build:cache                     # Cache debugging
node scripts/optimize-assets.js         # Asset optimization
```

## Common Issues and Solutions

### 1. Build Errors

#### Module Resolution Errors

**Error**: `Module not found: Can't resolve 'module-name'`

**Solutions**:

```bash
# Check if module is installed
npm ls module-name

# Install missing dependency
npm install module-name

# Check path aliases in vite.config.ts
# Verify import paths are correct
```

**Example Fix**:

```typescript
// Instead of:
import { Button } from '../../../components/ui/button';

// Use path alias:
import { Button } from '@components/ui/button';
```

#### TypeScript Errors

**Error**: `TypeScript compilation errors`

**Solutions**:

```bash
# Run TypeScript check
npm run type-check

# Fix TypeScript configuration
# Check tsconfig.json settings
# Verify type definitions are installed
```

#### ES Module Errors

**Error**: `require is not defined in ES module scope`

**Solutions**:

```bash
# Convert CommonJS to ES modules
# Update package.json "type": "module"
# Use import instead of require
```

**Example Fix**:

```javascript
// Instead of:
const fs = require('fs');

// Use:
import fs from 'fs';
```

### 2. Performance Issues

#### Slow Build Times

**Symptoms**: Build takes longer than 10 seconds

**Diagnosis**:

```bash
# Profile build performance
npm run build:profile

# Check for large dependencies
npm run build:analyze
```

**Solutions**:

```bash
# Clear build cache
npm run build:clean

# Optimize dependencies
npm run build:report

# Check for circular dependencies
npm run build:analyze
```

#### Memory Issues

**Error**: `JavaScript heap out of memory`

**Solutions**:

```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Or for Windows:
set NODE_OPTIONS=--max-old-space-size=4096

# Clean build cache
npm run build:clean
```

#### Large Bundle Size

**Symptoms**: Bundle size exceeds performance budgets

**Diagnosis**:

```bash
# Check bundle composition
npm run build:analyze

# Validate against budgets
npm run bundle:size
```

**Solutions**:

```bash
# Identify large chunks
npm run build:analyze

# Optimize imports
# Use tree shaking
# Implement code splitting
```

### 3. Asset Issues

#### Image Loading Problems

**Symptoms**: Images not loading or 404 errors

**Diagnosis**:

```bash
# Check asset paths
npm run build:report

# Verify build output
ls -la dist/assets/images/
```

**Solutions**:

```bash
# Optimize assets
node scripts/optimize-assets.js

# Check image paths in code
# Verify image files exist
# Check build output directory
```

#### Font Loading Issues

**Symptoms**: Fonts not loading or FOUC (Flash of Unstyled Content)

**Solutions**:

```bash
# Check font optimization
node scripts/optimize-assets.js

# Verify font preloading
# Check font-display settings
# Validate font file formats
```

#### Icon Problems

**Symptoms**: Icons not displaying or broken

**Solutions**:

```bash
# Optimize icons
node scripts/optimize-assets.js

# Check icon imports
# Verify SVG optimization
# Validate icon sprites
```

### 4. Caching Issues

#### Cache Invalidation Problems

**Symptoms**: Old files served after updates

**Solutions**:

```bash
# Clear all caches
npm run build:clean

# Rebuild with fresh cache
npm run build:clean && npm run build

# Check content hashing
npm run build:report
```

#### Development Cache Issues

**Symptoms**: Changes not reflected in development

**Solutions**:

```bash
# Clear Vite cache
rm -rf node_modules/.vite

# Restart development server
npm run dev

# Hard refresh browser (Ctrl+Shift+R)
```

### 5. PWA Issues

#### Service Worker Problems

**Symptoms**: PWA not working offline

**Diagnosis**:

```bash
# Check service worker generation
npm run build
ls -la dist/sw.js

# Validate PWA manifest
cat dist/manifest.webmanifest
```

**Solutions**:

```bash
# Rebuild PWA assets
npm run build

# Check service worker registration
# Validate PWA configuration
# Test offline functionality
```

#### Manifest Issues

**Symptoms**: App not installable

**Solutions**:

```bash
# Check manifest generation
npm run build
cat dist/manifest.webmanifest

# Validate manifest format
# Check icon references
# Test PWA installation
```

### 6. Compression Issues

#### Compression Not Working

**Symptoms**: Assets not compressed

**Diagnosis**:

```bash
# Check compression output
npm run build
ls -la dist/assets/*.gz dist/assets/*.br
```

**Solutions**:

```bash
# Verify compression configuration
# Check file size thresholds
# Validate compression plugins
```

#### Poor Compression Ratios

**Symptoms**: Compressed files still large

**Solutions**:

```bash
# Analyze compression effectiveness
npm run build:report

# Optimize source files
# Check compression settings
# Consider different algorithms
```

## Debugging Techniques

### 1. Build Analysis

#### Bundle Composition Analysis

```bash
# Generate bundle visualization
npm run build:analyze

# This creates bundle-analysis.html
# Open in browser for interactive analysis
```

**What to Look For**:

- Large chunks that can be split
- Duplicate dependencies
- Unused modules
- Inefficient imports

#### Performance Profiling

```bash
# Profile build performance
npm run build:profile

# Check build timings
# Identify bottlenecks
# Optimize slow operations
```

### 2. Asset Debugging

#### Asset Optimization Analysis

```bash
# Run asset optimization
node scripts/optimize-assets.js

# Check optimization results
# Verify asset processing
# Validate optimization settings
```

#### Asset Path Debugging

```bash
# Generate asset report
npm run build:report

# Check asset paths
# Verify asset categorization
# Validate asset loading
```

### 3. Performance Debugging

#### Build Performance Metrics

```bash
# Generate performance report
npm run build:report

# Review build metrics
# Check compression ratios
# Analyze asset breakdown
```

#### Bundle Size Validation

```bash
# Check bundle budgets
npm run bundle:size

# Review budget violations
# Check size recommendations
# Optimize large assets
```

## Error Messages and Solutions

### Common Error Messages

#### `Error: Failed to resolve import`

**Cause**: Module path resolution issue

**Solution**:

```bash
# Check import path
# Verify module exists
# Check path aliases
# Install missing dependencies
```

#### `Error: Transform failed`

**Cause**: Build transformation error

**Solution**:

```bash
# Check file syntax
# Verify plugin configuration
# Update dependencies
# Check TypeScript configuration
```

#### `Error: Out of memory`

**Cause**: Insufficient memory for build

**Solution**:

```bash
# Increase memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Clear cache
npm run build:clean

# Optimize bundle size
npm run build:analyze
```

### Network and Permission Errors

#### `Error: Permission denied`

**Solution**:

```bash
# Check file permissions
chmod -R 755 dist/

# Check user permissions
# Verify directory access
# Check file ownership
```

#### `Error: ENOENT: no such file or directory`

**Solution**:

```bash
# Check file exists
ls -la [file-path]

# Verify path is correct
# Check case sensitivity
# Ensure file is generated
```

## Performance Optimization

### Bundle Size Optimization

#### Identifying Large Bundles

```bash
# Analyze bundle composition
npm run build:analyze

# Check size breakdown
npm run bundle:size

# Generate optimization report
npm run build:report
```

#### Optimization Strategies

1. **Code Splitting**:

   ```typescript
   // Dynamic imports
   const LazyComponent = React.lazy(() => import('./LazyComponent'));

   // Route-based splitting
   const HomePage = React.lazy(() => import('./pages/HomePage'));
   ```

2. **Tree Shaking**:

   ```typescript
   // Import only what you need
   import { debounce } from 'lodash';

   // Instead of:
   import _ from 'lodash';
   ```

3. **Dependency Optimization**:

   ```bash
   # Check dependency sizes
   npm run build:analyze

   # Consider lighter alternatives
   # Remove unused dependencies
   ```

### Build Performance Optimization

#### Caching Optimization

```bash
# Use build cache
npm run build:cache

# Clear cache if issues
npm run build:clean

# Monitor cache effectiveness
npm run build:report
```

#### Asset Optimization

```bash
# Optimize all assets
node scripts/optimize-assets.js

# Check optimization results
npm run build:report

# Monitor asset loading
npm run build:analyze
```

## Monitoring and Alerting

### Performance Monitoring

#### Build Time Monitoring

```bash
# Track build performance
npm run build:performance

# Set up alerts for slow builds
# Monitor performance trends
# Identify performance regressions
```

#### Bundle Size Monitoring

```bash
# Monitor bundle size
npm run bundle:size

# Set up size alerts
# Track size growth
# Monitor compression effectiveness
```

### Automated Diagnostics

#### CI/CD Integration

```yaml
# Example GitHub Actions
name: Build Diagnostics
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - run: npm run bundle:size
      - run: npm run build:report
```

## Emergency Procedures

### Build Failure Recovery

#### Complete Build Reset

```bash
# Nuclear option - complete reset
rm -rf node_modules dist
npm install
npm run build:clean
npm run build
```

#### Dependency Reset

```bash
# Reset dependencies
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Production Build Issues

#### Emergency Rollback

```bash
# Rollback to previous build
git checkout [previous-commit]
npm run build
# Deploy previous version
```

#### Hot Fix Deployment

```bash
# Quick fix for critical issues
npm run build:clean
npm run build
npm run bundle:size
# Deploy if budgets pass
```

## Advanced Debugging

### Deep Dive Analysis

#### Dependency Analysis

```bash
# Analyze dependency tree
npm ls --depth=0

# Check for duplicates
npm ls --depth=1 | grep -E "^\w"

# Audit dependencies
npm audit
```

#### Bundle Analysis

```bash
# Detailed bundle analysis
npm run build:analyze

# Check chunk composition
# Analyze dependency usage
# Identify optimization opportunities
```

### Custom Debugging Scripts

#### Debug Script Example

```bash
#!/bin/bash
# debug-build.sh

echo "🔍 Starting build diagnostics..."

# Clean build
npm run build:clean

# Build with analysis
npm run build:analyze

# Generate reports
npm run build:report
npm run bundle:size

echo "✅ Diagnostics complete!"
```

## Best Practices

### Development Best Practices

1. **Regular Monitoring**:

   ```bash
   # Check build performance weekly
   npm run build:performance

   # Monitor bundle size daily
   npm run bundle:size
   ```

2. **Preventive Measures**:

   ```bash
   # Pre-commit checks
   npm run build && npm run bundle:size

   # Regular optimization
   npm run build:analyze
   ```

3. **Documentation**:
   - Document known issues
   - Keep troubleshooting logs
   - Share solutions with team

### Production Best Practices

1. **Monitoring**:
   - Set up build alerts
   - Monitor performance metrics
   - Track bundle size trends

2. **Backup Plans**:
   - Keep known-good builds
   - Document rollback procedures
   - Test emergency procedures

## Getting Help

### Resources

- **Documentation**: Review architecture and usage guides
- **Scripts**: Use diagnostic scripts for analysis
- **Reports**: Generate performance reports
- **Logs**: Check build logs for details

### Support Process

1. **Self-Diagnosis**: Use diagnostic commands
2. **Documentation**: Check troubleshooting guide
3. **Analysis**: Generate performance reports
4. **Escalation**: Provide diagnostic information

### Information to Provide

When seeking help, provide:

- Error messages and stack traces
- Build configuration details
- Performance report output
- Steps to reproduce issue
- Environment information

## Conclusion

This troubleshooting guide provides comprehensive solutions for common build system issues. Regular use of diagnostic commands and monitoring tools helps prevent issues and ensures optimal build performance.

Key diagnostic commands:

- `npm run build:clean && npm run build` - Clean build
- `npm run build:analyze` - Bundle analysis
- `npm run build:report` - Performance report
- `npm run bundle:size` - Budget validation

Remember to monitor build performance regularly and address issues proactively to maintain optimal build system health.
