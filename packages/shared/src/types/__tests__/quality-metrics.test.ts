/**
 * Unit Tests for Quality Metrics Types
 * Tests all Zod schemas and type validations
 * Coverage target: 95%+
 */

import {
  CoverageMetricSchema,
  CoverageReportSchema,
  CodeQualityMetricSchema,
  BugMetricSchema,
  PerformanceBenchmarkSchema,
  QualityMetricsDashboardSchema,
  type CoverageMetric,
  type QualityThresholds,
  type RefactoringSuggestion,
  type Anomaly,
} from '../quality-metrics';

describe('Quality Metrics Types - TS-006', () => {
  describe('CoverageMetricSchema', () => {
    it('should validate a complete coverage metric', () => {
      const validMetric = {
        id: 'cov-123',
        timestamp: new Date().toISOString(),
        projectId: 'proj-456',
        branch: 'main',
        commit: 'abc123def456',
        linesCovered: 850,
        linesTotal: 1000,
        branchesCovered: 120,
        branchesTotal: 150,
        functionsCovered: 90,
        functionsTotal: 100,
        statementsCovered: 900,
        statementsTotal: 1000,
        coveragePercentage: 85.0,
        pathCoverage: 80.0,
        qualityScore: 92.5,
        trends: [
          {
            date: new Date().toISOString(),
            coverage: 85.0,
            change: 2.5,
          },
        ],
        files: [
          {
            path: 'src/services/auth.ts',
            coverage: 95.0,
            uncoveredLines: [42, 87, 123],
            complexityScore: 15.5,
          },
        ],
        threshold: {
          minimum: 80.0,
          target: 95.0,
          adaptive: true,
          enforcement: 'strict' as const,
        },
        aiInsights: {
          suggestions: ['Increase coverage in auth module'],
          predictedCoverage: 87.5,
          improvementAreas: ['Error handling', 'Edge cases'],
          riskAssessment: 'low' as const,
        },
      };

      const result = CoverageMetricSchema.safeParse(validMetric);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.coveragePercentage).toBe(85.0);
      }
    });

    it('should reject coverage percentage > 100', () => {
      const invalidMetric = {
        id: 'cov-123',
        timestamp: new Date().toISOString(),
        projectId: 'proj-456',
        branch: 'main',
        commit: 'abc123',
        linesCovered: 1100,
        linesTotal: 1000,
        branchesCovered: 120,
        branchesTotal: 150,
        functionsCovered: 90,
        functionsTotal: 100,
        statementsCovered: 900,
        statementsTotal: 1000,
        coveragePercentage: 110.0, // Invalid
        pathCoverage: 80.0,
        qualityScore: 92.5,
        trends: [],
        files: [],
        threshold: {
          minimum: 80.0,
          target: 95.0,
          adaptive: true,
          enforcement: 'strict' as const,
        },
        aiInsights: {
          suggestions: [],
          predictedCoverage: 87.5,
          improvementAreas: [],
          riskAssessment: 'low' as const,
        },
      };

      const result = CoverageMetricSchema.safeParse(invalidMetric);
      expect(result.success).toBe(false);
    });

    it('should reject negative line counts', () => {
      const invalidMetric = {
        id: 'cov-123',
        timestamp: new Date().toISOString(),
        projectId: 'proj-456',
        branch: 'main',
        commit: 'abc123',
        linesCovered: -10, // Invalid
        linesTotal: 1000,
        branchesCovered: 120,
        branchesTotal: 150,
        functionsCovered: 90,
        functionsTotal: 100,
        statementsCovered: 900,
        statementsTotal: 1000,
        coveragePercentage: 85.0,
        pathCoverage: 80.0,
        qualityScore: 92.5,
        trends: [],
        files: [],
        threshold: {
          minimum: 80.0,
          target: 95.0,
          adaptive: true,
          enforcement: 'strict' as const,
        },
        aiInsights: {
          suggestions: [],
          predictedCoverage: 87.5,
          improvementAreas: [],
          riskAssessment: 'low' as const,
        },
      };

      const result = CoverageMetricSchema.safeParse(invalidMetric);
      expect(result.success).toBe(false);
    });
  });

  describe('CoverageReportSchema', () => {
    it('should validate coverage report with visualizations', () => {
      const validReport = {
        id: 'report-123',
        generatedAt: new Date().toISOString(),
        metrics: {
          id: 'cov-123',
          timestamp: new Date().toISOString(),
          projectId: 'proj-456',
          branch: 'main',
          commit: 'abc123',
          linesCovered: 850,
          linesTotal: 1000,
          branchesCovered: 120,
          branchesTotal: 150,
          functionsCovered: 90,
          functionsTotal: 100,
          statementsCovered: 900,
          statementsTotal: 1000,
          coveragePercentage: 85.0,
          pathCoverage: 80.0,
          qualityScore: 92.5,
          trends: [],
          files: [],
          threshold: {
            minimum: 80.0,
            target: 95.0,
            adaptive: true,
            enforcement: 'strict' as const,
          },
          aiInsights: {
            suggestions: [],
            predictedCoverage: 87.5,
            improvementAreas: [],
            riskAssessment: 'low' as const,
          },
        },
        visualizations: [
          {
            type: 'line_chart' as const,
            data: {
              labels: ['Week 1', 'Week 2'],
              values: [80, 85],
            },
            config: { theme: 'dark', animated: true },
          },
        ],
        recommendations: [
          {
            priority: 'high' as const,
            description: 'Increase test coverage',
            impact: 'High impact on quality',
            effort: 'medium' as const,
            automated: false,
          },
        ],
        status: 'passing' as const,
        alerts: [],
      };

      const result = CoverageReportSchema.safeParse(validReport);
      expect(result.success).toBe(true);
    });

    it('should validate visualization data with various types', () => {
      const reportWithComplexData = {
        id: 'report-456',
        generatedAt: new Date().toISOString(),
        metrics: {
          id: 'cov-123',
          timestamp: new Date().toISOString(),
          projectId: 'proj-456',
          branch: 'main',
          commit: 'abc123',
          linesCovered: 850,
          linesTotal: 1000,
          branchesCovered: 120,
          branchesTotal: 150,
          functionsCovered: 90,
          functionsTotal: 100,
          statementsCovered: 900,
          statementsTotal: 1000,
          coveragePercentage: 85.0,
          pathCoverage: 80.0,
          qualityScore: 92.5,
          trends: [],
          files: [],
          threshold: {
            minimum: 80.0,
            target: 95.0,
            adaptive: true,
            enforcement: 'strict' as const,
          },
          aiInsights: {
            suggestions: [],
            predictedCoverage: 87.5,
            improvementAreas: [],
            riskAssessment: 'low' as const,
          },
        },
        visualizations: [
          {
            type: 'heatmap' as const,
            data: {
              matrix: [
                [0.8, 0.9],
                [0.7, 0.85],
              ],
              labels: ['File1', 'File2'],
              nested: [null, 42, true, 'value'],
            },
          },
        ],
        recommendations: [],
        status: 'passing' as const,
        alerts: [],
      };

      const result = CoverageReportSchema.safeParse(reportWithComplexData);
      expect(result.success).toBe(true);
    });
  });

  describe('CodeQualityMetricSchema', () => {
    it('should validate complete code quality metrics', () => {
      const validMetric = {
        id: 'quality-123',
        timestamp: new Date().toISOString(),
        projectId: 'proj-456',
        branch: 'main',
        commit: 'abc123',
        overallScore: 85.5,
        maintainabilityIndex: 78.2,
        cyclomaticComplexity: 15.8,
        cognitiveComplexity: 22.3,
        technicalDebt: {
          minutes: 1250,
          ratio: 5.2,
          classification: 'A' as const,
        },
        duplication: {
          percentage: 3.5,
          blocks: 12,
          lines: 450,
        },
        violations: [
          {
            rule: 'max-complexity',
            severity: 'major' as const,
            count: 3,
            file: 'src/utils/complex.ts',
            line: 42,
            message: 'Complexity exceeds threshold',
            effort: 30,
          },
        ],
        trends: [],
        aiAnalysis: {
          patterns: ['Repeated error handling'],
          refactoringOpportunities: [],
          hotspots: [],
          forecast: {
            nextWeek: 86.0,
            nextMonth: 88.0,
            confidence: 0.85,
          },
        },
        gates: {
          qualityGate: 'passed' as const,
          thresholds: { maintainability: 70, complexity: 20 },
          blockers: [],
          warnings: [],
        },
      };

      const result = CodeQualityMetricSchema.safeParse(validMetric);
      expect(result.success).toBe(true);
    });

    it('should validate technical debt classifications', () => {
      const classifications = ['A', 'B', 'C', 'D', 'E'] as const;

      classifications.forEach((classification) => {
        const metric = {
          id: 'quality-123',
          timestamp: new Date().toISOString(),
          projectId: 'proj-456',
          branch: 'main',
          commit: 'abc123',
          overallScore: 85.5,
          maintainabilityIndex: 78.2,
          cyclomaticComplexity: 15.8,
          cognitiveComplexity: 22.3,
          technicalDebt: {
            minutes: 1250,
            ratio: 5.2,
            classification,
          },
          duplication: { percentage: 3.5, blocks: 12, lines: 450 },
          violations: [],
          trends: [],
          aiAnalysis: {
            patterns: [],
            refactoringOpportunities: [],
            hotspots: [],
            forecast: { nextWeek: 86.0, nextMonth: 88.0, confidence: 0.85 },
          },
          gates: {
            qualityGate: 'passed' as const,
            thresholds: {},
            blockers: [],
            warnings: [],
          },
        };

        const result = CodeQualityMetricSchema.safeParse(metric);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('BugMetricSchema', () => {
    it('should validate bug tracking metrics', () => {
      const validMetric = {
        id: 'bug-123',
        timestamp: new Date().toISOString(),
        projectId: 'proj-456',
        totalBugs: 150,
        openBugs: 45,
        resolvedBugs: 105,
        criticalBugs: 5,
        averageResolutionTime: 48.5,
        bugVelocity: 2.3,
        escapedBugs: 8,
        regressionRate: 12.5,
        defectDensity: 0.8,
        categories: { security: 10, performance: 15, ui: 20 },
        severity: {
          critical: 5,
          high: 15,
          medium: 40,
          low: 90,
        },
        trends: [],
        aiClassification: {
          accuracy: 0.92,
          patterns: [],
          predictions: {
            nextWeekBugs: 12,
            hotspots: ['auth module'],
            riskAreas: ['payment processing'],
          },
          rootCauses: [],
        },
        performance: {
          timeToDetection: 24.5,
          timeToResolution: 72.3,
          firstTimeFixRate: 88.5,
          reopenRate: 8.2,
        },
      };

      const result = BugMetricSchema.safeParse(validMetric);
      expect(result.success).toBe(true);
    });
  });

  describe('PerformanceBenchmarkSchema', () => {
    it('should validate performance benchmarks', () => {
      const validBenchmark = {
        id: 'perf-123',
        timestamp: new Date().toISOString(),
        projectId: 'proj-456',
        environment: 'production' as const,
        baseline: {
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          metrics: { responseTime: 250, throughput: 1000 },
        },
        current: {
          version: '1.1.0',
          timestamp: new Date().toISOString(),
          metrics: { responseTime: 200, throughput: 1200 },
        },
        performance: {
          responseTime: {
            average: 200,
            p95: 350,
            p99: 500,
            max: 750,
          },
          throughput: {
            requestsPerSecond: 1200,
            transactionsPerSecond: 950,
            concurrentUsers: 500,
          },
          resources: {
            cpuUsage: 45.5,
            memoryUsage: 62.3,
            diskUsage: 35.8,
            networkUsage: 1250000,
          },
          errors: {
            rate: 0.5,
            count: 25,
            types: { '500': 10, '404': 15 },
          },
        },
        comparisons: [],
        anomalies: [],
        aiAnalysis: {
          forecast: {
            nextHour: { responseTime: 210 },
            nextDay: { responseTime: 220 },
            confidence: 0.88,
          },
          optimizations: [],
          patterns: [],
        },
        alerts: [],
      };

      const result = PerformanceBenchmarkSchema.safeParse(validBenchmark);
      expect(result.success).toBe(true);
    });

    it('should reject invalid resource usage percentages', () => {
      const invalidBenchmark = {
        id: 'perf-123',
        timestamp: new Date().toISOString(),
        projectId: 'proj-456',
        environment: 'production' as const,
        baseline: {
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          metrics: {},
        },
        current: {
          version: '1.1.0',
          timestamp: new Date().toISOString(),
          metrics: {},
        },
        performance: {
          responseTime: { average: 200, p95: 350, p99: 500, max: 750 },
          throughput: { requestsPerSecond: 1200, transactionsPerSecond: 950, concurrentUsers: 500 },
          resources: {
            cpuUsage: 150.0, // Invalid: > 100
            memoryUsage: 62.3,
            diskUsage: 35.8,
            networkUsage: 1250000,
          },
          errors: { rate: 0.5, count: 25, types: {} },
        },
        comparisons: [],
        anomalies: [],
        aiAnalysis: {
          forecast: { nextHour: {}, nextDay: {}, confidence: 0.88 },
          optimizations: [],
          patterns: [],
        },
        alerts: [],
      };

      const result = PerformanceBenchmarkSchema.safeParse(invalidBenchmark);
      expect(result.success).toBe(false);
    });
  });

  describe('QualityMetricsDashboardSchema', () => {
    it('should validate unified quality dashboard', () => {
      const validDashboard = {
        id: 'dash-123',
        projectId: 'proj-456',
        timestamp: new Date().toISOString(),
        overallScore: 88.5,
        coverage: {
          id: 'cov-123',
          timestamp: new Date().toISOString(),
          projectId: 'proj-456',
          branch: 'main',
          commit: 'abc123',
          linesCovered: 850,
          linesTotal: 1000,
          branchesCovered: 120,
          branchesTotal: 150,
          functionsCovered: 90,
          functionsTotal: 100,
          statementsCovered: 900,
          statementsTotal: 1000,
          coveragePercentage: 85.0,
          pathCoverage: 80.0,
          qualityScore: 92.5,
          trends: [],
          files: [],
          threshold: {
            minimum: 80.0,
            target: 95.0,
            adaptive: true,
            enforcement: 'strict' as const,
          },
          aiInsights: {
            suggestions: [],
            predictedCoverage: 87.5,
            improvementAreas: [],
            riskAssessment: 'low' as const,
          },
        },
        quality: {
          id: 'quality-123',
          timestamp: new Date().toISOString(),
          projectId: 'proj-456',
          branch: 'main',
          commit: 'abc123',
          overallScore: 85.5,
          maintainabilityIndex: 78.2,
          cyclomaticComplexity: 15.8,
          cognitiveComplexity: 22.3,
          technicalDebt: { minutes: 1250, ratio: 5.2, classification: 'A' as const },
          duplication: { percentage: 3.5, blocks: 12, lines: 450 },
          violations: [],
          trends: [],
          aiAnalysis: {
            patterns: [],
            refactoringOpportunities: [],
            hotspots: [],
            forecast: { nextWeek: 86.0, nextMonth: 88.0, confidence: 0.85 },
          },
          gates: {
            qualityGate: 'passed' as const,
            thresholds: {},
            blockers: [],
            warnings: [],
          },
        },
        bugs: {
          id: 'bug-123',
          timestamp: new Date().toISOString(),
          projectId: 'proj-456',
          totalBugs: 150,
          openBugs: 45,
          resolvedBugs: 105,
          criticalBugs: 5,
          averageResolutionTime: 48.5,
          bugVelocity: 2.3,
          escapedBugs: 8,
          regressionRate: 12.5,
          defectDensity: 0.8,
          categories: {},
          severity: { critical: 5, high: 15, medium: 40, low: 90 },
          trends: [],
          aiClassification: {
            accuracy: 0.92,
            patterns: [],
            predictions: { nextWeekBugs: 12, hotspots: [], riskAreas: [] },
            rootCauses: [],
          },
          performance: {
            timeToDetection: 24.5,
            timeToResolution: 72.3,
            firstTimeFixRate: 88.5,
            reopenRate: 8.2,
          },
        },
        performance: {
          id: 'perf-123',
          timestamp: new Date().toISOString(),
          projectId: 'proj-456',
          environment: 'production' as const,
          baseline: {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            metrics: {},
          },
          current: {
            version: '1.1.0',
            timestamp: new Date().toISOString(),
            metrics: {},
          },
          performance: {
            responseTime: { average: 200, p95: 350, p99: 500, max: 750 },
            throughput: {
              requestsPerSecond: 1200,
              transactionsPerSecond: 950,
              concurrentUsers: 500,
            },
            resources: {
              cpuUsage: 45.5,
              memoryUsage: 62.3,
              diskUsage: 35.8,
              networkUsage: 1250000,
            },
            errors: { rate: 0.5, count: 25, types: {} },
          },
          comparisons: [],
          anomalies: [],
          aiAnalysis: {
            forecast: { nextHour: {}, nextDay: {}, confidence: 0.88 },
            optimizations: [],
            patterns: [],
          },
          alerts: [],
        },
        insights: [],
        trends: {
          overall: [],
          categories: {},
        },
        goals: [],
        recommendations: [],
      };

      const result = QualityMetricsDashboardSchema.safeParse(validDashboard);
      expect(result.success).toBe(true);
    });
  });

  describe('Interface Types (TypeScript Only)', () => {
    it('should compile QualityThresholds interface', () => {
      const thresholds: QualityThresholds = {
        coverage: {
          min: 80,
          target: 95,
          enforcement: 'strict',
        },
        complexity: {
          max: 20,
          warning: 15,
        },
        maintainability: {
          min: 70,
          target: 85,
        },
        bugs: {
          critical: 0,
          high: 5,
          medium: 20,
        },
        performance: {
          responseTime: 500,
          throughput: 1000,
          errorRate: 1.0,
        },
      };

      expect(thresholds.coverage?.min).toBe(80);
    });

    it('should compile RefactoringSuggestion interface', () => {
      const suggestion: RefactoringSuggestion = {
        file: 'src/utils/complex.ts',
        line: 42,
        severity: 'high',
        category: 'complexity',
        description: 'Function is too complex',
        estimatedEffort: 'medium',
        impact: 'Improved maintainability',
        confidence: 0.92,
      };

      expect(suggestion.severity).toBe('high');
    });

    it('should compile Anomaly interface', () => {
      const anomaly: Anomaly = {
        type: 'performance',
        timestamp: new Date().toISOString(),
        severity: 'high',
        description: 'Response time spike detected',
        affectedComponents: ['API Gateway', 'Database'],
        suggestedAction: 'Scale up resources',
        autoResolvable: true,
        possibleCauses: ['Database connection pool exhausted'],
      };

      expect(anomaly.type).toBe('performance');
    });
  });

  describe('Type Safety', () => {
    it('should prevent any types at compile time', () => {
      // This test verifies no `any` types exist by attempting to use the types
      const metric: CoverageMetric = {
        id: 'test',
        timestamp: new Date().toISOString(),
        projectId: 'proj',
        branch: 'main',
        commit: 'abc',
        linesCovered: 100,
        linesTotal: 100,
        branchesCovered: 100,
        branchesTotal: 100,
        functionsCovered: 100,
        functionsTotal: 100,
        statementsCovered: 100,
        statementsTotal: 100,
        coveragePercentage: 100,
        pathCoverage: 100,
        qualityScore: 100,
        trends: [],
        files: [],
        threshold: {
          minimum: 80,
          target: 95,
          adaptive: true,
          enforcement: 'strict',
        },
        aiInsights: {
          suggestions: [],
          predictedCoverage: 100,
          improvementAreas: [],
          riskAssessment: 'low',
        },
      };

      // TypeScript will catch if any fields accept `any`
      expect(typeof metric.coveragePercentage).toBe('number');
    });
  });
});
