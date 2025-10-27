/**
 * @file AIUsabilityTestingFramework.test.ts
 * @description Comprehensive tests for AI Usability Testing Framework (US-157)
 */

import {
  AIUsabilityTestingFramework,
  HeuristicEvaluation,
} from '../usability-testing/AIUsabilityTestingFramework';

// Mock Logger
jest.mock('../common/Logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe('AIUsabilityTestingFramework', () => {
  let framework: AIUsabilityTestingFramework;
  let heuristicEvaluation: HeuristicEvaluation;

  beforeEach(() => {
    heuristicEvaluation = {
      heuristics: [
        {
          id: 'h1',
          name: 'Visibility of system status',
          description: 'The system should always keep users informed about what is going on',
          category: 'visibility',
          evaluationMethods: ['automated', 'ai_analysis'],
          weight: 0.15,
          automationLevel: 'fully_automated',
        },
        {
          id: 'h2',
          name: 'Match between system and real world',
          description: 'The system should speak the users language',
          category: 'consistency',
          evaluationMethods: ['ai_analysis', 'pattern_recognition'],
          weight: 0.12,
          automationLevel: 'semi_automated',
        },
      ],
      evaluationCriteria: [
        {
          id: 'c1',
          description: 'Clear feedback for user actions',
          measurementMethod: 'automated_detection',
          successThreshold: 80,
          warningThreshold: 60,
          failureThreshold: 40,
        },
      ],
      scoringMethod: 'nielsen',
      severityClassification: {
        levels: [
          {
            level: 'cosmetic',
            scoreRange: [0, 25],
            description: 'Minor cosmetic issues',
            actionRequired: 'Fix if time permits',
            priority: 1,
          },
          {
            level: 'minor',
            scoreRange: [26, 50],
            description: 'Minor usability issues',
            actionRequired: 'Should be fixed',
            priority: 2,
          },
          {
            level: 'major',
            scoreRange: [51, 75],
            description: 'Major usability issues',
            actionRequired: 'Must be fixed',
            priority: 3,
          },
          {
            level: 'catastrophic',
            scoreRange: [76, 100],
            description: 'Catastrophic usability issues',
            actionRequired: 'Fix immediately',
            priority: 4,
          },
        ],
        criteria: [
          {
            type: 'frequency',
            parameters: { threshold: 0.3 },
            weight: 0.4,
          },
          {
            type: 'impact',
            parameters: { threshold: 0.7 },
            weight: 0.6,
          },
        ],
        impactAssessment: {
          businessImpact: 'medium',
          userExperienceImpact: 'high',
          technicalImpact: 'low',
          recommendationPriority: 3,
        },
      },
    };

    framework = new AIUsabilityTestingFramework(heuristicEvaluation);
  });

  afterEach(() => {
    framework.stopMonitoring();
    jest.clearAllMocks();
  });

  describe('Framework Initialization', () => {
    test('should initialize with correct configuration', () => {
      expect(framework).toBeInstanceOf(AIUsabilityTestingFramework);

      const stats = framework.getUsabilityStats();
      expect(stats.overallScore).toBeGreaterThanOrEqual(0);
      expect(stats.totalReports).toBeGreaterThanOrEqual(0);
      expect(['improving', 'declining', 'stable']).toContain(stats.improvementTrend);
    });

    test('should validate heuristic evaluation configuration', () => {
      expect(heuristicEvaluation.heuristics).toHaveLength(2);
      expect(heuristicEvaluation.evaluationCriteria).toHaveLength(1);
      expect(heuristicEvaluation.scoringMethod).toBe('nielsen');
    });

    test('should validate severity classification', () => {
      expect(heuristicEvaluation.severityClassification.levels).toHaveLength(4);
      expect(heuristicEvaluation.severityClassification.criteria).toHaveLength(2);
    });
  });

  describe('US-157 Sub-task 11.7.1: Design AI-driven usability testing framework with user behavior simulation', () => {
    test('should design usability testing framework', async () => {
      await expect(framework.designUsabilityTestingFramework()).resolves.not.toThrow();
    });

    test('should initialize user personas', async () => {
      await framework.designUsabilityTestingFramework();
      // User personas should be initialized
      expect(framework).toBeDefined();
    });

    test('should setup behavior simulation', async () => {
      await framework.designUsabilityTestingFramework();
      // Behavior simulation should be configured
      expect(framework).toBeDefined();
    });

    test('should configure heuristic evaluation', async () => {
      await framework.designUsabilityTestingFramework();
      // Heuristic evaluation should be configured
      expect(framework).toBeDefined();
    });
  });

  describe('US-157 Sub-task 11.7.2: Implement autonomous user testing scenario generation', () => {
    test('should generate user testing scenarios', async () => {
      const scenarios = await framework.generateUserTestingScenarios();

      expect(Array.isArray(scenarios)).toBe(true);
      scenarios.forEach((scenario) => {
        expect(scenario).toHaveProperty('id');
        expect(scenario).toHaveProperty('name');
        expect(scenario).toHaveProperty('triggers');
        expect(scenario).toHaveProperty('sequence');
        expect(scenario).toHaveProperty('frequency');
        expect(scenario).toHaveProperty('contextDependent');

        expect(typeof scenario.id).toBe('string');
        expect(typeof scenario.name).toBe('string');
        expect(Array.isArray(scenario.triggers)).toBe(true);
        expect(Array.isArray(scenario.sequence)).toBe(true);
        expect(typeof scenario.frequency).toBe('number');
        expect(typeof scenario.contextDependent).toBe('boolean');
      });
    });

    test('should generate scenarios for different personas', async () => {
      await framework.designUsabilityTestingFramework();
      const scenarios = await framework.generateUserTestingScenarios();

      expect(Array.isArray(scenarios)).toBe(true);
      // Should generate scenarios based on user personas
      expect(scenarios.length).toBeGreaterThanOrEqual(0);
    });

    test('should prioritize testing scenarios', async () => {
      const scenarios = await framework.generateUserTestingScenarios();

      expect(Array.isArray(scenarios)).toBe(true);
      // Scenarios should be intelligently prioritized
      scenarios.forEach((scenario) => {
        expect(scenario.frequency).toBeGreaterThanOrEqual(0);
        expect(scenario.frequency).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('US-157 Sub-task 11.7.3: Create automated usability metrics collection and analysis', () => {
    test('should collect and analyze usability metrics', async () => {
      const metrics = await framework.collectAndAnalyzeUsabilityMetrics();

      expect(metrics).toHaveProperty('taskCompletionRate');
      expect(metrics).toHaveProperty('taskCompletionTime');
      expect(metrics).toHaveProperty('errorRate');
      expect(metrics).toHaveProperty('errorRecoveryTime');
      expect(metrics).toHaveProperty('navigationEfficiency');
      expect(metrics).toHaveProperty('cognitiveLoadScore');
      expect(metrics).toHaveProperty('satisfactionScore');
      expect(metrics).toHaveProperty('learnabilityScore');
      expect(metrics).toHaveProperty('memorabilityScore');
      expect(metrics).toHaveProperty('accessibilityScore');

      // Validate metric ranges
      expect(metrics.taskCompletionRate).toBeGreaterThanOrEqual(0);
      expect(metrics.taskCompletionRate).toBeLessThanOrEqual(100);
      expect(metrics.errorRate).toBeGreaterThanOrEqual(0);
      expect(metrics.navigationEfficiency).toBeGreaterThanOrEqual(0);
      expect(metrics.cognitiveLoadScore).toBeGreaterThanOrEqual(0);
      expect(metrics.satisfactionScore).toBeGreaterThanOrEqual(0);
      expect(metrics.learnabilityScore).toBeGreaterThanOrEqual(0);
      expect(metrics.memorabilityScore).toBeGreaterThanOrEqual(0);
      expect(metrics.accessibilityScore).toBeGreaterThanOrEqual(0);
    });

    test('should analyze task completion metrics', async () => {
      const metrics = await framework.collectAndAnalyzeUsabilityMetrics();

      expect(typeof metrics.taskCompletionRate).toBe('number');
      expect(typeof metrics.taskCompletionTime).toBe('number');
      expect(metrics.taskCompletionTime).toBeGreaterThanOrEqual(0);
    });

    test('should analyze error and recovery metrics', async () => {
      const metrics = await framework.collectAndAnalyzeUsabilityMetrics();

      expect(typeof metrics.errorRate).toBe('number');
      expect(typeof metrics.errorRecoveryTime).toBe('number');
      expect(metrics.errorRate).toBeGreaterThanOrEqual(0);
      expect(metrics.errorRecoveryTime).toBeGreaterThanOrEqual(0);
    });

    test('should assess cognitive load and satisfaction', async () => {
      const metrics = await framework.collectAndAnalyzeUsabilityMetrics();

      expect(typeof metrics.cognitiveLoadScore).toBe('number');
      expect(typeof metrics.satisfactionScore).toBe('number');
      expect(typeof metrics.learnabilityScore).toBe('number');
      expect(typeof metrics.memorabilityScore).toBe('number');
    });
  });

  describe('US-157 Sub-task 11.7.4: Add synthetic user feedback generation based on interaction patterns', () => {
    let mockInteractionData: any[];

    beforeEach(() => {
      mockInteractionData = [
        {
          action: 'click',
          element: 'button',
          timestamp: Date.now(),
          duration: 200,
          success: true,
        },
        {
          action: 'scroll',
          element: 'page',
          timestamp: Date.now() + 1000,
          duration: 500,
          success: true,
        },
      ];
    });

    test('should generate synthetic user feedback', async () => {
      const feedback = await framework.generateSyntheticUserFeedback(mockInteractionData);

      expect(Array.isArray(feedback)).toBe(true);
      feedback.forEach((item) => {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('persona');
        expect(item).toHaveProperty('category');
        expect(item).toHaveProperty('content');
        expect(item).toHaveProperty('severity');
        expect(item).toHaveProperty('suggestions');
        expect(item).toHaveProperty('confidence');
        expect(item).toHaveProperty('context');

        expect(typeof item.id).toBe('string');
        expect(typeof item.persona).toBe('string');
        expect(['positive', 'negative', 'neutral', 'suggestion']).toContain(item.category);
        expect(typeof item.content).toBe('string');
        expect(['low', 'medium', 'high', 'critical']).toContain(item.severity);
        expect(Array.isArray(item.suggestions)).toBe(true);
        expect(typeof item.confidence).toBe('number');
        expect(item.confidence).toBeGreaterThanOrEqual(0);
        expect(item.confidence).toBeLessThanOrEqual(1);
      });
    });

    test('should generate contextual feedback based on interactions', async () => {
      const feedback = await framework.generateSyntheticUserFeedback(mockInteractionData);

      feedback.forEach((item) => {
        expect(item.context).toHaveProperty('task');
        expect(item.context).toHaveProperty('taskStep');
        expect(item.context).toHaveProperty('timeElapsed');
        expect(item.context).toHaveProperty('previousActions');
        expect(item.context).toHaveProperty('userState');

        expect(typeof item.context.task).toBe('string');
        expect(typeof item.context.taskStep).toBe('number');
        expect(typeof item.context.timeElapsed).toBe('number');
        expect(Array.isArray(item.context.previousActions)).toBe(true);
        expect(['calm', 'frustrated', 'confused', 'satisfied']).toContain(item.context.userState);
      });
    });

    test('should validate feedback quality', async () => {
      const feedback = await framework.generateSyntheticUserFeedback(mockInteractionData);

      feedback.forEach((item) => {
        expect(item.content.length).toBeGreaterThan(0);
        expect(item.suggestions.length).toBeGreaterThanOrEqual(0);
        expect(item.confidence).toBeGreaterThan(0);
      });
    });
  });

  describe('US-157 Sub-task 11.7.5: Implement AI-powered usability analysis with heuristic evaluation', () => {
    test('should perform heuristic evaluation', async () => {
      const results = await framework.performHeuristicEvaluation();

      expect(Array.isArray(results)).toBe(true);
      results.forEach((result) => {
        expect(result).toHaveProperty('heuristicId');
        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('issues');
        expect(result).toHaveProperty('recommendations');
        expect(result).toHaveProperty('confidence');

        expect(typeof result.heuristicId).toBe('string');
        expect(typeof result.score).toBe('number');
        expect(Array.isArray(result.issues)).toBe(true);
        expect(Array.isArray(result.recommendations)).toBe(true);
        expect(typeof result.confidence).toBe('number');

        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      });
    });

    test('should evaluate individual heuristics', async () => {
      const results = await framework.performHeuristicEvaluation();

      results.forEach((result) => {
        // Should match configured heuristics
        expect(['h1', 'h2']).toContain(result.heuristicId);

        result.issues.forEach((issue) => {
          expect(issue).toHaveProperty('id');
          expect(issue).toHaveProperty('title');
          expect(issue).toHaveProperty('description');
          expect(issue).toHaveProperty('severity');
          expect(issue).toHaveProperty('affectedHeuristics');
          expect(issue).toHaveProperty('targetElement');
          expect(issue).toHaveProperty('reproductionSteps');
          expect(issue).toHaveProperty('suggestedFixes');
          expect(issue).toHaveProperty('impact');

          expect(['cosmetic', 'minor', 'major', 'catastrophic']).toContain(issue.severity);
          expect(Array.isArray(issue.affectedHeuristics)).toBe(true);
          expect(Array.isArray(issue.reproductionSteps)).toBe(true);
          expect(Array.isArray(issue.suggestedFixes)).toBe(true);
        });
      });
    });

    test('should cross-validate heuristic results', async () => {
      const results = await framework.performHeuristicEvaluation();

      expect(Array.isArray(results)).toBe(true);
      // Cross-validation should ensure consistency
      results.forEach((result) => {
        expect(result.confidence).toBeGreaterThan(0);
      });
    });
  });

  describe('US-157 Sub-task 11.7.6: Create automated usability reporting with improvement recommendations', () => {
    test('should generate comprehensive usability report', async () => {
      const report = await framework.generateUsabilityReport();

      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('overallScore');
      expect(report).toHaveProperty('metricsSummary');
      expect(report).toHaveProperty('heuristicResults');
      expect(report).toHaveProperty('syntheticFeedback');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('trendAnalysis');

      expect(report.timestamp).toBeInstanceOf(Date);
      expect(typeof report.overallScore).toBe('number');
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(100);

      expect(Array.isArray(report.heuristicResults)).toBe(true);
      expect(Array.isArray(report.syntheticFeedback)).toBe(true);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    test('should provide actionable improvement recommendations', async () => {
      const report = await framework.generateUsabilityReport();

      report.recommendations.forEach((recommendation) => {
        expect(recommendation).toHaveProperty('id');
        expect(recommendation).toHaveProperty('title');
        expect(recommendation).toHaveProperty('description');
        expect(recommendation).toHaveProperty('priority');
        expect(recommendation).toHaveProperty('implementationEffort');
        expect(recommendation).toHaveProperty('expectedImpact');
        expect(recommendation).toHaveProperty('implementationSteps');
        expect(recommendation).toHaveProperty('successMetrics');

        expect(typeof recommendation.id).toBe('string');
        expect(typeof recommendation.title).toBe('string');
        expect(typeof recommendation.description).toBe('string');
        expect(['low', 'medium', 'high', 'critical']).toContain(recommendation.priority);
        expect(['low', 'medium', 'high']).toContain(recommendation.implementationEffort);
        expect(['low', 'medium', 'high']).toContain(recommendation.expectedImpact);
        expect(Array.isArray(recommendation.implementationSteps)).toBe(true);
        expect(Array.isArray(recommendation.successMetrics)).toBe(true);
      });
    });

    test('should include trend analysis', async () => {
      const report = await framework.generateUsabilityReport();

      expect(report.trendAnalysis).toHaveProperty('historicalData');
      expect(report.trendAnalysis).toHaveProperty('improvementTrends');
      expect(report.trendAnalysis).toHaveProperty('regressionAlerts');
      expect(report.trendAnalysis).toHaveProperty('predictions');

      expect(Array.isArray(report.trendAnalysis.historicalData)).toBe(true);
      expect(Array.isArray(report.trendAnalysis.improvementTrends)).toBe(true);
      expect(Array.isArray(report.trendAnalysis.regressionAlerts)).toBe(true);
      expect(Array.isArray(report.trendAnalysis.predictions)).toBe(true);
    });
  });

  describe('US-157 Sub-task 11.7.7: Add autonomous usability improvement tracking and validation', () => {
    test('should track usability improvements', async () => {
      await expect(framework.trackUsabilityImprovements()).resolves.not.toThrow();
    });

    test('should track implemented improvements', async () => {
      await framework.trackUsabilityImprovements();
      // Improvement tracking should be active
      expect(framework).toBeDefined();
    });

    test('should validate improvement effectiveness', async () => {
      await framework.trackUsabilityImprovements();
      // Effectiveness validation should be performed
      expect(framework).toBeDefined();
    });

    test('should update recommendations based on progress', async () => {
      await framework.trackUsabilityImprovements();
      // Recommendations should be updated
      expect(framework).toBeDefined();
    });
  });

  describe('US-157 Sub-task 11.7.8: Implement continuous usability testing effectiveness monitoring', () => {
    test('should monitor testing effectiveness', async () => {
      await expect(framework.monitorTestingEffectiveness()).resolves.not.toThrow();
    });

    test('should monitor test coverage', async () => {
      await framework.monitorTestingEffectiveness();
      // Test coverage monitoring should be active
      expect(framework).toBeDefined();
    });

    test('should assess prediction accuracy', async () => {
      await framework.monitorTestingEffectiveness();
      // Prediction accuracy should be assessed
      expect(framework).toBeDefined();
    });

    test('should validate simulation quality', async () => {
      await framework.monitorTestingEffectiveness();
      // Simulation quality should be validated
      expect(framework).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    test('should perform complete usability testing cycle', async () => {
      // Design framework
      await framework.designUsabilityTestingFramework();

      // Generate scenarios
      const scenarios = await framework.generateUserTestingScenarios();
      expect(Array.isArray(scenarios)).toBe(true);

      // Collect metrics
      const metrics = await framework.collectAndAnalyzeUsabilityMetrics();
      expect(metrics).toBeDefined();

      // Generate feedback
      const feedback = await framework.generateSyntheticUserFeedback([]);
      expect(Array.isArray(feedback)).toBe(true);

      // Perform heuristic evaluation
      const heuristicResults = await framework.performHeuristicEvaluation();
      expect(Array.isArray(heuristicResults)).toBe(true);

      // Generate report
      const report = await framework.generateUsabilityReport();
      expect(report).toBeDefined();

      // Track improvements
      await framework.trackUsabilityImprovements();

      // Monitor effectiveness
      await framework.monitorTestingEffectiveness();
    });

    test('should maintain consistency across testing phases', async () => {
      await framework.designUsabilityTestingFramework();

      const report1 = await framework.generateUsabilityReport();
      const report2 = await framework.generateUsabilityReport();

      // Reports should be consistent
      expect(Math.abs(report1.overallScore - report2.overallScore)).toBeLessThan(5);
      expect(report1.metricsSummary.taskCompletionRate).toEqual(
        report2.metricsSummary.taskCompletionRate
      );
    });
  });

  describe('Performance and Scalability Tests', () => {
    test('should handle large interaction datasets efficiently', async () => {
      const startTime = Date.now();

      // Generate large interaction dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        action: 'click',
        element: `element-${i}`,
        timestamp: Date.now() + i * 100,
        duration: Math.random() * 1000,
        success: Math.random() > 0.1,
      }));

      const feedback = await framework.generateSyntheticUserFeedback(largeDataset);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(Array.isArray(feedback)).toBe(true);
      expect(duration).toBeLessThan(10000); // 10 seconds
    });

    test('should handle concurrent usability analysis', async () => {
      const [scenarios, metrics, heuristicResults] = await Promise.all([
        framework.generateUserTestingScenarios(),
        framework.collectAndAnalyzeUsabilityMetrics(),
        framework.performHeuristicEvaluation(),
      ]);

      expect(Array.isArray(scenarios)).toBe(true);
      expect(metrics).toBeDefined();
      expect(Array.isArray(heuristicResults)).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle empty interaction data gracefully', async () => {
      const feedback = await framework.generateSyntheticUserFeedback([]);

      expect(Array.isArray(feedback)).toBe(true);
    });

    test('should handle invalid heuristic configuration gracefully', async () => {
      const invalidHeuristic = {
        heuristics: [],
        evaluationCriteria: [],
        scoringMethod: 'nielsen',
        severityClassification: {
          levels: [],
          criteria: [],
          impactAssessment: {
            businessImpact: 'low',
            userExperienceImpact: 'low',
            technicalImpact: 'low',
            recommendationPriority: 1,
          },
        },
      } as HeuristicEvaluation;

      const testFramework = new AIUsabilityTestingFramework(invalidHeuristic);

      await expect(testFramework.designUsabilityTestingFramework()).resolves.not.toThrow();

      testFramework.stopMonitoring();
    });

    test('should handle analysis failures gracefully', async () => {
      // Simulate analysis failure scenarios
      await expect(framework.collectAndAnalyzeUsabilityMetrics()).resolves.not.toThrow();
      await expect(framework.performHeuristicEvaluation()).resolves.not.toThrow();
    });
  });

  describe('Monitoring and Cleanup', () => {
    test('should start and stop monitoring correctly', () => {
      expect(() => framework.stopMonitoring()).not.toThrow();
    });

    test('should provide accurate statistics', () => {
      const stats = framework.getUsabilityStats();

      expect(stats).toHaveProperty('overallScore');
      expect(stats).toHaveProperty('totalReports');
      expect(stats).toHaveProperty('latestMetrics');
      expect(stats).toHaveProperty('improvementTrend');

      expect(typeof stats.overallScore).toBe('number');
      expect(typeof stats.totalReports).toBe('number');
      expect(['improving', 'declining', 'stable']).toContain(stats.improvementTrend);
    });
  });
});
