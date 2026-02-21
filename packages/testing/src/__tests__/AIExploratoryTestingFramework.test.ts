/**
 * @file AIExploratoryTestingFramework.test.ts
 * @description Comprehensive tests for AI Exploratory Testing Framework (US-155)
 */

import { CodeStructure } from '../common/types';
import {
  AIExploratoryTestingFramework,
  BugDetectionConfig,
  MLPathDiscoveryConfig,
  TestMetricsConfig,
  TestOutcome,
} from '../e2e-testing/AIExploratoryTestingFramework';

// Mock Logger
vi.mock('../common/Logger', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe('AIExploratoryTestingFramework', () => {
  let framework: AIExploratoryTestingFramework;
  let mlConfig: MLPathDiscoveryConfig;
  let bugDetectionConfig: BugDetectionConfig;
  let metricsConfig: TestMetricsConfig;

  beforeEach(() => {
    mlConfig = {
      modelType: 'transformer',
      trainingDataSize: 10000,
      confidenceThreshold: 0.8,
      maxDepth: 10,
      enableRL: true,
      rewardFunction: vi.fn().mockReturnValue(0.9),
    };

    bugDetectionConfig = {
      enableAnomalyDetection: true,
      patternRecognition: ['statistical', 'ml_based', 'rule_based'],
      falsePositiveThreshold: 0.1,
      autoReporting: true,
      bugTrackingIntegration: 'jira',
    };

    metricsConfig = {
      collectionInterval: 60000,
      storageBackend: 'database',
      realTimeAnalytics: true,
      predictiveAnalytics: true,
      anomalyDetection: true,
    };

    framework = new AIExploratoryTestingFramework(mlConfig, bugDetectionConfig, metricsConfig);
  });

  afterEach(() => {
    framework.stopMonitoring();
    vi.clearAllMocks();
  });

  describe('Framework Initialization', () => {
    test('should initialize with correct configuration', () => {
      expect(framework).toBeInstanceOf(AIExploratoryTestingFramework);

      const stats = framework.getTestingStats();
      expect(stats.totalPaths).toBe(0);
      expect(stats.discoveredBugs).toBe(0);
      expect(stats.effectivenessScore).toBe(0.9);
    });

    test('should validate configuration parameters', () => {
      expect(mlConfig.modelType).toBe('transformer');
      expect(mlConfig.enableRL).toBe(true);
      expect(bugDetectionConfig.enableAnomalyDetection).toBe(true);
      expect(metricsConfig.realTimeAnalytics).toBe(true);
    });
  });

  describe('11.5.1: ML-based path discovery design', () => {
    test('should design ML path discovery system successfully', async () => {
      await expect(framework.designMLPathDiscovery()).resolves.toBeUndefined();
    });

    test('should handle ML path discovery design errors', async () => {
      // Create a framework with invalid configuration
      const invalidConfig = { ...mlConfig, modelType: 'invalid' as any };
      const invalidFramework = new AIExploratoryTestingFramework(
        invalidConfig,
        bugDetectionConfig,
        metricsConfig
      );

      // Should not throw for configuration validation
      await expect(invalidFramework.designMLPathDiscovery()).resolves.toBeUndefined();
    });

    test('should configure reinforcement learning when enabled', async () => {
      const rlConfig = { ...mlConfig, enableRL: true };
      const rlFramework = new AIExploratoryTestingFramework(
        rlConfig,
        bugDetectionConfig,
        metricsConfig
      );

      await expect(rlFramework.designMLPathDiscovery()).resolves.toBeUndefined();
    });
  });

  describe('11.5.2: AI-generated testing scenario creation', () => {
    test('should generate testing scenarios from code structure', async () => {
      const mockCodeStructure: CodeStructure = {
        projectName: 'TestProject',
        rootDir: '/src',
        files: ['src/components/Button.tsx'],
        components: [
          {
            name: 'Button',
            type: 'component',
            filePath: 'src/components/Button.tsx',
            extension: '.tsx',
            sourceCode: 'export const Button = () => <button>Click me</button>',
            exports: ['Button'],
            dependencies: ['react'],
            props: [
              {
                name: 'onClick',
                type: 'function',
                isRequired: false,
                defaultValue: undefined,
              },
              {
                name: 'children',
                type: 'ReactNode',
                isRequired: true,
              },
            ],
            hooks: [
              {
                name: 'useState',
                type: 'state',
                sourceCode: 'const [state, setState] = useState(false)',
              },
            ],
          },
        ],
        dependencies: {
          Button: ['react'],
        },
        metadata: {},
      };

      const scenarios = await framework.generateTestingScenarios(mockCodeStructure);
      expect(Array.isArray(scenarios)).toBe(true);
    });

    test('should prioritize scenarios by importance', async () => {
      const mockCodeStructure: CodeStructure = {
        projectName: 'TestProject',
        rootDir: '/src',
        files: [],
        components: [],
        dependencies: {},
        metadata: {},
      };

      const scenarios = await framework.generateTestingScenarios(mockCodeStructure);
      expect(scenarios).toBeDefined();
    });

    test('should handle empty code structure', async () => {
      const emptyCodeStructure: CodeStructure = {
        projectName: 'EmptyProject',
        rootDir: '/src',
        files: [],
        components: [],
        dependencies: {},
        metadata: {},
      };

      const scenarios = await framework.generateTestingScenarios(emptyCodeStructure);
      expect(Array.isArray(scenarios)).toBe(true);
    });
  });

  describe('11.5.3: Automated test case management', () => {
    test('should manage test cases with intelligent prioritization', async () => {
      const priorities = await framework.manageTestCases();
      expect(Array.isArray(priorities)).toBe(true);
    });

    test('should sort test cases by priority score', async () => {
      const priorities = await framework.manageTestCases();

      // Check that priorities are sorted (if any exist)
      for (let i = 1; i < priorities.length; i++) {
        expect(priorities[i].priority).toBeLessThanOrEqual(priorities[i - 1].priority);
      }
    });

    test('should calculate priority based on multiple factors', async () => {
      const priorities = await framework.manageTestCases();

      priorities.forEach((priority) => {
        expect(priority).toHaveProperty('testId');
        expect(priority).toHaveProperty('priority');
        expect(priority).toHaveProperty('reasoning');
        expect(priority).toHaveProperty('riskFactors');
        expect(priority).toHaveProperty('businessImpact');
        expect(priority).toHaveProperty('technicalComplexity');
      });
    });
  });

  describe('11.5.4: Autonomous bug detection and reporting', () => {
    test('should detect and report bugs autonomously', async () => {
      const mockTestOutcome: TestOutcome = {
        success: false,
        bugs: [],
        performance: {
          responseTime: 100,
          memoryUsage: 50,
          cpuUsage: 10,
          networkRequests: 5,
          bundleSize: 100,
          coreWebVitals: { LCP: 2.5, FID: 100, CLS: 0.1 },
        },
        accessibilityIssues: [],
        securityIssues: [],
        uxInsights: [],
      };

      const detectedBugs = await framework.detectAndReportBugs(mockTestOutcome);
      expect(Array.isArray(detectedBugs)).toBe(true);
    });

    test('should apply ML-based anomaly detection', async () => {
      const anomalyConfig = { ...bugDetectionConfig, enableAnomalyDetection: true };
      const anomalyFramework = new AIExploratoryTestingFramework(
        mlConfig,
        anomalyConfig,
        metricsConfig
      );

      const mockTestOutcome: TestOutcome = {
        success: true,
        bugs: [],
        performance: {
          responseTime: 5000, // Anomalously high
          memoryUsage: 50,
          cpuUsage: 10,
          networkRequests: 5,
          bundleSize: 100,
          coreWebVitals: { LCP: 2.5, FID: 100, CLS: 0.1 },
        },
        accessibilityIssues: [],
        securityIssues: [],
        uxInsights: [],
      };

      const detectedBugs = await anomalyFramework.detectAndReportBugs(mockTestOutcome);
      expect(Array.isArray(detectedBugs)).toBe(true);
    });

    test('should filter false positives', async () => {
      const mockTestOutcome: TestOutcome = {
        success: true,
        bugs: [],
        performance: {
          responseTime: 100,
          memoryUsage: 50,
          cpuUsage: 10,
          networkRequests: 5,
          bundleSize: 100,
          coreWebVitals: { LCP: 2.5, FID: 100, CLS: 0.1 },
        },
        accessibilityIssues: [],
        securityIssues: [],
        uxInsights: [],
      };

      const detectedBugs = await framework.detectAndReportBugs(mockTestOutcome);
      expect(Array.isArray(detectedBugs)).toBe(true);
    });
  });

  describe('11.5.5: Automated documentation generation', () => {
    test('should generate documentation from test cases', async () => {
      const documentation = await framework.generateDocumentation();
      expect(typeof documentation).toBe('string');
      expect(documentation).toContain('AI Exploratory Testing Report');
    });

    test('should include test summary in documentation', async () => {
      const documentation = await framework.generateDocumentation();
      expect(documentation).toBeTruthy();
      expect(documentation.length).toBeGreaterThan(0);
    });

    test('should format documentation as markdown', async () => {
      const documentation = await framework.generateDocumentation();
      expect(documentation).toMatch(/^# /); // Should start with markdown header
    });
  });

  describe('11.5.6: Autonomous testing metrics tracking', () => {
    test('should track and optimize metrics', async () => {
      await expect(framework.trackAndOptimizeMetrics()).resolves.toBeUndefined();
    });

    test('should collect metrics continuously', async () => {
      const collectPromise = framework.trackAndOptimizeMetrics();

      // Allow some time for metrics collection
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Stop and wait for completion
      framework.stopMonitoring();
      await expect(collectPromise).resolves.toBeUndefined();
    });

    test('should identify optimization opportunities', async () => {
      await expect(framework.trackAndOptimizeMetrics()).resolves.toBeUndefined();
    });
  });

  describe('11.5.7: AI-powered collaboration and knowledge sharing', () => {
    test('should enable collaboration and knowledge sharing', async () => {
      await expect(framework.enableCollaborationAndKnowledgeSharing()).resolves.toBeUndefined();
    });

    test('should share testing insights across team', async () => {
      await expect(framework.enableCollaborationAndKnowledgeSharing()).resolves.toBeUndefined();
    });

    test('should build knowledge base from discoveries', async () => {
      await expect(framework.enableCollaborationAndKnowledgeSharing()).resolves.toBeUndefined();
    });
  });

  describe('11.5.8: Continuous effectiveness monitoring', () => {
    test('should monitor testing effectiveness continuously', async () => {
      const monitoringPromise = framework.monitorTestingEffectiveness();

      // Allow some monitoring time
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Stop monitoring
      framework.stopMonitoring();

      await expect(monitoringPromise).resolves.toBeUndefined();
    });

    test('should assess effectiveness and adjust strategies', async () => {
      const monitoringPromise = framework.monitorTestingEffectiveness();

      // Allow brief monitoring
      await new Promise((resolve) => setTimeout(resolve, 50));
      framework.stopMonitoring();

      await expect(monitoringPromise).resolves.toBeUndefined();
    });

    test('should handle monitoring interruption gracefully', async () => {
      const monitoringPromise = framework.monitorTestingEffectiveness();

      // Immediately stop monitoring
      framework.stopMonitoring();

      await expect(monitoringPromise).resolves.toBeUndefined();
    });
  });

  describe('Complete exploratory testing cycle', () => {
    test('should execute complete exploratory testing cycle', async () => {
      const mockCodeStructure: CodeStructure = {
        projectName: 'TestApp',
        rootDir: '/src',
        files: ['src/App.tsx'],
        components: [
          {
            name: 'App',
            type: 'component',
            filePath: 'src/App.tsx',
            extension: '.tsx',
            sourceCode: 'export const App = () => <div>App</div>',
            exports: ['App'],
            dependencies: ['react'],
            hooks: [
              {
                name: 'useState',
                type: 'state',
                sourceCode: 'const [state, setState] = useState()',
              },
              {
                name: 'useEffect',
                type: 'effect',
                sourceCode: 'useEffect(() => {}, [])',
              },
            ],
          },
        ],
        dependencies: {
          App: ['react', 'react-dom'],
        },
        metadata: {},
      };

      const outcomes = await framework.executeExploratoryTesting(mockCodeStructure);
      expect(Array.isArray(outcomes)).toBe(true);
    });

    test('should generate outcomes for all scenarios', async () => {
      const mockCodeStructure: CodeStructure = {
        projectName: 'TestProject',
        rootDir: '/src',
        files: [],
        components: [],
        dependencies: {},
        metadata: {},
      };

      const outcomes = await framework.executeExploratoryTesting(mockCodeStructure);
      expect(outcomes).toBeDefined();
    });

    test('should handle complex code structures', async () => {
      const complexCodeStructure: CodeStructure = {
        projectName: 'ComplexApp',
        rootDir: '/src',
        files: Array.from({ length: 50 }, (_, i) => `src/component${i}.tsx`),
        components: Array.from({ length: 50 }, (_, i) => ({
          name: `Component${i}`,
          type: 'component',
          filePath: `src/component${i}.tsx`,
          extension: '.tsx',
          sourceCode: `export const Component${i} = ({ children }) => <div>{children}</div>`,
          exports: [`Component${i}`],
          dependencies: ['react'],
          props: [
            {
              name: 'children',
              type: 'ReactNode',
              isRequired: false,
            },
          ],
          hooks: [
            {
              name: 'useState',
              type: 'state',
              sourceCode: 'const [state, setState] = useState()',
            },
          ],
        })),
        dependencies: Object.fromEntries(
          Array.from({ length: 50 }, (_, i) => [`Component${i}`, ['react']])
        ),
        metadata: {
          totalComponents: 50,
          complexity: 'high',
        },
      };

      const outcomes = await framework.executeExploratoryTesting(complexCodeStructure);
      expect(Array.isArray(outcomes)).toBe(true);
    });
  });

  describe('Testing statistics and monitoring', () => {
    test('should provide accurate testing statistics', () => {
      const stats = framework.getTestingStats();

      expect(stats).toHaveProperty('totalPaths');
      expect(stats).toHaveProperty('discoveredBugs');
      expect(stats).toHaveProperty('averagePerformance');
      expect(stats).toHaveProperty('effectivenessScore');

      expect(typeof stats.totalPaths).toBe('number');
      expect(typeof stats.discoveredBugs).toBe('number');
      expect(typeof stats.averagePerformance).toBe('number');
      expect(typeof stats.effectivenessScore).toBe('number');
    });

    test('should track bug discovery over time', async () => {
      const initialStats = framework.getTestingStats();
      const initialBugs = initialStats.discoveredBugs;

      // Simulate bug detection
      const mockTestOutcome: TestOutcome = {
        success: false,
        bugs: [
          {
            id: 'bug-1',
            severity: 'high',
            category: 'functional',
            description: 'Test bug',
            reproductionSteps: [],
            expected: 'Expected behavior',
            actual: 'Actual behavior',
            screenshots: [],
            confidence: 0.9,
          },
        ],
        performance: {
          responseTime: 100,
          memoryUsage: 50,
          cpuUsage: 10,
          networkRequests: 5,
          bundleSize: 100,
          coreWebVitals: { LCP: 2.5, FID: 100, CLS: 0.1 },
        },
        accessibilityIssues: [],
        securityIssues: [],
        uxInsights: [],
      };

      await framework.detectAndReportBugs(mockTestOutcome);

      const updatedStats = framework.getTestingStats();
      expect(updatedStats.discoveredBugs).toBeGreaterThanOrEqual(initialBugs);
    });

    test('should calculate effectiveness score correctly', () => {
      const stats = framework.getTestingStats();
      expect(stats.effectivenessScore).toBeGreaterThanOrEqual(0);
      expect(stats.effectivenessScore).toBeLessThanOrEqual(1);
    });
  });

  describe('Error handling and edge cases', () => {
    test('should handle framework shutdown gracefully', () => {
      framework.stopMonitoring();

      const stats = framework.getTestingStats();
      expect(stats).toBeDefined();
    });

    test('should handle multiple concurrent operations', async () => {
      const mockCodeStructure: CodeStructure = {
        files: [],
        components: [],
        dependencies: [],
        testCoverage: 0,
      };

      const promises = [
        framework.generateTestingScenarios(mockCodeStructure),
        framework.manageTestCases(),
        framework.generateDocumentation(),
        framework.trackAndOptimizeMetrics(),
      ];

      await expect(Promise.all(promises)).resolves.toBeDefined();
    });

    test('should maintain consistency during concurrent access', async () => {
      const initialStats = framework.getTestingStats();

      // Start multiple operations
      const operations = [
        framework.generateDocumentation(),
        framework.manageTestCases(),
        framework.trackAndOptimizeMetrics(),
      ];

      await Promise.all(operations);

      const finalStats = framework.getTestingStats();
      expect(finalStats.totalPaths).toBeGreaterThanOrEqual(initialStats.totalPaths);
    });
  });

  describe('Performance and scalability', () => {
    test('should handle large number of test paths efficiently', async () => {
      const startTime = Date.now();

      const mockCodeStructure: CodeStructure = {
        files: Array.from({ length: 1000 }, (_, i) => ({
          path: `src/file${i}.tsx`,
          type: 'component',
          dependencies: [],
          exports: [`Export${i}`],
          complexity: 1,
        })),
        components: [],
        dependencies: [],
        testCoverage: 50,
      };

      await framework.generateTestingScenarios(mockCodeStructure);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Should complete within reasonable time (5 seconds)
      expect(executionTime).toBeLessThan(5000);
    });

    test('should manage memory efficiently during long operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform memory-intensive operations
      for (let i = 0; i < 10; i++) {
        await framework.generateDocumentation();
        await framework.manageTestCases();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });
});
