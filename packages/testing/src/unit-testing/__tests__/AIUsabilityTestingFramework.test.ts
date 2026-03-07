/**
 * @file AIUsabilityTestingFramework.test.ts
 * @description Comprehensive test suite for AI-driven usability testing framework (US-157)
 *
 * Tests Coverage:
 * - US-157: Automated usability testing (8 sub-tasks)
 * - AI-driven usability testing framework
 * - Automated user scenario generation
 * - Usability metrics collection
 * - Synthetic user feedback generation
 * - AI-powered heuristic evaluation
 * - Usability reporting and insights
 * - Usability improvement tracking
 * - Usability testing effectiveness monitoring
 */

import { AIUsabilityTestingFramework } from '../AIUsabilityTestingFramework';
import type { AIUsabilityTestingConfig, UserBehaviorPattern, UserScenario } from '../types';

// Mock dependencies
vi.mock('../common/Logger');

describe('AIUsabilityTestingFramework - US-157 Complete Implementation', () => {
  let framework: AIUsabilityTestingFramework;
  let mockConfig: AIUsabilityTestingConfig;

  beforeEach(() => {
    // US-157 Configuration - All sub-tasks enabled
    mockConfig = {
      userPersonas: [
        { id: 'novice', name: 'Novice User', techSkill: 'low', goals: ['simple-tasks'] },
        { id: 'expert', name: 'Expert User', techSkill: 'high', goals: ['efficiency'] },
        { id: 'mobile', name: 'Mobile User', device: 'mobile', context: 'on-the-go' },
      ],
      scenarioGeneration: {
        enableAIGeneration: true,
        maxScenariosPerPersona: 20,
        includeEdgeCases: true,
        adaptToUserBehavior: true,
      },
      metricsCollection: {
        taskCompletionRate: true,
        timeOnTask: true,
        errorRate: true,
        satisfactionScore: true,
        cognitiveLoad: true,
        learnability: true,
      },
      heuristicEvaluation: {
        enableNielsenHeuristics: true,
        enableCustomHeuristics: true,
        automationLevel: 'high',
        aiEnhancedAnalysis: true,
      },
      feedbackGeneration: {
        enableSyntheticFeedback: true,
        sentimentAnalysis: true,
        behaviorPatternAnalysis: true,
        preferenceMapping: true,
      },
      reporting: {
        enableRealTimeReporting: true,
        includeActionableInsights: true,
        generateImprovementSuggestions: true,
        exportFormats: ['json', 'html', 'pdf'],
      },
    };

    framework = new AIUsabilityTestingFramework(mockConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Framework Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultFramework = new AIUsabilityTestingFramework();
      expect(defaultFramework).toBeDefined();
    });

    it('should initialize with custom configuration', () => {
      expect(framework).toBeDefined();
      expect(framework['config']).toMatchObject(mockConfig);
    });

    it('should properly setup user personas', async () => {
      await framework.initialize();
      expect(framework['isInitialized']).toBe(true);
      expect(framework['userPersonas']).toHaveLength(3);
    });
  });

  describe('11.7.1 - AI-driven Usability Testing Framework', () => {
    it('should establish comprehensive usability testing framework', async () => {
      await framework.initialize();

      const frameworkSetup = await framework.setupUsabilityFramework();

      expect(frameworkSetup).toBeDefined();
      expect(frameworkSetup).toHaveProperty('testingStrategy');
      expect(frameworkSetup).toHaveProperty('evaluationCriteria');
      expect(frameworkSetup).toHaveProperty('automationCapabilities');
      expect(frameworkSetup).toHaveProperty('aiIntegration');

      expect(frameworkSetup.testingStrategy).toHaveProperty('userCentered');
      expect(frameworkSetup.evaluationCriteria).toHaveProperty('heuristics');
      expect(frameworkSetup.automationCapabilities).toHaveProperty('scenarioGeneration');
      expect(frameworkSetup.aiIntegration).toHaveProperty('behaviorPrediction');
    });

    it('should integrate multiple usability testing methodologies', async () => {
      await framework.initialize();

      const methodologies = await framework.getAvailableMethodologies();

      expect(Array.isArray(methodologies)).toBe(true);
      expect(methodologies).toContain('heuristic-evaluation');
      expect(methodologies).toContain('cognitive-walkthrough');
      expect(methodologies).toContain('task-analysis');
      expect(methodologies).toContain('user-journey-mapping');
    });

    it('should configure AI-driven testing parameters', async () => {
      await framework.initialize();

      const aiConfig = await framework.configureAIParameters();

      expect(aiConfig).toBeDefined();
      expect(aiConfig).toHaveProperty('behaviorModelingEnabled');
      expect(aiConfig).toHaveProperty('predictiveAnalytics');
      expect(aiConfig).toHaveProperty('adaptiveTesting');
      expect(aiConfig).toHaveProperty('intelligentScenarios');

      expect(aiConfig.behaviorModelingEnabled).toBe(true);
      expect(aiConfig.predictiveAnalytics).toBe(true);
    });
  });

  describe('11.7.2 - Automated User Scenario Generation', () => {
    it('should generate user scenarios for different personas', async () => {
      await framework.initialize();

      const scenarios = await framework.generateUserScenarios();

      expect(Array.isArray(scenarios)).toBe(true);
      expect(scenarios.length).toBeGreaterThan(0);

      scenarios.forEach((scenario: UserScenario) => {
        expect(scenario).toHaveProperty('id');
        expect(scenario).toHaveProperty('name');
        expect(scenario).toHaveProperty('persona');
        expect(scenario).toHaveProperty('context');
        expect(scenario).toHaveProperty('tasks');
        expect(scenario).toHaveProperty('expectedOutcome');
        expect(scenario).toHaveProperty('successCriteria');
        expect(scenario).toHaveProperty('complexity');

        expect(['novice', 'expert', 'mobile']).toContain(scenario.persona.id);
        expect(Array.isArray(scenario.tasks)).toBe(true);
        expect(scenario.tasks.length).toBeGreaterThan(0);
      });
    });

    it('should adapt scenarios based on user behavior patterns', async () => {
      await framework.initialize();

      const behaviorPattern: UserBehaviorPattern = {
        userId: 'test-user',
        sessionData: [
          { action: 'click', element: 'button', timestamp: Date.now() },
          { action: 'scroll', direction: 'down', timestamp: Date.now() + 1000 },
        ],
        preferences: { fastNavigation: true, detailedInformation: false },
        skillLevel: 'intermediate',
      };

      const adaptedScenarios = await framework.adaptScenariosToUserBehavior([behaviorPattern]);

      expect(Array.isArray(adaptedScenarios)).toBe(true);
      adaptedScenarios.forEach((scenario) => {
        expect(scenario).toHaveProperty('adaptations');
        expect(Array.isArray(scenario.adaptations)).toBe(true);
      });
    });

    it('should generate edge case scenarios', async () => {
      await framework.initialize();

      const edgeCases = await framework.generateEdgeCaseScenarios();

      expect(Array.isArray(edgeCases)).toBe(true);
      edgeCases.forEach((scenario) => {
        expect(scenario).toHaveProperty('isEdgeCase');
        expect(scenario.isEdgeCase).toBe(true);
        expect(scenario).toHaveProperty('riskLevel');
        expect(['low', 'medium', 'high']).toContain(scenario.riskLevel);
      });
    });
  });

  describe('11.7.3 - Usability Metrics Collection', () => {
    it('should collect comprehensive usability metrics', async () => {
      await framework.initialize();

      const mockUserSession = {
        userId: 'test-user',
        scenarioId: 'scenario-1',
        startTime: Date.now(),
        interactions: [
          { type: 'click', target: 'button', timestamp: Date.now() },
          { type: 'input', target: 'form-field', value: 'test', timestamp: Date.now() + 1000 },
        ],
      };

      const metrics = await framework.collectUsabilityMetrics(mockUserSession);

      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('taskCompletionRate');
      expect(metrics).toHaveProperty('timeOnTask');
      expect(metrics).toHaveProperty('errorRate');
      expect(metrics).toHaveProperty('satisfactionScore');
      expect(metrics).toHaveProperty('cognitiveLoad');
      expect(metrics).toHaveProperty('learnability');

      expect(typeof metrics.taskCompletionRate).toBe('number');
      expect(metrics.taskCompletionRate).toBeGreaterThanOrEqual(0);
      expect(metrics.taskCompletionRate).toBeLessThanOrEqual(100);
    });

    it('should calculate advanced usability metrics', async () => {
      await framework.initialize();

      const advancedMetrics = await framework.calculateAdvancedMetrics();

      expect(advancedMetrics).toBeDefined();
      expect(advancedMetrics).toHaveProperty('systemUsabilityScale');
      expect(advancedMetrics).toHaveProperty('netPromoterScore');
      expect(advancedMetrics).toHaveProperty('userEffortScore');
      expect(advancedMetrics).toHaveProperty('taskLoadIndex');

      expect(typeof advancedMetrics.systemUsabilityScale).toBe('number');
      expect(advancedMetrics.systemUsabilityScale).toBeGreaterThanOrEqual(0);
      expect(advancedMetrics.systemUsabilityScale).toBeLessThanOrEqual(100);
    });

    it('should track metrics across different user segments', async () => {
      await framework.initialize();

      const segmentMetrics = await framework.getMetricsBySegment();

      expect(segmentMetrics).toBeDefined();
      expect(segmentMetrics).toHaveProperty('byPersona');
      expect(segmentMetrics).toHaveProperty('byDevice');
      expect(segmentMetrics).toHaveProperty('byExperience');

      Object.values(segmentMetrics.byPersona).forEach((metrics: any) => {
        expect(metrics).toHaveProperty('averageTaskTime');
        expect(metrics).toHaveProperty('completionRate');
        expect(metrics).toHaveProperty('errorFrequency');
      });
    });
  });

  describe('11.7.4 - Synthetic User Feedback Generation', () => {
    it('should generate realistic user feedback', async () => {
      await framework.initialize();

      const feedback = await framework.generateSyntheticFeedback('scenario-1');

      expect(Array.isArray(feedback)).toBe(true);
      feedback.forEach((item) => {
        expect(item).toHaveProperty('userId');
        expect(item).toHaveProperty('feedback');
        expect(item).toHaveProperty('sentiment');
        expect(item).toHaveProperty('category');
        expect(item).toHaveProperty('severity');
        expect(item).toHaveProperty('actionable');

        expect(['positive', 'neutral', 'negative']).toContain(item.sentiment);
        expect(typeof item.actionable).toBe('boolean');
      });
    });

    it('should perform sentiment analysis on feedback', async () => {
      await framework.initialize();

      const testFeedback = [
        { text: 'This interface is really confusing and hard to use', userId: 'user1' },
        { text: 'Great design, very intuitive and easy to navigate', userId: 'user2' },
        { text: 'The button placement is okay but could be better', userId: 'user3' },
      ];

      const sentimentResults = await framework.analyzeFeedbackSentiment(testFeedback);

      expect(Array.isArray(sentimentResults)).toBe(true);
      expect(sentimentResults).toHaveLength(3);

      sentimentResults.forEach((result) => {
        expect(result).toHaveProperty('sentiment');
        expect(result).toHaveProperty('confidence');
        expect(result).toHaveProperty('emotions');
        expect(['positive', 'neutral', 'negative']).toContain(result.sentiment);
        expect(typeof result.confidence).toBe('number');
      });
    });

    it('should map user preferences from behavior patterns', async () => {
      await framework.initialize();

      const behaviorData = {
        clickPatterns: [{ element: 'menu', frequency: 15 }],
        navigationPaths: [['home', 'products', 'checkout']],
        timeSpent: { pages: { home: 30, products: 120, checkout: 45 } },
      };

      const preferences = await framework.mapUserPreferences(behaviorData);

      expect(preferences).toBeDefined();
      expect(preferences).toHaveProperty('navigationStyle');
      expect(preferences).toHaveProperty('informationProcessing');
      expect(preferences).toHaveProperty('interactionPreferences');

      expect(['linear', 'exploratory', 'goal-oriented']).toContain(preferences.navigationStyle);
    });
  });

  describe('11.7.5 - AI-powered Heuristic Evaluation', () => {
    it('should perform Nielsen heuristic evaluation', async () => {
      await framework.initialize();

      const heuristicResults = await framework.performHeuristicEvaluation('/test-interface');

      expect(heuristicResults).toBeDefined();
      expect(heuristicResults).toHaveProperty('heuristics');
      expect(Array.isArray(heuristicResults.heuristics)).toBe(true);

      const nielsenHeuristics = [
        'visibility-of-system-status',
        'match-system-real-world',
        'user-control-freedom',
        'consistency-standards',
        'error-prevention',
        'recognition-recall',
        'flexibility-efficiency',
        'aesthetic-minimalist',
        'error-recovery',
        'help-documentation',
      ];

      heuristicResults.heuristics.forEach((heuristic: any) => {
        expect(heuristic).toHaveProperty('id');
        expect(heuristic).toHaveProperty('name');
        expect(heuristic).toHaveProperty('score');
        expect(heuristic).toHaveProperty('violations');
        expect(heuristic).toHaveProperty('recommendations');

        expect(nielsenHeuristics).toContain(heuristic.id);
        expect(typeof heuristic.score).toBe('number');
        expect(heuristic.score).toBeGreaterThanOrEqual(0);
        expect(heuristic.score).toBeLessThanOrEqual(10);
      });
    });

    it('should apply custom heuristics for domain-specific evaluation', async () => {
      await framework.initialize();

      const customHeuristics = [
        { id: 'data-visualization', name: 'Data Clarity' },
        { id: 'mobile-optimization', name: 'Mobile Experience' },
      ];

      const evaluation = await framework.applyCustomHeuristics('/dashboard', customHeuristics);

      expect(evaluation).toBeDefined();
      expect(evaluation).toHaveProperty('customResults');
      expect(Array.isArray(evaluation.customResults)).toBe(true);

      evaluation.customResults.forEach((result: any) => {
        expect(result).toHaveProperty('heuristicId');
        expect(result).toHaveProperty('compliance');
        expect(result).toHaveProperty('issues');
        expect(customHeuristics.map((h) => h.id)).toContain(result.heuristicId);
      });
    });

    it('should provide AI-enhanced analysis and insights', async () => {
      await framework.initialize();

      const aiAnalysis = await framework.generateAIInsights('/complex-interface');

      expect(aiAnalysis).toBeDefined();
      expect(aiAnalysis).toHaveProperty('keyFindings');
      expect(aiAnalysis).toHaveProperty('usabilityIssues');
      expect(aiAnalysis).toHaveProperty('improvementOpportunities');
      expect(aiAnalysis).toHaveProperty('predictedUserImpact');

      expect(Array.isArray(aiAnalysis.keyFindings)).toBe(true);
      expect(Array.isArray(aiAnalysis.usabilityIssues)).toBe(true);
    });
  });

  describe('11.7.6 - Usability Reporting and Insights', () => {
    it('should generate comprehensive usability reports', async () => {
      await framework.initialize();

      const report = await framework.generateUsabilityReport();

      expect(report).toBeDefined();
      expect(report).toHaveProperty('executiveSummary');
      expect(report).toHaveProperty('detailedFindings');
      expect(report).toHaveProperty('metricsAnalysis');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('actionPlan');

      expect(typeof report.executiveSummary).toBe('string');
      expect(report.executiveSummary.length).toBeGreaterThan(0);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should provide actionable insights with priority ranking', async () => {
      await framework.initialize();

      const insights = await framework.generateActionableInsights();

      expect(Array.isArray(insights)).toBe(true);
      insights.forEach((insight) => {
        expect(insight).toHaveProperty('issue');
        expect(insight).toHaveProperty('impact');
        expect(insight).toHaveProperty('effort');
        expect(insight).toHaveProperty('priority');
        expect(insight).toHaveProperty('recommendation');

        expect(['low', 'medium', 'high', 'critical']).toContain(insight.impact);
        expect(['low', 'medium', 'high']).toContain(insight.effort);
        expect(typeof insight.priority).toBe('number');
      });
    });

    it('should create visual usability dashboards', async () => {
      await framework.initialize();

      const dashboard = await framework.createUsabilityDashboard();

      expect(dashboard).toBeDefined();
      expect(dashboard).toHaveProperty('overallScore');
      expect(dashboard).toHaveProperty('metricsTrends');
      expect(dashboard).toHaveProperty('issueBreakdown');
      expect(dashboard).toHaveProperty('userSegmentAnalysis');

      expect(typeof dashboard.overallScore).toBe('number');
      expect(dashboard.overallScore).toBeGreaterThanOrEqual(0);
      expect(dashboard.overallScore).toBeLessThanOrEqual(100);
    });
  });

  describe('11.7.7 - Usability Improvement Tracking', () => {
    it('should track usability improvements over time', async () => {
      await framework.initialize();

      const tracking = await framework.trackUsabilityImprovements();

      expect(tracking).toBeDefined();
      expect(tracking).toHaveProperty('baseline');
      expect(tracking).toHaveProperty('currentState');
      expect(tracking).toHaveProperty('improvements');
      expect(tracking).toHaveProperty('trends');

      expect(Array.isArray(tracking.improvements)).toBe(true);
      tracking.improvements.forEach((improvement: any) => {
        expect(improvement).toHaveProperty('area');
        expect(improvement).toHaveProperty('change');
        expect(improvement).toHaveProperty('impact');
        expect(typeof improvement.change).toBe('number');
      });
    });

    it('should measure improvement effectiveness', async () => {
      await framework.initialize();

      const effectiveness = await framework.measureImprovementEffectiveness();

      expect(effectiveness).toBeDefined();
      expect(effectiveness).toHaveProperty('roi');
      expect(effectiveness).toHaveProperty('userSatisfactionChange');
      expect(effectiveness).toHaveProperty('taskEfficiencyGains');
      expect(effectiveness).toHaveProperty('errorReduction');

      expect(typeof effectiveness.roi).toBe('number');
      expect(typeof effectiveness.userSatisfactionChange).toBe('number');
    });

    it('should predict future usability trends', async () => {
      await framework.initialize();

      const predictions = await framework.predictUsabilityTrends();

      expect(predictions).toBeDefined();
      expect(predictions).toHaveProperty('projectedScores');
      expect(predictions).toHaveProperty('emergingIssues');
      expect(predictions).toHaveProperty('improvementOpportunities');

      expect(Array.isArray(predictions.projectedScores)).toBe(true);
      expect(Array.isArray(predictions.emergingIssues)).toBe(true);
    });
  });

  describe('11.7.8 - Usability Testing Effectiveness Monitoring', () => {
    it('should monitor testing process effectiveness', async () => {
      await framework.initialize();

      const effectiveness = await framework.monitorTestingEffectiveness();

      expect(effectiveness).toBeDefined();
      expect(effectiveness).toHaveProperty('testCoverage');
      expect(effectiveness).toHaveProperty('issueDetectionRate');
      expect(effectiveness).toHaveProperty('falsePositiveRate');
      expect(effectiveness).toHaveProperty('testingVelocity');

      expect(typeof effectiveness.testCoverage).toBe('number');
      expect(effectiveness.testCoverage).toBeGreaterThanOrEqual(0);
      expect(effectiveness.testCoverage).toBeLessThanOrEqual(100);
    });

    it('should optimize testing strategies based on effectiveness data', async () => {
      await framework.initialize();

      const optimization = await framework.optimizeTestingStrategy();

      expect(optimization).toBeDefined();
      expect(optimization).toHaveProperty('recommendedChanges');
      expect(optimization).toHaveProperty('expectedImprovements');
      expect(optimization).toHaveProperty('implementationPlan');

      expect(Array.isArray(optimization.recommendedChanges)).toBe(true);
    });

    it('should provide continuous improvement recommendations', async () => {
      await framework.initialize();

      const recommendations = await framework.generateContinuousImprovements();

      expect(Array.isArray(recommendations)).toBe(true);
      recommendations.forEach((rec) => {
        expect(rec).toHaveProperty('area');
        expect(rec).toHaveProperty('suggestion');
        expect(rec).toHaveProperty('expectedBenefit');
        expect(rec).toHaveProperty('implementationComplexity');
      });
    });
  });

  describe('Integration and Performance Tests', () => {
    it('should handle multiple concurrent usability tests', async () => {
      await framework.initialize();

      const concurrentTests = Array.from({ length: 3 }, (_, i) =>
        framework.runUsabilityTest(`scenario-${i}`)
      );

      const results = await Promise.all(concurrentTests);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toHaveProperty('scenarioId');
        expect(result).toHaveProperty('metrics');
        expect(result).toHaveProperty('issues');
      });
    });

    it('should maintain performance under load', async () => {
      await framework.initialize();

      const startTime = Date.now();
      await framework.generateUsabilityReport();
      const endTime = Date.now();

      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(8000); // Should complete within 8 seconds
    });

    it('should handle edge cases gracefully', async () => {
      await framework.initialize();

      // Test with empty user data
      const result = await framework.generateSyntheticFeedback('non-existent-scenario');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should properly cleanup resources after testing', async () => {
      await framework.initialize();
      await framework.runUsabilityTest('test-scenario');

      const cleanupResult = await framework.cleanup();
      expect(cleanupResult).toBe(true);
    });

    it('should handle multiple cleanup calls safely', async () => {
      await framework.initialize();

      const cleanup1 = await framework.cleanup();
      const cleanup2 = await framework.cleanup();

      expect(cleanup1).toBe(true);
      expect(cleanup2).toBe(true);
    });
  });
});
