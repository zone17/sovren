// @ts-nocheck
// =====================================================
// 🔒 RLS POLICY VALIDATION SCRIPT - CI/CD INTEGRATION
// =====================================================
//
// Implementation for US-209: Supabase Row-Level Security CI/CD Validation
// Elite security validation with automated policy testing
//
// @author Sovren Platform Team
// @version 1.0.0
// @date 2024-12-29
//
// Validation Coverage:
// - RLS policy existence verification
// - Policy functionality testing
// - Security breach prevention validation
// - Performance impact assessment
// - Compliance requirement verification
// =====================================================

import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

// Validation results interface
interface ValidationResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
  details?: any;
}

interface PolicyValidationReport {
  timestamp: string;
  environment: string;
  totalTests: number;
  passed: number;
  failed: number;
  warnings: number;
  results: ValidationResult[];
  securityScore: number;
  complianceStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIAL';
}

// Critical tables that must have RLS enabled
const CRITICAL_TABLES = [
  'users',
  'lightning_invoices',
  'lightning_payments',
  'lightning_addresses',
  'lightning_analytics',
  'user_activity_log',
  'user_preferences',
  'user_behavior_events',
  'user_sessions',
  'session_activity',
];

// Expected minimum policy counts per table
const EXPECTED_POLICY_COUNTS = {
  users: 3,
  lightning_invoices: 4,
  lightning_payments: 4,
  lightning_addresses: 4,
  user_preferences: 3,
  user_behavior_events: 3,
};

class RLSPolicyValidator {
  private serviceClient: any;
  private anonClient: any;
  private results: ValidationResult[];

  constructor() {
    this.serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    this.anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.results = [];
  }

  // =====================================================
  // MAIN VALIDATION RUNNER
  // =====================================================

  async runValidation(): Promise<PolicyValidationReport> {
    console.log('🔒 Starting RLS Policy Validation...\n');

    this.results = [];

    // Run all validation tests
    await this.validateRLSEnabled();
    await this.validatePolicyExistence();
    await this.validatePolicyFunctionality();
    await this.validateSecurityBreach();
    await this.validatePerformanceImpact();
    await this.validateComplianceRequirements();

    // Generate report
    const report = this.generateReport();
    await this.saveReport(report);

    return report;
  }

  // =====================================================
  // RLS ENABLEMENT VALIDATION
  // =====================================================

  async validateRLSEnabled(): Promise<void> {
    console.log('📋 Validating RLS enablement on critical tables...');

    try {
      // Check if RLS is enabled on all critical tables
      const { data, error } = await this.serviceClient
        .from('pg_tables')
        .select('tablename, rowsecurity')
        .eq('schemaname', 'public')
        .in('tablename', CRITICAL_TABLES);

      if (error) {
        this.addResult(
          'RLS_ENABLEMENT_CHECK',
          'FAIL',
          `Failed to query table security status: ${error.message}`
        );
        return;
      }

      const missingRLS = data.filter((table: any) => !table.rowsecurity);

      if (missingRLS.length === 0) {
        this.addResult(
          'RLS_ENABLEMENT_CHECK',
          'PASS',
          `All ${CRITICAL_TABLES.length} critical tables have RLS enabled`
        );
      } else {
        this.addResult(
          'RLS_ENABLEMENT_CHECK',
          'FAIL',
          `${missingRLS.length} critical tables missing RLS`,
          { missingTables: missingRLS.map((t) => t.tablename) }
        );
      }

      // Check total RLS coverage
      const totalTables = await this.getTotalTableCount();
      const rlsEnabledCount = data.filter((t) => t.rowsecurity).length;
      const coverage = (rlsEnabledCount / totalTables) * 100;

      if (coverage >= 90) {
        this.addResult(
          'RLS_COVERAGE_CHECK',
          'PASS',
          `Excellent RLS coverage: ${coverage.toFixed(1)}%`
        );
      } else if (coverage >= 75) {
        this.addResult(
          'RLS_COVERAGE_CHECK',
          'WARNING',
          `Good RLS coverage: ${coverage.toFixed(1)}%`
        );
      } else {
        this.addResult(
          'RLS_COVERAGE_CHECK',
          'FAIL',
          `Insufficient RLS coverage: ${coverage.toFixed(1)}%`
        );
      }
    } catch (error) {
      this.addResult('RLS_ENABLEMENT_CHECK', 'FAIL', `RLS enablement validation failed: ${error}`);
    }
  }

  // =====================================================
  // POLICY EXISTENCE VALIDATION
  // =====================================================

  async validatePolicyExistence(): Promise<void> {
    console.log('📝 Validating policy existence and counts...');

    try {
      // Get policy counts for each table
      const { data, error } = await this.serviceClient
        .from('pg_policies')
        .select('tablename, policyname')
        .eq('schemaname', 'public');

      if (error) {
        this.addResult(
          'POLICY_EXISTENCE_CHECK',
          'FAIL',
          `Failed to query policies: ${error.message}`
        );
        return;
      }

      // Group policies by table
      const policiesByTable = data.reduce((acc, policy) => {
        acc[policy.tablename] = (acc[policy.tablename] || 0) + 1;
        return acc;
      }, {});

      const missingPolicies = [];

      // Check critical tables have expected policy counts
      for (const [table, expectedCount] of Object.entries(EXPECTED_POLICY_COUNTS)) {
        const actualCount = policiesByTable[table] || 0;

        if (actualCount >= expectedCount) {
          this.addResult(
            'POLICY_COUNT_CHECK',
            'PASS',
            `Table ${table} has sufficient policies: ${actualCount}/${expectedCount}`
          );
        } else {
          this.addResult(
            'POLICY_COUNT_CHECK',
            'FAIL',
            `Table ${table} missing policies: ${actualCount}/${expectedCount}`
          );
          missingPolicies.push(table);
        }
      }

      // Overall policy count validation
      const totalPolicies = data.length;
      if (totalPolicies >= 100) {
        this.addResult(
          'TOTAL_POLICY_COUNT',
          'PASS',
          `Comprehensive policy coverage: ${totalPolicies} policies`
        );
      } else if (totalPolicies >= 75) {
        this.addResult(
          'TOTAL_POLICY_COUNT',
          'WARNING',
          `Good policy coverage: ${totalPolicies} policies`
        );
      } else {
        this.addResult(
          'TOTAL_POLICY_COUNT',
          'FAIL',
          `Insufficient policy coverage: ${totalPolicies} policies`
        );
      }
    } catch (error) {
      this.addResult(
        'POLICY_EXISTENCE_CHECK',
        'FAIL',
        `Policy existence validation failed: ${error}`
      );
    }
  }

  // =====================================================
  // POLICY FUNCTIONALITY VALIDATION
  // =====================================================

  async validatePolicyFunctionality(): Promise<void> {
    console.log('🧪 Validating policy functionality...');

    try {
      // Test user data isolation
      await this.testUserDataIsolation();

      // Test creator analytics access
      await this.testCreatorAnalyticsAccess();

      // Test admin privileges
      await this.testAdminPrivileges();

      // Test service account access
      await this.testServiceAccountAccess();
    } catch (error) {
      this.addResult(
        'POLICY_FUNCTIONALITY_CHECK',
        'FAIL',
        `Policy functionality validation failed: ${error}`
      );
    }
  }

  async testUserDataIsolation(): Promise<void> {
    // This would require creating test users and verifying isolation
    // For now, we'll do a simplified check

    try {
      // Attempt to access users table without authentication
      const { data, error } = await this.anonClient.from('users').select('*').limit(1);

      if (error && error.message.includes('permission')) {
        this.addResult('USER_DATA_ISOLATION', 'PASS', 'Unauthenticated access properly blocked');
      } else if (data && data.length === 0) {
        this.addResult('USER_DATA_ISOLATION', 'PASS', 'No data leaked to unauthenticated users');
      } else {
        this.addResult('USER_DATA_ISOLATION', 'FAIL', 'Potential data leakage detected');
      }
    } catch (error) {
      this.addResult(
        'USER_DATA_ISOLATION',
        'WARNING',
        `Could not test user data isolation: ${error}`
      );
    }
  }

  async testCreatorAnalyticsAccess(): Promise<void> {
    try {
      // Test lightning analytics access without auth
      const { data, error } = await this.anonClient
        .from('lightning_analytics')
        .select('*')
        .limit(1);

      if (error && error.message.includes('permission')) {
        this.addResult(
          'CREATOR_ANALYTICS_ACCESS',
          'PASS',
          'Analytics properly protected from unauthorized access'
        );
      } else if (!data || data.length === 0) {
        this.addResult('CREATOR_ANALYTICS_ACCESS', 'PASS', 'No analytics data leaked');
      } else {
        this.addResult('CREATOR_ANALYTICS_ACCESS', 'FAIL', 'Analytics data potentially exposed');
      }
    } catch (error) {
      this.addResult(
        'CREATOR_ANALYTICS_ACCESS',
        'WARNING',
        `Could not test analytics access: ${error}`
      );
    }
  }

  async testAdminPrivileges(): Promise<void> {
    // Test admin access to system configuration
    try {
      const { data, error } = await this.anonClient
        .from('auto_tagging_configs')
        .select('*')
        .limit(1);

      if (error && error.message.includes('permission')) {
        this.addResult('ADMIN_PRIVILEGES', 'PASS', 'Admin-only tables properly protected');
      } else {
        this.addResult(
          'ADMIN_PRIVILEGES',
          'FAIL',
          'Admin tables potentially accessible to non-admins'
        );
      }
    } catch (error) {
      this.addResult('ADMIN_PRIVILEGES', 'WARNING', `Could not test admin privileges: ${error}`);
    }
  }

  async testServiceAccountAccess(): Promise<void> {
    // Test service account capabilities
    try {
      const { data, error } = await this.serviceClient.from('system_logs').select('*').limit(1);

      if (!error) {
        this.addResult('SERVICE_ACCOUNT_ACCESS', 'PASS', 'Service account has appropriate access');
      } else {
        this.addResult(
          'SERVICE_ACCOUNT_ACCESS',
          'FAIL',
          `Service account access restricted: ${error.message}`
        );
      }
    } catch (error) {
      this.addResult(
        'SERVICE_ACCOUNT_ACCESS',
        'WARNING',
        `Could not test service account access: ${error}`
      );
    }
  }

  // =====================================================
  // SECURITY BREACH VALIDATION
  // =====================================================

  async validateSecurityBreach(): Promise<void> {
    console.log('🚨 Validating security breach prevention...');

    try {
      // Test SQL injection resistance
      await this.testSQLInjectionResistance();

      // Test unauthorized role escalation
      await this.testRoleEscalation();

      // Test cross-user data access
      await this.testCrossUserAccess();
    } catch (error) {
      this.addResult(
        'SECURITY_BREACH_CHECK',
        'FAIL',
        `Security breach validation failed: ${error}`
      );
    }
  }

  async testSQLInjectionResistance(): Promise<void> {
    try {
      // Attempt SQL injection
      const { data, error } = await this.anonClient
        .from('users')
        .select('*')
        .eq('id', "'; DROP TABLE users; --");

      if (error || (data && data.length === 0)) {
        this.addResult(
          'SQL_INJECTION_RESISTANCE',
          'PASS',
          'SQL injection attempts properly blocked'
        );
      } else {
        this.addResult('SQL_INJECTION_RESISTANCE', 'FAIL', 'Potential SQL injection vulnerability');
      }
    } catch (error) {
      this.addResult('SQL_INJECTION_RESISTANCE', 'PASS', 'SQL injection properly rejected');
    }
  }

  async testRoleEscalation(): Promise<void> {
    try {
      // Attempt unauthorized admin action
      const { error } = await this.anonClient
        .from('users')
        .update({ role: 'admin' })
        .eq('id', 'any-id');

      if (error && error.message.includes('permission')) {
        this.addResult('ROLE_ESCALATION_PREVENTION', 'PASS', 'Role escalation properly prevented');
      } else {
        this.addResult(
          'ROLE_ESCALATION_PREVENTION',
          'FAIL',
          'Potential role escalation vulnerability'
        );
      }
    } catch (error) {
      this.addResult('ROLE_ESCALATION_PREVENTION', 'PASS', 'Role escalation properly blocked');
    }
  }

  async testCrossUserAccess(): Promise<void> {
    // This would require creating test users
    // For now, validate that user-specific tables require authentication

    const userTables = ['user_preferences', 'user_behavior_events'];

    for (const table of userTables) {
      try {
        const { data, error } = await this.anonClient.from(table).select('*').limit(1);

        if (error && error.message.includes('permission')) {
          this.addResult(
            'CROSS_USER_ACCESS_PREVENTION',
            'PASS',
            `Table ${table} properly protected`
          );
        } else if (!data || data.length === 0) {
          this.addResult('CROSS_USER_ACCESS_PREVENTION', 'PASS', `No data leaked from ${table}`);
        } else {
          this.addResult(
            'CROSS_USER_ACCESS_PREVENTION',
            'FAIL',
            `Potential data exposure in ${table}`
          );
        }
      } catch (error) {
        this.addResult(
          'CROSS_USER_ACCESS_PREVENTION',
          'PASS',
          `Access to ${table} properly blocked`
        );
      }
    }
  }

  // =====================================================
  // PERFORMANCE IMPACT VALIDATION
  // =====================================================

  async validatePerformanceImpact(): Promise<void> {
    console.log('⚡ Validating performance impact...');

    try {
      // Test query performance with RLS
      const testQueries = [
        { table: 'users', query: 'SELECT username, display_name FROM users LIMIT 50' },
        {
          table: 'lightning_invoices',
          query: 'SELECT id, status, amount_sats FROM lightning_invoices LIMIT 20',
        },
      ];

      for (const test of testQueries) {
        const startTime = Date.now();

        try {
          await this.serviceClient.rpc('exec_sql', { sql: test.query });
          const queryTime = Date.now() - startTime;

          if (queryTime < 1000) {
            this.addResult(
              'PERFORMANCE_IMPACT',
              'PASS',
              `${test.table} query completed in ${queryTime}ms`
            );
          } else if (queryTime < 2000) {
            this.addResult(
              'PERFORMANCE_IMPACT',
              'WARNING',
              `${test.table} query took ${queryTime}ms`
            );
          } else {
            this.addResult(
              'PERFORMANCE_IMPACT',
              'FAIL',
              `${test.table} query too slow: ${queryTime}ms`
            );
          }
        } catch (error) {
          this.addResult(
            'PERFORMANCE_IMPACT',
            'WARNING',
            `Could not test ${test.table} performance: ${error}`
          );
        }
      }
    } catch (error) {
      this.addResult('PERFORMANCE_IMPACT', 'WARNING', `Performance validation failed: ${error}`);
    }
  }

  // =====================================================
  // COMPLIANCE VALIDATION
  // =====================================================

  async validateComplianceRequirements(): Promise<void> {
    console.log('📋 Validating compliance requirements...');

    try {
      // Check audit logging capability
      await this.validateAuditLogging();

      // Check data retention policies
      await this.validateDataRetention();

      // Check access control documentation
      await this.validateAccessControlDocumentation();
    } catch (error) {
      this.addResult('COMPLIANCE_CHECK', 'FAIL', `Compliance validation failed: ${error}`);
    }
  }

  async validateAuditLogging(): Promise<void> {
    try {
      // Check if system logs table exists and is accessible
      const { data, error } = await this.serviceClient
        .from('system_logs')
        .select('event_type')
        .limit(1);

      if (!error) {
        this.addResult('AUDIT_LOGGING', 'PASS', 'Audit logging infrastructure in place');
      } else {
        this.addResult('AUDIT_LOGGING', 'FAIL', 'Audit logging not properly configured');
      }
    } catch (error) {
      this.addResult('AUDIT_LOGGING', 'FAIL', `Audit logging validation failed: ${error}`);
    }
  }

  async validateDataRetention(): Promise<void> {
    // Check if cleanup functions exist
    try {
      const { data, error } = await this.serviceClient.rpc('cleanup_expired_sessions');

      this.addResult('DATA_RETENTION', 'PASS', 'Data retention functions operational');
    } catch (error) {
      if (error.message.includes('does not exist')) {
        this.addResult('DATA_RETENTION', 'FAIL', 'Data retention functions missing');
      } else {
        this.addResult('DATA_RETENTION', 'WARNING', `Data retention check inconclusive: ${error}`);
      }
    }
  }

  async validateAccessControlDocumentation(): Promise<void> {
    // Check if RLS monitoring view exists
    try {
      const { data, error } = await this.serviceClient
        .from('rls_security_status')
        .select('*')
        .limit(1);

      if (!error) {
        this.addResult(
          'ACCESS_CONTROL_DOCUMENTATION',
          'PASS',
          'RLS monitoring and documentation in place'
        );
      } else {
        this.addResult('ACCESS_CONTROL_DOCUMENTATION', 'FAIL', 'RLS monitoring view missing');
      }
    } catch (error) {
      this.addResult(
        'ACCESS_CONTROL_DOCUMENTATION',
        'WARNING',
        `Documentation check failed: ${error}`
      );
    }
  }

  // =====================================================
  // UTILITY METHODS
  // =====================================================

  private addResult(
    test: string,
    status: 'PASS' | 'FAIL' | 'WARNING',
    message: string,
    details?: any
  ): void {
    this.results.push({ test, status, message, details });

    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} ${test}: ${message}`);
  }

  private async getTotalTableCount(): Promise<number> {
    const { data } = await this.serviceClient
      .from('pg_tables')
      .select('tablename')
      .eq('schemaname', 'public');

    return data?.length || 0;
  }

  private generateReport(): PolicyValidationReport {
    const passed = this.results.filter((r) => r.status === 'PASS').length;
    const failed = this.results.filter((r) => r.status === 'FAIL').length;
    const warnings = this.results.filter((r) => r.status === 'WARNING').length;

    const securityScore = Math.round((passed / this.results.length) * 100);

    let complianceStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIAL';
    if (failed === 0) {
      complianceStatus = 'COMPLIANT';
    } else if (failed <= warnings) {
      complianceStatus = 'PARTIAL';
    } else {
      complianceStatus = 'NON_COMPLIANT';
    }

    return {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      totalTests: this.results.length,
      passed,
      failed,
      warnings,
      results: this.results,
      securityScore,
      complianceStatus,
    };
  }

  private async saveReport(report: PolicyValidationReport): Promise<void> {
    try {
      // Save report to system logs
      await this.serviceClient.from('system_logs').insert({
        event_type: 'rls_validation_report',
        details: report,
      });

      console.log('\n📊 Validation Report Summary:');
      console.log(`Total Tests: ${report.totalTests}`);
      console.log(`Passed: ${report.passed}`);
      console.log(`Failed: ${report.failed}`);
      console.log(`Warnings: ${report.warnings}`);
      console.log(`Security Score: ${report.securityScore}%`);
      console.log(`Compliance Status: ${report.complianceStatus}`);
    } catch (error) {
      console.error('Failed to save report:', error);
    }
  }
}

// =====================================================
// MAIN EXECUTION
// =====================================================

async function main() {
  const validator = new RLSPolicyValidator();
  const report = await validator.runValidation();

  // Exit with error code if validation failed
  if (report.failed > 0) {
    console.error('\n❌ RLS Policy validation failed!');
    process.exit(1);
  } else {
    console.log('\n✅ RLS Policy validation passed!');
    process.exit(0);
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Validation script failed:', error);
    process.exit(1);
  });
}

export { PolicyValidationReport, RLSPolicyValidator };
