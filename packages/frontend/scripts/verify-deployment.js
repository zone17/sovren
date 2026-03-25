#!/usr/bin/env node

/**
 * 🚀 Elite Deployment Verification Script
 *
 * Verifies that the build will succeed on Vercel by:
 * 1. Testing production build locally
 * 2. Verifying bundle sizes
 * 3. Checking for missing dependencies
 * 4. Validating configuration files
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 ELITE DEPLOYMENT VERIFICATION STARTING...\n');

/**
 * Run command and handle errors elegantly
 */
function runCommand(command, description) {
  console.log(`⚙️  ${description}...`);
  try {
    const output = execSync(command, {
      stdio: 'pipe',
      encoding: 'utf8',
      cwd: process.cwd(),
    });
    console.log(`✅ ${description} - SUCCESS`);
    return output;
  } catch (error) {
    console.error(`❌ ${description} - FAILED`);
    console.error(error.stdout || error.message);
    process.exit(1);
  }
}

/**
 * Verify package.json dependencies
 */
function verifyDependencies() {
  console.log('📦 Verifying dependencies...');

  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredDeps = ['react', 'react-dom', '@vitejs/plugin-react', 'vite', 'typescript'];

  const missing = requiredDeps.filter(
    (dep) => !packageJson.dependencies[dep] && !packageJson.devDependencies[dep]
  );

  if (missing.length > 0) {
    console.error(`❌ Missing required dependencies: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log('✅ All required dependencies present');
}

/**
 * Verify build configuration
 */
function verifyConfiguration() {
  console.log('⚙️  Verifying build configuration...');

  // Check vite.config.ts exists
  if (!fs.existsSync('vite.config.ts')) {
    console.error('❌ vite.config.ts not found');
    process.exit(1);
  }

  // Check for problematic babel plugins
  const viteConfig = fs.readFileSync('vite.config.ts', 'utf8');
  if (viteConfig.includes('babel-plugin-transform-react-remove-prop-types')) {
    console.error('❌ Problematic babel plugin detected in vite.config.ts');
    process.exit(1);
  }

  console.log('✅ Build configuration verified');
}

/**
 * Test production build
 */
function testBuild() {
  // Clean previous builds
  runCommand('rm -rf dist', 'Cleaning previous builds');

  // Run production build
  runCommand('npm run build', 'Running production build');

  // Verify dist folder exists
  if (!fs.existsSync('dist')) {
    console.error('❌ Build failed - dist folder not created');
    process.exit(1);
  }

  // Verify index.html exists
  if (!fs.existsSync('dist/index.html')) {
    console.error('❌ Build failed - index.html not generated');
    process.exit(1);
  }

  console.log('✅ Production build successful');
}

/**
 * Verify bundle sizes
 */
function verifyBundleSizes() {
  console.log('📊 Verifying bundle sizes...');

  const distPath = path.join(process.cwd(), 'dist');
  const jsFiles = fs
    .readdirSync(path.join(distPath, 'assets'))
    .filter((file) => file.endsWith('.js'))
    .map((file) => {
      const filePath = path.join(distPath, 'assets', file);
      const stats = fs.statSync(filePath);
      return { file, size: stats.size };
    });

  // Check if any JS file is too large (> 1MB)
  const largeFiles = jsFiles.filter((f) => f.size > 1024 * 1024);
  if (largeFiles.length > 0) {
    console.warn(`⚠️  Large bundle detected:`);
    largeFiles.forEach((f) => {
      console.warn(`   ${f.file}: ${(f.size / 1024 / 1024).toFixed(2)}MB`);
    });
  }

  const totalSize = jsFiles.reduce((sum, f) => sum + f.size, 0);
  console.log(`✅ Total JS bundle size: ${(totalSize / 1024).toFixed(2)}KB`);
}

/**
 * Main verification process
 */
async function main() {
  try {
    // Step 1: Verify dependencies
    verifyDependencies();

    // Step 2: Verify configuration
    verifyConfiguration();

    // Step 3: Test build
    testBuild();

    // Step 4: Verify bundle sizes
    verifyBundleSizes();

    console.log('\n🎉 ELITE DEPLOYMENT VERIFICATION COMPLETE!');
    console.log('✅ Build is ready for Vercel deployment');
    console.log('🚀 You can now safely push to main branch');
  } catch (error) {
    console.error('\n❌ DEPLOYMENT VERIFICATION FAILED!');
    console.error(error.message);
    process.exit(1);
  }
}

main();
