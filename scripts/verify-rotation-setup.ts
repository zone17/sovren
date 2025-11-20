#!/usr/bin/env ts-node
/**
 * Verification script for automated credential rotation setup
 * Checks all prerequisites and configuration
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface VerificationResult {
  component: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
}

class RotationSetupVerifier {
  private results: VerificationResult[] = [];

  async verifyAll(): Promise<void> {
    console.log('🔍 Verifying Automated Credential Rotation Setup\n');
    console.log('=' .repeat(50));

    // GitHub Token Rotation Checks
    await this.verifyGitHubSetup();

    // Supabase Rotation Checks
    await this.verifySupabaseSetup();

    // AWS Setup Checks
    await this.verifyAWSSetup();

    // General Environment Checks
    await this.verifyEnvironment();

    // Scripts and Dependencies
    await this.verifyScriptsAndDeps();

    // Report Results
    this.reportResults();
  }

  private async verifyGitHubSetup(): Promise<void> {
    console.log('\n📦 GitHub Token Rotation Setup');
    console.log('-' .repeat(30));

    // Check gh CLI installation
    try {
      execSync('gh --version', { stdio: 'pipe' });
      this.addResult('GitHub CLI', 'pass', 'gh CLI installed');
    } catch {
      this.addResult('GitHub CLI', 'fail', 'gh CLI not installed - run: brew install gh');
    }

    // Check gh authentication
    try {
      execSync('gh auth status', { stdio: 'pipe' });
      this.addResult('GitHub Auth', 'pass', 'gh CLI authenticated');
    } catch {
      this.addResult('GitHub Auth', 'warning', 'gh CLI not authenticated - run: gh auth login');
    }

    // Check GitHub App credentials (optional)
    if (process.env.GITHUB_APP_ID) {
      this.addResult('GitHub App ID', 'pass', 'GitHub App ID configured');
    } else {
      this.addResult('GitHub App ID', 'warning', 'GitHub App ID not set (optional for enterprise)');
    }

    if (process.env.GITHUB_APP_PRIVATE_KEY || process.env.GITHUB_APP_PRIVATE_KEY_PATH) {
      this.addResult('GitHub App Key', 'pass', 'GitHub App private key configured');
    } else {
      this.addResult('GitHub App Key', 'warning', 'GitHub App private key not set (optional)');
    }

    // Check repository permissions
    try {
      const repo = execSync('gh repo view --json name', { encoding: 'utf8' });
      this.addResult('Repository Access', 'pass', 'Repository access verified');
    } catch {
      this.addResult('Repository Access', 'fail', 'Cannot access repository via gh CLI');
    }
  }

  private async verifySupabaseSetup(): Promise<void> {
    console.log('\n🗄️  Supabase Credential Rotation Setup');
    console.log('-' .repeat(30));

    // Check Supabase CLI
    try {
      execSync('supabase --version', { stdio: 'pipe' });
      this.addResult('Supabase CLI', 'pass', 'Supabase CLI installed');
    } catch {
      this.addResult('Supabase CLI', 'warning', 'Supabase CLI not installed (optional)');
    }

    // Check Supabase access token
    if (process.env.SUPABASE_ACCESS_TOKEN) {
      this.addResult('Supabase Token', 'pass', 'Supabase access token configured');
    } else {
      this.addResult('Supabase Token', 'warning', 'Supabase access token not set');
    }

    // Check DATABASE_URL
    if (process.env.DATABASE_URL) {
      const dbUrl = process.env.DATABASE_URL;
      if (dbUrl.includes('supabase.co')) {
        this.addResult('Database URL', 'pass', 'Supabase database URL configured');
      } else {
        this.addResult('Database URL', 'warning', 'Database URL set but not Supabase');
      }
    } else {
      this.addResult('Database URL', 'fail', 'DATABASE_URL not set');
    }

    // Check pg library
    try {
      require('pg');
      this.addResult('PostgreSQL Client', 'pass', 'pg library installed');
    } catch {
      this.addResult('PostgreSQL Client', 'fail', 'pg library not installed - run: npm install pg');
    }
  }

  private async verifyAWSSetup(): Promise<void> {
    console.log('\n☁️  AWS Secrets Manager Setup');
    console.log('-' .repeat(30));

    // Check AWS CLI
    try {
      execSync('aws --version', { stdio: 'pipe' });
      this.addResult('AWS CLI', 'pass', 'AWS CLI installed');
    } catch {
      this.addResult('AWS CLI', 'fail', 'AWS CLI not installed - install from aws.amazon.com/cli');
    }

    // Check AWS credentials
    try {
      const identity = execSync('aws sts get-caller-identity', { encoding: 'utf8', stdio: 'pipe' });
      this.addResult('AWS Credentials', 'pass', 'AWS credentials configured');
    } catch {
      this.addResult('AWS Credentials', 'fail', 'AWS credentials not configured - run: aws configure');
    }

    // Check Secrets Manager access
    try {
      execSync('aws secretsmanager list-secrets --max-results 1', { stdio: 'pipe' });
      this.addResult('Secrets Manager', 'pass', 'AWS Secrets Manager accessible');
    } catch {
      this.addResult('Secrets Manager', 'warning', 'Cannot access AWS Secrets Manager - check IAM permissions');
    }
  }

  private async verifyEnvironment(): Promise<void> {
    console.log('\n🌍 Environment Setup');
    console.log('-' .repeat(30));

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
    if (majorVersion >= 18) {
      this.addResult('Node.js', 'pass', `Node.js ${nodeVersion} installed`);
    } else {
      this.addResult('Node.js', 'fail', `Node.js ${nodeVersion} too old - need v18+`);
    }

    // Check TypeScript
    try {
      execSync('tsc --version', { stdio: 'pipe' });
      this.addResult('TypeScript', 'pass', 'TypeScript installed');
    } catch {
      this.addResult('TypeScript', 'fail', 'TypeScript not installed - run: npm install -g typescript');
    }

    // Check ts-node
    try {
      execSync('ts-node --version', { stdio: 'pipe' });
      this.addResult('ts-node', 'pass', 'ts-node installed');
    } catch {
      this.addResult('ts-node', 'fail', 'ts-node not installed - run: npm install -g ts-node');
    }

    // Check backup directory permissions
    const backupDir = path.join(__dirname, '../.credentials-backup');
    if (fs.existsSync(backupDir)) {
      const stats = fs.statSync(backupDir);
      if ((stats.mode & 0o777) === 0o700) {
        this.addResult('Backup Directory', 'pass', 'Backup directory secure (700 permissions)');
      } else {
        this.addResult('Backup Directory', 'warning', 'Backup directory exists but permissions not optimal');
      }
    } else {
      this.addResult('Backup Directory', 'warning', 'Backup directory will be created on first run');
    }

    // Check encryption key
    if (process.env.BACKUP_ENCRYPTION_KEY) {
      this.addResult('Encryption Key', 'pass', 'Backup encryption key configured');
    } else {
      this.addResult('Encryption Key', 'warning', 'Using default encryption key - set BACKUP_ENCRYPTION_KEY');
    }
  }

  private async verifyScriptsAndDeps(): Promise<void> {
    console.log('\n📝 Scripts and Dependencies');
    console.log('-' .repeat(30));

    // Check rotation scripts exist
    const scripts = [
      'scripts/automated-github-token-rotation.ts',
      'scripts/automated-supabase-rotation.ts',
    ];

    for (const script of scripts) {
      const scriptPath = path.join(__dirname, '..', script);
      if (fs.existsSync(scriptPath)) {
        this.addResult(path.basename(script), 'pass', 'Script exists');
      } else {
        this.addResult(path.basename(script), 'fail', `Script missing: ${script}`);
      }
    }

    // Check GitHub Actions workflow
    const workflowPath = path.join(__dirname, '../.github/workflows/credential-rotation.yml');
    if (fs.existsSync(workflowPath)) {
      this.addResult('GitHub Workflow', 'pass', 'credential-rotation.yml exists');
    } else {
      this.addResult('GitHub Workflow', 'fail', 'GitHub Actions workflow missing');
    }

    // Check required npm packages
    const requiredPackages = ['jsonwebtoken', 'pg', '@octokit/core'];
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
    const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    for (const pkg of requiredPackages) {
      if (allDeps[pkg]) {
        this.addResult(`Package: ${pkg}`, 'pass', 'Installed');
      } else {
        this.addResult(`Package: ${pkg}`, 'fail', `Not installed - run: npm install ${pkg}`);
      }
    }
  }

  private addResult(component: string, status: 'pass' | 'fail' | 'warning', message: string): void {
    this.results.push({ component, status, message });
  }

  private reportResults(): void {
    console.log('\n' + '=' .repeat(50));
    console.log('📊 VERIFICATION RESULTS');
    console.log('=' .repeat(50) + '\n');

    let passCount = 0;
    let failCount = 0;
    let warningCount = 0;

    for (const result of this.results) {
      const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️ ';
      console.log(`${icon} ${result.component.padEnd(25)} ${result.message}`);

      if (result.status === 'pass') passCount++;
      else if (result.status === 'fail') failCount++;
      else warningCount++;
    }

    console.log('\n' + '-' .repeat(50));
    console.log(`Summary: ${passCount} passed, ${failCount} failed, ${warningCount} warnings`);

    if (failCount > 0) {
      console.log('\n❌ SETUP INCOMPLETE - Fix failed items above');
      process.exit(1);
    } else if (warningCount > 0) {
      console.log('\n⚠️  SETUP FUNCTIONAL - Review warnings for optimal configuration');
      process.exit(0);
    } else {
      console.log('\n✅ SETUP COMPLETE - Ready for automated credential rotation');
      process.exit(0);
    }
  }
}

// Execute verification
async function main() {
  const verifier = new RotationSetupVerifier();
  await verifier.verifyAll();
}

main().catch(console.error);