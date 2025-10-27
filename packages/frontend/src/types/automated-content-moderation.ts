import { z } from 'zod';

// === US-167: AI-Powered Content Moderation Tools ===

export const ModerationActionSchema = z.object({
  id: z.string(),
  type: z.enum(['approve', 'reject', 'flag', 'escalate', 'review']),
  reason: z.string(),
  confidence: z.number().min(0).max(1),
  timestamp: z.string(),
  automated: z.boolean(),
  reviewerId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const ContentModerationResultSchema = z.object({
  contentId: z.string(),
  contentType: z.enum(['post', 'comment', 'media', 'profile', 'message']),
  status: z.enum(['pending', 'approved', 'rejected', 'flagged', 'escalated']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  violations: z.array(
    z.object({
      type: z.string(),
      description: z.string(),
      confidence: z.number().min(0).max(1),
      category: z.enum([
        'spam',
        'harassment',
        'hate_speech',
        'violence',
        'explicit',
        'misinformation',
        'copyright',
        'other',
      ]),
    })
  ),
  actions: z.array(ModerationActionSchema),
  analyzedAt: z.string(),
  reviewedAt: z.string().optional(),
  escalatedAt: z.string().optional(),
  aiModels: z.array(z.string()),
  humanReview: z.boolean(),
  appealable: z.boolean(),
});

export const ModerationWorkflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  rules: z.array(
    z.object({
      id: z.string(),
      condition: z.string(),
      action: z.string(),
      parameters: z.record(z.any()),
      priority: z.number(),
    })
  ),
  escalationRules: z.array(
    z.object({
      trigger: z.string(),
      action: z.string(),
      assigneeType: z.enum(['human', 'ai', 'hybrid']),
      priority: z.enum(['low', 'medium', 'high', 'urgent']),
    })
  ),
  performance: z.object({
    accuracy: z.number(),
    precision: z.number(),
    recall: z.number(),
    falsePositiveRate: z.number(),
    averageProcessingTime: z.number(),
  }),
});

export const ModerationKnowledgeBaseSchema = z.object({
  id: z.string(),
  version: z.string(),
  policies: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      category: z.string(),
      rules: z.array(z.string()),
      examples: z.array(
        z.object({
          content: z.string(),
          violation: z.boolean(),
          explanation: z.string(),
        })
      ),
      lastUpdated: z.string(),
    })
  ),
  patterns: z.array(
    z.object({
      id: z.string(),
      pattern: z.string(),
      type: z.enum(['regex', 'ml_model', 'keyword', 'semantic']),
      confidence: z.number(),
      category: z.string(),
      metadata: z.record(z.any()),
    })
  ),
  emergingThreats: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      description: z.string(),
      detectionRate: z.number(),
      firstSeen: z.string(),
      lastSeen: z.string(),
      countermeasures: z.array(z.string()),
    })
  ),
});

// === US-168: Advanced Automated Content Filtering ===

export const ContentFilterSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['text', 'image', 'video', 'audio', 'multimodal']),
  enabled: z.boolean(),
  confidence: z.number().min(0).max(1),
  filterRules: z.array(
    z.object({
      id: z.string(),
      pattern: z.string(),
      type: z.enum(['keyword', 'regex', 'ml_model', 'semantic', 'visual', 'audio']),
      action: z.enum(['block', 'flag', 'moderate', 'review']),
      weight: z.number(),
      metadata: z.record(z.any()),
    })
  ),
  performance: z.object({
    accuracy: z.number(),
    falsePositives: z.number(),
    falseNegatives: z.number(),
    throughput: z.number(),
    latency: z.number(),
  }),
  selfOptimization: z.object({
    enabled: z.boolean(),
    learningRate: z.number(),
    adaptationThreshold: z.number(),
    lastOptimized: z.string(),
  }),
});

export const FilteringResultSchema = z.object({
  contentId: z.string(),
  filterId: z.string(),
  result: z.enum(['pass', 'block', 'flag', 'review']),
  confidence: z.number().min(0).max(1),
  violationTypes: z.array(z.string()),
  explanation: z.string(),
  processedAt: z.string(),
  processingTime: z.number(),
  modelVersions: z.array(z.string()),
  flaggedElements: z.array(
    z.object({
      type: z.string(),
      location: z.string(),
      confidence: z.number(),
      description: z.string(),
    })
  ),
});

export const FilterPerformanceMetricsSchema = z.object({
  filterId: z.string(),
  period: z.string(),
  totalProcessed: z.number(),
  blocked: z.number(),
  flagged: z.number(),
  approved: z.number(),
  accuracy: z.number(),
  precision: z.number(),
  recall: z.number(),
  f1Score: z.number(),
  avgProcessingTime: z.number(),
  driftDetected: z.boolean(),
  optimizations: z.array(
    z.object({
      timestamp: z.string(),
      type: z.string(),
      improvement: z.number(),
      description: z.string(),
    })
  ),
});

// === US-169: Autonomous User Reporting Systems ===

export const UserReportSchema = z.object({
  id: z.string(),
  reporterId: z.string(),
  reportedContentId: z.string().optional(),
  reportedUserId: z.string().optional(),
  category: z.enum([
    'spam',
    'harassment',
    'hate_speech',
    'violence',
    'explicit',
    'misinformation',
    'copyright',
    'other',
  ]),
  subcategory: z.string().optional(),
  description: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  evidence: z.array(
    z.object({
      type: z.enum(['text', 'image', 'video', 'audio', 'link', 'screenshot']),
      content: z.string(),
      metadata: z.record(z.any()),
    })
  ),
  status: z.enum(['pending', 'investigating', 'resolved', 'dismissed', 'escalated']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  submittedAt: z.string(),
  updatedAt: z.string(),
  resolvedAt: z.string().optional(),
  assignedTo: z.string().optional(),
  aiAnalysis: z.object({
    legitimacy: z.number().min(0).max(1),
    severity: z.number().min(0).max(1),
    category: z.string(),
    confidence: z.number().min(0).max(1),
    similarReports: z.array(z.string()),
    recommendedAction: z.string(),
  }),
  resolution: z
    .object({
      action: z.string(),
      reason: z.string(),
      appealable: z.boolean(),
      followUpRequired: z.boolean(),
    })
    .optional(),
});

export const ReportProcessingWorkflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  steps: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.enum(['validation', 'analysis', 'classification', 'resolution', 'notification']),
      automated: z.boolean(),
      conditions: z.array(z.string()),
      actions: z.array(z.string()),
      sla: z.number(),
      escalationRules: z.array(z.string()),
    })
  ),
  performance: z.object({
    averageProcessingTime: z.number(),
    accuracyRate: z.number(),
    resolutionRate: z.number(),
    appealRate: z.number(),
  }),
  enabled: z.boolean(),
});

export const ReportAnalyticsSchema = z.object({
  period: z.string(),
  totalReports: z.number(),
  reportsByCategory: z.record(z.number()),
  reportsBySeverity: z.record(z.number()),
  resolutionMetrics: z.object({
    averageTime: z.number(),
    resolutionRate: z.number(),
    appealRate: z.number(),
    satisfactionScore: z.number(),
  }),
  patterns: z.array(
    z.object({
      type: z.string(),
      description: z.string(),
      frequency: z.number(),
      trend: z.enum(['increasing', 'decreasing', 'stable']),
      recommendations: z.array(z.string()),
    })
  ),
  falsePositives: z.object({
    rate: z.number(),
    categories: z.record(z.number()),
    improvementActions: z.array(z.string()),
  }),
});

// === US-170: Autonomous Moderation Analytics ===

export const ModerationAnalyticsSchema = z.object({
  id: z.string(),
  period: z.string(),
  overview: z.object({
    totalContentProcessed: z.number(),
    automaticActions: z.number(),
    humanReviews: z.number(),
    escalations: z.number(),
    appeals: z.number(),
    overallAccuracy: z.number(),
  }),
  contentMetrics: z.object({
    byType: z.record(z.number()),
    byCategory: z.record(z.number()),
    bySeverity: z.record(z.number()),
    byAction: z.record(z.number()),
  }),
  performanceMetrics: z.object({
    averageProcessingTime: z.number(),
    throughput: z.number(),
    accuracy: z.number(),
    precision: z.number(),
    recall: z.number(),
    f1Score: z.number(),
    falsePositiveRate: z.number(),
    falseNegativeRate: z.number(),
  }),
  trendsAndPatterns: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      description: z.string(),
      trend: z.enum(['increasing', 'decreasing', 'stable', 'volatile']),
      significance: z.number(),
      recommendation: z.string(),
      actionRequired: z.boolean(),
    })
  ),
  predictiveInsights: z.array(
    z.object({
      id: z.string(),
      prediction: z.string(),
      confidence: z.number(),
      timeframe: z.string(),
      impactLevel: z.enum(['low', 'medium', 'high', 'critical']),
      recommendedActions: z.array(z.string()),
    })
  ),
  benchmarks: z.object({
    industryComparison: z.record(z.number()),
    internalBaseline: z.record(z.number()),
    competitorAnalysis: z.record(z.number()),
  }),
});

export const ModerationKPISchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  currentValue: z.number(),
  targetValue: z.number(),
  trend: z.enum(['improving', 'declining', 'stable']),
  alertThreshold: z.number(),
  criticalThreshold: z.number(),
  unit: z.string(),
  frequency: z.enum(['real-time', 'hourly', 'daily', 'weekly', 'monthly']),
  lastUpdated: z.string(),
  historicalData: z.array(
    z.object({
      timestamp: z.string(),
      value: z.number(),
    })
  ),
});

export const ModerationOptimizationSchema = z.object({
  id: z.string(),
  type: z.enum(['performance', 'accuracy', 'efficiency', 'cost']),
  recommendation: z.string(),
  impact: z.object({
    accuracy: z.number(),
    performance: z.number(),
    cost: z.number(),
    effort: z.number(),
  }),
  implementation: z.object({
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    effort: z.enum(['low', 'medium', 'high']),
    timeline: z.string(),
    resources: z.array(z.string()),
  }),
  riskAssessment: z.object({
    level: z.enum(['low', 'medium', 'high']),
    factors: z.array(z.string()),
    mitigation: z.array(z.string()),
  }),
  success: z.object({
    metrics: z.array(z.string()),
    criteria: z.array(z.string()),
    timeline: z.string(),
  }),
});

// Type exports
export type ModerationAction = z.infer<typeof ModerationActionSchema>;
export type ContentModerationResult = z.infer<typeof ContentModerationResultSchema>;
export type ModerationWorkflow = z.infer<typeof ModerationWorkflowSchema>;
export type ModerationKnowledgeBase = z.infer<typeof ModerationKnowledgeBaseSchema>;
export type ContentFilter = z.infer<typeof ContentFilterSchema>;
export type FilteringResult = z.infer<typeof FilteringResultSchema>;
export type FilterPerformanceMetrics = z.infer<typeof FilterPerformanceMetricsSchema>;
export type UserReport = z.infer<typeof UserReportSchema>;
export type ReportProcessingWorkflow = z.infer<typeof ReportProcessingWorkflowSchema>;
export type ReportAnalytics = z.infer<typeof ReportAnalyticsSchema>;
export type ModerationAnalytics = z.infer<typeof ModerationAnalyticsSchema>;
export type ModerationKPI = z.infer<typeof ModerationKPISchema>;
export type ModerationOptimization = z.infer<typeof ModerationOptimizationSchema>;

// API Response types
export interface AutomatedContentModerationResponse {
  success: boolean;
  data: {
    aiModerationTools: ContentModerationResult[];
    contentFilters: ContentFilter[];
    userReports: UserReport[];
    moderationAnalytics: ModerationAnalytics;
  };
  meta: {
    totalItems: number;
    page: number;
    pageSize: number;
    totalPages: number;
    processingTime: number;
    timestamp: string;
  };
}

export interface ModerationDashboardData {
  overview: {
    totalContentProcessed: number;
    automaticActions: number;
    humanReviews: number;
    accuracy: number;
    avgProcessingTime: number;
  };
  recentActions: ContentModerationResult[];
  trendingViolations: Array<{
    type: string;
    count: number;
    trend: number;
  }>;
  performanceMetrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
  };
  aiModels: Array<{
    name: string;
    version: string;
    accuracy: number;
    lastUpdated: string;
  }>;
}

// Service interfaces
export interface AutomatedContentModerationService {
  // US-167: AI-Powered Content Moderation
  analyzeContent: (contentId: string, contentType: string) => Promise<ContentModerationResult>;
  processWorkflow: (workflowId: string, contentId: string) => Promise<ModerationAction[]>;
  updateKnowledgeBase: (patterns: any[]) => Promise<void>;
  escalateContent: (contentId: string, reason: string) => Promise<void>;

  // US-168: Advanced Automated Content Filtering
  applyFilters: (content: any, filterIds: string[]) => Promise<FilteringResult[]>;
  optimizeFilters: (filterId: string) => Promise<void>;
  monitorFilterPerformance: (filterId: string) => Promise<FilterPerformanceMetrics>;

  // US-169: Autonomous User Reporting
  processReport: (report: Partial<UserReport>) => Promise<UserReport>;
  validateReport: (reportId: string) => Promise<boolean>;
  resolveReport: (reportId: string, resolution: any) => Promise<void>;

  // US-170: Autonomous Moderation Analytics
  generateAnalytics: (period: string) => Promise<ModerationAnalytics>;
  getKPIs: () => Promise<ModerationKPI[]>;
  getOptimizationRecommendations: () => Promise<ModerationOptimization[]>;
}

// Error types
export class AutomatedModerationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AutomatedModerationError';
  }
}

// Constants
export const MODERATION_CONSTANTS = {
  CONFIDENCE_THRESHOLDS: {
    LOW: 0.3,
    MEDIUM: 0.6,
    HIGH: 0.8,
    CRITICAL: 0.95,
  },
  PROCESSING_TIMEOUTS: {
    FAST: 100, // ms
    NORMAL: 500, // ms
    DETAILED: 2000, // ms
  },
  ESCALATION_RULES: {
    HIGH_CONFIDENCE_VIOLATION: 0.9,
    MULTIPLE_VIOLATIONS: 3,
    REPEATED_OFFENDER: 5,
  },
  AI_MODELS: {
    TEXT_CLASSIFIER: 'text-moderation-v3',
    IMAGE_ANALYZER: 'image-moderation-v2',
    VIDEO_ANALYZER: 'video-moderation-v1',
    MULTIMODAL: 'multimodal-moderation-v1',
  },
} as const;
