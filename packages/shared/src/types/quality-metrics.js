"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QualityMetricsConfigSchema = exports.QualityMetricsDashboardSchema = exports.PerformanceDashboardSchema = exports.PerformanceBenchmarkSchema = exports.BugTrackingDashboardSchema = exports.BugMetricSchema = exports.CodeQualityDashboardSchema = exports.CodeQualityMetricSchema = exports.CoverageReportSchema = exports.CoverageMetricSchema = void 0;
const zod_1 = require("zod");
/**
 * Quality Metrics Types for Sovren Platform
 * Supports US-159 through US-162 implementations
 */
// ========================================
// US-159: Code Coverage Tracking Types
// ========================================
exports.CoverageMetricSchema = zod_1.z.object({
    id: zod_1.z.string(),
    timestamp: zod_1.z.string().datetime(),
    projectId: zod_1.z.string(),
    branch: zod_1.z.string(),
    commit: zod_1.z.string(),
    linesCovered: zod_1.z.number().min(0),
    linesTotal: zod_1.z.number().min(0),
    branchesCovered: zod_1.z.number().min(0),
    branchesTotal: zod_1.z.number().min(0),
    functionsCovered: zod_1.z.number().min(0),
    functionsTotal: zod_1.z.number().min(0),
    statementsCovered: zod_1.z.number().min(0),
    statementsTotal: zod_1.z.number().min(0),
    coveragePercentage: zod_1.z.number().min(0).max(100),
    pathCoverage: zod_1.z.number().min(0).max(100),
    qualityScore: zod_1.z.number().min(0).max(100),
    trends: zod_1.z.array(zod_1.z.object({
        date: zod_1.z.string().datetime(),
        coverage: zod_1.z.number().min(0).max(100),
        change: zod_1.z.number(),
    })),
    files: zod_1.z.array(zod_1.z.object({
        path: zod_1.z.string(),
        coverage: zod_1.z.number().min(0).max(100),
        uncoveredLines: zod_1.z.array(zod_1.z.number()),
        complexityScore: zod_1.z.number().min(0),
    })),
    threshold: zod_1.z.object({
        minimum: zod_1.z.number().min(0).max(100),
        target: zod_1.z.number().min(0).max(100),
        adaptive: zod_1.z.boolean(),
        enforcement: zod_1.z.enum(['strict', 'warning', 'disabled']),
    }),
    aiInsights: zod_1.z.object({
        suggestions: zod_1.z.array(zod_1.z.string()),
        predictedCoverage: zod_1.z.number().min(0).max(100),
        improvementAreas: zod_1.z.array(zod_1.z.string()),
        riskAssessment: zod_1.z.enum(['low', 'medium', 'high', 'critical']),
    }),
});
exports.CoverageReportSchema = zod_1.z.object({
    id: zod_1.z.string(),
    generatedAt: zod_1.z.string().datetime(),
    metrics: exports.CoverageMetricSchema,
    visualizations: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.enum(['line_chart', 'heatmap', 'treemap', 'gauge']),
        data: zod_1.z.any(),
        config: zod_1.z.any(),
    })),
    recommendations: zod_1.z.array(zod_1.z.object({
        priority: zod_1.z.enum(['high', 'medium', 'low']),
        description: zod_1.z.string(),
        impact: zod_1.z.string(),
        effort: zod_1.z.enum(['low', 'medium', 'high']),
        automated: zod_1.z.boolean(),
    })),
    status: zod_1.z.enum(['passing', 'warning', 'failing']),
    alerts: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.enum(['threshold_breach', 'regression', 'improvement']),
        message: zod_1.z.string(),
        severity: zod_1.z.enum(['info', 'warning', 'error', 'critical']),
    })),
});
// ========================================
// US-160: Code Quality Metrics Types
// ========================================
exports.CodeQualityMetricSchema = zod_1.z.object({
    id: zod_1.z.string(),
    timestamp: zod_1.z.string().datetime(),
    projectId: zod_1.z.string(),
    branch: zod_1.z.string(),
    commit: zod_1.z.string(),
    overallScore: zod_1.z.number().min(0).max(100),
    maintainabilityIndex: zod_1.z.number().min(0).max(100),
    cyclomaticComplexity: zod_1.z.number().min(0),
    cognitiveComplexity: zod_1.z.number().min(0),
    technicalDebt: zod_1.z.object({
        minutes: zod_1.z.number().min(0),
        ratio: zod_1.z.number().min(0).max(100),
        classification: zod_1.z.enum(['A', 'B', 'C', 'D', 'E']),
    }),
    duplication: zod_1.z.object({
        percentage: zod_1.z.number().min(0).max(100),
        blocks: zod_1.z.number().min(0),
        lines: zod_1.z.number().min(0),
    }),
    violations: zod_1.z.array(zod_1.z.object({
        rule: zod_1.z.string(),
        severity: zod_1.z.enum(['info', 'minor', 'major', 'critical', 'blocker']),
        count: zod_1.z.number().min(0),
        file: zod_1.z.string(),
        line: zod_1.z.number().optional(),
        message: zod_1.z.string(),
        effort: zod_1.z.number().min(0), // minutes to fix
    })),
    trends: zod_1.z.array(zod_1.z.object({
        date: zod_1.z.string().datetime(),
        score: zod_1.z.number().min(0).max(100),
        change: zod_1.z.number(),
    })),
    aiAnalysis: zod_1.z.object({
        patterns: zod_1.z.array(zod_1.z.string()),
        refactoringOpportunities: zod_1.z.array(zod_1.z.object({
            file: zod_1.z.string(),
            function: zod_1.z.string(),
            suggestion: zod_1.z.string(),
            impact: zod_1.z.enum(['low', 'medium', 'high']),
            confidence: zod_1.z.number().min(0).max(1),
        })),
        hotspots: zod_1.z.array(zod_1.z.object({
            file: zod_1.z.string(),
            riskScore: zod_1.z.number().min(0).max(100),
            issues: zod_1.z.array(zod_1.z.string()),
        })),
        forecast: zod_1.z.object({
            nextWeek: zod_1.z.number().min(0).max(100),
            nextMonth: zod_1.z.number().min(0).max(100),
            confidence: zod_1.z.number().min(0).max(1),
        }),
    }),
    gates: zod_1.z.object({
        qualityGate: zod_1.z.enum(['passed', 'warning', 'failed']),
        thresholds: zod_1.z.record(zod_1.z.string(), zod_1.z.number()),
        blockers: zod_1.z.array(zod_1.z.string()),
        warnings: zod_1.z.array(zod_1.z.string()),
    }),
});
exports.CodeQualityDashboardSchema = zod_1.z.object({
    id: zod_1.z.string(),
    projectId: zod_1.z.string(),
    timeframe: zod_1.z.enum(['day', 'week', 'month', 'quarter', 'year']),
    metrics: exports.CodeQualityMetricSchema,
    comparisons: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.enum(['previous_period', 'baseline', 'target']),
        value: zod_1.z.number(),
        change: zod_1.z.number(),
        trend: zod_1.z.enum(['up', 'down', 'stable']),
    })),
    insights: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.enum(['improvement', 'regression', 'stability', 'anomaly']),
        title: zod_1.z.string(),
        description: zod_1.z.string(),
        actionable: zod_1.z.boolean(),
        priority: zod_1.z.enum(['low', 'medium', 'high', 'critical']),
    })),
    recommendations: zod_1.z.array(zod_1.z.object({
        category: zod_1.z.enum(['performance', 'maintainability', 'reliability', 'security']),
        action: zod_1.z.string(),
        impact: zod_1.z.string(),
        effort: zod_1.z.enum(['low', 'medium', 'high']),
        automated: zod_1.z.boolean(),
    })),
});
// ========================================
// US-161: Bug Tracking and Resolution Types
// ========================================
exports.BugMetricSchema = zod_1.z.object({
    id: zod_1.z.string(),
    timestamp: zod_1.z.string().datetime(),
    projectId: zod_1.z.string(),
    totalBugs: zod_1.z.number().min(0),
    openBugs: zod_1.z.number().min(0),
    resolvedBugs: zod_1.z.number().min(0),
    criticalBugs: zod_1.z.number().min(0),
    averageResolutionTime: zod_1.z.number().min(0), // hours
    bugVelocity: zod_1.z.number(), // bugs resolved per day
    escapedBugs: zod_1.z.number().min(0), // bugs found in production
    regressionRate: zod_1.z.number().min(0).max(100),
    defectDensity: zod_1.z.number().min(0), // bugs per KLOC
    categories: zod_1.z.record(zod_1.z.string(), zod_1.z.number()),
    severity: zod_1.z.object({
        critical: zod_1.z.number().min(0),
        high: zod_1.z.number().min(0),
        medium: zod_1.z.number().min(0),
        low: zod_1.z.number().min(0),
    }),
    trends: zod_1.z.array(zod_1.z.object({
        date: zod_1.z.string().datetime(),
        opened: zod_1.z.number().min(0),
        resolved: zod_1.z.number().min(0),
        backlog: zod_1.z.number().min(0),
    })),
    aiClassification: zod_1.z.object({
        accuracy: zod_1.z.number().min(0).max(1),
        patterns: zod_1.z.array(zod_1.z.object({
            pattern: zod_1.z.string(),
            frequency: zod_1.z.number().min(0),
            impact: zod_1.z.enum(['low', 'medium', 'high']),
        })),
        predictions: zod_1.z.object({
            nextWeekBugs: zod_1.z.number().min(0),
            hotspots: zod_1.z.array(zod_1.z.string()),
            riskAreas: zod_1.z.array(zod_1.z.string()),
        }),
        rootCauses: zod_1.z.array(zod_1.z.object({
            cause: zod_1.z.string(),
            frequency: zod_1.z.number().min(0),
            preventable: zod_1.z.boolean(),
        })),
    }),
    performance: zod_1.z.object({
        timeToDetection: zod_1.z.number().min(0), // hours
        timeToResolution: zod_1.z.number().min(0), // hours
        firstTimeFixRate: zod_1.z.number().min(0).max(100),
        reopenRate: zod_1.z.number().min(0).max(100),
    }),
});
exports.BugTrackingDashboardSchema = zod_1.z.object({
    id: zod_1.z.string(),
    projectId: zod_1.z.string(),
    metrics: exports.BugMetricSchema,
    workflows: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        status: zod_1.z.enum(['active', 'paused', 'disabled']),
        efficiency: zod_1.z.number().min(0).max(100),
        automationLevel: zod_1.z.number().min(0).max(100),
        interventions: zod_1.z.number().min(0),
    })),
    alerts: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.enum(['spike', 'regression', 'threshold_breach', 'pattern_anomaly']),
        severity: zod_1.z.enum(['info', 'warning', 'critical']),
        message: zod_1.z.string(),
        actionRequired: zod_1.z.boolean(),
        autoResolvable: zod_1.z.boolean(),
    })),
    reports: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.enum(['daily', 'weekly', 'monthly', 'incident']),
        generatedAt: zod_1.z.string().datetime(),
        summary: zod_1.z.string(),
        keyMetrics: zod_1.z.record(zod_1.z.string(), zod_1.z.any()),
        recommendations: zod_1.z.array(zod_1.z.string()),
    })),
});
// ========================================
// US-162: Performance Benchmarking Types
// ========================================
exports.PerformanceBenchmarkSchema = zod_1.z.object({
    id: zod_1.z.string(),
    timestamp: zod_1.z.string().datetime(),
    projectId: zod_1.z.string(),
    environment: zod_1.z.enum(['development', 'staging', 'production']),
    baseline: zod_1.z.object({
        version: zod_1.z.string(),
        timestamp: zod_1.z.string().datetime(),
        metrics: zod_1.z.record(zod_1.z.string(), zod_1.z.number()),
    }),
    current: zod_1.z.object({
        version: zod_1.z.string(),
        timestamp: zod_1.z.string().datetime(),
        metrics: zod_1.z.record(zod_1.z.string(), zod_1.z.number()),
    }),
    performance: zod_1.z.object({
        responseTime: zod_1.z.object({
            average: zod_1.z.number().min(0),
            p95: zod_1.z.number().min(0),
            p99: zod_1.z.number().min(0),
            max: zod_1.z.number().min(0),
        }),
        throughput: zod_1.z.object({
            requestsPerSecond: zod_1.z.number().min(0),
            transactionsPerSecond: zod_1.z.number().min(0),
            concurrentUsers: zod_1.z.number().min(0),
        }),
        resources: zod_1.z.object({
            cpuUsage: zod_1.z.number().min(0).max(100),
            memoryUsage: zod_1.z.number().min(0).max(100),
            diskUsage: zod_1.z.number().min(0).max(100),
            networkUsage: zod_1.z.number().min(0),
        }),
        errors: zod_1.z.object({
            rate: zod_1.z.number().min(0).max(100),
            count: zod_1.z.number().min(0),
            types: zod_1.z.record(zod_1.z.string(), zod_1.z.number()),
        }),
    }),
    comparisons: zod_1.z.array(zod_1.z.object({
        metric: zod_1.z.string(),
        baseline: zod_1.z.number(),
        current: zod_1.z.number(),
        change: zod_1.z.number(),
        changePercent: zod_1.z.number(),
        trend: zod_1.z.enum(['improvement', 'regression', 'stable']),
        significance: zod_1.z.enum(['major', 'minor', 'negligible']),
    })),
    anomalies: zod_1.z.array(zod_1.z.object({
        metric: zod_1.z.string(),
        detected: zod_1.z.string().datetime(),
        severity: zod_1.z.enum(['low', 'medium', 'high', 'critical']),
        description: zod_1.z.string(),
        possibleCauses: zod_1.z.array(zod_1.z.string()),
        autoResolved: zod_1.z.boolean(),
    })),
    aiAnalysis: zod_1.z.object({
        forecast: zod_1.z.object({
            nextHour: zod_1.z.record(zod_1.z.string(), zod_1.z.number()),
            nextDay: zod_1.z.record(zod_1.z.string(), zod_1.z.number()),
            confidence: zod_1.z.number().min(0).max(1),
        }),
        optimizations: zod_1.z.array(zod_1.z.object({
            area: zod_1.z.string(),
            recommendation: zod_1.z.string(),
            impact: zod_1.z.enum(['low', 'medium', 'high']),
            effort: zod_1.z.enum(['low', 'medium', 'high']),
            automated: zod_1.z.boolean(),
        })),
        patterns: zod_1.z.array(zod_1.z.object({
            pattern: zod_1.z.string(),
            frequency: zod_1.z.string(),
            correlation: zod_1.z.number().min(-1).max(1),
        })),
    }),
    alerts: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.enum(['threshold_breach', 'regression', 'anomaly', 'prediction']),
        metric: zod_1.z.string(),
        value: zod_1.z.number(),
        threshold: zod_1.z.number(),
        severity: zod_1.z.enum(['info', 'warning', 'critical']),
        actionable: zod_1.z.boolean(),
    })),
});
exports.PerformanceDashboardSchema = zod_1.z.object({
    id: zod_1.z.string(),
    projectId: zod_1.z.string(),
    timeframe: zod_1.z.enum(['realtime', 'hour', 'day', 'week', 'month']),
    benchmarks: zod_1.z.array(exports.PerformanceBenchmarkSchema),
    aggregates: zod_1.z.object({
        average: zod_1.z.record(zod_1.z.string(), zod_1.z.number()),
        median: zod_1.z.record(zod_1.z.string(), zod_1.z.number()),
        p95: zod_1.z.record(zod_1.z.string(), zod_1.z.number()),
        p99: zod_1.z.record(zod_1.z.string(), zod_1.z.number()),
    }),
    trends: zod_1.z.array(zod_1.z.object({
        metric: zod_1.z.string(),
        data: zod_1.z.array(zod_1.z.object({
            timestamp: zod_1.z.string().datetime(),
            value: zod_1.z.number(),
        })),
        trend: zod_1.z.enum(['improving', 'degrading', 'stable']),
        rate: zod_1.z.number(), // rate of change
    })),
    insights: zod_1.z.array(zod_1.z.object({
        type: zod_1.z.enum(['optimization', 'issue', 'achievement', 'forecast']),
        title: zod_1.z.string(),
        description: zod_1.z.string(),
        impact: zod_1.z.enum(['low', 'medium', 'high']),
        actionable: zod_1.z.boolean(),
    })),
});
// ========================================
// Unified Quality Metrics Dashboard
// ========================================
exports.QualityMetricsDashboardSchema = zod_1.z.object({
    id: zod_1.z.string(),
    projectId: zod_1.z.string(),
    timestamp: zod_1.z.string().datetime(),
    overallScore: zod_1.z.number().min(0).max(100),
    coverage: exports.CoverageMetricSchema,
    quality: exports.CodeQualityMetricSchema,
    bugs: exports.BugMetricSchema,
    performance: exports.PerformanceBenchmarkSchema,
    insights: zod_1.z.array(zod_1.z.object({
        category: zod_1.z.enum(['coverage', 'quality', 'bugs', 'performance']),
        type: zod_1.z.enum(['success', 'warning', 'error', 'info']),
        title: zod_1.z.string(),
        description: zod_1.z.string(),
        actionable: zod_1.z.boolean(),
        automated: zod_1.z.boolean(),
    })),
    trends: zod_1.z.object({
        overall: zod_1.z.array(zod_1.z.object({
            date: zod_1.z.string().datetime(),
            score: zod_1.z.number().min(0).max(100),
        })),
        categories: zod_1.z.record(zod_1.z.string(), zod_1.z.array(zod_1.z.object({
            date: zod_1.z.string().datetime(),
            value: zod_1.z.number(),
        }))),
    }),
    goals: zod_1.z.array(zod_1.z.object({
        metric: zod_1.z.string(),
        current: zod_1.z.number(),
        target: zod_1.z.number(),
        deadline: zod_1.z.string().datetime(),
        progress: zod_1.z.number().min(0).max(100),
        onTrack: zod_1.z.boolean(),
    })),
    recommendations: zod_1.z.array(zod_1.z.object({
        priority: zod_1.z.enum(['low', 'medium', 'high', 'critical']),
        category: zod_1.z.enum(['coverage', 'quality', 'bugs', 'performance']),
        action: zod_1.z.string(),
        impact: zod_1.z.string(),
        effort: zod_1.z.enum(['low', 'medium', 'high']),
        automated: zod_1.z.boolean(),
        roi: zod_1.z.number().optional(),
    })),
});
// ========================================
// Configuration and Settings
// ========================================
exports.QualityMetricsConfigSchema = zod_1.z.object({
    coverage: zod_1.z.object({
        enabled: zod_1.z.boolean(),
        thresholds: zod_1.z.object({
            line: zod_1.z.number().min(0).max(100),
            branch: zod_1.z.number().min(0).max(100),
            function: zod_1.z.number().min(0).max(100),
            statement: zod_1.z.number().min(0).max(100),
        }),
        enforcement: zod_1.z.enum(['strict', 'warning', 'disabled']),
        aiOptimization: zod_1.z.boolean(),
    }),
    quality: zod_1.z.object({
        enabled: zod_1.z.boolean(),
        gates: zod_1.z.record(zod_1.z.string(), zod_1.z.number()),
        aiAnalysis: zod_1.z.boolean(),
        autoRefactoring: zod_1.z.boolean(),
    }),
    bugs: zod_1.z.object({
        enabled: zod_1.z.boolean(),
        autoClassification: zod_1.z.boolean(),
        workflowOptimization: zod_1.z.boolean(),
        preventionMode: zod_1.z.boolean(),
    }),
    performance: zod_1.z.object({
        enabled: zod_1.z.boolean(),
        baselineTracking: zod_1.z.boolean(),
        anomalyDetection: zod_1.z.boolean(),
        autoOptimization: zod_1.z.boolean(),
    }),
    reporting: zod_1.z.object({
        frequency: zod_1.z.enum(['realtime', 'hourly', 'daily', 'weekly']),
        formats: zod_1.z.array(zod_1.z.enum(['json', 'pdf', 'html', 'slack'])),
        stakeholders: zod_1.z.array(zod_1.z.string()),
        customMetrics: zod_1.z.array(zod_1.z.string()),
    }),
});
//# sourceMappingURL=quality-metrics.js.map