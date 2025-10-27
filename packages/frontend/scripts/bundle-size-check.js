#!/usr/bin/env node

/**
 * Elite Bundle Size Checker
 * Validates build artifacts against performance budgets
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.join(__dirname, '../dist');
const BUDGET_CONFIG = {
  // Elite Performance Budgets (Industry Best Practice)
  js: {
    max: 250 * 1024, // 250KB per JS bundle
    warn: 200 * 1024, // Warning at 200KB
  },
  css: {
    max: 50 * 1024, // 50KB per CSS bundle
    warn: 40 * 1024, // Warning at 40KB
  },
  image: {
    max: 100 * 1024, // 100KB per image
    warn: 80 * 1024, // Warning at 80KB
  },
  total: {
    max: 2 * 1024 * 1024, // 2MB total bundle size
    warn: 1.5 * 1024 * 1024, // Warning at 1.5MB
  },
  chunks: {
    max: 15, // Maximum number of chunks
    warn: 12, // Warning at 12 chunks
  },
};

/**
 * Elite Bundle Size Analyzer
 */
class BundleSizeAnalyzer {
  constructor() {
    this.results = {
      passed: true,
      warnings: [],
      errors: [],
      metrics: {
        totalSize: 0,
        totalGzipSize: 0,
        jsSize: 0,
        cssSize: 0,
        imageSize: 0,
        chunkCount: 0,
      },
      assets: [],
    };
  }

  /**
   * Analyze all build artifacts
   */
  analyze() {
    if (!fs.existsSync(DIST_DIR)) {
      throw new Error('Build directory not found. Run npm run build first.');
    }

    console.log('🔍 Analyzing bundle sizes...');

    const assets = this.getAllAssets(DIST_DIR);
    this.results.metrics.chunkCount = assets.filter(
      (asset) => asset.endsWith('.js') && !asset.includes('node_modules')
    ).length;

    // Analyze each asset
    for (const asset of assets) {
      const assetPath = path.join(DIST_DIR, asset);
      const stats = fs.statSync(assetPath);
      const size = stats.size;
      const gzipSize = this.getGzipSize(assetPath);
      const type = this.getAssetType(asset);

      const assetInfo = {
        path: asset,
        size,
        gzipSize,
        type,
        sizeFormatted: this.formatBytes(size),
        gzipSizeFormatted: this.formatBytes(gzipSize),
      };

      this.results.assets.push(assetInfo);
      this.results.metrics.totalSize += size;
      this.results.metrics.totalGzipSize += gzipSize;

      // Add to category totals
      if (type === 'javascript') {
        this.results.metrics.jsSize += size;
      } else if (type === 'stylesheet') {
        this.results.metrics.cssSize += size;
      } else if (type === 'image') {
        this.results.metrics.imageSize += size;
      }

      // Check individual asset budgets
      this.checkAssetBudget(assetInfo);
    }

    // Check total budgets
    this.checkTotalBudgets();

    // Sort assets by size for reporting
    this.results.assets.sort((a, b) => b.size - a.size);

    console.log('✅ Bundle size analysis complete');
  }

  /**
   * Get all assets recursively
   */
  getAllAssets(dir, prefix = '') {
    const assets = [];
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        assets.push(...this.getAllAssets(filePath, path.join(prefix, file)));
      } else {
        assets.push(path.join(prefix, file));
      }
    }

    return assets;
  }

  /**
   * Get gzip size of asset
   */
  getGzipSize(assetPath) {
    try {
      const gzipPath = `${assetPath}.gz`;
      if (fs.existsSync(gzipPath)) {
        return fs.statSync(gzipPath).size;
      }

      // Calculate gzip size on the fly
      const zlib = require('zlib');
      const content = fs.readFileSync(assetPath);
      const gzipped = zlib.gzipSync(content);
      return gzipped.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get asset type
   */
  getAssetType(asset) {
    const ext = path.extname(asset);
    const typeMap = {
      '.js': 'javascript',
      '.css': 'stylesheet',
      '.png': 'image',
      '.jpg': 'image',
      '.jpeg': 'image',
      '.gif': 'image',
      '.svg': 'image',
      '.woff': 'font',
      '.woff2': 'font',
      '.ttf': 'font',
      '.eot': 'font',
      '.html': 'html',
      '.json': 'data',
    };
    return typeMap[ext] || 'other';
  }

  /**
   * Check individual asset budget
   */
  checkAssetBudget(asset) {
    const budgets = BUDGET_CONFIG[asset.type];
    if (!budgets) return;

    if (asset.size > budgets.max) {
      this.results.errors.push({
        type: 'size',
        severity: 'error',
        message: `${asset.path} exceeds ${asset.type} budget`,
        actual: asset.sizeFormatted,
        budget: this.formatBytes(budgets.max),
        asset: asset.path,
      });
      this.results.passed = false;
    } else if (asset.size > budgets.warn) {
      this.results.warnings.push({
        type: 'size',
        severity: 'warning',
        message: `${asset.path} approaching ${asset.type} budget`,
        actual: asset.sizeFormatted,
        budget: this.formatBytes(budgets.max),
        asset: asset.path,
      });
    }
  }

  /**
   * Check total budgets
   */
  checkTotalBudgets() {
    // Check total size
    if (this.results.metrics.totalSize > BUDGET_CONFIG.total.max) {
      this.results.errors.push({
        type: 'total',
        severity: 'error',
        message: 'Total bundle size exceeds budget',
        actual: this.formatBytes(this.results.metrics.totalSize),
        budget: this.formatBytes(BUDGET_CONFIG.total.max),
      });
      this.results.passed = false;
    } else if (this.results.metrics.totalSize > BUDGET_CONFIG.total.warn) {
      this.results.warnings.push({
        type: 'total',
        severity: 'warning',
        message: 'Total bundle size approaching budget',
        actual: this.formatBytes(this.results.metrics.totalSize),
        budget: this.formatBytes(BUDGET_CONFIG.total.max),
      });
    }

    // Check chunk count
    if (this.results.metrics.chunkCount > BUDGET_CONFIG.chunks.max) {
      this.results.errors.push({
        type: 'chunks',
        severity: 'error',
        message: 'Too many chunks generated',
        actual: this.results.metrics.chunkCount,
        budget: BUDGET_CONFIG.chunks.max,
      });
      this.results.passed = false;
    } else if (this.results.metrics.chunkCount > BUDGET_CONFIG.chunks.warn) {
      this.results.warnings.push({
        type: 'chunks',
        severity: 'warning',
        message: 'Chunk count approaching limit',
        actual: this.results.metrics.chunkCount,
        budget: BUDGET_CONFIG.chunks.max,
      });
    }
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Generate optimization suggestions
   */
  generateOptimizationSuggestions() {
    const suggestions = [];

    // Large asset suggestions
    const largeAssets = this.results.assets.filter((asset) => asset.size > 100 * 1024);
    if (largeAssets.length > 0) {
      suggestions.push({
        type: 'optimization',
        message: 'Consider code splitting for large bundles',
        assets: largeAssets.slice(0, 5).map((a) => `${a.path} (${a.sizeFormatted})`),
      });
    }

    // Image optimization
    const largeImages = this.results.assets.filter(
      (asset) => asset.type === 'image' && asset.size > 50 * 1024
    );
    if (largeImages.length > 0) {
      suggestions.push({
        type: 'image',
        message: 'Optimize images with compression or WebP format',
        assets: largeImages.map((a) => `${a.path} (${a.sizeFormatted})`),
      });
    }

    // Duplicate dependencies
    const jsAssets = this.results.assets.filter((asset) => asset.type === 'javascript');
    if (jsAssets.length > 10) {
      suggestions.push({
        type: 'chunking',
        message: 'Consider consolidating similar chunks to reduce HTTP requests',
        count: jsAssets.length,
      });
    }

    return suggestions;
  }

  /**
   * Generate detailed report
   */
  generateReport() {
    const suggestions = this.generateOptimizationSuggestions();

    return {
      passed: this.results.passed,
      timestamp: new Date().toISOString(),
      summary: {
        totalAssets: this.results.assets.length,
        totalSize: this.formatBytes(this.results.metrics.totalSize),
        totalGzipSize: this.formatBytes(this.results.metrics.totalGzipSize),
        compressionRatio: `${((this.results.metrics.totalGzipSize / this.results.metrics.totalSize) * 100).toFixed(1)}%`,
        chunkCount: this.results.metrics.chunkCount,
        jsSize: this.formatBytes(this.results.metrics.jsSize),
        cssSize: this.formatBytes(this.results.metrics.cssSize),
        imageSize: this.formatBytes(this.results.metrics.imageSize),
      },
      budgets: {
        js: this.formatBytes(BUDGET_CONFIG.js.max),
        css: this.formatBytes(BUDGET_CONFIG.css.max),
        image: this.formatBytes(BUDGET_CONFIG.image.max),
        total: this.formatBytes(BUDGET_CONFIG.total.max),
        chunks: BUDGET_CONFIG.chunks.max,
      },
      largestAssets: this.results.assets.slice(0, 10),
      warnings: this.results.warnings,
      errors: this.results.errors,
      suggestions,
    };
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('📊 Elite Bundle Size Checker');
    console.log('='.repeat(40));

    const analyzer = new BundleSizeAnalyzer();
    analyzer.analyze();

    const report = analyzer.generateReport();

    // Display results
    console.log('\n📈 Bundle Size Summary:');
    console.log(
      `Total Size: ${report.summary.totalSize} (${report.summary.totalGzipSize} gzipped)`
    );
    console.log(`Compression: ${report.summary.compressionRatio}`);
    console.log(`Chunks: ${report.summary.chunkCount}`);
    console.log(`JavaScript: ${report.summary.jsSize}`);
    console.log(`CSS: ${report.summary.cssSize}`);
    console.log(`Images: ${report.summary.imageSize}`);

    console.log('\n🎯 Performance Budgets:');
    console.log(`JS Budget: ${report.budgets.js} per bundle`);
    console.log(`CSS Budget: ${report.budgets.css} per bundle`);
    console.log(`Image Budget: ${report.budgets.image} per image`);
    console.log(`Total Budget: ${report.budgets.total}`);
    console.log(`Chunk Limit: ${report.budgets.chunks}`);

    // Show largest assets
    if (report.largestAssets.length > 0) {
      console.log('\n📦 Largest Assets:');
      report.largestAssets.slice(0, 5).forEach((asset, index) => {
        console.log(
          `  ${index + 1}. ${asset.path} - ${asset.sizeFormatted} (${asset.gzipSizeFormatted} gzipped)`
        );
      });
    }

    // Show warnings
    if (report.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      report.warnings.forEach((warning) => {
        console.log(`  ${warning.message}`);
        if (warning.actual && warning.budget) {
          console.log(`    Size: ${warning.actual} / Budget: ${warning.budget}`);
        }
      });
    }

    // Show errors
    if (report.errors.length > 0) {
      console.log('\n❌ Errors:');
      report.errors.forEach((error) => {
        console.log(`  ${error.message}`);
        if (error.actual && error.budget) {
          console.log(`    Size: ${error.actual} / Budget: ${error.budget}`);
        }
      });
    }

    // Show suggestions
    if (report.suggestions.length > 0) {
      console.log('\n💡 Optimization Suggestions:');
      report.suggestions.forEach((suggestion) => {
        console.log(`  ${suggestion.message}`);
        if (suggestion.assets) {
          suggestion.assets.forEach((asset) => {
            console.log(`    - ${asset}`);
          });
        }
      });
    }

    // Final result
    if (report.passed) {
      console.log('\n✅ All bundle size budgets passed!');
    } else {
      console.log('\n❌ Bundle size budget violations detected!');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error checking bundle sizes:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

export { BUDGET_CONFIG, BundleSizeAnalyzer };
