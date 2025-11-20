#!/usr/bin/env ts-node

/**
 * Database Credential Rotation Verification Script
 *
 * Verifies database credential rotation was successful by:
 * - Testing new database connection
 * - Verifying old credentials are disabled
 * - Checking pool health metrics
 * - Running smoke tests
 * - Validating AWS Secrets Manager update
 *
 * Usage:
 *   npx ts-node scripts/verify-credential-rotation.ts
 *
 * Options:
 *   --old-url <url>     Old DATABASE_URL for verification (should fail)
 *   --skip-old-test     Skip testing that old credentials are disabled
 *   --skip-aws          Skip AWS Secrets Manager verification
 */

import { Pool } from 'pg';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface VerificationResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP' | 'WARN';
  message: string;
  duration?: number;
}

class CredentialRotationVerifier {
  private results: VerificationResult[] = [];
  private startTime: number = Date.now();

  constructor(
    private newConnectionString: string,
    private oldConnectionString?: string,
    private skipOldTest: boolean = false,
    private skipAWS: boolean = false
  ) {}

  async verify(): Promise<boolean> {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║   DATABASE CREDENTIAL ROTATION VERIFICATION                    ║');
    console.log('║   Issue: #9 (IMMED-004)                                        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    try {
      // Phase 1: Connection Tests
      await this.testNewConnection();
      if (!this.skipOldTest && this.oldConnectionString) {
        await this.testOldConnectionDisabled();
      }

      // Phase 2: Pool Health
      await this.checkPoolHealth();

      // Phase 3: Application Health
      await this.checkApplicationHealth();

      // Phase 4: AWS Secrets Manager
      if (!this.skipAWS) {
        await this.verifyAWSSecretsManager();
      }

      // Phase 5: Functional Tests
      await this.runSmokeTests();

      // Phase 6: Security Scan
      await this.scanForHardcodedCredentials();

      // Print summary
      this.printSummary();

      // Determine overall success
      const failedTests = this.results.filter(r => r.status === 'FAIL');
      return failedTests.length === 0;

    } catch (error) {
      console.error('\n❌ Verification failed with error:', error);
      return false;
    }
  }

  private async testNewConnection(): Promise<void> {
    console.log('📡 Testing new database connection...');
    const startTime = Date.now();

    try {
      const pool = new Pool({
        connectionString: this.newConnectionString,
        max: 1,
        connectionTimeoutMillis: 5000,
      });

      // Test basic query
      const result = await pool.query('SELECT NOW() as time, current_database() as db, version() as version');
      const duration = Date.now() - startTime;

      await pool.end();

      this.results.push({
        test: 'New Connection Test',
        status: 'PASS',
        message: `✅ Connected to database "${result.rows[0].db}" in ${duration}ms`,
        duration,
      });

      console.log(`   ✅ Connection successful (${duration}ms)`);
      console.log(`   Database: ${result.rows[0].db}`);
      console.log(`   Timestamp: ${result.rows[0].time}\n`);

    } catch (error: any) {
      const duration = Date.now() - startTime;

      this.results.push({
        test: 'New Connection Test',
        status: 'FAIL',
        message: `❌ Failed to connect: ${error.message}`,
        duration,
      });

      console.log(`   ❌ Connection failed: ${error.message}\n`);
    }
  }

  private async testOldConnectionDisabled(): Promise<void> {
    console.log('🔒 Verifying old credentials are disabled...');
    const startTime = Date.now();

    try {
      const pool = new Pool({
        connectionString: this.oldConnectionString,
        max: 1,
        connectionTimeoutMillis: 5000,
      });

      // This should FAIL if rotation was successful
      await pool.query('SELECT 1');
      const duration = Date.now() - startTime;

      await pool.end();

      // If we get here, old credentials still work (BAD!)
      this.results.push({
        test: 'Old Credentials Disabled',
        status: 'FAIL',
        message: '❌ Old credentials still work - rotation may not have taken effect!',
        duration,
      });

      console.log(`   ❌ WARNING: Old credentials still work! Rotation may have failed.\n`);

    } catch (error: any) {
      const duration = Date.now() - startTime;

      // Expected: Authentication failure
      if (error.message.includes('password') || error.message.includes('authentication')) {
        this.results.push({
          test: 'Old Credentials Disabled',
          status: 'PASS',
          message: '✅ Old credentials correctly disabled (authentication failed)',
          duration,
        });

        console.log(`   ✅ Old credentials disabled (authentication failed)\n`);
      } else {
        // Unexpected error
        this.results.push({
          test: 'Old Credentials Disabled',
          status: 'WARN',
          message: `⚠️  Unexpected error (not auth failure): ${error.message}`,
          duration,
        });

        console.log(`   ⚠️  Unexpected error: ${error.message}\n`);
      }
    }
  }

  private async checkPoolHealth(): Promise<void> {
    console.log('🏊 Checking database pool health...');
    const startTime = Date.now();

    try {
      const pool = new Pool({
        connectionString: this.newConnectionString,
        max: 20,
        min: 5,
      });

      // Run multiple queries to test pool
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(pool.query('SELECT pg_sleep(0.1), $1::int as id', [i]));
      }

      await Promise.all(promises);
      const duration = Date.now() - startTime;

      await pool.end();

      this.results.push({
        test: 'Pool Health Check',
        status: 'PASS',
        message: `✅ Pool handled 10 concurrent queries in ${duration}ms`,
        duration,
      });

      console.log(`   ✅ Pool healthy (10 concurrent queries: ${duration}ms)\n`);

    } catch (error: any) {
      const duration = Date.now() - startTime;

      this.results.push({
        test: 'Pool Health Check',
        status: 'FAIL',
        message: `❌ Pool health check failed: ${error.message}`,
        duration,
      });

      console.log(`   ❌ Pool health check failed: ${error.message}\n`);
    }
  }

  private async checkApplicationHealth(): Promise<void> {
    console.log('🏥 Checking application health endpoints...');
    const startTime = Date.now();

    try {
      // Try to hit health endpoint
      const response = await fetch('http://localhost:3001/health', {
        signal: AbortSignal.timeout(5000),
      });

      const duration = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();

        this.results.push({
          test: 'Application Health',
          status: 'PASS',
          message: `✅ Health endpoint responding (${response.status})`,
          duration,
        });

        console.log(`   ✅ Health endpoint: ${response.status} OK`);
        console.log(`   Status: ${JSON.stringify(data, null, 2)}\n`);
      } else {
        this.results.push({
          test: 'Application Health',
          status: 'WARN',
          message: `⚠️  Health endpoint returned ${response.status}`,
          duration,
        });

        console.log(`   ⚠️  Health endpoint: ${response.status}\n`);
      }

    } catch (error: any) {
      const duration = Date.now() - startTime;

      this.results.push({
        test: 'Application Health',
        status: 'SKIP',
        message: `Application not running locally: ${error.message}`,
        duration,
      });

      console.log(`   ℹ️  Application not running locally (expected if remote)\n`);
    }
  }

  private async verifyAWSSecretsManager(): Promise<void> {
    console.log('☁️  Verifying AWS Secrets Manager update...');
    const startTime = Date.now();

    try {
      // Check if AWS CLI is available
      execSync('which aws', { stdio: 'ignore' });

      // Try to describe the secret
      const result = execSync(
        'aws secretsmanager describe-secret --secret-id sovren/production/supabase --region us-east-1 2>&1',
        { encoding: 'utf-8' }
      );

      const duration = Date.now() - startTime;
      const secretData = JSON.parse(result);

      this.results.push({
        test: 'AWS Secrets Manager',
        status: 'PASS',
        message: `✅ Secret exists, last updated: ${secretData.LastChangedDate || 'N/A'}`,
        duration,
      });

      console.log(`   ✅ Secret found: sovren/production/supabase`);
      console.log(`   Last Updated: ${secretData.LastChangedDate || 'N/A'}\n`);

    } catch (error: any) {
      const duration = Date.now() - startTime;

      if (error.message.includes('not found') || error.message.includes('aws')) {
        this.results.push({
          test: 'AWS Secrets Manager',
          status: 'SKIP',
          message: 'AWS CLI not configured or secret not accessible',
          duration,
        });

        console.log(`   ℹ️  Skipped (AWS CLI not configured)\n`);
      } else {
        this.results.push({
          test: 'AWS Secrets Manager',
          status: 'WARN',
          message: `⚠️  Could not verify: ${error.message}`,
          duration,
        });

        console.log(`   ⚠️  Could not verify: ${error.message}\n`);
      }
    }
  }

  private async runSmokeTests(): Promise<void> {
    console.log('🧪 Running smoke tests...');
    const startTime = Date.now();

    try {
      // Run basic query test
      const pool = new Pool({ connectionString: this.newConnectionString });

      // Test 1: Read operation
      await pool.query('SELECT 1 as test');

      // Test 2: Check table access (if tables exist)
      try {
        const result = await pool.query(
          "SELECT count(*) as table_count FROM information_schema.tables WHERE table_schema = 'public'"
        );
        console.log(`   ✅ Database has ${result.rows[0].table_count} tables`);
      } catch (e) {
        console.log(`   ℹ️  Could not count tables (may not exist yet)`);
      }

      const duration = Date.now() - startTime;

      await pool.end();

      this.results.push({
        test: 'Smoke Tests',
        status: 'PASS',
        message: `✅ Basic smoke tests passed (${duration}ms)`,
        duration,
      });

      console.log(`   ✅ Smoke tests passed\n`);

    } catch (error: any) {
      const duration = Date.now() - startTime;

      this.results.push({
        test: 'Smoke Tests',
        status: 'FAIL',
        message: `❌ Smoke tests failed: ${error.message}`,
        duration,
      });

      console.log(`   ❌ Smoke tests failed: ${error.message}\n`);
    }
  }

  private async scanForHardcodedCredentials(): Promise<void> {
    console.log('🔍 Scanning for hardcoded credentials...');
    const startTime = Date.now();

    try {
      // Search for potential hardcoded passwords in source code
      const result = execSync(
        'git grep -iE "(password|passwd)\\s*=\\s*[\'\\"][^\'\\"]{8,}" -- \':!*.md\' \':!*.example\' \':!*.backup\' || true',
        { encoding: 'utf-8', cwd: path.join(__dirname, '..') }
      );

      const duration = Date.now() - startTime;

      if (!result || result.trim().length === 0) {
        this.results.push({
          test: 'Hardcoded Credentials Scan',
          status: 'PASS',
          message: '✅ No hardcoded credentials found',
          duration,
        });

        console.log(`   ✅ No hardcoded credentials found\n`);
      } else {
        const matches = result.trim().split('\n').length;

        this.results.push({
          test: 'Hardcoded Credentials Scan',
          status: 'WARN',
          message: `⚠️  Found ${matches} potential hardcoded credentials (review required)`,
          duration,
        });

        console.log(`   ⚠️  Found ${matches} potential matches:\n`);
        console.log(result);
      }

    } catch (error: any) {
      const duration = Date.now() - startTime;

      this.results.push({
        test: 'Hardcoded Credentials Scan',
        status: 'SKIP',
        message: 'Could not run credential scan',
        duration,
      });

      console.log(`   ℹ️  Credential scan skipped\n`);
    }
  }

  private printSummary(): void {
    const totalDuration = Date.now() - this.startTime;

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                     VERIFICATION SUMMARY                       ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warnings = this.results.filter(r => r.status === 'WARN').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;

    console.log(`Total Tests: ${this.results.length}`);
    console.log(`✅ Passed:   ${passed}`);
    console.log(`❌ Failed:   ${failed}`);
    console.log(`⚠️  Warnings: ${warnings}`);
    console.log(`ℹ️  Skipped:  ${skipped}`);
    console.log(`\nTotal Duration: ${totalDuration}ms\n`);

    console.log('Detailed Results:\n');

    this.results.forEach((result, index) => {
      const icon = {
        PASS: '✅',
        FAIL: '❌',
        WARN: '⚠️ ',
        SKIP: 'ℹ️ ',
      }[result.status];

      console.log(`${index + 1}. ${icon} ${result.test}`);
      console.log(`   ${result.message}`);
      if (result.duration !== undefined) {
        console.log(`   Duration: ${result.duration}ms`);
      }
      console.log('');
    });

    // Final verdict
    if (failed === 0) {
      console.log('╔════════════════════════════════════════════════════════════════╗');
      console.log('║                ✅ ROTATION VERIFICATION PASSED                 ║');
      console.log('╚════════════════════════════════════════════════════════════════╝\n');

      if (warnings > 0) {
        console.log(`⚠️  Note: ${warnings} warning(s) require review\n`);
      }
    } else {
      console.log('╔════════════════════════════════════════════════════════════════╗');
      console.log('║                ❌ ROTATION VERIFICATION FAILED                 ║');
      console.log('╚════════════════════════════════════════════════════════════════╝\n');
      console.log(`❌ ${failed} critical test(s) failed\n`);
      console.log('RECOMMENDED ACTIONS:');
      console.log('1. Review failed tests above');
      console.log('2. Check database credentials are correct');
      console.log('3. Verify application can connect to database');
      console.log('4. Consider rollback if issues persist\n');
    }

    // Next steps
    console.log('NEXT STEPS:');
    console.log('1. Review all warnings and failed tests');
    console.log('2. Monitor application logs for database errors');
    console.log('3. Run full integration test suite');
    console.log('4. Update security audit log');
    console.log('5. Schedule next rotation (90 days)\n');

    // Save results to file
    this.saveResults();
  }

  private saveResults(): void {
    const resultsFile = path.join(__dirname, '..', '.credentials-backup', 'verification-results.json');

    const data = {
      timestamp: new Date().toISOString(),
      totalDuration: Date.now() - this.startTime,
      summary: {
        total: this.results.length,
        passed: this.results.filter(r => r.status === 'PASS').length,
        failed: this.results.filter(r => r.status === 'FAIL').length,
        warnings: this.results.filter(r => r.status === 'WARN').length,
        skipped: this.results.filter(r => r.status === 'SKIP').length,
      },
      results: this.results,
    };

    try {
      fs.mkdirSync(path.dirname(resultsFile), { recursive: true });
      fs.writeFileSync(resultsFile, JSON.stringify(data, null, 2));
      console.log(`📄 Results saved to: ${resultsFile}\n`);
    } catch (error) {
      console.log(`⚠️  Could not save results to file\n`);
    }
  }
}

// CLI Entry Point
async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const getArg = (flag: string): string | undefined => {
    const index = args.indexOf(flag);
    return index !== -1 && index + 1 < args.length ? args[index + 1] : undefined;
  };

  const hasFlag = (flag: string): boolean => args.includes(flag);

  // Get connection strings
  const newUrl = process.env.DATABASE_URL || getArg('--new-url');
  const oldUrl = getArg('--old-url');
  const skipOldTest = hasFlag('--skip-old-test') || !oldUrl;
  const skipAWS = hasFlag('--skip-aws');

  if (!newUrl) {
    console.error('❌ Error: DATABASE_URL not set');
    console.error('');
    console.error('Usage:');
    console.error('  DATABASE_URL=<url> npx ts-node scripts/verify-credential-rotation.ts');
    console.error('');
    console.error('Options:');
    console.error('  --old-url <url>     Old DATABASE_URL for verification');
    console.error('  --skip-old-test     Skip testing old credentials');
    console.error('  --skip-aws          Skip AWS Secrets Manager verification');
    process.exit(1);
  }

  // Run verification
  const verifier = new CredentialRotationVerifier(newUrl, oldUrl, skipOldTest, skipAWS);
  const success = await verifier.verify();

  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { CredentialRotationVerifier, VerificationResult };
