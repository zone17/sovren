import { z } from 'zod';

/**
 * Quality Metrics Types for Sovren Platform
 * Supports US-159 through US-162 implementations
 */

// ========================================
// US-159: Code Coverage Tracking Types
// ========================================

export const CoverageMetricSchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  projectId: z.string(),
  branch: z.string(),
  commit: z.string(),
  linesCovered: z.number().min(0),
  linesTotal: z.number().min(0),
  branchesCovered: z.number().min(0),
  branchesTotal: z.number().min(0),
  functionsCovered: z.number().min(0),
  functionsTotal: z.number().min(0),
  statementsCovered: z.number().min(0),
  statementsTotal: z.number().min(0),
  coveragePercentage: z.number().min(0).max(100),
  pathCoverage: z.number().min(0).max(100),
  qualityScore: z.number().min(0).max(100),
  trends: z.array(
    z.object({
      date: z.string().datetime(),
      coverage: z.number().min(0).max(100),
      change: z.number(),
    })
  ),
  files: z.array(
    z.object({
      path: z.string(),
      coverage: z.number().min(0).max(100),
      uncoveredLines: z.array(z.number()),
      complexityScore: z.number().min(0),
    })
  ),
  threshold: z.object({
    minimum: z.number().min(0).max(100),
    target: z.number().min(0).max(100),
    adaptive: z.boolean(),
    enforcement: z.enum(['strict', 'warning', 'disabled']),
  }),
  aiInsights: z.object({
    suggestions: z.array(z.string()),
    predictedCoverage: z.number().min(0).max(100),
    improvementAreas: z.array(z.string()),
    riskAssessment: z.enum(['low', 'medium', 'high', 'critical']),
  }),
});

export const CoverageReportSchema = z.object({
  id: z.string(),
  generatedAt: z.string().datetime(),
  metrics: CoverageMetricSchema,
  visualizations: z.array(
    z.object({
      type: z.enum(['line_chart', 'heatmap', 'treemap', 'gauge']),
      data: z.record(
        z.string(),
        z.union([z.string(), z.number(), z.boolean(), z.array(z.unknown()), z.null()])
      ),
      config: z
        .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
        .optional(),
    })
  ),
  recommendations: z.array(
    z.object({
      priority: z.enum(['high', 'medium', 'low']),
      description: z.string(),
      impact: z.string(),
      effort: z.enum(['low', 'medium', 'high']),
      automated: z.boolean(),
    })
  ),
  status: z.enum(['passing', 'warning', 'failing']),
  alerts: z.array(
    z.object({
      type: z.enum(['threshold_breach', 'regression', 'improvement']),
      message: z.string(),
      severity: z.enum(['info', 'warning', 'error', 'critical']),
    })
  ),
});

export type CoverageMetric = z.infer<typeof CoverageMetricSchema>;
export type CoverageReport = z.infer<typeof CoverageReportSchema>;

// ========================================
// US-160: Code Quality Metrics Types
// ========================================

export const CodeQualityMetricSchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  projectId: z.string(),
  branch: z.string(),
  commit: z.string(),
  overallScore: z.number().min(0).max(100),
  maintainabilityIndex: z.number().min(0).max(100),
  cyclomaticComplexity: z.number().min(0),
  cognitiveComplexity: z.number().min(0),
  technicalDebt: z.object({
    minutes: z.number().min(0),
    ratio: z.number().min(0).max(100),
    classification: z.enum(['A', 'B', 'C', 'D', 'E']),
  }),
  duplication: z.object({
    percentage: z.number().min(0).max(100),
    blocks: z.number().min(0),
    lines: z.number().min(0),
  }),
  violations: z.array(
    z.object({
      rule: z.string(),
      severity: z.enum(['info', 'minor', 'major', 'critical', 'blocker']),
      count: z.number().min(0),
      file: z.string(),
      line: z.number().optional(),
      message: z.string(),
      effort: z.number().min(0), // minutes to fix
    })
  ),
  trends: z.array(
    z.object({
      date: z.string().datetime(),
      score: z.number().min(0).max(100),
      change: z.number(),
    })
  ),
  aiAnalysis: z.object({
    patterns: z.array(z.string()),
    refactoringOpportunities: z.array(
      z.object({
        file: z.string(),
        function: z.string(),
        suggestion: z.string(),
        impact: z.enum(['low', 'medium', 'high']),
        confidence: z.number().min(0).max(1),
      })
    ),
    hotspots: z.array(
      z.object({
        file: z.string(),
        riskScore: z.number().min(0).max(100),
        issues: z.array(z.string()),
      })
    ),
    forecast: z.object({
      nextWeek: z.number().min(0).max(100),
      nextMonth: z.number().min(0).max(100),
      confidence: z.number().min(0).max(1),
    }),
  }),
  gates: z.object({
    qualityGate: z.enum(['passed', 'warning', 'failed']),
    thresholds: z.record(z.string(), z.number()),
    blockers: z.array(z.string()),
    warnings: z.array(z.string()),
  }),
});

export const CodeQualityDashboardSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  timeframe: z.enum(['day', 'week', 'month', 'quarter', 'year']),
  metrics: CodeQualityMetricSchema,
  comparisons: z.array(
    z.object({
      type: z.enum(['previous_period', 'baseline', 'target']),
      value: z.number(),
      change: z.number(),
      trend: z.enum(['up', 'down', 'stable']),
    })
  ),
  insights: z.array(
    z.object({
      type: z.enum(['improvement', 'regression', 'stability', 'anomaly']),
      title: z.string(),
      description: z.string(),
      actionable: z.boolean(),
      priority: z.enum(['low', 'medium', 'high', 'critical']),
    })
  ),
  recommendations: z.array(
    z.object({
      category: z.enum(['performance', 'maintainability', 'reliability', 'security']),
      action: z.string(),
      impact: z.string(),
      effort: z.enum(['low', 'medium', 'high']),
      automated: z.boolean(),
    })
  ),
});

export type CodeQualityMetric = z.infer<typeof CodeQualityMetricSchema>;
export type CodeQualityDashboard = z.infer<typeof CodeQualityDashboardSchema>;

// ========================================
// US-161: Bug Tracking and Resolution Types
// ========================================

export const BugMetricSchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  projectId: z.string(),
  totalBugs: z.number().min(0),
  openBugs: z.number().min(0),
  resolvedBugs: z.number().min(0),
  criticalBugs: z.number().min(0),
  averageResolutionTime: z.number().min(0), // hours
  bugVelocity: z.number(), // bugs resolved per day
  escapedBugs: z.number().min(0), // bugs found in production
  regressionRate: z.number().min(0).max(100),
  defectDensity: z.number().min(0), // bugs per KLOC
  categories: z.record(z.string(), z.number()),
  severity: z.object({
    critical: z.number().min(0),
    high: z.number().min(0),
    medium: z.number().min(0),
    low: z.number().min(0),
  }),
  trends: z.array(
    z.object({
      date: z.string().datetime(),
      opened: z.number().min(0),
      resolved: z.number().min(0),
      backlog: z.number().min(0),
    })
  ),
  aiClassification: z.object({
    accuracy: z.number().min(0).max(1),
    patterns: z.array(
      z.object({
        pattern: z.string(),
        frequency: z.number().min(0),
        impact: z.enum(['low', 'medium', 'high']),
      })
    ),
    predictions: z.object({
      nextWeekBugs: z.number().min(0),
      hotspots: z.array(z.string()),
      riskAreas: z.array(z.string()),
    }),
    rootCauses: z.array(
      z.object({
        cause: z.string(),
        frequency: z.number().min(0),
        preventable: z.boolean(),
      })
    ),
  }),
  performance: z.object({
    timeToDetection: z.number().min(0), // hours
    timeToResolution: z.number().min(0), // hours
    firstTimeFixRate: z.number().min(0).max(100),
    reopenRate: z.number().min(0).max(100),
  }),
});

export const BugTrackingDashboardSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  metrics: BugMetricSchema,
  workflows: z.array(
    z.object({
      name: z.string(),
      status: z.enum(['active', 'paused', 'disabled']),
      efficiency: z.number().min(0).max(100),
      automationLevel: z.number().min(0).max(100),
      interventions: z.number().min(0),
    })
  ),
  alerts: z.array(
    z.object({
      type: z.enum(['spike', 'regression', 'threshold_breach', 'pattern_anomaly']),
      severity: z.enum(['info', 'warning', 'critical']),
      message: z.string(),
      actionRequired: z.boolean(),
      autoResolvable: z.boolean(),
    })
  ),
  reports: z.array(
    z.object({
      type: z.enum(['daily', 'weekly', 'monthly', 'incident']),
      generatedAt: z.string().datetime(),
      summary: z.string(),
      keyMetrics: z.record(
        z.string(),
        z.union([
          z.number(),
          z.string(),
          z.boolean(),
          z.object({
            value: z.number(),
            unit: z.string().optional(),
            trend: z.enum(['up', 'down', 'stable']).optional(),
          }),
        ])
      ),
      recommendations: z.array(z.string()),
    })
  ),
});

export type BugMetric = z.infer<typeof BugMetricSchema>;
export type BugTrackingDashboard = z.infer<typeof BugTrackingDashboardSchema>;

// ========================================
// US-162: Performance Benchmarking Types
// ========================================

export const PerformanceBenchmarkSchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  projectId: z.string(),
  environment: z.enum(['development', 'staging', 'production']),
  baseline: z.object({
    version: z.string(),
    timestamp: z.string().datetime(),
    metrics: z.record(z.string(), z.number()),
  }),
  current: z.object({
    version: z.string(),
    timestamp: z.string().datetime(),
    metrics: z.record(z.string(), z.number()),
  }),
  performance: z.object({
    responseTime: z.object({
      average: z.number().min(0),
      p95: z.number().min(0),
      p99: z.number().min(0),
      max: z.number().min(0),
    }),
    throughput: z.object({
      requestsPerSecond: z.number().min(0),
      transactionsPerSecond: z.number().min(0),
      concurrentUsers: z.number().min(0),
    }),
    resources: z.object({
      cpuUsage: z.number().min(0).max(100),
      memoryUsage: z.number().min(0).max(100),
      diskUsage: z.number().min(0).max(100),
      networkUsage: z.number().min(0),
    }),
    errors: z.object({
      rate: z.number().min(0).max(100),
      count: z.number().min(0),
      types: z.record(z.string(), z.number()),
    }),
  }),
  comparisons: z.array(
    z.object({
      metric: z.string(),
      baseline: z.number(),
      current: z.number(),
      change: z.number(),
      changePercent: z.number(),
      trend: z.enum(['improvement', 'regression', 'stable']),
      significance: z.enum(['major', 'minor', 'negligible']),
    })
  ),
  anomalies: z.array(
    z.object({
      metric: z.string(),
      detected: z.string().datetime(),
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      description: z.string(),
      possibleCauses: z.array(z.string()),
      autoResolved: z.boolean(),
    })
  ),
  aiAnalysis: z.object({
    forecast: z.object({
      nextHour: z.record(z.string(), z.number()),
      nextDay: z.record(z.string(), z.number()),
      confidence: z.number().min(0).max(1),
    }),
    optimizations: z.array(
      z.object({
        area: z.string(),
        recommendation: z.string(),
        impact: z.enum(['low', 'medium', 'high']),
        effort: z.enum(['low', 'medium', 'high']),
        automated: z.boolean(),
      })
    ),
    patterns: z.array(
      z.object({
        pattern: z.string(),
        frequency: z.string(),
        correlation: z.number().min(-1).max(1),
      })
    ),
  }),
  alerts: z.array(
    z.object({
      type: z.enum(['threshold_breach', 'regression', 'anomaly', 'prediction']),
      metric: z.string(),
      value: z.number(),
      threshold: z.number(),
      severity: z.enum(['info', 'warning', 'critical']),
      actionable: z.boolean(),
    })
  ),
});

export const PerformanceDashboardSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  timeframe: z.enum(['realtime', 'hour', 'day', 'week', 'month']),
  benchmarks: z.array(PerformanceBenchmarkSchema),
  aggregates: z.object({
    average: z.record(z.string(), z.number()),
    median: z.record(z.string(), z.number()),
    p95: z.record(z.string(), z.number()),
    p99: z.record(z.string(), z.number()),
  }),
  trends: z.array(
    z.object({
      metric: z.string(),
      data: z.array(
        z.object({
          timestamp: z.string().datetime(),
          value: z.number(),
        })
      ),
      trend: z.enum(['improving', 'degrading', 'stable']),
      rate: z.number(), // rate of change
    })
  ),
  insights: z.array(
    z.object({
      type: z.enum(['optimization', 'issue', 'achievement', 'forecast']),
      title: z.string(),
      description: z.string(),
      impact: z.enum(['low', 'medium', 'high']),
      actionable: z.boolean(),
    })
  ),
});

export type PerformanceBenchmark = z.infer<typeof PerformanceBenchmarkSchema>;
export type PerformanceDashboard = z.infer<typeof PerformanceDashboardSchema>;

// ========================================
// Unified Quality Metrics Dashboard
// ========================================

export const QualityMetricsDashboardSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  timestamp: z.string().datetime(),
  overallScore: z.number().min(0).max(100),
  coverage: CoverageMetricSchema,
  quality: CodeQualityMetricSchema,
  bugs: BugMetricSchema,
  performance: PerformanceBenchmarkSchema,
  insights: z.array(
    z.object({
      category: z.enum(['coverage', 'quality', 'bugs', 'performance']),
      type: z.enum(['success', 'warning', 'error', 'info']),
      title: z.string(),
      description: z.string(),
      actionable: z.boolean(),
      automated: z.boolean(),
    })
  ),
  trends: z.object({
    overall: z.array(
      z.object({
        date: z.string().datetime(),
        score: z.number().min(0).max(100),
      })
    ),
    categories: z.record(
      z.string(),
      z.array(
        z.object({
          date: z.string().datetime(),
          value: z.number(),
        })
      )
    ),
  }),
  goals: z.array(
    z.object({
      metric: z.string(),
      current: z.number(),
      target: z.number(),
      deadline: z.string().datetime(),
      progress: z.number().min(0).max(100),
      onTrack: z.boolean(),
    })
  ),
  recommendations: z.array(
    z.object({
      priority: z.enum(['low', 'medium', 'high', 'critical']),
      category: z.enum(['coverage', 'quality', 'bugs', 'performance']),
      action: z.string(),
      impact: z.string(),
      effort: z.enum(['low', 'medium', 'high']),
      automated: z.boolean(),
      roi: z.number().optional(),
    })
  ),
});

export type QualityMetricsDashboard = z.infer<typeof QualityMetricsDashboardSchema>;

// ========================================
// Service Interfaces
// ========================================

/**
 * Quality Thresholds Configuration
 */
export interface QualityThresholds {
  coverage?: {
    min: number;
    target: number;
    enforcement?: 'strict' | 'warning' | 'disabled';
  };
  complexity?: {
    max: number;
    warning: number;
  };
  maintainability?: {
    min: number;
    target: number;
  };
  bugs?: {
    critical: number;
    high: number;
    medium: number;
  };
  performance?: {
    responseTime: number;
    throughput: number;
    errorRate: number;
  };
}

/**
 * Refactoring Suggestion Interface
 */
export interface RefactoringSuggestion {
  file: string;
  line: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'complexity' | 'duplication' | 'performance' | 'maintainability' | 'security';
  description: string;
  estimatedEffort: 'low' | 'medium' | 'high';
  impact: string;
  confidence?: number;
}

/**
 * Bug Classification Result
 */
export interface BugClassification {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'security' | 'performance' | 'functionality' | 'ui' | 'data';
  priority: number;
  estimatedFixTime: string;
  suggestedOwner?: string;
  rootCause?: string;
  preventable: boolean;
}

/**
 * Bug Input for Classification
 */
export interface BugInput {
  title: string;
  description: string;
  stackTrace?: string;
  reproducibilitySteps?: string[];
  environment?: string;
  affectedUsers?: number;
}

/**
 * Anomaly Detection Result
 */
export interface Anomaly {
  type: 'performance' | 'error_rate' | 'resource_usage' | 'pattern_anomaly';
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedComponents: string[];
  suggestedAction: string;
  autoResolvable: boolean;
  possibleCauses?: string[];
}

/**
 * Performance Optimization Recommendation
 */
export interface PerformanceOptimization {
  component: string;
  issue: string;
  currentMetric: number;
  targetMetric: number;
  optimizationType:
    | 'caching'
    | 'lazy_loading'
    | 'code_splitting'
    | 'debouncing'
    | 'database_query'
    | 'resource_usage';
  estimatedImprovement: string;
  implementationSteps: string[];
  effort: 'low' | 'medium' | 'high';
  automated: boolean;
}

export interface CoverageTrackingService {
  getCoverage(projectId: string): Promise<CoverageMetric>;
  generateReport(projectId: string): Promise<CoverageReport>;
  updateThresholds(projectId: string, thresholds: QualityThresholds): Promise<void>;
  trackTrends(projectId: string, days: number): Promise<CoverageMetric[]>;
}

export interface CodeQualityService {
  getQualityMetrics(projectId: string): Promise<CodeQualityMetric>;
  getDashboard(projectId: string): Promise<CodeQualityDashboard>;
  enforceGates(projectId: string): Promise<boolean>;
  getRefactoringSuggestions(projectId: string): Promise<RefactoringSuggestion[]>;
}

export interface BugTrackingService {
  getBugMetrics(projectId: string): Promise<BugMetric>;
  getDashboard(projectId: string): Promise<BugTrackingDashboard>;
  classifyBug(bug: BugInput): Promise<BugClassification>;
  optimizeWorkflows(projectId: string): Promise<void>;
}

export interface PerformanceBenchmarkingService {
  getBenchmarks(projectId: string): Promise<PerformanceBenchmark>;
  getDashboard(projectId: string): Promise<PerformanceDashboard>;
  detectAnomalies(projectId: string): Promise<Anomaly[]>;
  optimizePerformance(projectId: string): Promise<PerformanceOptimization[]>;
}

// ========================================
// Configuration and Settings
// ========================================

export const QualityMetricsConfigSchema = z.object({
  coverage: z.object({
    enabled: z.boolean(),
    thresholds: z.object({
      line: z.number().min(0).max(100),
      branch: z.number().min(0).max(100),
      function: z.number().min(0).max(100),
      statement: z.number().min(0).max(100),
    }),
    enforcement: z.enum(['strict', 'warning', 'disabled']),
    aiOptimization: z.boolean(),
  }),
  quality: z.object({
    enabled: z.boolean(),
    gates: z.record(z.string(), z.number()),
    aiAnalysis: z.boolean(),
    autoRefactoring: z.boolean(),
  }),
  bugs: z.object({
    enabled: z.boolean(),
    autoClassification: z.boolean(),
    workflowOptimization: z.boolean(),
    preventionMode: z.boolean(),
  }),
  performance: z.object({
    enabled: z.boolean(),
    baselineTracking: z.boolean(),
    anomalyDetection: z.boolean(),
    autoOptimization: z.boolean(),
  }),
  reporting: z.object({
    frequency: z.enum(['realtime', 'hourly', 'daily', 'weekly']),
    formats: z.array(z.enum(['json', 'pdf', 'html', 'slack'])),
    stakeholders: z.array(z.string()),
    customMetrics: z.array(z.string()),
  }),
});

export type QualityMetricsConfig = z.infer<typeof QualityMetricsConfigSchema>;
