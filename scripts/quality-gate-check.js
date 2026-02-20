#!/usr/bin/env node

/**
 * Quality Gate Validation Script
 *
 * This script validates that all code quality standards are met before
 * allowing code to be committed or deployed. It serves as a comprehensive
 * quality gate that enforces our elite engineering standards.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// Configuration
const QUALITY_GATES = {
  linting: {
    name: 'ESLint Code Quality',
    command: 'npm run lint',
    required: true,
    weight: 20,
  },
  formatting: {
    name: 'Prettier Code Formatting',
    command: 'npm run format:check',
    required: true,
    weight: 10,
  },
  typeCheck: {
    name: 'TypeScript Type Checking',
    command: 'npm run type-check',
    required: true,
    weight: 15,
  },
  unitTests: {
    name: 'Unit Tests',
    command: 'npm run test:unit',
    required: true,
    weight: 25,
  },
  coverage: {
    name: 'Test Coverage',
    command: 'npm run test:coverage:check',
    required: true,
    weight: 20,
  },
  security: {
    name: 'Security Audit',
    command: 'npm audit --audit-level=high',
    required: true,
    weight: 10,
  },
};

const COVERAGE_THRESHOLDS = {
  statements: 95,
  branches: 90,
  functions: 100,
  lines: 95,
};

class QualityGateValidator {
  constructor() {
    this.results = [];
    this.totalScore = 0;
    this.maxScore = 0;
    this.failed = false;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      info: chalk.blue,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red,
    };

    console.log(`[${timestamp}] ${colors[type](message)}`);
  }

  async runCommand(command, description) {
    this.log(`Running: ${description}`, 'info');

    try {
      const output = execSync(command, {
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 300000, // 5 minutes
      });

      this.log(`✅ ${description} passed`, 'success');
      return { success: true, output };
    } catch (error) {
      this.log(`❌ ${description} failed`, 'error');
      this.log(`Error: ${error.message}`, 'error');

      if (error.stdout) {
        this.log(`stdout: ${error.stdout}`, 'error');
      }

      if (error.stderr) {
        this.log(`stderr: ${error.stderr}`, 'error');
      }

      return { success: false, error: error.message };
    }
  }

  async validateQualityGate(gateName, config) {
    const startTime = Date.now();
    this.log(`\n🔍 Validating ${config.name}...`, 'info');

    const result = await this.runCommand(config.command, config.name);
    const duration = Date.now() - startTime;

    const gateResult = {
      name: config.name,
      success: result.success,
      required: config.required,
      weight: config.weight,
      duration,
      error: result.error,
    };

    this.results.push(gateResult);

    if (result.success) {
      this.totalScore += config.weight;
    } else if (config.required) {
      this.failed = true;
    }

    this.maxScore += config.weight;

    return gateResult;
  }

  async validateCoverage() {
    this.log('\n📊 Validating test coverage...', 'info');

    const coverageFile = path.join(process.cwd(), 'coverage', 'coverage-summary.json');

    if (!fs.existsSync(coverageFile)) {
      this.log('❌ Coverage file not found. Run tests first.', 'error');
      return false;
    }

    try {
      const coverage = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
      const total = coverage.total;

      let coveragePassed = true;

      for (const [metric, threshold] of Object.entries(COVERAGE_THRESHOLDS)) {
        const actual = total[metric].pct;

        if (actual < threshold) {
          this.log(`❌ ${metric} coverage: ${actual}% (required: ${threshold}%)`, 'error');
          coveragePassed = false;
        } else {
          this.log(`✅ ${metric} coverage: ${actual}% (required: ${threshold}%)`, 'success');
        }
      }

      return coveragePassed;
    } catch (error) {
      this.log(`❌ Error reading coverage file: ${error.message}`, 'error');
      return false;
    }
  }

  async validateFileStructure() {
    this.log('\n📁 Validating file structure...', 'info');

    const requiredFiles = [
      '.eslintrc.json',
      '.prettierrc.json',
      'vitest.config.ts',
      'tsconfig.json',
      'package.json',
      'CHANGELOG.md',
      'README.md',
    ];

    const requiredDirectories = [
      'packages/backend/src',
      'packages/frontend/src',
      'packages/shared/src',
      'docs',
      'scripts',
    ];

    let structureValid = true;

    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        this.log(`❌ Required file missing: ${file}`, 'error');
        structureValid = false;
      } else {
        this.log(`✅ Required file exists: ${file}`, 'success');
      }
    }

    for (const dir of requiredDirectories) {
      if (!fs.existsSync(dir)) {
        this.log(`❌ Required directory missing: ${dir}`, 'error');
        structureValid = false;
      } else {
        this.log(`✅ Required directory exists: ${dir}`, 'success');
      }
    }

    return structureValid;
  }

  async validateDocumentation() {
    this.log('\n📚 Validating documentation...', 'info');

    const changelogPath = 'CHANGELOG.md';

    if (!fs.existsSync(changelogPath)) {
      this.log('❌ CHANGELOG.md not found', 'error');
      return false;
    }

    const changelog = fs.readFileSync(changelogPath, 'utf8');
    const today = new Date().toISOString().split('T')[0];

    // Check if changelog has been updated recently (within last 7 days)
    const recentDatePattern = new RegExp(`\\[?\\d{4}-\\d{2}-\\d{2}\\]?`, 'g');
    const dates = changelog.match(recentDatePattern) || [];

    if (dates.length === 0) {
      this.log('❌ No dates found in CHANGELOG.md', 'error');
      return false;
    }

    this.log('✅ CHANGELOG.md exists and has date entries', 'success');
    return true;
  }

  generateReport() {
    this.log('\n📋 Quality Gate Report', 'info');
    this.log('='.repeat(50), 'info');

    for (const result of this.results) {
      const status = result.success ? '✅' : '❌';
      const duration = `${result.duration}ms`;
      const weight = `(${result.weight}pts)`;

      this.log(
        `${status} ${result.name} ${weight} - ${duration}`,
        result.success ? 'success' : 'error'
      );

      if (!result.success && result.error) {
        this.log(`   Error: ${result.error}`, 'error');
      }
    }

    this.log('='.repeat(50), 'info');

    const scorePercentage = Math.round((this.totalScore / this.maxScore) * 100);
    this.log(
      `Score: ${this.totalScore}/${this.maxScore} (${scorePercentage}%)`,
      scorePercentage >= 90 ? 'success' : 'warning'
    );

    if (this.failed) {
      this.log('❌ Quality gate FAILED - Required checks failed', 'error');
      return false;
    } else if (scorePercentage < 90) {
      this.log('⚠️  Quality gate WARNING - Score below 90%', 'warning');
      return false;
    } else {
      this.log('✅ Quality gate PASSED - All checks successful!', 'success');
      return true;
    }
  }

  async run() {
    this.log('🚀 Starting Quality Gate Validation', 'info');
    this.log(`Node.js version: ${process.version}`, 'info');
    this.log(`Working directory: ${process.cwd()}`, 'info');

    const startTime = Date.now();

    try {
      // Validate file structure
      const structureValid = await this.validateFileStructure();
      if (!structureValid) {
        this.failed = true;
      }

      // Validate documentation
      const docsValid = await this.validateDocumentation();
      if (!docsValid) {
        this.failed = true;
      }

      // Run quality gates
      for (const [gateName, config] of Object.entries(QUALITY_GATES)) {
        await this.validateQualityGate(gateName, config);
      }

      // Validate coverage separately for detailed reporting
      const coverageValid = await this.validateCoverage();
      if (!coverageValid) {
        this.failed = true;
      }

      const totalDuration = Date.now() - startTime;
      this.log(`\nTotal validation time: ${totalDuration}ms`, 'info');

      const success = this.generateReport();

      if (!success) {
        process.exit(1);
      }

      this.log('\n🎉 All quality gates passed! Ready for deployment.', 'success');
    } catch (error) {
      this.log(`💥 Unexpected error: ${error.message}`, 'error');
      console.error(error);
      process.exit(1);
    }
  }
}

// CLI execution
if (require.main === module) {
  const validator = new QualityGateValidator();
  validator.run();
}

module.exports = QualityGateValidator;
