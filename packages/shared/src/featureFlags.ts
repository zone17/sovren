import { z } from 'zod';

// Define all feature flags and their types here
export const featureFlagSchema = z.object({
  enablePayments: z.boolean().default(false),
  enableAIRecommendations: z.boolean().default(false),
  enableNostrIntegration: z.boolean().default(true),
  enableExperimentalUI: z.boolean().default(false),

  // 🌐 NOSTR Protocol Feature Flags (Granular Control)
  enableNostrKeyGeneration: z.boolean().default(true),
  enableNostrEventPublishing: z.boolean().default(true),
  enableNostrEventSubscription: z.boolean().default(true),
  enableNostrDirectMessages: z.boolean().default(false), // NIP-04
  enableNostrContactList: z.boolean().default(true), // NIP-02
  enableNostrEventCaching: z.boolean().default(true),
  enableNostrRelay: z.boolean().default(true),
  enableNostrAIContentDiscovery: z.boolean().default(false),
  enableNostrMobileOptimizations: z.boolean().default(true),

  // 👤 USER MANAGEMENT FEATURE FLAGS (Step 4)
  enableUserRegistration: z.boolean().default(true),
  enableUserProfileManagement: z.boolean().default(true),
  enableUserSearch: z.boolean().default(true),
  enableUserDiscovery: z.boolean().default(true),
  enableUserFollowing: z.boolean().default(true),
  enableCreatorProfiles: z.boolean().default(true),
  enableSupporterProfiles: z.boolean().default(true),
  enableUserPrivacySettings: z.boolean().default(true),
  enableUserPreferences: z.boolean().default(true),
  enableProfileImageUpload: z.boolean().default(true),
  enableProfileImageOptimization: z.boolean().default(true),
  enableUserVerification: z.boolean().default(false),
  enableNostrIdentityVerification: z.boolean().default(true),
  enableUserAnalytics: z.boolean().default(false),
  enableUserActivityTracking: z.boolean().default(true),
  enableAIUserRecommendations: z.boolean().default(false),
  enableAdvancedUserSearch: z.boolean().default(false),
  enableUserSubscriptions: z.boolean().default(false),
  enableCreatorStats: z.boolean().default(true),
  enableSupporterStats: z.boolean().default(true),
  enableUserExport: z.boolean().default(false),
  enableUserDeletion: z.boolean().default(false),

  // 📊 CREATOR DASHBOARD ANALYTICS FEATURE FLAGS (US-067 to US-070)
  enableAnalyticsDashboard: z.boolean().default(true), // US-067: Analytics dashboard for monitoring key metrics
  enableContentPerformance: z.boolean().default(true), // US-068: Content performance breakdown
  enableAudienceGrowth: z.boolean().default(true), // US-069: Audience growth visualization
  enableRevenueTracking: z.boolean().default(true), // US-070: Revenue tracking and forecasting
  enableAdvancedAnalytics: z.boolean().default(false), // Advanced analytics features
  enableRealTimeUpdates: z.boolean().default(false), // Real-time dashboard updates
  enableExportFeatures: z.boolean().default(false), // Data export functionality
  enableAnalyticsNotifications: z.boolean().default(false), // Analytics-based notifications
  enablePredictiveAnalytics: z.boolean().default(false), // AI-powered predictions
  enableCustomDashboards: z.boolean().default(false), // Custom dashboard layouts

  // 📊 Analytics Dashboard - US-067 to US-070 (LEGENDARY TIER)
  enableDashboardCustomization: z.boolean().default(false),
  enableForecastingAI: z.boolean().default(false),
  enableLightningAnalytics: z.boolean().default(false),

  // 📚 Content Management Tools - US-071 to US-074 (LEGENDARY TIER)
  enableContentLibrary: z.boolean().default(false),
  enableContentScheduling: z.boolean().default(false),
  enableContentMetrics: z.boolean().default(false),
  enableContentStrategy: z.boolean().default(false),
  enableBulkOperations: z.boolean().default(false),
  enableSchedulingCalendar: z.boolean().default(false),
  enablePerformanceAnalytics: z.boolean().default(false),
  enableStrategyAI: z.boolean().default(false),
  enableContentOptimization: z.boolean().default(false),
  enableCompetitiveAnalysis: z.boolean().default(false),

  // 🎯 SUPPORTER EXPERIENCE FEATURE FLAGS (US-075 TO US-078) - LEGENDARY TIER
  enablePersonalizedFeed: z.boolean().default(false), // US-075: Personalized content feed
  enableCategoryBrowsing: z.boolean().default(false), // US-076: Category-based browsing
  enableAdvancedSearch: z.boolean().default(false), // US-077: Search functionality with filters
  enableTrendingContent: z.boolean().default(false), // US-078: Trending content section
  enableFeedCustomization: z.boolean().default(false), // Feed customization options
  enableContentRecommendations: z.boolean().default(false), // ML-powered recommendations
  enableSearchAutocomplete: z.boolean().default(false), // Search autocomplete
  enableTrendingNotifications: z.boolean().default(false), // Trending alerts
  enableSearchHistory: z.boolean().default(false), // Search history tracking
  enableCategorySubscriptions: z.boolean().default(false), // Category follow feature

  // Add more flags as needed
});

export type FeatureFlags = z.infer<typeof featureFlagSchema>;

// Default flags (used for new environments or as fallback)
export const defaultFeatureFlags: FeatureFlags = featureFlagSchema.parse({});

// Utility to validate and parse flags from any source
export function parseFeatureFlags(input: unknown): FeatureFlags {
  return featureFlagSchema.parse(input);
}

export const qualityMetricsFlags = {
  // US-159: Automated Code Coverage Tracking
  enableAutomatedCoverage: {
    enabled: true,
    description: 'Enable automated code coverage tracking with AI-powered analysis',
    rolloutPercentage: 100,
    environments: ['development', 'staging', 'production'],
    dependencies: [],
    gradualRollout: {
      phase1: { percentage: 25, duration: '7 days', criteria: 'Internal teams only' },
      phase2: { percentage: 50, duration: '7 days', criteria: 'Beta customers' },
      phase3: { percentage: 100, duration: '14 days', criteria: 'All customers' },
    },
  },

  enableCoverageAIInsights: {
    enabled: true,
    description: 'Enable AI-powered coverage insights and recommendations',
    rolloutPercentage: 100,
    environments: ['development', 'staging', 'production'],
    dependencies: ['enableAutomatedCoverage'],
    aiModel: 'coverage-analyzer-v2.1',
    confidenceThreshold: 0.85,
  },

  enableAdaptiveThresholds: {
    enabled: true,
    description: 'Enable adaptive coverage thresholds with machine learning',
    rolloutPercentage: 100,
    environments: ['development', 'staging', 'production'],
    dependencies: ['enableAutomatedCoverage', 'enableCoverageAIInsights'],
    adaptationRules: {
      minCoverage: 70,
      maxCoverage: 95,
      adaptationRate: 0.1,
      stabilityPeriod: '30 days',
    },
  },

  enableRealTimeCoverage: {
    enabled: true,
    description: 'Enable real-time coverage tracking and updates',
    rolloutPercentage: 100,
    environments: ['development', 'staging', 'production'],
    dependencies: ['enableAutomatedCoverage'],
    performance: {
      maxLatency: '50ms',
      maxMemoryUsage: '100MB',
      cacheStrategy: 'intelligent',
    },
  },

  // US-160: Automated Code Quality Metrics
  enableAutomatedQuality: {
    enabled: true,
    description: 'Enable automated code quality metrics with AI analysis',
    rolloutPercentage: 100,
    environments: ['development', 'staging', 'production'],
    dependencies: [],
    qualityTools: ['sonarqube', 'eslint', 'codeclimate'],
    gradualRollout: {
      phase1: { percentage: 30, duration: '5 days', criteria: 'Development teams' },
      phase2: { percentage: 70, duration: '7 days', criteria: 'QA teams included' },
      phase3: { percentage: 100, duration: '10 days', criteria: 'All teams' },
    },
  },

  enableQualityGates: {
    enabled: true,
    description: 'Enable automated quality gates with adaptive thresholds',
    rolloutPercentage: 100,
    environments: ['development', 'staging', 'production'],
    dependencies: ['enableAutomatedQuality'],
    gateConfiguration: {
      maintainabilityThreshold: 80,
      complexityThreshold: 15,
      duplicationThreshold: 3,
      enforcement: 'strict',
    },
  },

  enableAIRefactoring: {
    enabled: true,
    description: 'Enable AI-powered refactoring suggestions',
    rolloutPercentage: 100,
    environments: ['development', 'staging', 'production'],
    dependencies: ['enableAutomatedQuality'],
    aiModel: 'refactoring-assistant-v1.5',
    suggestionTypes: ['complexity-reduction', 'duplication-removal', 'pattern-optimization'],
    confidenceThreshold: 0.8,
  },

  enableQualityForecasting: {
    enabled: true,
    description: 'Enable quality trend forecasting with machine learning',
    rolloutPercentage: 100,
    environments: ['development', 'staging', 'production'],
    dependencies: ['enableAutomatedQuality'],
    forecastingModel: 'quality-prophet-v2.0',
    forecastHorizon: '30 days',
    updateFrequency: 'daily',
  },

  // US-161: Automated Bug Tracking and Resolution
  enableAutomatedBugTracking: {
    enabled: true,
    description: 'Enable automated bug tracking with AI classification',
    rolloutPercentage: 100,
    environments: ['development', 'staging', 'production'],
    dependencies: [],
    integrations: ['jira', 'github', 'sentry'],
    gradualRollout: {
      phase1: { percentage: 25, duration: '7 days', criteria: 'Core development team' },
      phase2: { percentage: 60, duration: '10 days', criteria: 'All development teams' },
      phase3: { percentage: 100, duration: '14 days', criteria: 'Include support teams' },
    },
  },

  enableAIBugClassification: {
    enabled: true,
    description: 'Enable AI-powered bug classification and prioritization',
    rolloutPercentage: 100,
    environments: ['development', 'staging', 'production'],
    dependencies: ['enableAutomatedBugTracking'],
    aiModel: 'bug-classifier-v3.2',
    classificationTypes: ['severity', 'category', 'priority', 'effort'],
    accuracyThreshold: 0.9,
    retrainingFrequency: 'weekly',
  },

  enableBugPrediction: {
    enabled: true,
    description: 'Enable bug prediction and hotspot detection',
    rolloutPercentage: 100,
    environments: ['development', 'staging', 'production'],
    dependencies: ['enableAutomatedBugTracking', 'enableAIBugClassification'],
    predictionModel: 'bug-prophet-v1.8',
    predictionHorizon: '14 days',
    hotspotDetection: {
      algorithm: 'isolation-forest',
      sensitivityLevel: 'medium',
      updateFrequency: 'daily',
    },
  },

  enableAutomatedWorkflowOptimization: {
    enabled: true,
    description: 'Enable automated bug resolution workflow optimization',
    rolloutPercentage: 100,
    environments: ['development', 'staging', 'production'],
    dependencies: ['enableAutomatedBugTracking'],
    optimizationCriteria: ['resolution-time', 'first-time-fix-rate', 'reopen-rate'],
    learningRate: 0.1,
    stabilityPeriod: '21 days',
  },

  // US-162: Automated Performance Benchmarking
  enableAutomatedPerformance: {
    enabled: true,
    description: 'Enable automated performance benchmarking with baseline tracking',
    rolloutPercentage: 100,
    environments: ['development', 'staging', 'production'],
    dependencies: [],
    metrics: ['response-time', 'throughput', 'resource-usage', 'error-rate'],
    gradualRollout: {
      phase1: { percentage: 40, duration: '5 days', criteria: 'Performance team only' },
      phase2: { percentage: 75, duration: '7 days', criteria: 'Development teams' },
      phase3: { percentage: 100, duration: '10 days', criteria: 'All stakeholders' },
    },
  },

  enableAnomalyDetection: {
    enabled: true,
    description: 'Enable AI-powered performance anomaly detection',
    rolloutPercentage: 100,
    environments: ['development', 'staging', 'production'],
    dependencies: ['enableAutomatedPerformance'],
    detectionModel: 'anomaly-detector-v2.5',
    algorithms: ['isolation-forest', 'one-class-svm', 'local-outlier-factor'],
    sensitivityLevel: 'adaptive',
    alertingThresholds: {
      low: 'info',
      medium: 'warning',
      high: 'critical',
    },
  },

  enablePerformanceForecasting: {
    enabled: true,
    description: 'Enable performance trend forecasting and capacity planning',
    rolloutPercentage: 100,
    environments: ['development', 'staging', 'production'],
    dependencies: ['enableAutomatedPerformance'],
    forecastingModel: 'performance-prophet-v1.9',
    forecastHorizons: ['1 hour', '24 hours', '7 days'],
    updateFrequency: 'hourly',
    capacityPlanning: {
      enabled: true,
      growthAssumptions: ['linear', 'exponential', 'seasonal'],
      alertThresholds: [70, 85, 95], // percentage of capacity
    },
  },

  enableAutoOptimization: {
    enabled: true,
    description: 'Enable automated performance optimization suggestions',
    rolloutPercentage: 100,
    environments: ['development', 'staging', 'production'],
    dependencies: ['enableAutomatedPerformance', 'enableAnomalyDetection'],
    optimizationAreas: ['database', 'caching', 'networking', 'resource-allocation'],
    aiModel: 'optimization-advisor-v1.4',
    autoImplementation: {
      enabled: false, // Requires explicit approval
      approvalRequired: true,
      rollbackCapability: true,
    },
  },

  // Unified Quality Metrics Dashboard
  enableUnifiedDashboard: {
    enabled: true,
    description: 'Enable unified quality metrics dashboard with all features',
    rolloutPercentage: 100,
    environments: ['development', 'staging', 'production'],
    dependencies: [
      'enableAutomatedCoverage',
      'enableAutomatedQuality',
      'enableAutomatedBugTracking',
      'enableAutomatedPerformance',
    ],
    dashboardFeatures: {
      realTimeUpdates: true,
      aiInsights: true,
      exportFormats: ['pdf', 'json', 'csv', 'html'],
      customization: true,
      collaboration: true,
    },
  },

  enableQualityMetricsAPI: {
    enabled: true,
    description: 'Enable comprehensive Quality Metrics API for external integrations',
    rolloutPercentage: 100,
    environments: ['development', 'staging', 'production'],
    dependencies: ['enableUnifiedDashboard'],
    apiFeatures: {
      authentication: 'oauth2',
      rateLimit: '1000 requests/hour',
      versioning: 'v1',
      documentation: 'openapi-3.0',
      webhooks: true,
    },
  },

  // Advanced Features
  enableQualityMetricsML: {
    enabled: true,
    description: 'Enable machine learning pipeline for quality metrics',
    rolloutPercentage: 100,
    environments: ['development', 'staging', 'production'],
    dependencies: ['enableUnifiedDashboard'],
    mlPipeline: {
      trainingFrequency: 'weekly',
      modelVersioning: true,
      a11nTesting: true,
      performanceMonitoring: true,
      modelDrift: {
        detection: true,
        threshold: 0.1,
        retraining: 'automatic',
      },
    },
  },

  enableQualityMetricsNotifications: {
    enabled: true,
    description: 'Enable intelligent notifications for quality metrics events',
    rolloutPercentage: 100,
    environments: ['development', 'staging', 'production'],
    dependencies: ['enableUnifiedDashboard'],
    notificationChannels: ['email', 'slack', 'teams', 'webhook'],
    intelligentFiltering: {
      enabled: true,
      learningPeriod: '14 days',
      personalization: true,
      contextAware: true,
    },
  },

  // Compliance and Security
  enableQualityMetricsCompliance: {
    enabled: true,
    description: 'Enable compliance tracking and reporting for quality metrics',
    rolloutPercentage: 100,
    environments: ['development', 'staging', 'production'],
    dependencies: ['enableUnifiedDashboard'],
    complianceStandards: ['ISO-25010', 'NIST', 'OWASP', 'GDPR'],
    auditLogging: {
      enabled: true,
      retention: '7 years',
      encryption: 'AES-256',
      immutability: true,
    },
  },

  enableQualityMetricsSecurity: {
    enabled: true,
    description: 'Enable security scanning and validation for quality metrics',
    rolloutPercentage: 100,
    environments: ['development', 'staging', 'production'],
    dependencies: ['enableUnifiedDashboard'],
    securityFeatures: {
      dataEncryption: true,
      accessControl: 'rbac',
      threatDetection: true,
      vulnerabilityScanning: 'continuous',
      securityAudits: 'monthly',
    },
  },
};

// Export updated feature flags
export const featureFlags = {
  // ... existing feature flags ...
  ...qualityMetricsFlags,
};

// Feature flag validation and dependency checking
export const validateQualityMetricsFlags = (): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Check dependencies
  Object.entries(qualityMetricsFlags).forEach(([flagKey, flagConfig]) => {
    if ((flagConfig as any).dependencies) {
      (flagConfig as any).dependencies.forEach((dep: string) => {
        if (!(qualityMetricsFlags as any)[dep]?.enabled) {
          errors.push(`Flag ${flagKey} depends on ${dep} which is not enabled`);
        }
      });
    }
  });

  // Check gradual rollout consistency
  Object.entries(qualityMetricsFlags).forEach(([flagKey, flagConfig]) => {
    if ((flagConfig as any).gradualRollout) {
      const phases = Object.values((flagConfig as any).gradualRollout);
      let lastPercentage = 0;

      phases.forEach((phase: any, index) => {
        if (phase.percentage <= lastPercentage) {
          errors.push(
            `Flag ${flagKey} has invalid gradual rollout: phase ${index + 1} percentage must be greater than previous phase`
          );
        }
        lastPercentage = phase.percentage;
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
};

// Quality Metrics feature flag utilities
export const getQualityMetricsFeature = (flagName: keyof typeof qualityMetricsFlags) => {
  return qualityMetricsFlags[flagName];
};

export const isQualityMetricsFeatureEnabled = (
  flagName: keyof typeof qualityMetricsFlags,
  environment?: string
): boolean => {
  const flag = qualityMetricsFlags[flagName];
  if (!flag) return false;

  // Check if feature is enabled
  if (!flag.enabled) return false;

  // Check environment if specified
  if (environment && flag.environments && !flag.environments.includes(environment)) {
    return false;
  }

  // Check rollout percentage
  if (flag.rolloutPercentage < 100) {
    // In a real implementation, this would use a consistent hash of user/project ID
    // For now, we'll use a simple random check
    return Math.random() * 100 < flag.rolloutPercentage;
  }

  return true;
};

export const getQualityMetricsFeatureConfiguration = (
  flagName: keyof typeof qualityMetricsFlags
) => {
  return qualityMetricsFlags[flagName] || null;
};
