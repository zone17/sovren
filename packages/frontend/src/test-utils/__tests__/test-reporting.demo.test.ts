/**
 * 📊 **ELITE TEST REPORTING DEMONSTRATION**
 *
 * **Purpose**: Demonstration of the test reporting system with real examples
 * **Architecture**: Shows how to integrate reporting into existing test suites
 * **Security**: Safe reporting demonstration without sensitive data
 * **Performance**: Efficient reporting integration
 *
 * @author Elite Engineering Team
 * @version 1.0.0 - US-201 Test Infrastructure Repair
 * @lastModified 2024-12-28
 */

import {
  createTestError,
  createTestResult,
  ReportOptions,
  TestReportingEngine,
  useTestReporting,
} from '../test-reporting';

describe('Test Reporting System Demonstration', () => {
  const { startReport, startSuite, addResult, endSuite, endReport, generateReport, exportReport } =
    useTestReporting();

  describe('Basic Reporting Flow', () => {
    it('creates and generates a complete test report', () => {
      // Start a new report
      const reportId = startReport(
        'Sample Test Suite',
        'Demonstration of test reporting capabilities'
      );

      // Start first test suite
      startSuite('Authentication Tests', 'auth.test.ts', 'Testing authentication functionality');

      // Add successful test
      addResult(createTestResult('should login with valid credentials', 'passed', 150));

      // Add failed test with error
      const loginError = createTestError(
        'Expected user to be authenticated but received null',
        'AssertionError',
        'high',
        'assertion'
      );
      addResult(createTestResult('should handle invalid credentials', 'failed', 230, loginError));

      // Add skipped test
      addResult(createTestResult('should handle OAuth login', 'skipped', 0));

      // End the suite
      endSuite();

      // Start second test suite
      startSuite('API Tests', 'api.test.ts', 'Testing API endpoints');

      // Add some API tests
      addResult(createTestResult('should fetch user data', 'passed', 89));
      addResult(createTestResult('should create new user', 'passed', 156));

      // Add a timeout error
      const timeoutError = createTestError(
        'Test exceeded timeout of 5000ms',
        'TimeoutError',
        'medium',
        'timeout'
      );
      addResult(createTestResult('should handle slow API response', 'failed', 5001, timeoutError));

      // End the suite
      endSuite();

      // End the report
      const report = endReport();

      // Verify report structure
      expect(report.name).toBe('Sample Test Suite');
      expect(report.suites).toHaveLength(2);
      expect(report.summary.total).toBe(6);
      expect(report.summary.passed).toBe(3);
      expect(report.summary.failed).toBe(2);
      expect(report.summary.skipped).toBe(1);
      expect(report.recommendations).toBeInstanceOf(Array);
      expect(report.analytics.insights.testStability).toBeGreaterThan(0);
    });
  });

  describe('Report Generation', () => {
    let reportId: string;

    beforeAll(() => {
      // Create a sample report for testing different formats
      reportId = startReport('Format Test Report', 'Testing different report formats');

      startSuite('Sample Suite', 'sample.test.ts');
      addResult(createTestResult('passing test', 'passed', 100));
      addResult(
        createTestResult('failing test', 'failed', 200, createTestError('Sample error', 'Error'))
      );
      endSuite();

      endReport();
    });

    it('generates JSON report format', () => {
      const options: ReportOptions = {
        format: 'json',
        includePerformance: true,
        includeCoverage: true,
        includeAnalytics: true,
        includeRecommendations: true,
      };

      const jsonReport = generateReport(reportId, options);

      expect(jsonReport).toBeDefined();
      expect(() => JSON.parse(jsonReport)).not.toThrow();

      const parsed = JSON.parse(jsonReport);
      expect(parsed.name).toBe('Format Test Report');
      expect(parsed.suites).toHaveLength(1);
      expect(parsed.summary.total).toBe(2);
    });

    it('generates HTML report format', () => {
      const options: ReportOptions = {
        format: 'html',
        theme: 'light',
        includePerformance: true,
        includeCoverage: true,
      };

      const htmlReport = generateReport(reportId, options);

      expect(htmlReport).toBeDefined();
      expect(htmlReport).toContain('<!DOCTYPE html>');
      expect(htmlReport).toContain('Format Test Report');
      expect(htmlReport).toContain('Test Report');
      expect(htmlReport).toContain('Summary');
      expect(htmlReport).toContain('Recommendations');
    });

    it('generates Markdown report format', () => {
      const options: ReportOptions = {
        format: 'markdown',
        includeRecommendations: true,
      };

      const markdownReport = generateReport(reportId, options);

      expect(markdownReport).toBeDefined();
      expect(markdownReport).toContain('# Format Test Report');
      expect(markdownReport).toContain('## Summary');
      expect(markdownReport).toContain('## Test Suites');
      expect(markdownReport).toContain('## Recommendations');
    });

    it('generates XML report format', () => {
      const options: ReportOptions = {
        format: 'xml',
      };

      const xmlReport = generateReport(reportId, options);

      expect(xmlReport).toBeDefined();
      expect(xmlReport).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xmlReport).toContain('<testsuites>');
      expect(xmlReport).toContain('<testsuite');
      expect(xmlReport).toContain('<testcase');
    });

    it('generates Console report format', () => {
      const options: ReportOptions = {
        format: 'console',
      };

      const consoleReport = generateReport(reportId, options);

      expect(consoleReport).toBeDefined();
      expect(consoleReport).toContain('📊 Test Report:');
      expect(consoleReport).toContain('Summary:');
      expect(consoleReport).toContain('✅ Passed:');
      expect(consoleReport).toContain('❌ Failed:');
      expect(consoleReport).toContain('💡 Recommendations:');
    });
  });

  describe('Advanced Analytics', () => {
    it('analyzes test failures and provides insights', () => {
      const reportId = startReport('Analytics Test Report', 'Testing failure analysis');

      startSuite('Failure Analysis Suite', 'failures.test.ts');

      // Add multiple failed tests with different error types
      addResult(
        createTestResult(
          'timeout test 1',
          'failed',
          5001,
          createTestError('Test timeout exceeded', 'TimeoutError', 'medium', 'timeout')
        )
      );
      addResult(
        createTestResult(
          'timeout test 2',
          'failed',
          5002,
          createTestError('Test timeout exceeded', 'TimeoutError', 'medium', 'timeout')
        )
      );
      addResult(
        createTestResult(
          'assertion test',
          'failed',
          120,
          createTestError('Expected true but got false', 'AssertionError', 'high', 'assertion')
        )
      );
      addResult(
        createTestResult(
          'null reference test',
          'failed',
          89,
          createTestError('Cannot read property of null', 'TypeError', 'medium', 'runtime')
        )
      );

      endSuite();

      const report = endReport();
      const reporter = TestReportingEngine.getInstance();

      // Analyze failures
      const failureAnalysis = reporter.analyzeFailures(report);

      expect(failureAnalysis).toHaveLength(3); // 3 different error patterns

      // Check timeout pattern
      const timeoutPattern = failureAnalysis.find((f) => f.pattern === 'Timeout Error');
      expect(timeoutPattern).toBeDefined();
      expect(timeoutPattern?.frequency).toBe(2);
      expect(timeoutPattern?.tests).toHaveLength(2);
      expect(timeoutPattern?.suggestions).toContain(
        'Increase test timeout or add proper wait conditions'
      );

      // Check assertion pattern
      const assertionPattern = failureAnalysis.find((f) => f.pattern === 'Assertion Error');
      expect(assertionPattern).toBeDefined();
      expect(assertionPattern?.frequency).toBe(1);

      // Check null reference pattern
      const nullPattern = failureAnalysis.find((f) => f.pattern === 'Null/Undefined Error');
      expect(nullPattern).toBeDefined();
      expect(nullPattern?.frequency).toBe(1);
      expect(nullPattern?.suggestions).toContain('Add null checks before accessing properties');
    });

    it('generates performance insights', () => {
      const reportId = startReport('Performance Test Report', 'Testing performance insights');

      startSuite('Performance Suite', 'performance.test.ts');

      // Add tests with various performance characteristics
      addResult(createTestResult('fast test', 'passed', 50));
      addResult(createTestResult('slow test', 'passed', 2500)); // Slow test
      addResult(createTestResult('very slow test', 'passed', 6000)); // Very slow test
      addResult(createTestResult('normal test', 'passed', 200));

      endSuite();

      const report = endReport();
      const reporter = TestReportingEngine.getInstance();

      // Generate performance insights
      const insights = reporter.generatePerformanceInsights(report);

      expect(insights.slowTests).toHaveLength(2); // 2 slow tests
      expect(insights.slowTests[0].name).toBe('very slow test');
      expect(insights.slowTests[0].impact).toBe('high');
      expect(insights.slowTests[1].name).toBe('slow test');
      expect(insights.slowTests[1].impact).toBe('medium');

      expect(insights.optimizations).toContain('Optimize slow tests to improve feedback cycle');
    });

    it('calculates stability score', () => {
      const reportId = startReport('Stability Test Report', 'Testing stability calculation');

      startSuite('Stability Suite', 'stability.test.ts');

      // Add a mix of passed and failed tests
      addResult(createTestResult('test 1', 'passed', 100));
      addResult(createTestResult('test 2', 'passed', 110));
      addResult(createTestResult('test 3', 'passed', 120));
      addResult(createTestResult('test 4', 'passed', 130));
      addResult(createTestResult('test 5', 'failed', 200, createTestError('Test error', 'Error')));

      endSuite();

      const report = endReport();
      const reporter = TestReportingEngine.getInstance();

      // Calculate stability score
      const stabilityScore = reporter.calculateStabilityScore(report);

      expect(stabilityScore).toBeGreaterThan(0);
      expect(stabilityScore).toBeLessThan(100); // Should be less than 100 due to failures
      expect(stabilityScore).toBeCloseTo(64, 0); // Expected score based on 80% pass rate with failure penalty
    });
  });

  describe('Recommendations Engine', () => {
    it('generates performance recommendations for slow tests', () => {
      const reportId = startReport(
        'Performance Recommendations',
        'Testing performance recommendations'
      );

      startSuite('Slow Tests Suite', 'slow.test.ts');

      // Add multiple slow tests
      for (let i = 0; i < 5; i++) {
        addResult(createTestResult(`slow test ${i}`, 'passed', 1500 + i * 100));
      }

      endSuite();

      const report = endReport();

      // Should generate performance recommendation
      const perfRecommendation = report.recommendations.find((r) => r.type === 'performance');
      expect(perfRecommendation).toBeDefined();
      expect(perfRecommendation?.title).toBe('High Average Test Duration');
      expect(perfRecommendation?.severity).toBe('high');
      expect(perfRecommendation?.actionItems).toContain(
        'Optimize slow tests by reducing setup/teardown time'
      );
    });

    it('generates reliability recommendations for high failure rate', () => {
      const reportId = startReport(
        'Reliability Recommendations',
        'Testing reliability recommendations'
      );

      startSuite('Unreliable Tests Suite', 'unreliable.test.ts');

      // Add mostly failed tests
      addResult(createTestResult('test 1', 'failed', 100, createTestError('Error 1', 'Error')));
      addResult(createTestResult('test 2', 'failed', 110, createTestError('Error 2', 'Error')));
      addResult(createTestResult('test 3', 'failed', 120, createTestError('Error 3', 'Error')));
      addResult(createTestResult('test 4', 'passed', 130));

      endSuite();

      const report = endReport();

      // Should generate reliability recommendation
      const reliabilityRecommendation = report.recommendations.find(
        (r) => r.type === 'reliability'
      );
      expect(reliabilityRecommendation).toBeDefined();
      expect(reliabilityRecommendation?.title).toBe('High Failure Rate');
      expect(reliabilityRecommendation?.severity).toBe('high');
      expect(reliabilityRecommendation?.actionItems).toContain(
        'Investigate flaky tests and add proper wait conditions'
      );
    });
  });

  describe('Export Functionality', () => {
    it('exports reports to console', () => {
      const reportId = startReport('Export Test', 'Testing export functionality');

      startSuite('Export Suite', 'export.test.ts');
      addResult(createTestResult('export test', 'passed', 100));
      endSuite();

      endReport();

      // Mock console.log to capture output
      const originalLog = console.log;
      const logs: string[] = [];
      console.log = vi.fn((message: string) => logs.push(message));

      const options: ReportOptions = {
        format: 'console',
        outputPath: '/tmp/test-report.txt',
        emailReport: true,
        emailRecipients: ['dev@example.com'],
      };

      exportReport(reportId, options);

      // Verify console output
      expect(logs).toContain('Report exported to: /tmp/test-report.txt');
      expect(logs).toContain('Report emailed to: dev@example.com');

      // Restore console.log
      console.log = originalLog;
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles empty reports gracefully', () => {
      const reportId = startReport('Empty Report', 'Testing empty report handling');
      const report = endReport();

      expect(report.summary.total).toBe(0);
      expect(report.summary.passRate).toBe(0);
      expect(report.summary.failureRate).toBe(0);
      expect(report.recommendations).toHaveLength(0);
      expect(report.analytics.insights.testStability).toBe(100); // Empty report should be considered stable
    });

    it('handles invalid report IDs', () => {
      const options: ReportOptions = { format: 'json' };

      expect(() => {
        generateReport('invalid-id', options);
      }).toThrow('Report with id invalid-id not found');
    });

    it('handles missing active report', () => {
      const reporter = TestReportingEngine.getInstance();

      expect(() => {
        reporter.startSuite('Test Suite', 'test.ts');
      }).toThrow('No active report. Call startReport() first.');
    });

    it('handles missing active suite', () => {
      const reporter = TestReportingEngine.getInstance();

      expect(() => {
        reporter.addTestResult(createTestResult('test', 'passed', 100));
      }).toThrow('No active suite. Call startSuite() first.');
    });
  });
});
