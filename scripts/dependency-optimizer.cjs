#!/usr/bin/env node

/**
 * 🚀 US-202 Dependency Management Overhaul - Optimization Engine
 *
 * This script analyzes the dependency tree and provides optimization
 * recommendations to reduce bundle size, eliminate duplicates, and
 * improve overall dependency management.
 *
 * @author Sovren Engineering Team
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class DependencyOptimizer {
  constructor() {
    this.frontendDir = path.join(__dirname, '../packages/frontend');
    this.packageJsonPath = path.join(this.frontendDir, 'package.json');
    this.results = {
      bundleAnalysis: {},
      duplicates: [],
      optimizations: [],
      treeShaking: [],
      bundleSplitting: [],
      performanceImpact: {},
    };
    this.packageJson = null;
  }

  /**
   * Main optimization process
   */
  async optimize() {
    console.log('🚀 Starting Dependency Optimization Analysis...\n');

    try {
      this.loadPackageJson();
      await this.analyzeBundleSize();
      this.findDuplicateDependencies();
      this.analyzeTreeShakingOpportunities();
      this.recommendBundleSplitting();
      this.calculatePerformanceImpact();
      this.generateOptimizationReport();
      this.generateOptimizedPackageJson();
    } catch (error) {
      console.error('❌ Optimization failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Load and parse package.json
   */
  loadPackageJson() {
    try {
      const content = fs.readFileSync(this.packageJsonPath, 'utf8');
      this.packageJson = JSON.parse(content);
      console.log(
        `📦 Loaded package.json with ${Object.keys(this.packageJson.dependencies || {}).length} dependencies`
      );
    } catch (error) {
      throw new Error(`Failed to load package.json: ${error.message}`);
    }
  }

  /**
   * Analyze current bundle size and composition
   */
  async analyzeBundleSize() {
    console.log('📊 Analyzing bundle size...');

    try {
      // Build the project to analyze bundle
      process.chdir(this.frontendDir);
      const buildOutput = execSync('npm run build', { encoding: 'utf8' });

      // Parse build output for bundle sizes
      const bundleLines = buildOutput
        .split('\n')
        .filter((line) => line.includes('dist/assets') && line.includes('kB'));

      let totalSize = 0;
      const bundles = [];

      bundleLines.forEach((line) => {
        const match = line.match(/(\S+)\s+(\d+\.?\d*)\s*kB/);
        if (match) {
          const [, filename, sizeStr] = match;
          const size = parseFloat(sizeStr);
          totalSize += size;
          bundles.push({ filename, size });
        }
      });

      this.results.bundleAnalysis = {
        totalSize,
        bundles,
        recommendation: this.getBundleSizeRecommendation(totalSize),
      };

      console.log(`📦 Total bundle size: ${totalSize.toFixed(2)} kB`);
    } catch (error) {
      console.warn('⚠️  Could not analyze bundle size:', error.message);
    }
  }

  /**
   * Find duplicate dependencies in the tree
   */
  findDuplicateDependencies() {
    console.log('🔍 Finding duplicate dependencies...');

    try {
      // Get dependency tree
      const depsOutput = execSync('npm ls --json --depth=2', {
        encoding: 'utf8',
        cwd: this.frontendDir,
      });

      const depsTree = JSON.parse(depsOutput);
      const packageCounts = new Map();

      // Recursively count package occurrences
      const countPackages = (node, depth = 0) => {
        if (!node.dependencies) return;

        Object.entries(node.dependencies).forEach(([name, info]) => {
          const key = `${name}@${info.version}`;
          packageCounts.set(key, (packageCounts.get(key) || 0) + 1);

          if (info.dependencies && depth < 3) {
            countPackages(info, depth + 1);
          }
        });
      };

      countPackages(depsTree);

      // Find duplicates
      this.results.duplicates = Array.from(packageCounts.entries())
        .filter(([, count]) => count > 1)
        .map(([pkg, count]) => ({ package: pkg, count }))
        .sort((a, b) => b.count - a.count);

      console.log(`🔁 Found ${this.results.duplicates.length} duplicate dependencies`);
    } catch (error) {
      console.warn('⚠️  Could not analyze duplicates:', error.message);
    }
  }

  /**
   * Analyze tree shaking opportunities
   */
  analyzeTreeShakingOpportunities() {
    console.log('🌳 Analyzing tree shaking opportunities...');

    const deps = this.packageJson.dependencies || {};
    const opportunities = [];

    // Check for packages that support tree shaking
    const treeShakablePackages = [
      {
        name: 'lodash',
        replacement: 'lodash-es',
        reason: 'ESM modules support better tree shaking',
      },
      {
        name: 'moment',
        replacement: 'date-fns',
        reason: 'Modular design allows importing only needed functions',
      },
      { name: 'rxjs', replacement: 'rxjs/operators', reason: 'Import only needed operators' },
      {
        name: 'material-ui',
        replacement: '@mui/material',
        reason: 'Better tree shaking support in v5+',
      },
    ];

    treeShakablePackages.forEach(({ name, replacement, reason }) => {
      if (deps[name]) {
        opportunities.push({
          package: name,
          recommendation: `Replace with ${replacement}`,
          reason,
          impact: 'Reduced bundle size through tree shaking',
        });
      }
    });

    // Check for barrel imports that prevent tree shaking
    const codeFiles = this.scanForBarrelImports();
    if (codeFiles.length > 0) {
      opportunities.push({
        package: 'barrel-imports',
        recommendation: 'Replace barrel imports with direct imports',
        reason: 'Barrel imports prevent effective tree shaking',
        impact: 'Significantly reduced bundle size',
        files: codeFiles,
      });
    }

    this.results.treeShaking = opportunities;
    console.log(`🌳 Found ${opportunities.length} tree shaking opportunities`);
  }

  /**
   * Scan for barrel imports in source code
   */
  scanForBarrelImports() {
    const files = [];
    try {
      const srcDir = path.join(this.frontendDir, 'src');
      const findBarrelImports = (dir) => {
        const entries = fs.readdirSync(dir);

        entries.forEach((entry) => {
          const fullPath = path.join(dir, entry);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            findBarrelImports(fullPath);
          } else if (entry.match(/\.(ts|tsx|js|jsx)$/)) {
            const content = fs.readFileSync(fullPath, 'utf8');

            // Look for barrel imports like import { a, b, c } from 'large-library'
            const barrelImportPattern = /import\s*{[^}]+}\s*from\s*['"`](@?[^/]+)(?!\/)/g;
            const matches = content.match(barrelImportPattern);

            if (matches && matches.length > 0) {
              files.push({
                file: path.relative(this.frontendDir, fullPath),
                imports: matches,
              });
            }
          }
        });
      };

      if (fs.existsSync(srcDir)) {
        findBarrelImports(srcDir);
      }
    } catch (error) {
      console.warn('⚠️  Could not scan for barrel imports:', error.message);
    }

    return files;
  }

  /**
   * Recommend bundle splitting strategies
   */
  recommendBundleSplitting() {
    console.log('📦 Analyzing bundle splitting opportunities...');

    const deps = this.packageJson.dependencies || {};
    const recommendations = [];

    // Identify large libraries that should be split
    const largeLibraries = [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      'framer-motion',
      'recharts',
      'stripe',
    ];

    const vendorChunks = largeLibraries.filter((lib) => deps[lib]);

    if (vendorChunks.length > 0) {
      recommendations.push({
        type: 'vendor-splitting',
        libraries: vendorChunks,
        recommendation: 'Split vendor libraries into separate chunks',
        reason: 'Better caching and parallel loading',
        implementation: 'Configure Vite/Rollup splitVendorChunkPlugin',
      });
    }

    // Recommend dynamic imports for heavy components
    recommendations.push({
      type: 'dynamic-imports',
      recommendation: 'Implement dynamic imports for heavy components',
      examples: [
        'Dashboard components',
        'Chart libraries (recharts)',
        'Rich text editors',
        'File upload components',
      ],
      reason: 'Reduce initial bundle size and improve TTI',
    });

    this.results.bundleSplitting = recommendations;
    console.log(`📦 Generated ${recommendations.length} bundle splitting recommendations`);
  }

  /**
   * Calculate performance impact of optimizations
   */
  calculatePerformanceImpact() {
    console.log('⚡ Calculating performance impact...');

    const currentSize = this.results.bundleAnalysis.totalSize || 0;
    let estimatedSavings = 0;

    // Estimate savings from each optimization
    this.results.treeShaking.forEach((opt) => {
      switch (opt.package) {
        case 'lodash':
          estimatedSavings += 50; // ~50kB typical savings
          break;
        case 'moment':
          estimatedSavings += 67; // ~67kB typical savings
          break;
        case 'barrel-imports':
          estimatedSavings += 30; // Conservative estimate
          break;
        default:
          estimatedSavings += 10;
      }
    });

    // Estimate duplicate removal savings
    this.results.duplicates.forEach((dup) => {
      estimatedSavings += (dup.count - 1) * 5; // Conservative 5kB per duplicate
    });

    const optimizedSize = Math.max(currentSize - estimatedSavings, currentSize * 0.6);
    const savingsPercent = (((currentSize - optimizedSize) / currentSize) * 100).toFixed(1);

    this.results.performanceImpact = {
      currentSize,
      optimizedSize,
      estimatedSavings,
      savingsPercent,
      loadTimeImprovement: this.calculateLoadTimeImprovement(estimatedSavings),
      cacheEfficiency: this.calculateCacheEfficiency(),
    };

    console.log(`⚡ Estimated savings: ${estimatedSavings.toFixed(1)} kB (${savingsPercent}%)`);
  }

  /**
   * Calculate estimated load time improvement
   */
  calculateLoadTimeImprovement(savingsKB) {
    // Estimates based on average connection speeds
    const connections = {
      '3G': 1.6, // MB/s
      '4G': 25, // MB/s
      Broadband: 100, // MB/s
    };

    const improvements = {};
    Object.entries(connections).forEach(([type, speedMBps]) => {
      const timeSavedMs = (savingsKB / 1024 / speedMBps) * 1000;
      improvements[type] = Math.round(timeSavedMs);
    });

    return improvements;
  }

  /**
   * Calculate cache efficiency improvements
   */
  calculateCacheEfficiency() {
    const bundleSplitting = this.results.bundleSplitting.length > 0;
    const vendorSeparation = this.results.bundleSplitting.some(
      (rec) => rec.type === 'vendor-splitting'
    );

    return {
      score: bundleSplitting ? (vendorSeparation ? 'High' : 'Medium') : 'Low',
      benefits: [
        bundleSplitting && 'Separate vendor chunks improve cache hit rates',
        vendorSeparation && 'Vendor libraries cached independently from app code',
        'Dynamic imports enable progressive loading',
      ].filter(Boolean),
    };
  }

  /**
   * Get bundle size recommendation
   */
  getBundleSizeRecommendation(totalSize) {
    if (totalSize < 200) {
      return { level: 'excellent', message: 'Bundle size is excellent' };
    } else if (totalSize < 400) {
      return { level: 'good', message: 'Bundle size is acceptable' };
    } else if (totalSize < 600) {
      return { level: 'warning', message: 'Bundle size should be optimized' };
    } else {
      return {
        level: 'critical',
        message: 'Bundle size is too large and needs immediate optimization',
      };
    }
  }

  /**
   * Generate comprehensive optimization report
   */
  generateOptimizationReport() {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 DEPENDENCY OPTIMIZATION REPORT');
    console.log('='.repeat(80));

    console.log(`\n📊 BUNDLE ANALYSIS:`);
    const { bundleAnalysis } = this.results;
    console.log(`   Current Size: ${bundleAnalysis.totalSize?.toFixed(1) || 'Unknown'} kB`);
    console.log(`   Status: ${bundleAnalysis.recommendation?.level || 'Unknown'}`);
    console.log(
      `   Recommendation: ${bundleAnalysis.recommendation?.message || 'No recommendations'}`
    );

    console.log(`\n🔁 DUPLICATE DEPENDENCIES:`);
    if (this.results.duplicates.length > 0) {
      this.results.duplicates.slice(0, 10).forEach((dup) => {
        console.log(`   • ${dup.package} (${dup.count} instances)`);
      });
      if (this.results.duplicates.length > 10) {
        console.log(`   ... and ${this.results.duplicates.length - 10} more`);
      }
    } else {
      console.log('   ✅ No significant duplicates found');
    }

    console.log(`\n🌳 TREE SHAKING OPPORTUNITIES:`);
    if (this.results.treeShaking.length > 0) {
      this.results.treeShaking.forEach((opt) => {
        console.log(`   • ${opt.package}: ${opt.recommendation}`);
        console.log(`     Reason: ${opt.reason}`);
      });
    } else {
      console.log('   ✅ No major tree shaking opportunities identified');
    }

    console.log(`\n📦 BUNDLE SPLITTING RECOMMENDATIONS:`);
    if (this.results.bundleSplitting.length > 0) {
      this.results.bundleSplitting.forEach((rec) => {
        console.log(`   • ${rec.type}: ${rec.recommendation}`);
        console.log(`     Reason: ${rec.reason}`);
      });
    } else {
      console.log('   ✅ Current bundle splitting strategy is adequate');
    }

    console.log(`\n⚡ PERFORMANCE IMPACT:`);
    const perf = this.results.performanceImpact;
    console.log(
      `   Estimated Savings: ${perf.estimatedSavings?.toFixed(1) || 0} kB (${perf.savingsPercent || 0}%)`
    );
    console.log(`   Load Time Improvement:`);
    if (perf.loadTimeImprovement) {
      Object.entries(perf.loadTimeImprovement).forEach(([conn, time]) => {
        console.log(`     ${conn}: ${time}ms faster`);
      });
    }
    console.log(`   Cache Efficiency: ${perf.cacheEfficiency?.score || 'Unknown'}`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ Optimization Analysis Complete');
    console.log('='.repeat(80));

    // Save detailed results
    const reportPath = path.join(__dirname, '../docs/dependency-optimization-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`📄 Detailed report saved to: ${reportPath}`);
  }

  /**
   * Generate optimized package.json suggestions
   */
  generateOptimizedPackageJson() {
    console.log('\n🔧 Generating optimization suggestions...');

    const optimizations = {
      scripts: {
        'analyze:bundle': 'npm run build && npx vite-bundle-analyzer dist/assets/*.js',
        'optimize:deps': 'node ../../scripts/dependency-optimizer.cjs',
        'clean:deps': 'rm -rf node_modules package-lock.json && npm install',
        'audit:size': 'npm run build && npm run bundlesize',
      },
      bundlesize: [
        {
          path: 'dist/assets/js/*.js',
          maxSize: '250kb',
          compression: 'gzip',
        },
        {
          path: 'dist/assets/css/*.css',
          maxSize: '50kb',
          compression: 'gzip',
        },
      ],
    };

    const suggestionsPath = path.join(__dirname, '../docs/package-optimization-suggestions.json');
    fs.writeFileSync(suggestionsPath, JSON.stringify(optimizations, null, 2));
    console.log(`💡 Optimization suggestions saved to: ${suggestionsPath}`);
  }
}

// Run optimization if called directly
if (require.main === module) {
  const optimizer = new DependencyOptimizer();
  optimizer.optimize().catch((error) => {
    console.error('❌ Optimization failed:', error);
    process.exit(1);
  });
}

module.exports = DependencyOptimizer;
