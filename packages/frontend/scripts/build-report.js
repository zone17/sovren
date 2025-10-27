#!/usr/bin/env node

/**
 * Elite Build Performance Report Generator
 * Analyzes build artifacts and generates comprehensive performance reports
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUILD_REPORT_VERSION = '1.0.0';
const DIST_DIR = path.join(__dirname, '../dist');
const REPORT_DIR = path.join(__dirname, '../reports');

// Ensure reports directory exists
if (!fs.existsSync(REPORT_DIR)) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
}

/**
 * Elite Build Metrics Collection
 */
class BuildMetricsCollector {
  constructor() {
    this.metrics = {
      timestamp: new Date().toISOString(),
      buildTime: 0,
      totalAssets: 0,
      totalSize: 0,
      gzipSize: 0,
      chunks: {},
      assets: {},
      performance: {},
      recommendations: [],
    };
  }

  /**
   * Analyze build artifacts
   */
  async analyzeBuildArtifacts() {
    console.log('🔍 Analyzing build artifacts...');

    if (!fs.existsSync(DIST_DIR)) {
      throw new Error('Build directory not found. Run npm run build first.');
    }

    const assets = this.getAllAssets(DIST_DIR);
    this.metrics.totalAssets = assets.length;

    // Analyze each asset
    for (const asset of assets) {
      const assetPath = path.join(DIST_DIR, asset);
      const stats = fs.statSync(assetPath);
      const size = stats.size;

      this.metrics.totalSize += size;
      this.metrics.assets[asset] = {
        size,
        gzipSize: this.getGzipSize(assetPath),
        type: this.getAssetType(asset),
        category: this.getAssetCategory(asset),
      };
    }

    // Analyze chunk distribution
    this.analyzeChunkDistribution();

    // Performance analysis
    this.analyzePerformance();

    // Generate recommendations
    this.generateRecommendations();

    console.log('✅ Build analysis complete');
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
      '.svg': 'icon',
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
   * Get asset category
   */
  getAssetCategory(asset) {
    if (asset.includes('react-vendor')) return 'vendor';
    if (asset.includes('router')) return 'routing';
    if (asset.includes('redux')) return 'state';
    if (asset.includes('ui-components')) return 'ui';
    if (asset.includes('utils')) return 'utilities';
    if (asset.includes('crypto')) return 'crypto';
    if (asset.includes('editor')) return 'editor';
    if (asset.includes('charts')) return 'charts';
    if (asset.includes('animations')) return 'animations';
    if (asset.includes('api')) return 'api';
    if (asset.includes('ipfs')) return 'ipfs';
    if (asset.includes('payments')) return 'payments';
    if (asset.includes('icons')) return 'icons';
    if (asset.includes('monitoring')) return 'monitoring';
    return 'app';
  }

  /**
   * Analyze chunk distribution
   */
  analyzeChunkDistribution() {
    const chunks = {};

    for (const [asset, info] of Object.entries(this.metrics.assets)) {
      if (info.type === 'javascript') {
        const category = info.category;
        if (!chunks[category]) {
          chunks[category] = {
            count: 0,
            totalSize: 0,
            totalGzipSize: 0,
            assets: [],
          };
        }

        chunks[category].count++;
        chunks[category].totalSize += info.size;
        chunks[category].totalGzipSize += info.gzipSize;
        chunks[category].assets.push(asset);
      }
    }

    this.metrics.chunks = chunks;
  }

  /**
   * Analyze performance characteristics
   */
  analyzePerformance() {
    const jsAssets = Object.entries(this.metrics.assets)
      .filter(([_, info]) => info.type === 'javascript')
      .sort(([_a, a], [_b, b]) => b.size - a.size);

    const cssAssets = Object.entries(this.metrics.assets)
      .filter(([_, info]) => info.type === 'stylesheet')
      .sort(([_a, a], [_b, b]) => b.size - a.size);

    const imageAssets = Object.entries(this.metrics.assets)
      .filter(([_, info]) => info.type === 'image')
      .sort(([_a, a], [_b, b]) => b.size - a.size);

    this.metrics.performance = {
      largestJsBundle: jsAssets[0] || null,
      largestCssBundle: cssAssets[0] || null,
      largestImage: imageAssets[0] || null,
      totalJsSize: jsAssets.reduce((sum, [_, info]) => sum + info.size, 0),
      totalCssSize: cssAssets.reduce((sum, [_, info]) => sum + info.size, 0),
      totalImageSize: imageAssets.reduce((sum, [_, info]) => sum + info.size, 0),
      compressionRatio: this.calculateCompressionRatio(),
    };
  }

  /**
   * Calculate compression ratio
   */
  calculateCompressionRatio() {
    const totalSize = this.metrics.totalSize;
    const totalGzipSize = Object.values(this.metrics.assets).reduce(
      (sum, info) => sum + info.gzipSize,
      0
    );

    return totalSize > 0 ? totalGzipSize / totalSize : 0;
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations() {
    const recommendations = [];

    // Check for oversized assets
    const oversizedAssets = Object.entries(this.metrics.assets).filter(
      ([_, info]) => info.size > 250 * 1024
    ); // 250KB threshold

    if (oversizedAssets.length > 0) {
      recommendations.push({
        type: 'size',
        priority: 'high',
        message: `${oversizedAssets.length} assets exceed 250KB threshold`,
        assets: oversizedAssets.map(([asset]) => asset),
      });
    }

    // Check for large images
    const largeImages = Object.entries(this.metrics.assets).filter(
      ([_, info]) => info.type === 'image' && info.size > 100 * 1024
    );

    if (largeImages.length > 0) {
      recommendations.push({
        type: 'image',
        priority: 'medium',
        message: `${largeImages.length} images exceed 100KB threshold`,
        assets: largeImages.map(([asset]) => asset),
      });
    }

    // Check compression efficiency
    if (this.metrics.performance.compressionRatio > 0.7) {
      recommendations.push({
        type: 'compression',
        priority: 'medium',
        message: 'Poor compression ratio detected. Consider optimizing assets.',
      });
    }

    // Check chunk distribution
    const oversizedChunks = Object.entries(this.metrics.chunks).filter(
      ([_, info]) => info.totalSize > 300 * 1024
    );

    if (oversizedChunks.length > 0) {
      recommendations.push({
        type: 'chunks',
        priority: 'medium',
        message: `${oversizedChunks.length} chunk categories exceed 300KB`,
        categories: oversizedChunks.map(([category]) => category),
      });
    }

    this.metrics.recommendations = recommendations;
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
   * Generate detailed report
   */
  generateReport() {
    const report = {
      version: BUILD_REPORT_VERSION,
      timestamp: this.metrics.timestamp,
      summary: {
        totalAssets: this.metrics.totalAssets,
        totalSize: this.formatBytes(this.metrics.totalSize),
        totalGzipSize: this.formatBytes(
          Object.values(this.metrics.assets).reduce((sum, info) => sum + info.gzipSize, 0)
        ),
        compressionRatio: `${(this.metrics.performance.compressionRatio * 100).toFixed(1)}%`,
      },
      performance: {
        largestJsBundle: this.metrics.performance.largestJsBundle
          ? {
              name: this.metrics.performance.largestJsBundle[0],
              size: this.formatBytes(this.metrics.performance.largestJsBundle[1].size),
              gzipSize: this.formatBytes(this.metrics.performance.largestJsBundle[1].gzipSize),
            }
          : null,
        totalJsSize: this.formatBytes(this.metrics.performance.totalJsSize),
        totalCssSize: this.formatBytes(this.metrics.performance.totalCssSize),
        totalImageSize: this.formatBytes(this.metrics.performance.totalImageSize),
      },
      chunks: Object.entries(this.metrics.chunks).map(([category, info]) => ({
        category,
        count: info.count,
        size: this.formatBytes(info.totalSize),
        gzipSize: this.formatBytes(info.totalGzipSize),
      })),
      recommendations: this.metrics.recommendations,
    };

    return report;
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🚀 Elite Build Performance Report Generator');
    console.log('='.repeat(50));

    const collector = new BuildMetricsCollector();
    await collector.analyzeBuildArtifacts();

    const report = collector.generateReport();

    // Save report
    const reportPath = path.join(REPORT_DIR, `build-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Display summary
    console.log('\n📊 Build Performance Summary:');
    console.log(`Total Assets: ${report.summary.totalAssets}`);
    console.log(`Total Size: ${report.summary.totalSize}`);
    console.log(`Gzip Size: ${report.summary.totalGzipSize}`);
    console.log(`Compression: ${report.summary.compressionRatio}`);

    if (report.performance.largestJsBundle) {
      console.log(
        `Largest JS Bundle: ${report.performance.largestJsBundle.name} (${report.performance.largestJsBundle.size})`
      );
    }

    console.log('\n📦 Chunk Distribution:');
    report.chunks.forEach((chunk) => {
      console.log(
        `  ${chunk.category}: ${chunk.count} files, ${chunk.size} (${chunk.gzipSize} gzipped)`
      );
    });

    if (report.recommendations.length > 0) {
      console.log('\n⚠️  Optimization Recommendations:');
      report.recommendations.forEach((rec) => {
        console.log(`  [${rec.priority.toUpperCase()}] ${rec.message}`);
      });
    }

    console.log(`\n📋 Full report saved to: ${reportPath}`);
    console.log('✅ Build performance analysis complete!');
  } catch (error) {
    console.error('❌ Error generating build report:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

export { BuildMetricsCollector };
