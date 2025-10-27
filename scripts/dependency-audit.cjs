#!/usr/bin/env node

/**
 * 🔍 US-202 Dependency Management Overhaul - Comprehensive Audit Script
 *
 * This script performs a complete audit of all dependencies in the Sovren frontend
 * to identify missing packages, version conflicts, and optimization opportunities.
 *
 * @author Sovren Engineering Team
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class DependencyAuditor {
  constructor() {
    this.sourceDir = path.join(__dirname, '../packages/frontend/src');
    this.packageJsonPath = path.join(__dirname, '../packages/frontend/package.json');
    this.results = {
      imports: new Set(),
      missing: [],
      unused: [],
      conflicts: [],
      security: [],
      optimization: [],
    };
    this.packageJson = null;
    this.installedPackages = new Set();
  }

  /**
   * Main audit process
   */
  async audit() {
    console.log('🔍 Starting Comprehensive Dependency Audit...\n');

    try {
      this.loadPackageJson();
      this.scanSourceFiles();
      this.identifyMissingDependencies();
      this.identifyUnusedDependencies();
      this.checkForConflicts();
      await this.securityAudit();
      this.generateOptimizationRecommendations();
      this.generateReport();
    } catch (error) {
      console.error('❌ Audit failed:', error.message);
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

      // Collect all installed packages
      const deps = this.packageJson.dependencies || {};
      const devDeps = this.packageJson.devDependencies || {};
      const optDeps = this.packageJson.optionalDependencies || {};

      Object.keys(deps).forEach((pkg) => this.installedPackages.add(pkg));
      Object.keys(devDeps).forEach((pkg) => this.installedPackages.add(pkg));
      Object.keys(optDeps).forEach((pkg) => this.installedPackages.add(pkg));

      console.log(`📦 Loaded package.json with ${this.installedPackages.size} packages`);
    } catch (error) {
      throw new Error(`Failed to load package.json: ${error.message}`);
    }
  }

  /**
   * Recursively scan source files for import statements
   */
  scanSourceFiles() {
    console.log('📁 Scanning source files for imports...');

    const scanDir = (dir) => {
      const entries = fs.readdirSync(dir);

      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
          scanDir(fullPath);
        } else if (stat.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry)) {
          this.scanFile(fullPath);
        }
      }
    };

    scanDir(this.sourceDir);
    console.log(`📊 Found ${this.results.imports.size} unique imports`);
  }

  /**
   * Scan individual file for import statements
   */
  scanFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      for (const line of lines) {
        // Match various import patterns
        const importPatterns = [
          /import\s+.*\s+from\s+['"`]([^'"`]+)['"`]/,
          /import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/,
          /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/,
        ];

        for (const pattern of importPatterns) {
          const match = line.match(pattern);
          if (match) {
            const importPath = match[1];

            // Only track external packages (not relative imports)
            if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
              // Extract package name (handle scoped packages)
              const packageName = importPath.startsWith('@')
                ? importPath.split('/').slice(0, 2).join('/')
                : importPath.split('/')[0];

              this.results.imports.add(packageName);
            }
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️  Failed to scan ${filePath}: ${error.message}`);
    }
  }

  /**
   * Identify missing dependencies
   */
  identifyMissingDependencies() {
    console.log('🔍 Identifying missing dependencies...');

    for (const importedPackage of this.results.imports) {
      if (!this.installedPackages.has(importedPackage)) {
        this.results.missing.push(importedPackage);
      }
    }

    console.log(`❌ Found ${this.results.missing.length} missing dependencies`);
  }

  /**
   * Identify unused dependencies
   */
  identifyUnusedDependencies() {
    console.log('🧹 Identifying unused dependencies...');

    const allDeps = {
      ...this.packageJson.dependencies,
      ...this.packageJson.devDependencies,
    };

    for (const installedPackage of Object.keys(allDeps)) {
      if (!this.results.imports.has(installedPackage)) {
        // Skip known build tools and configs
        const buildTools = [
          'vite',
          'typescript',
          'eslint',
          '@types/',
          '@vitejs/',
          'autoprefixer',
          'postcss',
          'tailwindcss',
          'jest',
          '@testing-library/',
          '@playwright/',
          '@storybook/',
          'prettier',
          '@babel/',
          'rollup',
        ];

        const isKnownTool = buildTools.some(
          (tool) => installedPackage.startsWith(tool) || installedPackage.includes(tool)
        );

        if (!isKnownTool) {
          this.results.unused.push(installedPackage);
        }
      }
    }

    console.log(`📦 Found ${this.results.unused.length} potentially unused dependencies`);
  }

  /**
   * Check for version conflicts
   */
  checkForConflicts() {
    console.log('⚔️  Checking for version conflicts...');

    // Check for common conflicting patterns
    const deps = this.packageJson.dependencies || {};
    const devDeps = this.packageJson.devDependencies || {};

    // Check React version consistency
    const reactVersion = deps.react;
    const reactDomVersion = deps['react-dom'];
    const reactTypesVersion = devDeps['@types/react'];

    if (reactVersion && reactDomVersion && reactVersion !== reactDomVersion) {
      this.results.conflicts.push({
        type: 'version_mismatch',
        packages: ['react', 'react-dom'],
        versions: [reactVersion, reactDomVersion],
        recommendation: 'Ensure React and React DOM versions match',
      });
    }

    // Check for known incompatible combinations
    if (deps.vite && deps.webpack) {
      this.results.conflicts.push({
        type: 'build_tool_conflict',
        packages: ['vite', 'webpack'],
        recommendation: 'Remove unused build tool to avoid conflicts',
      });
    }
  }

  /**
   * Perform security audit
   */
  async securityAudit() {
    console.log('🔒 Performing security audit...');

    try {
      // Run npm audit
      const auditResult = execSync('npm audit --json', {
        cwd: path.dirname(this.packageJsonPath),
        encoding: 'utf8',
      });

      const audit = JSON.parse(auditResult);

      if (audit.vulnerabilities) {
        Object.entries(audit.vulnerabilities).forEach(([pkg, vuln]) => {
          this.results.security.push({
            package: pkg,
            severity: vuln.severity,
            title: vuln.title,
            recommendation: vuln.fixAvailable ? 'Update available' : 'Manual review required',
          });
        });
      }
    } catch (error) {
      // npm audit returns non-zero exit code when vulnerabilities found
      if (error.stdout) {
        try {
          const audit = JSON.parse(error.stdout);
          if (audit.vulnerabilities) {
            Object.entries(audit.vulnerabilities).forEach(([pkg, vuln]) => {
              this.results.security.push({
                package: pkg,
                severity: vuln.severity,
                title: vuln.title || 'Security vulnerability',
                recommendation: vuln.fixAvailable ? 'Update available' : 'Manual review required',
              });
            });
          }
        } catch (parseError) {
          console.warn('⚠️  Could not parse npm audit output');
        }
      }
    }

    console.log(`🔒 Found ${this.results.security.length} security issues`);
  }

  /**
   * Generate optimization recommendations
   */
  generateOptimizationRecommendations() {
    console.log('⚡ Generating optimization recommendations...');

    // Check for large packages that could be replaced
    const largeDeps = [
      { name: 'moment', alternative: 'date-fns', reason: 'Smaller bundle size' },
      { name: 'lodash', alternative: 'lodash-es', reason: 'Better tree shaking' },
      { name: 'axios', alternative: 'fetch API', reason: 'Native browser support' },
    ];

    largeDeps.forEach(({ name, alternative, reason }) => {
      if (this.installedPackages.has(name)) {
        this.results.optimization.push({
          type: 'bundle_size',
          package: name,
          alternative,
          reason,
          impact: 'Reduced bundle size',
        });
      }
    });

    // Check for missing peer dependencies
    const importedPackages = Array.from(this.results.imports);
    importedPackages.forEach((pkg) => {
      if (pkg.startsWith('@radix-ui/') && !this.installedPackages.has(pkg)) {
        this.results.optimization.push({
          type: 'missing_ui_component',
          package: pkg,
          reason: 'Required for UI component system',
          impact: 'Fix missing component imports',
        });
      }
    });
  }

  /**
   * Generate comprehensive audit report
   */
  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 DEPENDENCY AUDIT REPORT');
    console.log('='.repeat(80));

    console.log(`\n🔍 AUDIT SUMMARY:`);
    console.log(`   Total Imports Found: ${this.results.imports.size}`);
    console.log(`   Installed Packages: ${this.installedPackages.size}`);
    console.log(`   Missing Dependencies: ${this.results.missing.length}`);
    console.log(`   Unused Dependencies: ${this.results.unused.length}`);
    console.log(`   Version Conflicts: ${this.results.conflicts.length}`);
    console.log(`   Security Issues: ${this.results.security.length}`);
    console.log(`   Optimization Opportunities: ${this.results.optimization.length}`);

    if (this.results.missing.length > 0) {
      console.log(`\n❌ MISSING DEPENDENCIES:`);
      this.results.missing.forEach((pkg) => {
        console.log(`   • ${pkg}`);
      });
    }

    if (this.results.unused.length > 0) {
      console.log(`\n📦 POTENTIALLY UNUSED DEPENDENCIES:`);
      this.results.unused.forEach((pkg) => {
        console.log(`   • ${pkg}`);
      });
    }

    if (this.results.conflicts.length > 0) {
      console.log(`\n⚔️  VERSION CONFLICTS:`);
      this.results.conflicts.forEach((conflict) => {
        console.log(`   • ${conflict.type}: ${conflict.packages.join(', ')}`);
        console.log(`     Recommendation: ${conflict.recommendation}`);
      });
    }

    if (this.results.security.length > 0) {
      console.log(`\n🔒 SECURITY ISSUES:`);
      this.results.security.forEach((issue) => {
        console.log(`   • ${issue.package} (${issue.severity}): ${issue.title}`);
        console.log(`     ${issue.recommendation}`);
      });
    }

    if (this.results.optimization.length > 0) {
      console.log(`\n⚡ OPTIMIZATION RECOMMENDATIONS:`);
      this.results.optimization.forEach((opt) => {
        console.log(`   • ${opt.package}: ${opt.reason}`);
        if (opt.alternative) {
          console.log(`     Consider: ${opt.alternative}`);
        }
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Audit Complete');
    console.log('='.repeat(80));

    // Save detailed results to file
    const reportPath = path.join(__dirname, '../docs/dependency-audit-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`📄 Detailed report saved to: ${reportPath}`);
  }
}

// Run audit if called directly
if (require.main === module) {
  const auditor = new DependencyAuditor();
  auditor.audit().catch((error) => {
    console.error('❌ Audit failed:', error);
    process.exit(1);
  });
}

module.exports = DependencyAuditor;
