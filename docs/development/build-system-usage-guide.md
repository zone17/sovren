# Build System Usage Guide

## Quick Start

This guide helps developers understand and use the Sovren build system effectively. The build system is based on Vite with comprehensive optimization, monitoring, and validation capabilities.

## Prerequisites

- Node.js 18+ (recommended: 20+)
- npm 8+ or yarn 1.22+
- Git for version control

## Installation

```bash
# Navigate to frontend package
cd packages/frontend

# Install dependencies
npm install

# Verify installation
npm run build
```

## Available Commands

### Standard Build Commands

```bash
# Development server with hot reload
npm run dev

# Production build
npm run build

# Clean build directory
npm run build:clean

# Preview production build
npm run preview
```

### Analysis and Monitoring Commands

```bash
# Build with bundle analysis visualization
npm run build:analyze

# Generate comprehensive performance report
npm run build:report

# Validate bundle size against budgets
npm run bundle:size

# Full performance audit pipeline
npm run build:performance
```

### Optimization Commands

```bash
# Build with caching enabled
npm run build:cache

# Build with performance profiling
npm run build:profile

# Optimize assets (images, fonts, icons)
node scripts/optimize-assets.js
```

### Testing Commands

```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run end-to-end tests
npm run test:e2e
```

## Development Workflow

### 1. Starting Development

```bash
# Start development server
npm run dev

# The server will start on http://localhost:3000
# Hot Module Replacement (HMR) is enabled by default
```

### 2. Making Changes

- Edit source files in `src/`
- Changes are automatically reflected in the browser
- Build errors are displayed in the browser overlay
- TypeScript errors are checked in real-time

### 3. Building for Production

```bash
# Standard production build
npm run build

# Build with analysis (recommended)
npm run build:analyze

# Full performance audit
npm run build:performance
```

### 4. Analyzing Build Performance

```bash
# Generate bundle visualization
npm run build:analyze
# Opens bundle-analysis.html in browser

# Generate performance report
npm run build:report
# Creates JSON report in reports/ directory

# Validate size budgets
npm run bundle:size
# Shows budget compliance and violations
```

## Understanding Build Output

### Standard Build Output

```bash
npm run build

# Output example:
dist/registerSW.js                     0.13 kB
dist/manifest.webmanifest              0.36 kB
dist/index.html                        0.56 kB
dist/assets/css/index-bca1542f.css     129.27 kB
dist/assets/js/index-CXs87XUv.js       0.71 kB
```

### Build Analysis Output

```bash
npm run build:analyze

# Additional output:
✨ Bundle analysis available at: bundle-analysis.html
📊 Treemap visualization generated
📈 Performance metrics collected
```

### Performance Report Output

```bash
npm run build:report

# Output example:
🚀 Elite Build Performance Report Generator
📊 Build Performance Summary:
Total Assets: 46
Total Size: 1.74 MB
Gzip Size: 23.12 KB
Compression: 1.3%
```

## Configuration

### Environment Variables

Create `.env` files for different environments:

```bash
# .env.development
VITE_API_URL=http://localhost:4000
VITE_APP_ENV=development

# .env.production
VITE_API_URL=https://api.sovren.dev
VITE_APP_ENV=production
```

### Build Configuration

The build system is configured in `vite.config.ts`:

```typescript
// Key configuration sections:
- Plugin configuration
- Module resolution aliases
- Build optimization settings
- Performance budgets
- Asset processing rules
```

## Performance Optimization

### Bundle Analysis

1. **Generate Bundle Analysis**:

   ```bash
   npm run build:analyze
   ```

2. **Open Analysis Report**:

   - Opens `bundle-analysis.html` automatically
   - Shows treemap visualization of bundle composition
   - Displays gzip and brotli sizes

3. **Identify Optimization Opportunities**:
   - Large chunks that can be split
   - Unused dependencies
   - Compression effectiveness

### Size Budget Validation

1. **Check Budget Compliance**:

   ```bash
   npm run bundle:size
   ```

2. **Understand Budget Violations**:

   ```bash
   # Example output:
   ❌ Errors:
     assets/images/Sovren-icon-d0bd48d5.png exceeds image budget
     Size: 1.34 MB / Budget: 100 KB
   ```

3. **Fix Budget Violations**:
   - Optimize large images
   - Split large CSS bundles
   - Reduce chunk count

### Performance Monitoring

1. **Generate Performance Report**:

   ```bash
   npm run build:report
   ```

2. **Review Metrics**:

   - Build time analysis
   - Asset breakdown
   - Compression effectiveness
   - Optimization recommendations

3. **Track Performance Trends**:
   - Reports are timestamped
   - Compare performance over time
   - Identify performance regressions

## Asset Optimization

### Image Optimization

The build system automatically optimizes images:

- **PNG**: Lossless compression
- **JPEG**: Quality optimization
- **WebP**: Modern format conversion
- **SVG**: Minification and optimization

### Font Optimization

Fonts are processed with:

- **Subsetting**: Remove unused characters
- **WOFF2 Conversion**: Modern font format
- **Preloading**: Critical font loading

### Icon Processing

Icons are optimized through:

- **SVG Optimization**: Minification and cleanup
- **Icon Sprites**: Efficient icon delivery
- **Multiple Sizes**: Different resolutions for different uses

## Caching Strategy

### Build Caching

The build system implements comprehensive caching:

1. **Content-based Hashing**:

   - Files are hashed based on content
   - Changed files get new hashes
   - Unchanged files maintain same hash

2. **Browser Caching**:

   - Long-term caching for static assets
   - Efficient cache invalidation
   - Optimal cache headers

3. **Build Cache**:
   - Dependency pre-bundling cache
   - Faster subsequent builds
   - Automatic cache invalidation

### Cache Management

```bash
# Clear all caches
npm run build:clean

# Build with fresh cache
npm run build:clean && npm run build

# Cache-enabled build
npm run build:cache
```

## Progressive Web App (PWA)

### PWA Features

The build system generates PWA assets:

- **Service Worker**: Offline functionality
- **Web App Manifest**: App-like experience
- **App Icons**: Multiple sizes and formats
- **Offline Fallback**: Graceful offline experience

### PWA Validation

```bash
# Build with PWA assets
npm run build

# Check PWA compliance
npm run test:lighthouse
```

## Troubleshooting

### Common Issues

#### Build Errors

```bash
# Error: Module not found
Solution: Check import paths and module resolution

# Error: Out of memory
Solution: Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Error: Permission denied
Solution: Check file permissions and user access
```

#### Performance Issues

```bash
# Slow build times
Solution: Clear cache and rebuild
npm run build:clean && npm run build

# Large bundle size
Solution: Analyze and optimize
npm run build:analyze
npm run bundle:size
```

#### Asset Loading Issues

```bash
# Images not loading
Solution: Check asset paths and build output
npm run build:report

# Fonts not loading
Solution: Verify font optimization
node scripts/optimize-assets.js
```

### Debug Commands

```bash
# Debug build performance
npm run build:profile

# Debug bundle composition
npm run build:analyze

# Debug asset optimization
npm run build:report

# Debug caching issues
npm run build:clean && npm run build
```

## Best Practices

### Development Best Practices

1. **Use Path Aliases**:

   ```typescript
   // Instead of:
   import { Button } from '../../../components/ui/button';

   // Use:
   import { Button } from '@components/ui/button';
   ```

2. **Optimize Imports**:

   ```typescript
   // Instead of:
   import * as _ from 'lodash';

   // Use:
   import { debounce } from 'lodash';
   ```

3. **Lazy Load Components**:
   ```typescript
   // Use dynamic imports for code splitting
   const LazyComponent = React.lazy(() => import('./LazyComponent'));
   ```

### Build Best Practices

1. **Regular Performance Audits**:

   ```bash
   # Run full performance audit weekly
   npm run build:performance
   ```

2. **Monitor Bundle Size**:

   ```bash
   # Check bundle size before commits
   npm run bundle:size
   ```

3. **Analyze Bundle Composition**:
   ```bash
   # Review bundle analysis monthly
   npm run build:analyze
   ```

### Asset Best Practices

1. **Image Optimization**:

   - Use WebP format for modern browsers
   - Optimize images before adding to project
   - Use appropriate image sizes

2. **Font Loading**:

   - Preload critical fonts
   - Use font-display: swap
   - Subset fonts for better performance

3. **Icon Usage**:
   - Use SVG icons when possible
   - Implement icon sprites for efficiency
   - Optimize icon files

## Advanced Usage

### Custom Build Scripts

Create custom build scripts for specific needs:

```bash
# Custom build script example
#!/bin/bash
npm run build:clean
npm run build:analyze
npm run build:report
npm run bundle:size
```

### Environment-Specific Builds

```bash
# Development build
npm run build -- --mode development

# Staging build
npm run build -- --mode staging

# Production build
npm run build -- --mode production
```

### CI/CD Integration

```yaml
# Example GitHub Actions workflow
name: Build and Test
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npm run bundle:size
      - run: npm run test:coverage
```

## Monitoring and Alerting

### Performance Monitoring

1. **Build Time Monitoring**:

   - Track build duration trends
   - Set up alerts for slow builds
   - Monitor performance regressions

2. **Bundle Size Monitoring**:

   - Track bundle size growth
   - Alert on budget violations
   - Monitor compression effectiveness

3. **Asset Optimization Monitoring**:
   - Track optimization savings
   - Monitor asset loading performance
   - Alert on unoptimized assets

### Automated Alerts

```bash
# Set up monitoring alerts
npm run build:performance > build-metrics.json
# Parse metrics and send alerts if thresholds exceeded
```

## Support and Resources

### Documentation

- **Architecture Documentation**: `docs/development/build-system-architecture.md`
- **Validation Report**: `docs/implementation-summaries/US-203-BUILD-SYSTEM-OPTIMIZATION-VALIDATION-REPORT.md`
- **Troubleshooting Guide**: This document

### Script Documentation

- **`scripts/build-report.js`**: Comprehensive build analysis
- **`scripts/bundle-size-check.js`**: Size validation and budget enforcement
- **`scripts/optimize-assets.js`**: Asset optimization pipeline

### Getting Help

1. **Check Documentation**: Review architecture and usage guides
2. **Run Diagnostics**: Use debug commands to identify issues
3. **Review Reports**: Analyze performance reports for insights
4. **Check Logs**: Review build logs for error details

## Conclusion

The Sovren build system provides comprehensive tools for efficient development and optimized production builds. Regular use of monitoring and analysis tools ensures optimal performance and helps identify optimization opportunities.

Key takeaways:

- Use `npm run build:analyze` for regular bundle analysis
- Monitor performance with `npm run build:report`
- Validate budgets with `npm run bundle:size`
- Follow best practices for optimal performance
- Leverage caching for faster builds
- Utilize PWA features for enhanced user experience

For additional support, refer to the comprehensive documentation and monitoring tools provided with the build system.
