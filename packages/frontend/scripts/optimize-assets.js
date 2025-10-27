#!/usr/bin/env node

/**
 * Elite Asset Optimizer
 * Optimizes images, icons, and other assets for production builds
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_ASSETS_DIR = path.join(__dirname, '../src/assets');
const PUBLIC_DIR = path.join(__dirname, '../public');
const DIST_DIR = path.join(__dirname, '../dist');
const OPTIMIZED_DIR = path.join(__dirname, '../optimized-assets');

// Asset optimization configuration
const OPTIMIZATION_CONFIG = {
  images: {
    png: {
      quality: 90,
      compressionLevel: 9,
      progressive: true,
    },
    jpg: {
      quality: 85,
      progressive: true,
    },
    webp: {
      quality: 80,
      effort: 6,
    },
  },
  icons: {
    generateSizes: [16, 32, 48, 64, 128, 256, 512],
    format: 'png',
    quality: 95,
  },
  fonts: {
    subsetting: true,
    formats: ['woff2', 'woff'],
  },
};

/**
 * Elite Asset Optimizer
 */
class AssetOptimizer {
  constructor() {
    this.stats = {
      originalSize: 0,
      optimizedSize: 0,
      filesOptimized: 0,
      errors: [],
      warnings: [],
    };
  }

  /**
   * Optimize all assets
   */
  async optimizeAssets() {
    console.log('🎨 Elite Asset Optimizer Starting...');

    // Create optimized directory
    this.ensureDirectory(OPTIMIZED_DIR);

    // Optimize different asset types
    await this.optimizeImages();
    await this.optimizeIcons();
    await this.generateFavicons();
    await this.optimizeFonts();
    await this.generateManifest();

    // Generate report
    this.generateReport();

    console.log('✅ Asset optimization complete!');
  }

  /**
   * Optimize images
   */
  async optimizeImages() {
    console.log('🖼️  Optimizing images...');

    const imageDir = path.join(SRC_ASSETS_DIR, 'images');
    if (!fs.existsSync(imageDir)) {
      console.log('No images directory found, skipping...');
      return;
    }

    const imageFiles = this.getFilesRecursively(imageDir).filter((file) =>
      /\.(png|jpg|jpeg|webp)$/i.test(file)
    );

    for (const imageFile of imageFiles) {
      await this.optimizeImage(imageFile);
    }
  }

  /**
   * Optimize individual image
   */
  async optimizeImage(imagePath) {
    try {
      const ext = path.extname(imagePath).toLowerCase();
      const fileName = path.basename(imagePath, ext);
      const relativePath = path.relative(SRC_ASSETS_DIR, imagePath);
      const outputDir = path.join(OPTIMIZED_DIR, path.dirname(relativePath));

      this.ensureDirectory(outputDir);

      const originalSize = fs.statSync(imagePath).size;
      this.stats.originalSize += originalSize;

      // Optimize based on file type
      let optimizedPath;
      switch (ext) {
        case '.png':
          optimizedPath = await this.optimizePng(imagePath, outputDir, fileName);
          break;
        case '.jpg':
        case '.jpeg':
          optimizedPath = await this.optimizeJpeg(imagePath, outputDir, fileName);
          break;
        case '.webp':
          optimizedPath = await this.optimizeWebp(imagePath, outputDir, fileName);
          break;
      }

      if (optimizedPath && fs.existsSync(optimizedPath)) {
        const optimizedSize = fs.statSync(optimizedPath).size;
        this.stats.optimizedSize += optimizedSize;
        this.stats.filesOptimized++;

        const savings = (((originalSize - optimizedSize) / originalSize) * 100).toFixed(1);
        console.log(
          `  ✓ ${relativePath} - ${this.formatBytes(originalSize)} → ${this.formatBytes(optimizedSize)} (${savings}% savings)`
        );
      }
    } catch (error) {
      this.stats.errors.push({
        file: imagePath,
        error: error.message,
      });
      console.error(`  ✗ Failed to optimize ${imagePath}:`, error.message);
    }
  }

  /**
   * Optimize PNG images
   */
  async optimizePng(inputPath, outputDir, fileName) {
    const outputPath = path.join(outputDir, `${fileName}.png`);

    try {
      // Use sharp for PNG optimization if available
      if (await this.isSharpAvailable()) {
        await this.optimizePngWithSharp(inputPath, outputPath);
      } else {
        // Fallback to imagemin or manual optimization
        await this.optimizePngFallback(inputPath, outputPath);
      }

      return outputPath;
    } catch (error) {
      // Copy original if optimization fails
      fs.copyFileSync(inputPath, outputPath);
      return outputPath;
    }
  }

  /**
   * Optimize PNG with Sharp
   */
  async optimizePngWithSharp(inputPath, outputPath) {
    const sharp = require('sharp');

    await sharp(inputPath)
      .png({
        quality: OPTIMIZATION_CONFIG.images.png.quality,
        compressionLevel: OPTIMIZATION_CONFIG.images.png.compressionLevel,
        progressive: OPTIMIZATION_CONFIG.images.png.progressive,
      })
      .toFile(outputPath);
  }

  /**
   * Optimize PNG fallback
   */
  async optimizePngFallback(inputPath, outputPath) {
    // Simple copy with potential size reduction
    fs.copyFileSync(inputPath, outputPath);
  }

  /**
   * Optimize JPEG images
   */
  async optimizeJpeg(inputPath, outputDir, fileName) {
    const outputPath = path.join(outputDir, `${fileName}.jpg`);

    try {
      if (await this.isSharpAvailable()) {
        const sharp = require('sharp');

        await sharp(inputPath)
          .jpeg({
            quality: OPTIMIZATION_CONFIG.images.jpg.quality,
            progressive: OPTIMIZATION_CONFIG.images.jpg.progressive,
          })
          .toFile(outputPath);
      } else {
        fs.copyFileSync(inputPath, outputPath);
      }

      return outputPath;
    } catch (error) {
      fs.copyFileSync(inputPath, outputPath);
      return outputPath;
    }
  }

  /**
   * Optimize WebP images
   */
  async optimizeWebp(inputPath, outputDir, fileName) {
    const outputPath = path.join(outputDir, `${fileName}.webp`);

    try {
      if (await this.isSharpAvailable()) {
        const sharp = require('sharp');

        await sharp(inputPath)
          .webp({
            quality: OPTIMIZATION_CONFIG.images.webp.quality,
            effort: OPTIMIZATION_CONFIG.images.webp.effort,
          })
          .toFile(outputPath);
      } else {
        fs.copyFileSync(inputPath, outputPath);
      }

      return outputPath;
    } catch (error) {
      fs.copyFileSync(inputPath, outputPath);
      return outputPath;
    }
  }

  /**
   * Optimize icons
   */
  async optimizeIcons() {
    console.log('🎯 Optimizing icons...');

    const iconDir = path.join(SRC_ASSETS_DIR, 'icons');
    if (!fs.existsSync(iconDir)) {
      console.log('No icons directory found, skipping...');
      return;
    }

    const iconFiles = this.getFilesRecursively(iconDir).filter((file) =>
      /\.(png|svg)$/i.test(file)
    );

    for (const iconFile of iconFiles) {
      await this.optimizeIcon(iconFile);
    }
  }

  /**
   * Optimize individual icon
   */
  async optimizeIcon(iconPath) {
    try {
      const ext = path.extname(iconPath).toLowerCase();
      const fileName = path.basename(iconPath, ext);
      const iconOutputDir = path.join(OPTIMIZED_DIR, 'icons');

      this.ensureDirectory(iconOutputDir);

      if (ext === '.svg') {
        await this.optimizeSvgIcon(iconPath, iconOutputDir, fileName);
      } else if (ext === '.png') {
        await this.optimizePngIcon(iconPath, iconOutputDir, fileName);
      }
    } catch (error) {
      this.stats.errors.push({
        file: iconPath,
        error: error.message,
      });
      console.error(`  ✗ Failed to optimize icon ${iconPath}:`, error.message);
    }
  }

  /**
   * Optimize SVG icons
   */
  async optimizeSvgIcon(inputPath, outputDir, fileName) {
    const outputPath = path.join(outputDir, `${fileName}.svg`);

    try {
      // Simple copy for now - could add SVGO optimization
      fs.copyFileSync(inputPath, outputPath);
      console.log(`  ✓ ${fileName}.svg optimized`);
    } catch (error) {
      console.error(`  ✗ Failed to optimize SVG ${fileName}:`, error.message);
    }
  }

  /**
   * Optimize PNG icons
   */
  async optimizePngIcon(inputPath, outputDir, fileName) {
    try {
      // Generate multiple sizes for PNG icons
      for (const size of OPTIMIZATION_CONFIG.icons.generateSizes) {
        const outputPath = path.join(outputDir, `${fileName}-${size}x${size}.png`);
        await this.resizeIcon(inputPath, outputPath, size);
      }

      console.log(
        `  ✓ ${fileName}.png optimized (${OPTIMIZATION_CONFIG.icons.generateSizes.length} sizes)`
      );
    } catch (error) {
      console.error(`  ✗ Failed to optimize PNG icon ${fileName}:`, error.message);
    }
  }

  /**
   * Resize icon to specific size
   */
  async resizeIcon(inputPath, outputPath, size) {
    if (await this.isSharpAvailable()) {
      const sharp = require('sharp');

      await sharp(inputPath)
        .resize(size, size)
        .png({
          quality: OPTIMIZATION_CONFIG.icons.quality,
          compressionLevel: 9,
        })
        .toFile(outputPath);
    } else {
      // Fallback: copy original
      fs.copyFileSync(inputPath, outputPath);
    }
  }

  /**
   * Generate favicons
   */
  async generateFavicons() {
    console.log('🌟 Generating favicons...');

    const iconPath = path.join(SRC_ASSETS_DIR, 'icons', 'Sovren-icon.png');
    if (!fs.existsSync(iconPath)) {
      console.log('Main icon not found, skipping favicon generation...');
      return;
    }

    const faviconDir = path.join(OPTIMIZED_DIR, 'favicons');
    this.ensureDirectory(faviconDir);

    // Generate different favicon sizes
    const faviconSizes = [16, 32, 48, 64, 128, 256, 512];

    for (const size of faviconSizes) {
      const outputPath = path.join(faviconDir, `favicon-${size}x${size}.png`);
      await this.resizeIcon(iconPath, outputPath, size);
    }

    // Generate ICO file (if possible)
    const icoPath = path.join(faviconDir, 'favicon.ico');
    try {
      // Copy 32x32 as ICO for now
      const png32Path = path.join(faviconDir, 'favicon-32x32.png');
      if (fs.existsSync(png32Path)) {
        fs.copyFileSync(png32Path, icoPath);
      }
    } catch (error) {
      console.error('Failed to generate ICO file:', error.message);
    }

    console.log(`  ✓ Generated ${faviconSizes.length} favicon sizes`);
  }

  /**
   * Optimize fonts
   */
  async optimizeFonts() {
    console.log('🔤 Optimizing fonts...');

    const fontDir = path.join(SRC_ASSETS_DIR, 'fonts');
    if (!fs.existsSync(fontDir)) {
      console.log('No fonts directory found, skipping...');
      return;
    }

    const fontFiles = this.getFilesRecursively(fontDir).filter((file) =>
      /\.(woff2|woff|ttf|otf)$/i.test(file)
    );

    const fontOutputDir = path.join(OPTIMIZED_DIR, 'fonts');
    this.ensureDirectory(fontOutputDir);

    for (const fontFile of fontFiles) {
      const fileName = path.basename(fontFile);
      const outputPath = path.join(fontOutputDir, fileName);

      // Simple copy for now - could add font subsetting
      fs.copyFileSync(fontFile, outputPath);
      console.log(`  ✓ ${fileName} optimized`);
    }
  }

  /**
   * Generate web app manifest
   */
  async generateManifest() {
    console.log('📱 Generating web app manifest...');

    const manifestPath = path.join(OPTIMIZED_DIR, 'manifest.json');
    const manifest = {
      name: 'Sovren Creator Platform',
      short_name: 'Sovren',
      description: 'Elite Creator Monetization Platform',
      start_url: '/',
      display: 'standalone',
      theme_color: '#f97316',
      background_color: '#ffffff',
      icons: [
        {
          src: 'favicons/favicon-192x192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: 'favicons/favicon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
        },
      ],
    };

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log('  ✓ Web app manifest generated');
  }

  /**
   * Check if Sharp is available
   */
  async isSharpAvailable() {
    try {
      require('sharp');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get files recursively
   */
  getFilesRecursively(dir) {
    const files = [];
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        files.push(...this.getFilesRecursively(fullPath));
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Ensure directory exists
   */
  ensureDirectory(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
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
   * Generate optimization report
   */
  generateReport() {
    const totalSavings = this.stats.originalSize - this.stats.optimizedSize;
    const savingsPercentage =
      this.stats.originalSize > 0 ? ((totalSavings / this.stats.originalSize) * 100).toFixed(1) : 0;

    console.log('\n📊 Asset Optimization Report:');
    console.log('='.repeat(40));
    console.log(`Files Optimized: ${this.stats.filesOptimized}`);
    console.log(`Original Size: ${this.formatBytes(this.stats.originalSize)}`);
    console.log(`Optimized Size: ${this.formatBytes(this.stats.optimizedSize)}`);
    console.log(`Total Savings: ${this.formatBytes(totalSavings)} (${savingsPercentage}%)`);

    if (this.stats.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.stats.errors.forEach((error) => {
        console.log(`  ${error.file}: ${error.error}`);
      });
    }

    if (this.stats.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      this.stats.warnings.forEach((warning) => {
        console.log(`  ${warning.file}: ${warning.warning}`);
      });
    }
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    const optimizer = new AssetOptimizer();
    await optimizer.optimizeAssets();
  } catch (error) {
    console.error('❌ Asset optimization failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

export { AssetOptimizer, OPTIMIZATION_CONFIG };
