import { z } from 'zod';
/**
 * Quality Metrics Types for Sovren Platform
 * Supports US-159 through US-162 implementations
 */
export declare const CoverageMetricSchema: z.ZodObject<{
    id: z.ZodString;
    timestamp: z.ZodString;
    projectId: z.ZodString;
    branch: z.ZodString;
    commit: z.ZodString;
    linesCovered: z.ZodNumber;
    linesTotal: z.ZodNumber;
    branchesCovered: z.ZodNumber;
    branchesTotal: z.ZodNumber;
    functionsCovered: z.ZodNumber;
    functionsTotal: z.ZodNumber;
    statementsCovered: z.ZodNumber;
    statementsTotal: z.ZodNumber;
    coveragePercentage: z.ZodNumber;
    pathCoverage: z.ZodNumber;
    qualityScore: z.ZodNumber;
    trends: z.ZodArray<z.ZodObject<{
        date: z.ZodString;
        coverage: z.ZodNumber;
        change: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        date: string;
        coverage: number;
        change: number;
    }, {
        date: string;
        coverage: number;
        change: number;
    }>, "many">;
    files: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        coverage: z.ZodNumber;
        uncoveredLines: z.ZodArray<z.ZodNumber, "many">;
        complexityScore: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        path: string;
        coverage: number;
        uncoveredLines: number[];
        complexityScore: number;
    }, {
        path: string;
        coverage: number;
        uncoveredLines: number[];
        complexityScore: number;
    }>, "many">;
    threshold: z.ZodObject<{
        minimum: z.ZodNumber;
        target: z.ZodNumber;
        adaptive: z.ZodBoolean;
        enforcement: z.ZodEnum<["strict", "warning", "disabled"]>;
    }, "strip", z.ZodTypeAny, {
        minimum: number;
        target: number;
        adaptive: boolean;
        enforcement: "strict" | "warning" | "disabled";
    }, {
        minimum: number;
        target: number;
        adaptive: boolean;
        enforcement: "strict" | "warning" | "disabled";
    }>;
    aiInsights: z.ZodObject<{
        suggestions: z.ZodArray<z.ZodString, "many">;
        predictedCoverage: z.ZodNumber;
        improvementAreas: z.ZodArray<z.ZodString, "many">;
        riskAssessment: z.ZodEnum<["low", "medium", "high", "critical"]>;
    }, "strip", z.ZodTypeAny, {
        suggestions: string[];
        predictedCoverage: number;
        improvementAreas: string[];
        riskAssessment: "low" | "medium" | "high" | "critical";
    }, {
        suggestions: string[];
        predictedCoverage: number;
        improvementAreas: string[];
        riskAssessment: "low" | "medium" | "high" | "critical";
    }>;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    id: string;
    threshold: {
        minimum: number;
        target: number;
        adaptive: boolean;
        enforcement: "strict" | "warning" | "disabled";
    };
    trends: {
        date: string;
        coverage: number;
        change: number;
    }[];
    files: {
        path: string;
        coverage: number;
        uncoveredLines: number[];
        complexityScore: number;
    }[];
    projectId: string;
    branch: string;
    commit: string;
    linesCovered: number;
    linesTotal: number;
    branchesCovered: number;
    branchesTotal: number;
    functionsCovered: number;
    functionsTotal: number;
    statementsCovered: number;
    statementsTotal: number;
    coveragePercentage: number;
    pathCoverage: number;
    qualityScore: number;
    aiInsights: {
        suggestions: string[];
        predictedCoverage: number;
        improvementAreas: string[];
        riskAssessment: "low" | "medium" | "high" | "critical";
    };
}, {
    timestamp: string;
    id: string;
    threshold: {
        minimum: number;
        target: number;
        adaptive: boolean;
        enforcement: "strict" | "warning" | "disabled";
    };
    trends: {
        date: string;
        coverage: number;
        change: number;
    }[];
    files: {
        path: string;
        coverage: number;
        uncoveredLines: number[];
        complexityScore: number;
    }[];
    projectId: string;
    branch: string;
    commit: string;
    linesCovered: number;
    linesTotal: number;
    branchesCovered: number;
    branchesTotal: number;
    functionsCovered: number;
    functionsTotal: number;
    statementsCovered: number;
    statementsTotal: number;
    coveragePercentage: number;
    pathCoverage: number;
    qualityScore: number;
    aiInsights: {
        suggestions: string[];
        predictedCoverage: number;
        improvementAreas: string[];
        riskAssessment: "low" | "medium" | "high" | "critical";
    };
}>;
export declare const CoverageReportSchema: z.ZodObject<{
    id: z.ZodString;
    generatedAt: z.ZodString;
    metrics: z.ZodObject<{
        id: z.ZodString;
        timestamp: z.ZodString;
        projectId: z.ZodString;
        branch: z.ZodString;
        commit: z.ZodString;
        linesCovered: z.ZodNumber;
        linesTotal: z.ZodNumber;
        branchesCovered: z.ZodNumber;
        branchesTotal: z.ZodNumber;
        functionsCovered: z.ZodNumber;
        functionsTotal: z.ZodNumber;
        statementsCovered: z.ZodNumber;
        statementsTotal: z.ZodNumber;
        coveragePercentage: z.ZodNumber;
        pathCoverage: z.ZodNumber;
        qualityScore: z.ZodNumber;
        trends: z.ZodArray<z.ZodObject<{
            date: z.ZodString;
            coverage: z.ZodNumber;
            change: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            date: string;
            coverage: number;
            change: number;
        }, {
            date: string;
            coverage: number;
            change: number;
        }>, "many">;
        files: z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            coverage: z.ZodNumber;
            uncoveredLines: z.ZodArray<z.ZodNumber, "many">;
            complexityScore: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            path: string;
            coverage: number;
            uncoveredLines: number[];
            complexityScore: number;
        }, {
            path: string;
            coverage: number;
            uncoveredLines: number[];
            complexityScore: number;
        }>, "many">;
        threshold: z.ZodObject<{
            minimum: z.ZodNumber;
            target: z.ZodNumber;
            adaptive: z.ZodBoolean;
            enforcement: z.ZodEnum<["strict", "warning", "disabled"]>;
        }, "strip", z.ZodTypeAny, {
            minimum: number;
            target: number;
            adaptive: boolean;
            enforcement: "strict" | "warning" | "disabled";
        }, {
            minimum: number;
            target: number;
            adaptive: boolean;
            enforcement: "strict" | "warning" | "disabled";
        }>;
        aiInsights: z.ZodObject<{
            suggestions: z.ZodArray<z.ZodString, "many">;
            predictedCoverage: z.ZodNumber;
            improvementAreas: z.ZodArray<z.ZodString, "many">;
            riskAssessment: z.ZodEnum<["low", "medium", "high", "critical"]>;
        }, "strip", z.ZodTypeAny, {
            suggestions: string[];
            predictedCoverage: number;
            improvementAreas: string[];
            riskAssessment: "low" | "medium" | "high" | "critical";
        }, {
            suggestions: string[];
            predictedCoverage: number;
            improvementAreas: string[];
            riskAssessment: "low" | "medium" | "high" | "critical";
        }>;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        id: string;
        threshold: {
            minimum: number;
            target: number;
            adaptive: boolean;
            enforcement: "strict" | "warning" | "disabled";
        };
        trends: {
            date: string;
            coverage: number;
            change: number;
        }[];
        files: {
            path: string;
            coverage: number;
            uncoveredLines: number[];
            complexityScore: number;
        }[];
        projectId: string;
        branch: string;
        commit: string;
        linesCovered: number;
        linesTotal: number;
        branchesCovered: number;
        branchesTotal: number;
        functionsCovered: number;
        functionsTotal: number;
        statementsCovered: number;
        statementsTotal: number;
        coveragePercentage: number;
        pathCoverage: number;
        qualityScore: number;
        aiInsights: {
            suggestions: string[];
            predictedCoverage: number;
            improvementAreas: string[];
            riskAssessment: "low" | "medium" | "high" | "critical";
        };
    }, {
        timestamp: string;
        id: string;
        threshold: {
            minimum: number;
            target: number;
            adaptive: boolean;
            enforcement: "strict" | "warning" | "disabled";
        };
        trends: {
            date: string;
            coverage: number;
            change: number;
        }[];
        files: {
            path: string;
            coverage: number;
            uncoveredLines: number[];
            complexityScore: number;
        }[];
        projectId: string;
        branch: string;
        commit: string;
        linesCovered: number;
        linesTotal: number;
        branchesCovered: number;
        branchesTotal: number;
        functionsCovered: number;
        functionsTotal: number;
        statementsCovered: number;
        statementsTotal: number;
        coveragePercentage: number;
        pathCoverage: number;
        qualityScore: number;
        aiInsights: {
            suggestions: string[];
            predictedCoverage: number;
            improvementAreas: string[];
            riskAssessment: "low" | "medium" | "high" | "critical";
        };
    }>;
    visualizations: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["line_chart", "heatmap", "treemap", "gauge"]>;
        data: z.ZodAny;
        config: z.ZodAny;
    }, "strip", z.ZodTypeAny, {
        type: "heatmap" | "line_chart" | "gauge" | "treemap";
        data?: any;
        config?: any;
    }, {
        type: "heatmap" | "line_chart" | "gauge" | "treemap";
        data?: any;
        config?: any;
    }>, "many">;
    recommendations: z.ZodArray<z.ZodObject<{
        priority: z.ZodEnum<["high", "medium", "low"]>;
        description: z.ZodString;
        impact: z.ZodString;
        effort: z.ZodEnum<["low", "medium", "high"]>;
        automated: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        description: string;
        priority: "low" | "medium" | "high";
        automated: boolean;
        impact: string;
        effort: "low" | "medium" | "high";
    }, {
        description: string;
        priority: "low" | "medium" | "high";
        automated: boolean;
        impact: string;
        effort: "low" | "medium" | "high";
    }>, "many">;
    status: z.ZodEnum<["passing", "warning", "failing"]>;
    alerts: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["threshold_breach", "regression", "improvement"]>;
        message: z.ZodString;
        severity: z.ZodEnum<["info", "warning", "error", "critical"]>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        type: "improvement" | "threshold_breach" | "regression";
        severity: "error" | "warning" | "critical" | "info";
    }, {
        message: string;
        type: "improvement" | "threshold_breach" | "regression";
        severity: "error" | "warning" | "critical" | "info";
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    status: "warning" | "passing" | "failing";
    id: string;
    recommendations: {
        description: string;
        priority: "low" | "medium" | "high";
        automated: boolean;
        impact: string;
        effort: "low" | "medium" | "high";
    }[];
    metrics: {
        timestamp: string;
        id: string;
        threshold: {
            minimum: number;
            target: number;
            adaptive: boolean;
            enforcement: "strict" | "warning" | "disabled";
        };
        trends: {
            date: string;
            coverage: number;
            change: number;
        }[];
        files: {
            path: string;
            coverage: number;
            uncoveredLines: number[];
            complexityScore: number;
        }[];
        projectId: string;
        branch: string;
        commit: string;
        linesCovered: number;
        linesTotal: number;
        branchesCovered: number;
        branchesTotal: number;
        functionsCovered: number;
        functionsTotal: number;
        statementsCovered: number;
        statementsTotal: number;
        coveragePercentage: number;
        pathCoverage: number;
        qualityScore: number;
        aiInsights: {
            suggestions: string[];
            predictedCoverage: number;
            improvementAreas: string[];
            riskAssessment: "low" | "medium" | "high" | "critical";
        };
    };
    generatedAt: string;
    visualizations: {
        type: "heatmap" | "line_chart" | "gauge" | "treemap";
        data?: any;
        config?: any;
    }[];
    alerts: {
        message: string;
        type: "improvement" | "threshold_breach" | "regression";
        severity: "error" | "warning" | "critical" | "info";
    }[];
}, {
    status: "warning" | "passing" | "failing";
    id: string;
    recommendations: {
        description: string;
        priority: "low" | "medium" | "high";
        automated: boolean;
        impact: string;
        effort: "low" | "medium" | "high";
    }[];
    metrics: {
        timestamp: string;
        id: string;
        threshold: {
            minimum: number;
            target: number;
            adaptive: boolean;
            enforcement: "strict" | "warning" | "disabled";
        };
        trends: {
            date: string;
            coverage: number;
            change: number;
        }[];
        files: {
            path: string;
            coverage: number;
            uncoveredLines: number[];
            complexityScore: number;
        }[];
        projectId: string;
        branch: string;
        commit: string;
        linesCovered: number;
        linesTotal: number;
        branchesCovered: number;
        branchesTotal: number;
        functionsCovered: number;
        functionsTotal: number;
        statementsCovered: number;
        statementsTotal: number;
        coveragePercentage: number;
        pathCoverage: number;
        qualityScore: number;
        aiInsights: {
            suggestions: string[];
            predictedCoverage: number;
            improvementAreas: string[];
            riskAssessment: "low" | "medium" | "high" | "critical";
        };
    };
    generatedAt: string;
    visualizations: {
        type: "heatmap" | "line_chart" | "gauge" | "treemap";
        data?: any;
        config?: any;
    }[];
    alerts: {
        message: string;
        type: "improvement" | "threshold_breach" | "regression";
        severity: "error" | "warning" | "critical" | "info";
    }[];
}>;
export type CoverageMetric = z.infer<typeof CoverageMetricSchema>;
export type CoverageReport = z.infer<typeof CoverageReportSchema>;
export declare const CodeQualityMetricSchema: z.ZodObject<{
    id: z.ZodString;
    timestamp: z.ZodString;
    projectId: z.ZodString;
    branch: z.ZodString;
    commit: z.ZodString;
    overallScore: z.ZodNumber;
    maintainabilityIndex: z.ZodNumber;
    cyclomaticComplexity: z.ZodNumber;
    cognitiveComplexity: z.ZodNumber;
    technicalDebt: z.ZodObject<{
        minutes: z.ZodNumber;
        ratio: z.ZodNumber;
        classification: z.ZodEnum<["A", "B", "C", "D", "E"]>;
    }, "strip", z.ZodTypeAny, {
        minutes: number;
        ratio: number;
        classification: "D" | "A" | "B" | "C" | "E";
    }, {
        minutes: number;
        ratio: number;
        classification: "D" | "A" | "B" | "C" | "E";
    }>;
    duplication: z.ZodObject<{
        percentage: z.ZodNumber;
        blocks: z.ZodNumber;
        lines: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        percentage: number;
        blocks: number;
        lines: number;
    }, {
        percentage: number;
        blocks: number;
        lines: number;
    }>;
    violations: z.ZodArray<z.ZodObject<{
        rule: z.ZodString;
        severity: z.ZodEnum<["info", "minor", "major", "critical", "blocker"]>;
        count: z.ZodNumber;
        file: z.ZodString;
        line: z.ZodOptional<z.ZodNumber>;
        message: z.ZodString;
        effort: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        message: string;
        count: number;
        rule: string;
        severity: "critical" | "info" | "minor" | "major" | "blocker";
        file: string;
        effort: number;
        line?: number | undefined;
    }, {
        message: string;
        count: number;
        rule: string;
        severity: "critical" | "info" | "minor" | "major" | "blocker";
        file: string;
        effort: number;
        line?: number | undefined;
    }>, "many">;
    trends: z.ZodArray<z.ZodObject<{
        date: z.ZodString;
        score: z.ZodNumber;
        change: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        date: string;
        score: number;
        change: number;
    }, {
        date: string;
        score: number;
        change: number;
    }>, "many">;
    aiAnalysis: z.ZodObject<{
        patterns: z.ZodArray<z.ZodString, "many">;
        refactoringOpportunities: z.ZodArray<z.ZodObject<{
            file: z.ZodString;
            function: z.ZodString;
            suggestion: z.ZodString;
            impact: z.ZodEnum<["low", "medium", "high"]>;
            confidence: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            function: string;
            confidence: number;
            file: string;
            impact: "low" | "medium" | "high";
            suggestion: string;
        }, {
            function: string;
            confidence: number;
            file: string;
            impact: "low" | "medium" | "high";
            suggestion: string;
        }>, "many">;
        hotspots: z.ZodArray<z.ZodObject<{
            file: z.ZodString;
            riskScore: z.ZodNumber;
            issues: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            issues: string[];
            file: string;
            riskScore: number;
        }, {
            issues: string[];
            file: string;
            riskScore: number;
        }>, "many">;
        forecast: z.ZodObject<{
            nextWeek: z.ZodNumber;
            nextMonth: z.ZodNumber;
            confidence: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            confidence: number;
            nextWeek: number;
            nextMonth: number;
        }, {
            confidence: number;
            nextWeek: number;
            nextMonth: number;
        }>;
    }, "strip", z.ZodTypeAny, {
        patterns: string[];
        refactoringOpportunities: {
            function: string;
            confidence: number;
            file: string;
            impact: "low" | "medium" | "high";
            suggestion: string;
        }[];
        hotspots: {
            issues: string[];
            file: string;
            riskScore: number;
        }[];
        forecast: {
            confidence: number;
            nextWeek: number;
            nextMonth: number;
        };
    }, {
        patterns: string[];
        refactoringOpportunities: {
            function: string;
            confidence: number;
            file: string;
            impact: "low" | "medium" | "high";
            suggestion: string;
        }[];
        hotspots: {
            issues: string[];
            file: string;
            riskScore: number;
        }[];
        forecast: {
            confidence: number;
            nextWeek: number;
            nextMonth: number;
        };
    }>;
    gates: z.ZodObject<{
        qualityGate: z.ZodEnum<["passed", "warning", "failed"]>;
        thresholds: z.ZodRecord<z.ZodString, z.ZodNumber>;
        blockers: z.ZodArray<z.ZodString, "many">;
        warnings: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        qualityGate: "failed" | "warning" | "passed";
        thresholds: Record<string, number>;
        blockers: string[];
        warnings: string[];
    }, {
        qualityGate: "failed" | "warning" | "passed";
        thresholds: Record<string, number>;
        blockers: string[];
        warnings: string[];
    }>;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    id: string;
    violations: {
        message: string;
        count: number;
        rule: string;
        severity: "critical" | "info" | "minor" | "major" | "blocker";
        file: string;
        effort: number;
        line?: number | undefined;
    }[];
    overallScore: number;
    trends: {
        date: string;
        score: number;
        change: number;
    }[];
    projectId: string;
    branch: string;
    commit: string;
    maintainabilityIndex: number;
    cyclomaticComplexity: number;
    cognitiveComplexity: number;
    technicalDebt: {
        minutes: number;
        ratio: number;
        classification: "D" | "A" | "B" | "C" | "E";
    };
    duplication: {
        percentage: number;
        blocks: number;
        lines: number;
    };
    aiAnalysis: {
        patterns: string[];
        refactoringOpportunities: {
            function: string;
            confidence: number;
            file: string;
            impact: "low" | "medium" | "high";
            suggestion: string;
        }[];
        hotspots: {
            issues: string[];
            file: string;
            riskScore: number;
        }[];
        forecast: {
            confidence: number;
            nextWeek: number;
            nextMonth: number;
        };
    };
    gates: {
        qualityGate: "failed" | "warning" | "passed";
        thresholds: Record<string, number>;
        blockers: string[];
        warnings: string[];
    };
}, {
    timestamp: string;
    id: string;
    violations: {
        message: string;
        count: number;
        rule: string;
        severity: "critical" | "info" | "minor" | "major" | "blocker";
        file: string;
        effort: number;
        line?: number | undefined;
    }[];
    overallScore: number;
    trends: {
        date: string;
        score: number;
        change: number;
    }[];
    projectId: string;
    branch: string;
    commit: string;
    maintainabilityIndex: number;
    cyclomaticComplexity: number;
    cognitiveComplexity: number;
    technicalDebt: {
        minutes: number;
        ratio: number;
        classification: "D" | "A" | "B" | "C" | "E";
    };
    duplication: {
        percentage: number;
        blocks: number;
        lines: number;
    };
    aiAnalysis: {
        patterns: string[];
        refactoringOpportunities: {
            function: string;
            confidence: number;
            file: string;
            impact: "low" | "medium" | "high";
            suggestion: string;
        }[];
        hotspots: {
            issues: string[];
            file: string;
            riskScore: number;
        }[];
        forecast: {
            confidence: number;
            nextWeek: number;
            nextMonth: number;
        };
    };
    gates: {
        qualityGate: "failed" | "warning" | "passed";
        thresholds: Record<string, number>;
        blockers: string[];
        warnings: string[];
    };
}>;
export declare const CodeQualityDashboardSchema: z.ZodObject<{
    id: z.ZodString;
    projectId: z.ZodString;
    timeframe: z.ZodEnum<["day", "week", "month", "quarter", "year"]>;
    metrics: z.ZodObject<{
        id: z.ZodString;
        timestamp: z.ZodString;
        projectId: z.ZodString;
        branch: z.ZodString;
        commit: z.ZodString;
        overallScore: z.ZodNumber;
        maintainabilityIndex: z.ZodNumber;
        cyclomaticComplexity: z.ZodNumber;
        cognitiveComplexity: z.ZodNumber;
        technicalDebt: z.ZodObject<{
            minutes: z.ZodNumber;
            ratio: z.ZodNumber;
            classification: z.ZodEnum<["A", "B", "C", "D", "E"]>;
        }, "strip", z.ZodTypeAny, {
            minutes: number;
            ratio: number;
            classification: "D" | "A" | "B" | "C" | "E";
        }, {
            minutes: number;
            ratio: number;
            classification: "D" | "A" | "B" | "C" | "E";
        }>;
        duplication: z.ZodObject<{
            percentage: z.ZodNumber;
            blocks: z.ZodNumber;
            lines: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            percentage: number;
            blocks: number;
            lines: number;
        }, {
            percentage: number;
            blocks: number;
            lines: number;
        }>;
        violations: z.ZodArray<z.ZodObject<{
            rule: z.ZodString;
            severity: z.ZodEnum<["info", "minor", "major", "critical", "blocker"]>;
            count: z.ZodNumber;
            file: z.ZodString;
            line: z.ZodOptional<z.ZodNumber>;
            message: z.ZodString;
            effort: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            message: string;
            count: number;
            rule: string;
            severity: "critical" | "info" | "minor" | "major" | "blocker";
            file: string;
            effort: number;
            line?: number | undefined;
        }, {
            message: string;
            count: number;
            rule: string;
            severity: "critical" | "info" | "minor" | "major" | "blocker";
            file: string;
            effort: number;
            line?: number | undefined;
        }>, "many">;
        trends: z.ZodArray<z.ZodObject<{
            date: z.ZodString;
            score: z.ZodNumber;
            change: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            date: string;
            score: number;
            change: number;
        }, {
            date: string;
            score: number;
            change: number;
        }>, "many">;
        aiAnalysis: z.ZodObject<{
            patterns: z.ZodArray<z.ZodString, "many">;
            refactoringOpportunities: z.ZodArray<z.ZodObject<{
                file: z.ZodString;
                function: z.ZodString;
                suggestion: z.ZodString;
                impact: z.ZodEnum<["low", "medium", "high"]>;
                confidence: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                function: string;
                confidence: number;
                file: string;
                impact: "low" | "medium" | "high";
                suggestion: string;
            }, {
                function: string;
                confidence: number;
                file: string;
                impact: "low" | "medium" | "high";
                suggestion: string;
            }>, "many">;
            hotspots: z.ZodArray<z.ZodObject<{
                file: z.ZodString;
                riskScore: z.ZodNumber;
                issues: z.ZodArray<z.ZodString, "many">;
            }, "strip", z.ZodTypeAny, {
                issues: string[];
                file: string;
                riskScore: number;
            }, {
                issues: string[];
                file: string;
                riskScore: number;
            }>, "many">;
            forecast: z.ZodObject<{
                nextWeek: z.ZodNumber;
                nextMonth: z.ZodNumber;
                confidence: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                confidence: number;
                nextWeek: number;
                nextMonth: number;
            }, {
                confidence: number;
                nextWeek: number;
                nextMonth: number;
            }>;
        }, "strip", z.ZodTypeAny, {
            patterns: string[];
            refactoringOpportunities: {
                function: string;
                confidence: number;
                file: string;
                impact: "low" | "medium" | "high";
                suggestion: string;
            }[];
            hotspots: {
                issues: string[];
                file: string;
                riskScore: number;
            }[];
            forecast: {
                confidence: number;
                nextWeek: number;
                nextMonth: number;
            };
        }, {
            patterns: string[];
            refactoringOpportunities: {
                function: string;
                confidence: number;
                file: string;
                impact: "low" | "medium" | "high";
                suggestion: string;
            }[];
            hotspots: {
                issues: string[];
                file: string;
                riskScore: number;
            }[];
            forecast: {
                confidence: number;
                nextWeek: number;
                nextMonth: number;
            };
        }>;
        gates: z.ZodObject<{
            qualityGate: z.ZodEnum<["passed", "warning", "failed"]>;
            thresholds: z.ZodRecord<z.ZodString, z.ZodNumber>;
            blockers: z.ZodArray<z.ZodString, "many">;
            warnings: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            qualityGate: "failed" | "warning" | "passed";
            thresholds: Record<string, number>;
            blockers: string[];
            warnings: string[];
        }, {
            qualityGate: "failed" | "warning" | "passed";
            thresholds: Record<string, number>;
            blockers: string[];
            warnings: string[];
        }>;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        id: string;
        violations: {
            message: string;
            count: number;
            rule: string;
            severity: "critical" | "info" | "minor" | "major" | "blocker";
            file: string;
            effort: number;
            line?: number | undefined;
        }[];
        overallScore: number;
        trends: {
            date: string;
            score: number;
            change: number;
        }[];
        projectId: string;
        branch: string;
        commit: string;
        maintainabilityIndex: number;
        cyclomaticComplexity: number;
        cognitiveComplexity: number;
        technicalDebt: {
            minutes: number;
            ratio: number;
            classification: "D" | "A" | "B" | "C" | "E";
        };
        duplication: {
            percentage: number;
            blocks: number;
            lines: number;
        };
        aiAnalysis: {
            patterns: string[];
            refactoringOpportunities: {
                function: string;
                confidence: number;
                file: string;
                impact: "low" | "medium" | "high";
                suggestion: string;
            }[];
            hotspots: {
                issues: string[];
                file: string;
                riskScore: number;
            }[];
            forecast: {
                confidence: number;
                nextWeek: number;
                nextMonth: number;
            };
        };
        gates: {
            qualityGate: "failed" | "warning" | "passed";
            thresholds: Record<string, number>;
            blockers: string[];
            warnings: string[];
        };
    }, {
        timestamp: string;
        id: string;
        violations: {
            message: string;
            count: number;
            rule: string;
            severity: "critical" | "info" | "minor" | "major" | "blocker";
            file: string;
            effort: number;
            line?: number | undefined;
        }[];
        overallScore: number;
        trends: {
            date: string;
            score: number;
            change: number;
        }[];
        projectId: string;
        branch: string;
        commit: string;
        maintainabilityIndex: number;
        cyclomaticComplexity: number;
        cognitiveComplexity: number;
        technicalDebt: {
            minutes: number;
            ratio: number;
            classification: "D" | "A" | "B" | "C" | "E";
        };
        duplication: {
            percentage: number;
            blocks: number;
            lines: number;
        };
        aiAnalysis: {
            patterns: string[];
            refactoringOpportunities: {
                function: string;
                confidence: number;
                file: string;
                impact: "low" | "medium" | "high";
                suggestion: string;
            }[];
            hotspots: {
                issues: string[];
                file: string;
                riskScore: number;
            }[];
            forecast: {
                confidence: number;
                nextWeek: number;
                nextMonth: number;
            };
        };
        gates: {
            qualityGate: "failed" | "warning" | "passed";
            thresholds: Record<string, number>;
            blockers: string[];
            warnings: string[];
        };
    }>;
    comparisons: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["previous_period", "baseline", "target"]>;
        value: z.ZodNumber;
        change: z.ZodNumber;
        trend: z.ZodEnum<["up", "down", "stable"]>;
    }, "strip", z.ZodTypeAny, {
        value: number;
        type: "target" | "previous_period" | "baseline";
        change: number;
        trend: "stable" | "up" | "down";
    }, {
        value: number;
        type: "target" | "previous_period" | "baseline";
        change: number;
        trend: "stable" | "up" | "down";
    }>, "many">;
    insights: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["improvement", "regression", "stability", "anomaly"]>;
        title: z.ZodString;
        description: z.ZodString;
        actionable: z.ZodBoolean;
        priority: z.ZodEnum<["low", "medium", "high", "critical"]>;
    }, "strip", z.ZodTypeAny, {
        type: "improvement" | "regression" | "stability" | "anomaly";
        description: string;
        priority: "low" | "medium" | "high" | "critical";
        title: string;
        actionable: boolean;
    }, {
        type: "improvement" | "regression" | "stability" | "anomaly";
        description: string;
        priority: "low" | "medium" | "high" | "critical";
        title: string;
        actionable: boolean;
    }>, "many">;
    recommendations: z.ZodArray<z.ZodObject<{
        category: z.ZodEnum<["performance", "maintainability", "reliability", "security"]>;
        action: z.ZodString;
        impact: z.ZodString;
        effort: z.ZodEnum<["low", "medium", "high"]>;
        automated: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        action: string;
        category: "security" | "reliability" | "performance" | "maintainability";
        automated: boolean;
        impact: string;
        effort: "low" | "medium" | "high";
    }, {
        action: string;
        category: "security" | "reliability" | "performance" | "maintainability";
        automated: boolean;
        impact: string;
        effort: "low" | "medium" | "high";
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    id: string;
    recommendations: {
        action: string;
        category: "security" | "reliability" | "performance" | "maintainability";
        automated: boolean;
        impact: string;
        effort: "low" | "medium" | "high";
    }[];
    timeframe: "day" | "week" | "month" | "year" | "quarter";
    metrics: {
        timestamp: string;
        id: string;
        violations: {
            message: string;
            count: number;
            rule: string;
            severity: "critical" | "info" | "minor" | "major" | "blocker";
            file: string;
            effort: number;
            line?: number | undefined;
        }[];
        overallScore: number;
        trends: {
            date: string;
            score: number;
            change: number;
        }[];
        projectId: string;
        branch: string;
        commit: string;
        maintainabilityIndex: number;
        cyclomaticComplexity: number;
        cognitiveComplexity: number;
        technicalDebt: {
            minutes: number;
            ratio: number;
            classification: "D" | "A" | "B" | "C" | "E";
        };
        duplication: {
            percentage: number;
            blocks: number;
            lines: number;
        };
        aiAnalysis: {
            patterns: string[];
            refactoringOpportunities: {
                function: string;
                confidence: number;
                file: string;
                impact: "low" | "medium" | "high";
                suggestion: string;
            }[];
            hotspots: {
                issues: string[];
                file: string;
                riskScore: number;
            }[];
            forecast: {
                confidence: number;
                nextWeek: number;
                nextMonth: number;
            };
        };
        gates: {
            qualityGate: "failed" | "warning" | "passed";
            thresholds: Record<string, number>;
            blockers: string[];
            warnings: string[];
        };
    };
    insights: {
        type: "improvement" | "regression" | "stability" | "anomaly";
        description: string;
        priority: "low" | "medium" | "high" | "critical";
        title: string;
        actionable: boolean;
    }[];
    projectId: string;
    comparisons: {
        value: number;
        type: "target" | "previous_period" | "baseline";
        change: number;
        trend: "stable" | "up" | "down";
    }[];
}, {
    id: string;
    recommendations: {
        action: string;
        category: "security" | "reliability" | "performance" | "maintainability";
        automated: boolean;
        impact: string;
        effort: "low" | "medium" | "high";
    }[];
    timeframe: "day" | "week" | "month" | "year" | "quarter";
    metrics: {
        timestamp: string;
        id: string;
        violations: {
            message: string;
            count: number;
            rule: string;
            severity: "critical" | "info" | "minor" | "major" | "blocker";
            file: string;
            effort: number;
            line?: number | undefined;
        }[];
        overallScore: number;
        trends: {
            date: string;
            score: number;
            change: number;
        }[];
        projectId: string;
        branch: string;
        commit: string;
        maintainabilityIndex: number;
        cyclomaticComplexity: number;
        cognitiveComplexity: number;
        technicalDebt: {
            minutes: number;
            ratio: number;
            classification: "D" | "A" | "B" | "C" | "E";
        };
        duplication: {
            percentage: number;
            blocks: number;
            lines: number;
        };
        aiAnalysis: {
            patterns: string[];
            refactoringOpportunities: {
                function: string;
                confidence: number;
                file: string;
                impact: "low" | "medium" | "high";
                suggestion: string;
            }[];
            hotspots: {
                issues: string[];
                file: string;
                riskScore: number;
            }[];
            forecast: {
                confidence: number;
                nextWeek: number;
                nextMonth: number;
            };
        };
        gates: {
            qualityGate: "failed" | "warning" | "passed";
            thresholds: Record<string, number>;
            blockers: string[];
            warnings: string[];
        };
    };
    insights: {
        type: "improvement" | "regression" | "stability" | "anomaly";
        description: string;
        priority: "low" | "medium" | "high" | "critical";
        title: string;
        actionable: boolean;
    }[];
    projectId: string;
    comparisons: {
        value: number;
        type: "target" | "previous_period" | "baseline";
        change: number;
        trend: "stable" | "up" | "down";
    }[];
}>;
export type CodeQualityMetric = z.infer<typeof CodeQualityMetricSchema>;
export type CodeQualityDashboard = z.infer<typeof CodeQualityDashboardSchema>;
export declare const BugMetricSchema: z.ZodObject<{
    id: z.ZodString;
    timestamp: z.ZodString;
    projectId: z.ZodString;
    totalBugs: z.ZodNumber;
    openBugs: z.ZodNumber;
    resolvedBugs: z.ZodNumber;
    criticalBugs: z.ZodNumber;
    averageResolutionTime: z.ZodNumber;
    bugVelocity: z.ZodNumber;
    escapedBugs: z.ZodNumber;
    regressionRate: z.ZodNumber;
    defectDensity: z.ZodNumber;
    categories: z.ZodRecord<z.ZodString, z.ZodNumber>;
    severity: z.ZodObject<{
        critical: z.ZodNumber;
        high: z.ZodNumber;
        medium: z.ZodNumber;
        low: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        low: number;
        medium: number;
        high: number;
        critical: number;
    }, {
        low: number;
        medium: number;
        high: number;
        critical: number;
    }>;
    trends: z.ZodArray<z.ZodObject<{
        date: z.ZodString;
        opened: z.ZodNumber;
        resolved: z.ZodNumber;
        backlog: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        date: string;
        resolved: number;
        opened: number;
        backlog: number;
    }, {
        date: string;
        resolved: number;
        opened: number;
        backlog: number;
    }>, "many">;
    aiClassification: z.ZodObject<{
        accuracy: z.ZodNumber;
        patterns: z.ZodArray<z.ZodObject<{
            pattern: z.ZodString;
            frequency: z.ZodNumber;
            impact: z.ZodEnum<["low", "medium", "high"]>;
        }, "strip", z.ZodTypeAny, {
            frequency: number;
            pattern: string;
            impact: "low" | "medium" | "high";
        }, {
            frequency: number;
            pattern: string;
            impact: "low" | "medium" | "high";
        }>, "many">;
        predictions: z.ZodObject<{
            nextWeekBugs: z.ZodNumber;
            hotspots: z.ZodArray<z.ZodString, "many">;
            riskAreas: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            hotspots: string[];
            nextWeekBugs: number;
            riskAreas: string[];
        }, {
            hotspots: string[];
            nextWeekBugs: number;
            riskAreas: string[];
        }>;
        rootCauses: z.ZodArray<z.ZodObject<{
            cause: z.ZodString;
            frequency: z.ZodNumber;
            preventable: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            frequency: number;
            cause: string;
            preventable: boolean;
        }, {
            frequency: number;
            cause: string;
            preventable: boolean;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        accuracy: number;
        predictions: {
            hotspots: string[];
            nextWeekBugs: number;
            riskAreas: string[];
        };
        patterns: {
            frequency: number;
            pattern: string;
            impact: "low" | "medium" | "high";
        }[];
        rootCauses: {
            frequency: number;
            cause: string;
            preventable: boolean;
        }[];
    }, {
        accuracy: number;
        predictions: {
            hotspots: string[];
            nextWeekBugs: number;
            riskAreas: string[];
        };
        patterns: {
            frequency: number;
            pattern: string;
            impact: "low" | "medium" | "high";
        }[];
        rootCauses: {
            frequency: number;
            cause: string;
            preventable: boolean;
        }[];
    }>;
    performance: z.ZodObject<{
        timeToDetection: z.ZodNumber;
        timeToResolution: z.ZodNumber;
        firstTimeFixRate: z.ZodNumber;
        reopenRate: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        timeToDetection: number;
        timeToResolution: number;
        firstTimeFixRate: number;
        reopenRate: number;
    }, {
        timeToDetection: number;
        timeToResolution: number;
        firstTimeFixRate: number;
        reopenRate: number;
    }>;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    id: string;
    severity: {
        low: number;
        medium: number;
        high: number;
        critical: number;
    };
    trends: {
        date: string;
        resolved: number;
        opened: number;
        backlog: number;
    }[];
    categories: Record<string, number>;
    projectId: string;
    performance: {
        timeToDetection: number;
        timeToResolution: number;
        firstTimeFixRate: number;
        reopenRate: number;
    };
    totalBugs: number;
    openBugs: number;
    resolvedBugs: number;
    criticalBugs: number;
    averageResolutionTime: number;
    bugVelocity: number;
    escapedBugs: number;
    regressionRate: number;
    defectDensity: number;
    aiClassification: {
        accuracy: number;
        predictions: {
            hotspots: string[];
            nextWeekBugs: number;
            riskAreas: string[];
        };
        patterns: {
            frequency: number;
            pattern: string;
            impact: "low" | "medium" | "high";
        }[];
        rootCauses: {
            frequency: number;
            cause: string;
            preventable: boolean;
        }[];
    };
}, {
    timestamp: string;
    id: string;
    severity: {
        low: number;
        medium: number;
        high: number;
        critical: number;
    };
    trends: {
        date: string;
        resolved: number;
        opened: number;
        backlog: number;
    }[];
    categories: Record<string, number>;
    projectId: string;
    performance: {
        timeToDetection: number;
        timeToResolution: number;
        firstTimeFixRate: number;
        reopenRate: number;
    };
    totalBugs: number;
    openBugs: number;
    resolvedBugs: number;
    criticalBugs: number;
    averageResolutionTime: number;
    bugVelocity: number;
    escapedBugs: number;
    regressionRate: number;
    defectDensity: number;
    aiClassification: {
        accuracy: number;
        predictions: {
            hotspots: string[];
            nextWeekBugs: number;
            riskAreas: string[];
        };
        patterns: {
            frequency: number;
            pattern: string;
            impact: "low" | "medium" | "high";
        }[];
        rootCauses: {
            frequency: number;
            cause: string;
            preventable: boolean;
        }[];
    };
}>;
export declare const BugTrackingDashboardSchema: z.ZodObject<{
    id: z.ZodString;
    projectId: z.ZodString;
    metrics: z.ZodObject<{
        id: z.ZodString;
        timestamp: z.ZodString;
        projectId: z.ZodString;
        totalBugs: z.ZodNumber;
        openBugs: z.ZodNumber;
        resolvedBugs: z.ZodNumber;
        criticalBugs: z.ZodNumber;
        averageResolutionTime: z.ZodNumber;
        bugVelocity: z.ZodNumber;
        escapedBugs: z.ZodNumber;
        regressionRate: z.ZodNumber;
        defectDensity: z.ZodNumber;
        categories: z.ZodRecord<z.ZodString, z.ZodNumber>;
        severity: z.ZodObject<{
            critical: z.ZodNumber;
            high: z.ZodNumber;
            medium: z.ZodNumber;
            low: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            low: number;
            medium: number;
            high: number;
            critical: number;
        }, {
            low: number;
            medium: number;
            high: number;
            critical: number;
        }>;
        trends: z.ZodArray<z.ZodObject<{
            date: z.ZodString;
            opened: z.ZodNumber;
            resolved: z.ZodNumber;
            backlog: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            date: string;
            resolved: number;
            opened: number;
            backlog: number;
        }, {
            date: string;
            resolved: number;
            opened: number;
            backlog: number;
        }>, "many">;
        aiClassification: z.ZodObject<{
            accuracy: z.ZodNumber;
            patterns: z.ZodArray<z.ZodObject<{
                pattern: z.ZodString;
                frequency: z.ZodNumber;
                impact: z.ZodEnum<["low", "medium", "high"]>;
            }, "strip", z.ZodTypeAny, {
                frequency: number;
                pattern: string;
                impact: "low" | "medium" | "high";
            }, {
                frequency: number;
                pattern: string;
                impact: "low" | "medium" | "high";
            }>, "many">;
            predictions: z.ZodObject<{
                nextWeekBugs: z.ZodNumber;
                hotspots: z.ZodArray<z.ZodString, "many">;
                riskAreas: z.ZodArray<z.ZodString, "many">;
            }, "strip", z.ZodTypeAny, {
                hotspots: string[];
                nextWeekBugs: number;
                riskAreas: string[];
            }, {
                hotspots: string[];
                nextWeekBugs: number;
                riskAreas: string[];
            }>;
            rootCauses: z.ZodArray<z.ZodObject<{
                cause: z.ZodString;
                frequency: z.ZodNumber;
                preventable: z.ZodBoolean;
            }, "strip", z.ZodTypeAny, {
                frequency: number;
                cause: string;
                preventable: boolean;
            }, {
                frequency: number;
                cause: string;
                preventable: boolean;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            accuracy: number;
            predictions: {
                hotspots: string[];
                nextWeekBugs: number;
                riskAreas: string[];
            };
            patterns: {
                frequency: number;
                pattern: string;
                impact: "low" | "medium" | "high";
            }[];
            rootCauses: {
                frequency: number;
                cause: string;
                preventable: boolean;
            }[];
        }, {
            accuracy: number;
            predictions: {
                hotspots: string[];
                nextWeekBugs: number;
                riskAreas: string[];
            };
            patterns: {
                frequency: number;
                pattern: string;
                impact: "low" | "medium" | "high";
            }[];
            rootCauses: {
                frequency: number;
                cause: string;
                preventable: boolean;
            }[];
        }>;
        performance: z.ZodObject<{
            timeToDetection: z.ZodNumber;
            timeToResolution: z.ZodNumber;
            firstTimeFixRate: z.ZodNumber;
            reopenRate: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            timeToDetection: number;
            timeToResolution: number;
            firstTimeFixRate: number;
            reopenRate: number;
        }, {
            timeToDetection: number;
            timeToResolution: number;
            firstTimeFixRate: number;
            reopenRate: number;
        }>;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        id: string;
        severity: {
            low: number;
            medium: number;
            high: number;
            critical: number;
        };
        trends: {
            date: string;
            resolved: number;
            opened: number;
            backlog: number;
        }[];
        categories: Record<string, number>;
        projectId: string;
        performance: {
            timeToDetection: number;
            timeToResolution: number;
            firstTimeFixRate: number;
            reopenRate: number;
        };
        totalBugs: number;
        openBugs: number;
        resolvedBugs: number;
        criticalBugs: number;
        averageResolutionTime: number;
        bugVelocity: number;
        escapedBugs: number;
        regressionRate: number;
        defectDensity: number;
        aiClassification: {
            accuracy: number;
            predictions: {
                hotspots: string[];
                nextWeekBugs: number;
                riskAreas: string[];
            };
            patterns: {
                frequency: number;
                pattern: string;
                impact: "low" | "medium" | "high";
            }[];
            rootCauses: {
                frequency: number;
                cause: string;
                preventable: boolean;
            }[];
        };
    }, {
        timestamp: string;
        id: string;
        severity: {
            low: number;
            medium: number;
            high: number;
            critical: number;
        };
        trends: {
            date: string;
            resolved: number;
            opened: number;
            backlog: number;
        }[];
        categories: Record<string, number>;
        projectId: string;
        performance: {
            timeToDetection: number;
            timeToResolution: number;
            firstTimeFixRate: number;
            reopenRate: number;
        };
        totalBugs: number;
        openBugs: number;
        resolvedBugs: number;
        criticalBugs: number;
        averageResolutionTime: number;
        bugVelocity: number;
        escapedBugs: number;
        regressionRate: number;
        defectDensity: number;
        aiClassification: {
            accuracy: number;
            predictions: {
                hotspots: string[];
                nextWeekBugs: number;
                riskAreas: string[];
            };
            patterns: {
                frequency: number;
                pattern: string;
                impact: "low" | "medium" | "high";
            }[];
            rootCauses: {
                frequency: number;
                cause: string;
                preventable: boolean;
            }[];
        };
    }>;
    workflows: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        status: z.ZodEnum<["active", "paused", "disabled"]>;
        efficiency: z.ZodNumber;
        automationLevel: z.ZodNumber;
        interventions: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "paused" | "disabled";
        name: string;
        efficiency: number;
        automationLevel: number;
        interventions: number;
    }, {
        status: "active" | "paused" | "disabled";
        name: string;
        efficiency: number;
        automationLevel: number;
        interventions: number;
    }>, "many">;
    alerts: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["spike", "regression", "threshold_breach", "pattern_anomaly"]>;
        severity: z.ZodEnum<["info", "warning", "critical"]>;
        message: z.ZodString;
        actionRequired: z.ZodBoolean;
        autoResolvable: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        message: string;
        type: "threshold_breach" | "regression" | "spike" | "pattern_anomaly";
        severity: "warning" | "critical" | "info";
        actionRequired: boolean;
        autoResolvable: boolean;
    }, {
        message: string;
        type: "threshold_breach" | "regression" | "spike" | "pattern_anomaly";
        severity: "warning" | "critical" | "info";
        actionRequired: boolean;
        autoResolvable: boolean;
    }>, "many">;
    reports: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["daily", "weekly", "monthly", "incident"]>;
        generatedAt: z.ZodString;
        summary: z.ZodString;
        keyMetrics: z.ZodRecord<z.ZodString, z.ZodAny>;
        recommendations: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        type: "daily" | "weekly" | "monthly" | "incident";
        recommendations: string[];
        summary: string;
        generatedAt: string;
        keyMetrics: Record<string, any>;
    }, {
        type: "daily" | "weekly" | "monthly" | "incident";
        recommendations: string[];
        summary: string;
        generatedAt: string;
        keyMetrics: Record<string, any>;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    id: string;
    reports: {
        type: "daily" | "weekly" | "monthly" | "incident";
        recommendations: string[];
        summary: string;
        generatedAt: string;
        keyMetrics: Record<string, any>;
    }[];
    metrics: {
        timestamp: string;
        id: string;
        severity: {
            low: number;
            medium: number;
            high: number;
            critical: number;
        };
        trends: {
            date: string;
            resolved: number;
            opened: number;
            backlog: number;
        }[];
        categories: Record<string, number>;
        projectId: string;
        performance: {
            timeToDetection: number;
            timeToResolution: number;
            firstTimeFixRate: number;
            reopenRate: number;
        };
        totalBugs: number;
        openBugs: number;
        resolvedBugs: number;
        criticalBugs: number;
        averageResolutionTime: number;
        bugVelocity: number;
        escapedBugs: number;
        regressionRate: number;
        defectDensity: number;
        aiClassification: {
            accuracy: number;
            predictions: {
                hotspots: string[];
                nextWeekBugs: number;
                riskAreas: string[];
            };
            patterns: {
                frequency: number;
                pattern: string;
                impact: "low" | "medium" | "high";
            }[];
            rootCauses: {
                frequency: number;
                cause: string;
                preventable: boolean;
            }[];
        };
    };
    projectId: string;
    alerts: {
        message: string;
        type: "threshold_breach" | "regression" | "spike" | "pattern_anomaly";
        severity: "warning" | "critical" | "info";
        actionRequired: boolean;
        autoResolvable: boolean;
    }[];
    workflows: {
        status: "active" | "paused" | "disabled";
        name: string;
        efficiency: number;
        automationLevel: number;
        interventions: number;
    }[];
}, {
    id: string;
    reports: {
        type: "daily" | "weekly" | "monthly" | "incident";
        recommendations: string[];
        summary: string;
        generatedAt: string;
        keyMetrics: Record<string, any>;
    }[];
    metrics: {
        timestamp: string;
        id: string;
        severity: {
            low: number;
            medium: number;
            high: number;
            critical: number;
        };
        trends: {
            date: string;
            resolved: number;
            opened: number;
            backlog: number;
        }[];
        categories: Record<string, number>;
        projectId: string;
        performance: {
            timeToDetection: number;
            timeToResolution: number;
            firstTimeFixRate: number;
            reopenRate: number;
        };
        totalBugs: number;
        openBugs: number;
        resolvedBugs: number;
        criticalBugs: number;
        averageResolutionTime: number;
        bugVelocity: number;
        escapedBugs: number;
        regressionRate: number;
        defectDensity: number;
        aiClassification: {
            accuracy: number;
            predictions: {
                hotspots: string[];
                nextWeekBugs: number;
                riskAreas: string[];
            };
            patterns: {
                frequency: number;
                pattern: string;
                impact: "low" | "medium" | "high";
            }[];
            rootCauses: {
                frequency: number;
                cause: string;
                preventable: boolean;
            }[];
        };
    };
    projectId: string;
    alerts: {
        message: string;
        type: "threshold_breach" | "regression" | "spike" | "pattern_anomaly";
        severity: "warning" | "critical" | "info";
        actionRequired: boolean;
        autoResolvable: boolean;
    }[];
    workflows: {
        status: "active" | "paused" | "disabled";
        name: string;
        efficiency: number;
        automationLevel: number;
        interventions: number;
    }[];
}>;
export type BugMetric = z.infer<typeof BugMetricSchema>;
export type BugTrackingDashboard = z.infer<typeof BugTrackingDashboardSchema>;
export declare const PerformanceBenchmarkSchema: z.ZodObject<{
    id: z.ZodString;
    timestamp: z.ZodString;
    projectId: z.ZodString;
    environment: z.ZodEnum<["development", "staging", "production"]>;
    baseline: z.ZodObject<{
        version: z.ZodString;
        timestamp: z.ZodString;
        metrics: z.ZodRecord<z.ZodString, z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        version: string;
        metrics: Record<string, number>;
    }, {
        timestamp: string;
        version: string;
        metrics: Record<string, number>;
    }>;
    current: z.ZodObject<{
        version: z.ZodString;
        timestamp: z.ZodString;
        metrics: z.ZodRecord<z.ZodString, z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        version: string;
        metrics: Record<string, number>;
    }, {
        timestamp: string;
        version: string;
        metrics: Record<string, number>;
    }>;
    performance: z.ZodObject<{
        responseTime: z.ZodObject<{
            average: z.ZodNumber;
            p95: z.ZodNumber;
            p99: z.ZodNumber;
            max: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            max: number;
            average: number;
            p95: number;
            p99: number;
        }, {
            max: number;
            average: number;
            p95: number;
            p99: number;
        }>;
        throughput: z.ZodObject<{
            requestsPerSecond: z.ZodNumber;
            transactionsPerSecond: z.ZodNumber;
            concurrentUsers: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            requestsPerSecond: number;
            transactionsPerSecond: number;
            concurrentUsers: number;
        }, {
            requestsPerSecond: number;
            transactionsPerSecond: number;
            concurrentUsers: number;
        }>;
        resources: z.ZodObject<{
            cpuUsage: z.ZodNumber;
            memoryUsage: z.ZodNumber;
            diskUsage: z.ZodNumber;
            networkUsage: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            cpuUsage: number;
            memoryUsage: number;
            diskUsage: number;
            networkUsage: number;
        }, {
            cpuUsage: number;
            memoryUsage: number;
            diskUsage: number;
            networkUsage: number;
        }>;
        errors: z.ZodObject<{
            rate: z.ZodNumber;
            count: z.ZodNumber;
            types: z.ZodRecord<z.ZodString, z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            count: number;
            rate: number;
            types: Record<string, number>;
        }, {
            count: number;
            rate: number;
            types: Record<string, number>;
        }>;
    }, "strip", z.ZodTypeAny, {
        errors: {
            count: number;
            rate: number;
            types: Record<string, number>;
        };
        throughput: {
            requestsPerSecond: number;
            transactionsPerSecond: number;
            concurrentUsers: number;
        };
        responseTime: {
            max: number;
            average: number;
            p95: number;
            p99: number;
        };
        resources: {
            cpuUsage: number;
            memoryUsage: number;
            diskUsage: number;
            networkUsage: number;
        };
    }, {
        errors: {
            count: number;
            rate: number;
            types: Record<string, number>;
        };
        throughput: {
            requestsPerSecond: number;
            transactionsPerSecond: number;
            concurrentUsers: number;
        };
        responseTime: {
            max: number;
            average: number;
            p95: number;
            p99: number;
        };
        resources: {
            cpuUsage: number;
            memoryUsage: number;
            diskUsage: number;
            networkUsage: number;
        };
    }>;
    comparisons: z.ZodArray<z.ZodObject<{
        metric: z.ZodString;
        baseline: z.ZodNumber;
        current: z.ZodNumber;
        change: z.ZodNumber;
        changePercent: z.ZodNumber;
        trend: z.ZodEnum<["improvement", "regression", "stable"]>;
        significance: z.ZodEnum<["major", "minor", "negligible"]>;
    }, "strip", z.ZodTypeAny, {
        metric: string;
        change: number;
        baseline: number;
        trend: "stable" | "improvement" | "regression";
        current: number;
        changePercent: number;
        significance: "minor" | "major" | "negligible";
    }, {
        metric: string;
        change: number;
        baseline: number;
        trend: "stable" | "improvement" | "regression";
        current: number;
        changePercent: number;
        significance: "minor" | "major" | "negligible";
    }>, "many">;
    anomalies: z.ZodArray<z.ZodObject<{
        metric: z.ZodString;
        detected: z.ZodString;
        severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
        description: z.ZodString;
        possibleCauses: z.ZodArray<z.ZodString, "many">;
        autoResolved: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        description: string;
        metric: string;
        severity: "low" | "medium" | "high" | "critical";
        detected: string;
        possibleCauses: string[];
        autoResolved: boolean;
    }, {
        description: string;
        metric: string;
        severity: "low" | "medium" | "high" | "critical";
        detected: string;
        possibleCauses: string[];
        autoResolved: boolean;
    }>, "many">;
    aiAnalysis: z.ZodObject<{
        forecast: z.ZodObject<{
            nextHour: z.ZodRecord<z.ZodString, z.ZodNumber>;
            nextDay: z.ZodRecord<z.ZodString, z.ZodNumber>;
            confidence: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            confidence: number;
            nextHour: Record<string, number>;
            nextDay: Record<string, number>;
        }, {
            confidence: number;
            nextHour: Record<string, number>;
            nextDay: Record<string, number>;
        }>;
        optimizations: z.ZodArray<z.ZodObject<{
            area: z.ZodString;
            recommendation: z.ZodString;
            impact: z.ZodEnum<["low", "medium", "high"]>;
            effort: z.ZodEnum<["low", "medium", "high"]>;
            automated: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            automated: boolean;
            area: string;
            recommendation: string;
            impact: "low" | "medium" | "high";
            effort: "low" | "medium" | "high";
        }, {
            automated: boolean;
            area: string;
            recommendation: string;
            impact: "low" | "medium" | "high";
            effort: "low" | "medium" | "high";
        }>, "many">;
        patterns: z.ZodArray<z.ZodObject<{
            pattern: z.ZodString;
            frequency: z.ZodString;
            correlation: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            frequency: string;
            pattern: string;
            correlation: number;
        }, {
            frequency: string;
            pattern: string;
            correlation: number;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        patterns: {
            frequency: string;
            pattern: string;
            correlation: number;
        }[];
        forecast: {
            confidence: number;
            nextHour: Record<string, number>;
            nextDay: Record<string, number>;
        };
        optimizations: {
            automated: boolean;
            area: string;
            recommendation: string;
            impact: "low" | "medium" | "high";
            effort: "low" | "medium" | "high";
        }[];
    }, {
        patterns: {
            frequency: string;
            pattern: string;
            correlation: number;
        }[];
        forecast: {
            confidence: number;
            nextHour: Record<string, number>;
            nextDay: Record<string, number>;
        };
        optimizations: {
            automated: boolean;
            area: string;
            recommendation: string;
            impact: "low" | "medium" | "high";
            effort: "low" | "medium" | "high";
        }[];
    }>;
    alerts: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["threshold_breach", "regression", "anomaly", "prediction"]>;
        metric: z.ZodString;
        value: z.ZodNumber;
        threshold: z.ZodNumber;
        severity: z.ZodEnum<["info", "warning", "critical"]>;
        actionable: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        value: number;
        type: "threshold_breach" | "regression" | "anomaly" | "prediction";
        metric: string;
        threshold: number;
        severity: "warning" | "critical" | "info";
        actionable: boolean;
    }, {
        value: number;
        type: "threshold_breach" | "regression" | "anomaly" | "prediction";
        metric: string;
        threshold: number;
        severity: "warning" | "critical" | "info";
        actionable: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    id: string;
    environment: "development" | "production" | "staging";
    anomalies: {
        description: string;
        metric: string;
        severity: "low" | "medium" | "high" | "critical";
        detected: string;
        possibleCauses: string[];
        autoResolved: boolean;
    }[];
    projectId: string;
    alerts: {
        value: number;
        type: "threshold_breach" | "regression" | "anomaly" | "prediction";
        metric: string;
        threshold: number;
        severity: "warning" | "critical" | "info";
        actionable: boolean;
    }[];
    aiAnalysis: {
        patterns: {
            frequency: string;
            pattern: string;
            correlation: number;
        }[];
        forecast: {
            confidence: number;
            nextHour: Record<string, number>;
            nextDay: Record<string, number>;
        };
        optimizations: {
            automated: boolean;
            area: string;
            recommendation: string;
            impact: "low" | "medium" | "high";
            effort: "low" | "medium" | "high";
        }[];
    };
    comparisons: {
        metric: string;
        change: number;
        baseline: number;
        trend: "stable" | "improvement" | "regression";
        current: number;
        changePercent: number;
        significance: "minor" | "major" | "negligible";
    }[];
    baseline: {
        timestamp: string;
        version: string;
        metrics: Record<string, number>;
    };
    performance: {
        errors: {
            count: number;
            rate: number;
            types: Record<string, number>;
        };
        throughput: {
            requestsPerSecond: number;
            transactionsPerSecond: number;
            concurrentUsers: number;
        };
        responseTime: {
            max: number;
            average: number;
            p95: number;
            p99: number;
        };
        resources: {
            cpuUsage: number;
            memoryUsage: number;
            diskUsage: number;
            networkUsage: number;
        };
    };
    current: {
        timestamp: string;
        version: string;
        metrics: Record<string, number>;
    };
}, {
    timestamp: string;
    id: string;
    environment: "development" | "production" | "staging";
    anomalies: {
        description: string;
        metric: string;
        severity: "low" | "medium" | "high" | "critical";
        detected: string;
        possibleCauses: string[];
        autoResolved: boolean;
    }[];
    projectId: string;
    alerts: {
        value: number;
        type: "threshold_breach" | "regression" | "anomaly" | "prediction";
        metric: string;
        threshold: number;
        severity: "warning" | "critical" | "info";
        actionable: boolean;
    }[];
    aiAnalysis: {
        patterns: {
            frequency: string;
            pattern: string;
            correlation: number;
        }[];
        forecast: {
            confidence: number;
            nextHour: Record<string, number>;
            nextDay: Record<string, number>;
        };
        optimizations: {
            automated: boolean;
            area: string;
            recommendation: string;
            impact: "low" | "medium" | "high";
            effort: "low" | "medium" | "high";
        }[];
    };
    comparisons: {
        metric: string;
        change: number;
        baseline: number;
        trend: "stable" | "improvement" | "regression";
        current: number;
        changePercent: number;
        significance: "minor" | "major" | "negligible";
    }[];
    baseline: {
        timestamp: string;
        version: string;
        metrics: Record<string, number>;
    };
    performance: {
        errors: {
            count: number;
            rate: number;
            types: Record<string, number>;
        };
        throughput: {
            requestsPerSecond: number;
            transactionsPerSecond: number;
            concurrentUsers: number;
        };
        responseTime: {
            max: number;
            average: number;
            p95: number;
            p99: number;
        };
        resources: {
            cpuUsage: number;
            memoryUsage: number;
            diskUsage: number;
            networkUsage: number;
        };
    };
    current: {
        timestamp: string;
        version: string;
        metrics: Record<string, number>;
    };
}>;
export declare const PerformanceDashboardSchema: z.ZodObject<{
    id: z.ZodString;
    projectId: z.ZodString;
    timeframe: z.ZodEnum<["realtime", "hour", "day", "week", "month"]>;
    benchmarks: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        timestamp: z.ZodString;
        projectId: z.ZodString;
        environment: z.ZodEnum<["development", "staging", "production"]>;
        baseline: z.ZodObject<{
            version: z.ZodString;
            timestamp: z.ZodString;
            metrics: z.ZodRecord<z.ZodString, z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            timestamp: string;
            version: string;
            metrics: Record<string, number>;
        }, {
            timestamp: string;
            version: string;
            metrics: Record<string, number>;
        }>;
        current: z.ZodObject<{
            version: z.ZodString;
            timestamp: z.ZodString;
            metrics: z.ZodRecord<z.ZodString, z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            timestamp: string;
            version: string;
            metrics: Record<string, number>;
        }, {
            timestamp: string;
            version: string;
            metrics: Record<string, number>;
        }>;
        performance: z.ZodObject<{
            responseTime: z.ZodObject<{
                average: z.ZodNumber;
                p95: z.ZodNumber;
                p99: z.ZodNumber;
                max: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                max: number;
                average: number;
                p95: number;
                p99: number;
            }, {
                max: number;
                average: number;
                p95: number;
                p99: number;
            }>;
            throughput: z.ZodObject<{
                requestsPerSecond: z.ZodNumber;
                transactionsPerSecond: z.ZodNumber;
                concurrentUsers: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                requestsPerSecond: number;
                transactionsPerSecond: number;
                concurrentUsers: number;
            }, {
                requestsPerSecond: number;
                transactionsPerSecond: number;
                concurrentUsers: number;
            }>;
            resources: z.ZodObject<{
                cpuUsage: z.ZodNumber;
                memoryUsage: z.ZodNumber;
                diskUsage: z.ZodNumber;
                networkUsage: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                cpuUsage: number;
                memoryUsage: number;
                diskUsage: number;
                networkUsage: number;
            }, {
                cpuUsage: number;
                memoryUsage: number;
                diskUsage: number;
                networkUsage: number;
            }>;
            errors: z.ZodObject<{
                rate: z.ZodNumber;
                count: z.ZodNumber;
                types: z.ZodRecord<z.ZodString, z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                count: number;
                rate: number;
                types: Record<string, number>;
            }, {
                count: number;
                rate: number;
                types: Record<string, number>;
            }>;
        }, "strip", z.ZodTypeAny, {
            errors: {
                count: number;
                rate: number;
                types: Record<string, number>;
            };
            throughput: {
                requestsPerSecond: number;
                transactionsPerSecond: number;
                concurrentUsers: number;
            };
            responseTime: {
                max: number;
                average: number;
                p95: number;
                p99: number;
            };
            resources: {
                cpuUsage: number;
                memoryUsage: number;
                diskUsage: number;
                networkUsage: number;
            };
        }, {
            errors: {
                count: number;
                rate: number;
                types: Record<string, number>;
            };
            throughput: {
                requestsPerSecond: number;
                transactionsPerSecond: number;
                concurrentUsers: number;
            };
            responseTime: {
                max: number;
                average: number;
                p95: number;
                p99: number;
            };
            resources: {
                cpuUsage: number;
                memoryUsage: number;
                diskUsage: number;
                networkUsage: number;
            };
        }>;
        comparisons: z.ZodArray<z.ZodObject<{
            metric: z.ZodString;
            baseline: z.ZodNumber;
            current: z.ZodNumber;
            change: z.ZodNumber;
            changePercent: z.ZodNumber;
            trend: z.ZodEnum<["improvement", "regression", "stable"]>;
            significance: z.ZodEnum<["major", "minor", "negligible"]>;
        }, "strip", z.ZodTypeAny, {
            metric: string;
            change: number;
            baseline: number;
            trend: "stable" | "improvement" | "regression";
            current: number;
            changePercent: number;
            significance: "minor" | "major" | "negligible";
        }, {
            metric: string;
            change: number;
            baseline: number;
            trend: "stable" | "improvement" | "regression";
            current: number;
            changePercent: number;
            significance: "minor" | "major" | "negligible";
        }>, "many">;
        anomalies: z.ZodArray<z.ZodObject<{
            metric: z.ZodString;
            detected: z.ZodString;
            severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
            description: z.ZodString;
            possibleCauses: z.ZodArray<z.ZodString, "many">;
            autoResolved: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            description: string;
            metric: string;
            severity: "low" | "medium" | "high" | "critical";
            detected: string;
            possibleCauses: string[];
            autoResolved: boolean;
        }, {
            description: string;
            metric: string;
            severity: "low" | "medium" | "high" | "critical";
            detected: string;
            possibleCauses: string[];
            autoResolved: boolean;
        }>, "many">;
        aiAnalysis: z.ZodObject<{
            forecast: z.ZodObject<{
                nextHour: z.ZodRecord<z.ZodString, z.ZodNumber>;
                nextDay: z.ZodRecord<z.ZodString, z.ZodNumber>;
                confidence: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                confidence: number;
                nextHour: Record<string, number>;
                nextDay: Record<string, number>;
            }, {
                confidence: number;
                nextHour: Record<string, number>;
                nextDay: Record<string, number>;
            }>;
            optimizations: z.ZodArray<z.ZodObject<{
                area: z.ZodString;
                recommendation: z.ZodString;
                impact: z.ZodEnum<["low", "medium", "high"]>;
                effort: z.ZodEnum<["low", "medium", "high"]>;
                automated: z.ZodBoolean;
            }, "strip", z.ZodTypeAny, {
                automated: boolean;
                area: string;
                recommendation: string;
                impact: "low" | "medium" | "high";
                effort: "low" | "medium" | "high";
            }, {
                automated: boolean;
                area: string;
                recommendation: string;
                impact: "low" | "medium" | "high";
                effort: "low" | "medium" | "high";
            }>, "many">;
            patterns: z.ZodArray<z.ZodObject<{
                pattern: z.ZodString;
                frequency: z.ZodString;
                correlation: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                frequency: string;
                pattern: string;
                correlation: number;
            }, {
                frequency: string;
                pattern: string;
                correlation: number;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            patterns: {
                frequency: string;
                pattern: string;
                correlation: number;
            }[];
            forecast: {
                confidence: number;
                nextHour: Record<string, number>;
                nextDay: Record<string, number>;
            };
            optimizations: {
                automated: boolean;
                area: string;
                recommendation: string;
                impact: "low" | "medium" | "high";
                effort: "low" | "medium" | "high";
            }[];
        }, {
            patterns: {
                frequency: string;
                pattern: string;
                correlation: number;
            }[];
            forecast: {
                confidence: number;
                nextHour: Record<string, number>;
                nextDay: Record<string, number>;
            };
            optimizations: {
                automated: boolean;
                area: string;
                recommendation: string;
                impact: "low" | "medium" | "high";
                effort: "low" | "medium" | "high";
            }[];
        }>;
        alerts: z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<["threshold_breach", "regression", "anomaly", "prediction"]>;
            metric: z.ZodString;
            value: z.ZodNumber;
            threshold: z.ZodNumber;
            severity: z.ZodEnum<["info", "warning", "critical"]>;
            actionable: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            value: number;
            type: "threshold_breach" | "regression" | "anomaly" | "prediction";
            metric: string;
            threshold: number;
            severity: "warning" | "critical" | "info";
            actionable: boolean;
        }, {
            value: number;
            type: "threshold_breach" | "regression" | "anomaly" | "prediction";
            metric: string;
            threshold: number;
            severity: "warning" | "critical" | "info";
            actionable: boolean;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        id: string;
        environment: "development" | "production" | "staging";
        anomalies: {
            description: string;
            metric: string;
            severity: "low" | "medium" | "high" | "critical";
            detected: string;
            possibleCauses: string[];
            autoResolved: boolean;
        }[];
        projectId: string;
        alerts: {
            value: number;
            type: "threshold_breach" | "regression" | "anomaly" | "prediction";
            metric: string;
            threshold: number;
            severity: "warning" | "critical" | "info";
            actionable: boolean;
        }[];
        aiAnalysis: {
            patterns: {
                frequency: string;
                pattern: string;
                correlation: number;
            }[];
            forecast: {
                confidence: number;
                nextHour: Record<string, number>;
                nextDay: Record<string, number>;
            };
            optimizations: {
                automated: boolean;
                area: string;
                recommendation: string;
                impact: "low" | "medium" | "high";
                effort: "low" | "medium" | "high";
            }[];
        };
        comparisons: {
            metric: string;
            change: number;
            baseline: number;
            trend: "stable" | "improvement" | "regression";
            current: number;
            changePercent: number;
            significance: "minor" | "major" | "negligible";
        }[];
        baseline: {
            timestamp: string;
            version: string;
            metrics: Record<string, number>;
        };
        performance: {
            errors: {
                count: number;
                rate: number;
                types: Record<string, number>;
            };
            throughput: {
                requestsPerSecond: number;
                transactionsPerSecond: number;
                concurrentUsers: number;
            };
            responseTime: {
                max: number;
                average: number;
                p95: number;
                p99: number;
            };
            resources: {
                cpuUsage: number;
                memoryUsage: number;
                diskUsage: number;
                networkUsage: number;
            };
        };
        current: {
            timestamp: string;
            version: string;
            metrics: Record<string, number>;
        };
    }, {
        timestamp: string;
        id: string;
        environment: "development" | "production" | "staging";
        anomalies: {
            description: string;
            metric: string;
            severity: "low" | "medium" | "high" | "critical";
            detected: string;
            possibleCauses: string[];
            autoResolved: boolean;
        }[];
        projectId: string;
        alerts: {
            value: number;
            type: "threshold_breach" | "regression" | "anomaly" | "prediction";
            metric: string;
            threshold: number;
            severity: "warning" | "critical" | "info";
            actionable: boolean;
        }[];
        aiAnalysis: {
            patterns: {
                frequency: string;
                pattern: string;
                correlation: number;
            }[];
            forecast: {
                confidence: number;
                nextHour: Record<string, number>;
                nextDay: Record<string, number>;
            };
            optimizations: {
                automated: boolean;
                area: string;
                recommendation: string;
                impact: "low" | "medium" | "high";
                effort: "low" | "medium" | "high";
            }[];
        };
        comparisons: {
            metric: string;
            change: number;
            baseline: number;
            trend: "stable" | "improvement" | "regression";
            current: number;
            changePercent: number;
            significance: "minor" | "major" | "negligible";
        }[];
        baseline: {
            timestamp: string;
            version: string;
            metrics: Record<string, number>;
        };
        performance: {
            errors: {
                count: number;
                rate: number;
                types: Record<string, number>;
            };
            throughput: {
                requestsPerSecond: number;
                transactionsPerSecond: number;
                concurrentUsers: number;
            };
            responseTime: {
                max: number;
                average: number;
                p95: number;
                p99: number;
            };
            resources: {
                cpuUsage: number;
                memoryUsage: number;
                diskUsage: number;
                networkUsage: number;
            };
        };
        current: {
            timestamp: string;
            version: string;
            metrics: Record<string, number>;
        };
    }>, "many">;
    aggregates: z.ZodObject<{
        average: z.ZodRecord<z.ZodString, z.ZodNumber>;
        median: z.ZodRecord<z.ZodString, z.ZodNumber>;
        p95: z.ZodRecord<z.ZodString, z.ZodNumber>;
        p99: z.ZodRecord<z.ZodString, z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        average: Record<string, number>;
        p95: Record<string, number>;
        p99: Record<string, number>;
        median: Record<string, number>;
    }, {
        average: Record<string, number>;
        p95: Record<string, number>;
        p99: Record<string, number>;
        median: Record<string, number>;
    }>;
    trends: z.ZodArray<z.ZodObject<{
        metric: z.ZodString;
        data: z.ZodArray<z.ZodObject<{
            timestamp: z.ZodString;
            value: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            timestamp: string;
            value: number;
        }, {
            timestamp: string;
            value: number;
        }>, "many">;
        trend: z.ZodEnum<["improving", "degrading", "stable"]>;
        rate: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        data: {
            timestamp: string;
            value: number;
        }[];
        metric: string;
        trend: "stable" | "improving" | "degrading";
        rate: number;
    }, {
        data: {
            timestamp: string;
            value: number;
        }[];
        metric: string;
        trend: "stable" | "improving" | "degrading";
        rate: number;
    }>, "many">;
    insights: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["optimization", "issue", "achievement", "forecast"]>;
        title: z.ZodString;
        description: z.ZodString;
        impact: z.ZodEnum<["low", "medium", "high"]>;
        actionable: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        type: "forecast" | "optimization" | "issue" | "achievement";
        description: string;
        title: string;
        impact: "low" | "medium" | "high";
        actionable: boolean;
    }, {
        type: "forecast" | "optimization" | "issue" | "achievement";
        description: string;
        title: string;
        impact: "low" | "medium" | "high";
        actionable: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    id: string;
    timeframe: "hour" | "day" | "week" | "month" | "realtime";
    trends: {
        data: {
            timestamp: string;
            value: number;
        }[];
        metric: string;
        trend: "stable" | "improving" | "degrading";
        rate: number;
    }[];
    insights: {
        type: "forecast" | "optimization" | "issue" | "achievement";
        description: string;
        title: string;
        impact: "low" | "medium" | "high";
        actionable: boolean;
    }[];
    projectId: string;
    benchmarks: {
        timestamp: string;
        id: string;
        environment: "development" | "production" | "staging";
        anomalies: {
            description: string;
            metric: string;
            severity: "low" | "medium" | "high" | "critical";
            detected: string;
            possibleCauses: string[];
            autoResolved: boolean;
        }[];
        projectId: string;
        alerts: {
            value: number;
            type: "threshold_breach" | "regression" | "anomaly" | "prediction";
            metric: string;
            threshold: number;
            severity: "warning" | "critical" | "info";
            actionable: boolean;
        }[];
        aiAnalysis: {
            patterns: {
                frequency: string;
                pattern: string;
                correlation: number;
            }[];
            forecast: {
                confidence: number;
                nextHour: Record<string, number>;
                nextDay: Record<string, number>;
            };
            optimizations: {
                automated: boolean;
                area: string;
                recommendation: string;
                impact: "low" | "medium" | "high";
                effort: "low" | "medium" | "high";
            }[];
        };
        comparisons: {
            metric: string;
            change: number;
            baseline: number;
            trend: "stable" | "improvement" | "regression";
            current: number;
            changePercent: number;
            significance: "minor" | "major" | "negligible";
        }[];
        baseline: {
            timestamp: string;
            version: string;
            metrics: Record<string, number>;
        };
        performance: {
            errors: {
                count: number;
                rate: number;
                types: Record<string, number>;
            };
            throughput: {
                requestsPerSecond: number;
                transactionsPerSecond: number;
                concurrentUsers: number;
            };
            responseTime: {
                max: number;
                average: number;
                p95: number;
                p99: number;
            };
            resources: {
                cpuUsage: number;
                memoryUsage: number;
                diskUsage: number;
                networkUsage: number;
            };
        };
        current: {
            timestamp: string;
            version: string;
            metrics: Record<string, number>;
        };
    }[];
    aggregates: {
        average: Record<string, number>;
        p95: Record<string, number>;
        p99: Record<string, number>;
        median: Record<string, number>;
    };
}, {
    id: string;
    timeframe: "hour" | "day" | "week" | "month" | "realtime";
    trends: {
        data: {
            timestamp: string;
            value: number;
        }[];
        metric: string;
        trend: "stable" | "improving" | "degrading";
        rate: number;
    }[];
    insights: {
        type: "forecast" | "optimization" | "issue" | "achievement";
        description: string;
        title: string;
        impact: "low" | "medium" | "high";
        actionable: boolean;
    }[];
    projectId: string;
    benchmarks: {
        timestamp: string;
        id: string;
        environment: "development" | "production" | "staging";
        anomalies: {
            description: string;
            metric: string;
            severity: "low" | "medium" | "high" | "critical";
            detected: string;
            possibleCauses: string[];
            autoResolved: boolean;
        }[];
        projectId: string;
        alerts: {
            value: number;
            type: "threshold_breach" | "regression" | "anomaly" | "prediction";
            metric: string;
            threshold: number;
            severity: "warning" | "critical" | "info";
            actionable: boolean;
        }[];
        aiAnalysis: {
            patterns: {
                frequency: string;
                pattern: string;
                correlation: number;
            }[];
            forecast: {
                confidence: number;
                nextHour: Record<string, number>;
                nextDay: Record<string, number>;
            };
            optimizations: {
                automated: boolean;
                area: string;
                recommendation: string;
                impact: "low" | "medium" | "high";
                effort: "low" | "medium" | "high";
            }[];
        };
        comparisons: {
            metric: string;
            change: number;
            baseline: number;
            trend: "stable" | "improvement" | "regression";
            current: number;
            changePercent: number;
            significance: "minor" | "major" | "negligible";
        }[];
        baseline: {
            timestamp: string;
            version: string;
            metrics: Record<string, number>;
        };
        performance: {
            errors: {
                count: number;
                rate: number;
                types: Record<string, number>;
            };
            throughput: {
                requestsPerSecond: number;
                transactionsPerSecond: number;
                concurrentUsers: number;
            };
            responseTime: {
                max: number;
                average: number;
                p95: number;
                p99: number;
            };
            resources: {
                cpuUsage: number;
                memoryUsage: number;
                diskUsage: number;
                networkUsage: number;
            };
        };
        current: {
            timestamp: string;
            version: string;
            metrics: Record<string, number>;
        };
    }[];
    aggregates: {
        average: Record<string, number>;
        p95: Record<string, number>;
        p99: Record<string, number>;
        median: Record<string, number>;
    };
}>;
export type PerformanceBenchmark = z.infer<typeof PerformanceBenchmarkSchema>;
export type PerformanceDashboard = z.infer<typeof PerformanceDashboardSchema>;
export declare const QualityMetricsDashboardSchema: z.ZodObject<{
    id: z.ZodString;
    projectId: z.ZodString;
    timestamp: z.ZodString;
    overallScore: z.ZodNumber;
    coverage: z.ZodObject<{
        id: z.ZodString;
        timestamp: z.ZodString;
        projectId: z.ZodString;
        branch: z.ZodString;
        commit: z.ZodString;
        linesCovered: z.ZodNumber;
        linesTotal: z.ZodNumber;
        branchesCovered: z.ZodNumber;
        branchesTotal: z.ZodNumber;
        functionsCovered: z.ZodNumber;
        functionsTotal: z.ZodNumber;
        statementsCovered: z.ZodNumber;
        statementsTotal: z.ZodNumber;
        coveragePercentage: z.ZodNumber;
        pathCoverage: z.ZodNumber;
        qualityScore: z.ZodNumber;
        trends: z.ZodArray<z.ZodObject<{
            date: z.ZodString;
            coverage: z.ZodNumber;
            change: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            date: string;
            coverage: number;
            change: number;
        }, {
            date: string;
            coverage: number;
            change: number;
        }>, "many">;
        files: z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            coverage: z.ZodNumber;
            uncoveredLines: z.ZodArray<z.ZodNumber, "many">;
            complexityScore: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            path: string;
            coverage: number;
            uncoveredLines: number[];
            complexityScore: number;
        }, {
            path: string;
            coverage: number;
            uncoveredLines: number[];
            complexityScore: number;
        }>, "many">;
        threshold: z.ZodObject<{
            minimum: z.ZodNumber;
            target: z.ZodNumber;
            adaptive: z.ZodBoolean;
            enforcement: z.ZodEnum<["strict", "warning", "disabled"]>;
        }, "strip", z.ZodTypeAny, {
            minimum: number;
            target: number;
            adaptive: boolean;
            enforcement: "strict" | "warning" | "disabled";
        }, {
            minimum: number;
            target: number;
            adaptive: boolean;
            enforcement: "strict" | "warning" | "disabled";
        }>;
        aiInsights: z.ZodObject<{
            suggestions: z.ZodArray<z.ZodString, "many">;
            predictedCoverage: z.ZodNumber;
            improvementAreas: z.ZodArray<z.ZodString, "many">;
            riskAssessment: z.ZodEnum<["low", "medium", "high", "critical"]>;
        }, "strip", z.ZodTypeAny, {
            suggestions: string[];
            predictedCoverage: number;
            improvementAreas: string[];
            riskAssessment: "low" | "medium" | "high" | "critical";
        }, {
            suggestions: string[];
            predictedCoverage: number;
            improvementAreas: string[];
            riskAssessment: "low" | "medium" | "high" | "critical";
        }>;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        id: string;
        threshold: {
            minimum: number;
            target: number;
            adaptive: boolean;
            enforcement: "strict" | "warning" | "disabled";
        };
        trends: {
            date: string;
            coverage: number;
            change: number;
        }[];
        files: {
            path: string;
            coverage: number;
            uncoveredLines: number[];
            complexityScore: number;
        }[];
        projectId: string;
        branch: string;
        commit: string;
        linesCovered: number;
        linesTotal: number;
        branchesCovered: number;
        branchesTotal: number;
        functionsCovered: number;
        functionsTotal: number;
        statementsCovered: number;
        statementsTotal: number;
        coveragePercentage: number;
        pathCoverage: number;
        qualityScore: number;
        aiInsights: {
            suggestions: string[];
            predictedCoverage: number;
            improvementAreas: string[];
            riskAssessment: "low" | "medium" | "high" | "critical";
        };
    }, {
        timestamp: string;
        id: string;
        threshold: {
            minimum: number;
            target: number;
            adaptive: boolean;
            enforcement: "strict" | "warning" | "disabled";
        };
        trends: {
            date: string;
            coverage: number;
            change: number;
        }[];
        files: {
            path: string;
            coverage: number;
            uncoveredLines: number[];
            complexityScore: number;
        }[];
        projectId: string;
        branch: string;
        commit: string;
        linesCovered: number;
        linesTotal: number;
        branchesCovered: number;
        branchesTotal: number;
        functionsCovered: number;
        functionsTotal: number;
        statementsCovered: number;
        statementsTotal: number;
        coveragePercentage: number;
        pathCoverage: number;
        qualityScore: number;
        aiInsights: {
            suggestions: string[];
            predictedCoverage: number;
            improvementAreas: string[];
            riskAssessment: "low" | "medium" | "high" | "critical";
        };
    }>;
    quality: z.ZodObject<{
        id: z.ZodString;
        timestamp: z.ZodString;
        projectId: z.ZodString;
        branch: z.ZodString;
        commit: z.ZodString;
        overallScore: z.ZodNumber;
        maintainabilityIndex: z.ZodNumber;
        cyclomaticComplexity: z.ZodNumber;
        cognitiveComplexity: z.ZodNumber;
        technicalDebt: z.ZodObject<{
            minutes: z.ZodNumber;
            ratio: z.ZodNumber;
            classification: z.ZodEnum<["A", "B", "C", "D", "E"]>;
        }, "strip", z.ZodTypeAny, {
            minutes: number;
            ratio: number;
            classification: "D" | "A" | "B" | "C" | "E";
        }, {
            minutes: number;
            ratio: number;
            classification: "D" | "A" | "B" | "C" | "E";
        }>;
        duplication: z.ZodObject<{
            percentage: z.ZodNumber;
            blocks: z.ZodNumber;
            lines: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            percentage: number;
            blocks: number;
            lines: number;
        }, {
            percentage: number;
            blocks: number;
            lines: number;
        }>;
        violations: z.ZodArray<z.ZodObject<{
            rule: z.ZodString;
            severity: z.ZodEnum<["info", "minor", "major", "critical", "blocker"]>;
            count: z.ZodNumber;
            file: z.ZodString;
            line: z.ZodOptional<z.ZodNumber>;
            message: z.ZodString;
            effort: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            message: string;
            count: number;
            rule: string;
            severity: "critical" | "info" | "minor" | "major" | "blocker";
            file: string;
            effort: number;
            line?: number | undefined;
        }, {
            message: string;
            count: number;
            rule: string;
            severity: "critical" | "info" | "minor" | "major" | "blocker";
            file: string;
            effort: number;
            line?: number | undefined;
        }>, "many">;
        trends: z.ZodArray<z.ZodObject<{
            date: z.ZodString;
            score: z.ZodNumber;
            change: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            date: string;
            score: number;
            change: number;
        }, {
            date: string;
            score: number;
            change: number;
        }>, "many">;
        aiAnalysis: z.ZodObject<{
            patterns: z.ZodArray<z.ZodString, "many">;
            refactoringOpportunities: z.ZodArray<z.ZodObject<{
                file: z.ZodString;
                function: z.ZodString;
                suggestion: z.ZodString;
                impact: z.ZodEnum<["low", "medium", "high"]>;
                confidence: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                function: string;
                confidence: number;
                file: string;
                impact: "low" | "medium" | "high";
                suggestion: string;
            }, {
                function: string;
                confidence: number;
                file: string;
                impact: "low" | "medium" | "high";
                suggestion: string;
            }>, "many">;
            hotspots: z.ZodArray<z.ZodObject<{
                file: z.ZodString;
                riskScore: z.ZodNumber;
                issues: z.ZodArray<z.ZodString, "many">;
            }, "strip", z.ZodTypeAny, {
                issues: string[];
                file: string;
                riskScore: number;
            }, {
                issues: string[];
                file: string;
                riskScore: number;
            }>, "many">;
            forecast: z.ZodObject<{
                nextWeek: z.ZodNumber;
                nextMonth: z.ZodNumber;
                confidence: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                confidence: number;
                nextWeek: number;
                nextMonth: number;
            }, {
                confidence: number;
                nextWeek: number;
                nextMonth: number;
            }>;
        }, "strip", z.ZodTypeAny, {
            patterns: string[];
            refactoringOpportunities: {
                function: string;
                confidence: number;
                file: string;
                impact: "low" | "medium" | "high";
                suggestion: string;
            }[];
            hotspots: {
                issues: string[];
                file: string;
                riskScore: number;
            }[];
            forecast: {
                confidence: number;
                nextWeek: number;
                nextMonth: number;
            };
        }, {
            patterns: string[];
            refactoringOpportunities: {
                function: string;
                confidence: number;
                file: string;
                impact: "low" | "medium" | "high";
                suggestion: string;
            }[];
            hotspots: {
                issues: string[];
                file: string;
                riskScore: number;
            }[];
            forecast: {
                confidence: number;
                nextWeek: number;
                nextMonth: number;
            };
        }>;
        gates: z.ZodObject<{
            qualityGate: z.ZodEnum<["passed", "warning", "failed"]>;
            thresholds: z.ZodRecord<z.ZodString, z.ZodNumber>;
            blockers: z.ZodArray<z.ZodString, "many">;
            warnings: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            qualityGate: "failed" | "warning" | "passed";
            thresholds: Record<string, number>;
            blockers: string[];
            warnings: string[];
        }, {
            qualityGate: "failed" | "warning" | "passed";
            thresholds: Record<string, number>;
            blockers: string[];
            warnings: string[];
        }>;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        id: string;
        violations: {
            message: string;
            count: number;
            rule: string;
            severity: "critical" | "info" | "minor" | "major" | "blocker";
            file: string;
            effort: number;
            line?: number | undefined;
        }[];
        overallScore: number;
        trends: {
            date: string;
            score: number;
            change: number;
        }[];
        projectId: string;
        branch: string;
        commit: string;
        maintainabilityIndex: number;
        cyclomaticComplexity: number;
        cognitiveComplexity: number;
        technicalDebt: {
            minutes: number;
            ratio: number;
            classification: "D" | "A" | "B" | "C" | "E";
        };
        duplication: {
            percentage: number;
            blocks: number;
            lines: number;
        };
        aiAnalysis: {
            patterns: string[];
            refactoringOpportunities: {
                function: string;
                confidence: number;
                file: string;
                impact: "low" | "medium" | "high";
                suggestion: string;
            }[];
            hotspots: {
                issues: string[];
                file: string;
                riskScore: number;
            }[];
            forecast: {
                confidence: number;
                nextWeek: number;
                nextMonth: number;
            };
        };
        gates: {
            qualityGate: "failed" | "warning" | "passed";
            thresholds: Record<string, number>;
            blockers: string[];
            warnings: string[];
        };
    }, {
        timestamp: string;
        id: string;
        violations: {
            message: string;
            count: number;
            rule: string;
            severity: "critical" | "info" | "minor" | "major" | "blocker";
            file: string;
            effort: number;
            line?: number | undefined;
        }[];
        overallScore: number;
        trends: {
            date: string;
            score: number;
            change: number;
        }[];
        projectId: string;
        branch: string;
        commit: string;
        maintainabilityIndex: number;
        cyclomaticComplexity: number;
        cognitiveComplexity: number;
        technicalDebt: {
            minutes: number;
            ratio: number;
            classification: "D" | "A" | "B" | "C" | "E";
        };
        duplication: {
            percentage: number;
            blocks: number;
            lines: number;
        };
        aiAnalysis: {
            patterns: string[];
            refactoringOpportunities: {
                function: string;
                confidence: number;
                file: string;
                impact: "low" | "medium" | "high";
                suggestion: string;
            }[];
            hotspots: {
                issues: string[];
                file: string;
                riskScore: number;
            }[];
            forecast: {
                confidence: number;
                nextWeek: number;
                nextMonth: number;
            };
        };
        gates: {
            qualityGate: "failed" | "warning" | "passed";
            thresholds: Record<string, number>;
            blockers: string[];
            warnings: string[];
        };
    }>;
    bugs: z.ZodObject<{
        id: z.ZodString;
        timestamp: z.ZodString;
        projectId: z.ZodString;
        totalBugs: z.ZodNumber;
        openBugs: z.ZodNumber;
        resolvedBugs: z.ZodNumber;
        criticalBugs: z.ZodNumber;
        averageResolutionTime: z.ZodNumber;
        bugVelocity: z.ZodNumber;
        escapedBugs: z.ZodNumber;
        regressionRate: z.ZodNumber;
        defectDensity: z.ZodNumber;
        categories: z.ZodRecord<z.ZodString, z.ZodNumber>;
        severity: z.ZodObject<{
            critical: z.ZodNumber;
            high: z.ZodNumber;
            medium: z.ZodNumber;
            low: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            low: number;
            medium: number;
            high: number;
            critical: number;
        }, {
            low: number;
            medium: number;
            high: number;
            critical: number;
        }>;
        trends: z.ZodArray<z.ZodObject<{
            date: z.ZodString;
            opened: z.ZodNumber;
            resolved: z.ZodNumber;
            backlog: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            date: string;
            resolved: number;
            opened: number;
            backlog: number;
        }, {
            date: string;
            resolved: number;
            opened: number;
            backlog: number;
        }>, "many">;
        aiClassification: z.ZodObject<{
            accuracy: z.ZodNumber;
            patterns: z.ZodArray<z.ZodObject<{
                pattern: z.ZodString;
                frequency: z.ZodNumber;
                impact: z.ZodEnum<["low", "medium", "high"]>;
            }, "strip", z.ZodTypeAny, {
                frequency: number;
                pattern: string;
                impact: "low" | "medium" | "high";
            }, {
                frequency: number;
                pattern: string;
                impact: "low" | "medium" | "high";
            }>, "many">;
            predictions: z.ZodObject<{
                nextWeekBugs: z.ZodNumber;
                hotspots: z.ZodArray<z.ZodString, "many">;
                riskAreas: z.ZodArray<z.ZodString, "many">;
            }, "strip", z.ZodTypeAny, {
                hotspots: string[];
                nextWeekBugs: number;
                riskAreas: string[];
            }, {
                hotspots: string[];
                nextWeekBugs: number;
                riskAreas: string[];
            }>;
            rootCauses: z.ZodArray<z.ZodObject<{
                cause: z.ZodString;
                frequency: z.ZodNumber;
                preventable: z.ZodBoolean;
            }, "strip", z.ZodTypeAny, {
                frequency: number;
                cause: string;
                preventable: boolean;
            }, {
                frequency: number;
                cause: string;
                preventable: boolean;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            accuracy: number;
            predictions: {
                hotspots: string[];
                nextWeekBugs: number;
                riskAreas: string[];
            };
            patterns: {
                frequency: number;
                pattern: string;
                impact: "low" | "medium" | "high";
            }[];
            rootCauses: {
                frequency: number;
                cause: string;
                preventable: boolean;
            }[];
        }, {
            accuracy: number;
            predictions: {
                hotspots: string[];
                nextWeekBugs: number;
                riskAreas: string[];
            };
            patterns: {
                frequency: number;
                pattern: string;
                impact: "low" | "medium" | "high";
            }[];
            rootCauses: {
                frequency: number;
                cause: string;
                preventable: boolean;
            }[];
        }>;
        performance: z.ZodObject<{
            timeToDetection: z.ZodNumber;
            timeToResolution: z.ZodNumber;
            firstTimeFixRate: z.ZodNumber;
            reopenRate: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            timeToDetection: number;
            timeToResolution: number;
            firstTimeFixRate: number;
            reopenRate: number;
        }, {
            timeToDetection: number;
            timeToResolution: number;
            firstTimeFixRate: number;
            reopenRate: number;
        }>;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        id: string;
        severity: {
            low: number;
            medium: number;
            high: number;
            critical: number;
        };
        trends: {
            date: string;
            resolved: number;
            opened: number;
            backlog: number;
        }[];
        categories: Record<string, number>;
        projectId: string;
        performance: {
            timeToDetection: number;
            timeToResolution: number;
            firstTimeFixRate: number;
            reopenRate: number;
        };
        totalBugs: number;
        openBugs: number;
        resolvedBugs: number;
        criticalBugs: number;
        averageResolutionTime: number;
        bugVelocity: number;
        escapedBugs: number;
        regressionRate: number;
        defectDensity: number;
        aiClassification: {
            accuracy: number;
            predictions: {
                hotspots: string[];
                nextWeekBugs: number;
                riskAreas: string[];
            };
            patterns: {
                frequency: number;
                pattern: string;
                impact: "low" | "medium" | "high";
            }[];
            rootCauses: {
                frequency: number;
                cause: string;
                preventable: boolean;
            }[];
        };
    }, {
        timestamp: string;
        id: string;
        severity: {
            low: number;
            medium: number;
            high: number;
            critical: number;
        };
        trends: {
            date: string;
            resolved: number;
            opened: number;
            backlog: number;
        }[];
        categories: Record<string, number>;
        projectId: string;
        performance: {
            timeToDetection: number;
            timeToResolution: number;
            firstTimeFixRate: number;
            reopenRate: number;
        };
        totalBugs: number;
        openBugs: number;
        resolvedBugs: number;
        criticalBugs: number;
        averageResolutionTime: number;
        bugVelocity: number;
        escapedBugs: number;
        regressionRate: number;
        defectDensity: number;
        aiClassification: {
            accuracy: number;
            predictions: {
                hotspots: string[];
                nextWeekBugs: number;
                riskAreas: string[];
            };
            patterns: {
                frequency: number;
                pattern: string;
                impact: "low" | "medium" | "high";
            }[];
            rootCauses: {
                frequency: number;
                cause: string;
                preventable: boolean;
            }[];
        };
    }>;
    performance: z.ZodObject<{
        id: z.ZodString;
        timestamp: z.ZodString;
        projectId: z.ZodString;
        environment: z.ZodEnum<["development", "staging", "production"]>;
        baseline: z.ZodObject<{
            version: z.ZodString;
            timestamp: z.ZodString;
            metrics: z.ZodRecord<z.ZodString, z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            timestamp: string;
            version: string;
            metrics: Record<string, number>;
        }, {
            timestamp: string;
            version: string;
            metrics: Record<string, number>;
        }>;
        current: z.ZodObject<{
            version: z.ZodString;
            timestamp: z.ZodString;
            metrics: z.ZodRecord<z.ZodString, z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            timestamp: string;
            version: string;
            metrics: Record<string, number>;
        }, {
            timestamp: string;
            version: string;
            metrics: Record<string, number>;
        }>;
        performance: z.ZodObject<{
            responseTime: z.ZodObject<{
                average: z.ZodNumber;
                p95: z.ZodNumber;
                p99: z.ZodNumber;
                max: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                max: number;
                average: number;
                p95: number;
                p99: number;
            }, {
                max: number;
                average: number;
                p95: number;
                p99: number;
            }>;
            throughput: z.ZodObject<{
                requestsPerSecond: z.ZodNumber;
                transactionsPerSecond: z.ZodNumber;
                concurrentUsers: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                requestsPerSecond: number;
                transactionsPerSecond: number;
                concurrentUsers: number;
            }, {
                requestsPerSecond: number;
                transactionsPerSecond: number;
                concurrentUsers: number;
            }>;
            resources: z.ZodObject<{
                cpuUsage: z.ZodNumber;
                memoryUsage: z.ZodNumber;
                diskUsage: z.ZodNumber;
                networkUsage: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                cpuUsage: number;
                memoryUsage: number;
                diskUsage: number;
                networkUsage: number;
            }, {
                cpuUsage: number;
                memoryUsage: number;
                diskUsage: number;
                networkUsage: number;
            }>;
            errors: z.ZodObject<{
                rate: z.ZodNumber;
                count: z.ZodNumber;
                types: z.ZodRecord<z.ZodString, z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                count: number;
                rate: number;
                types: Record<string, number>;
            }, {
                count: number;
                rate: number;
                types: Record<string, number>;
            }>;
        }, "strip", z.ZodTypeAny, {
            errors: {
                count: number;
                rate: number;
                types: Record<string, number>;
            };
            throughput: {
                requestsPerSecond: number;
                transactionsPerSecond: number;
                concurrentUsers: number;
            };
            responseTime: {
                max: number;
                average: number;
                p95: number;
                p99: number;
            };
            resources: {
                cpuUsage: number;
                memoryUsage: number;
                diskUsage: number;
                networkUsage: number;
            };
        }, {
            errors: {
                count: number;
                rate: number;
                types: Record<string, number>;
            };
            throughput: {
                requestsPerSecond: number;
                transactionsPerSecond: number;
                concurrentUsers: number;
            };
            responseTime: {
                max: number;
                average: number;
                p95: number;
                p99: number;
            };
            resources: {
                cpuUsage: number;
                memoryUsage: number;
                diskUsage: number;
                networkUsage: number;
            };
        }>;
        comparisons: z.ZodArray<z.ZodObject<{
            metric: z.ZodString;
            baseline: z.ZodNumber;
            current: z.ZodNumber;
            change: z.ZodNumber;
            changePercent: z.ZodNumber;
            trend: z.ZodEnum<["improvement", "regression", "stable"]>;
            significance: z.ZodEnum<["major", "minor", "negligible"]>;
        }, "strip", z.ZodTypeAny, {
            metric: string;
            change: number;
            baseline: number;
            trend: "stable" | "improvement" | "regression";
            current: number;
            changePercent: number;
            significance: "minor" | "major" | "negligible";
        }, {
            metric: string;
            change: number;
            baseline: number;
            trend: "stable" | "improvement" | "regression";
            current: number;
            changePercent: number;
            significance: "minor" | "major" | "negligible";
        }>, "many">;
        anomalies: z.ZodArray<z.ZodObject<{
            metric: z.ZodString;
            detected: z.ZodString;
            severity: z.ZodEnum<["low", "medium", "high", "critical"]>;
            description: z.ZodString;
            possibleCauses: z.ZodArray<z.ZodString, "many">;
            autoResolved: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            description: string;
            metric: string;
            severity: "low" | "medium" | "high" | "critical";
            detected: string;
            possibleCauses: string[];
            autoResolved: boolean;
        }, {
            description: string;
            metric: string;
            severity: "low" | "medium" | "high" | "critical";
            detected: string;
            possibleCauses: string[];
            autoResolved: boolean;
        }>, "many">;
        aiAnalysis: z.ZodObject<{
            forecast: z.ZodObject<{
                nextHour: z.ZodRecord<z.ZodString, z.ZodNumber>;
                nextDay: z.ZodRecord<z.ZodString, z.ZodNumber>;
                confidence: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                confidence: number;
                nextHour: Record<string, number>;
                nextDay: Record<string, number>;
            }, {
                confidence: number;
                nextHour: Record<string, number>;
                nextDay: Record<string, number>;
            }>;
            optimizations: z.ZodArray<z.ZodObject<{
                area: z.ZodString;
                recommendation: z.ZodString;
                impact: z.ZodEnum<["low", "medium", "high"]>;
                effort: z.ZodEnum<["low", "medium", "high"]>;
                automated: z.ZodBoolean;
            }, "strip", z.ZodTypeAny, {
                automated: boolean;
                area: string;
                recommendation: string;
                impact: "low" | "medium" | "high";
                effort: "low" | "medium" | "high";
            }, {
                automated: boolean;
                area: string;
                recommendation: string;
                impact: "low" | "medium" | "high";
                effort: "low" | "medium" | "high";
            }>, "many">;
            patterns: z.ZodArray<z.ZodObject<{
                pattern: z.ZodString;
                frequency: z.ZodString;
                correlation: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                frequency: string;
                pattern: string;
                correlation: number;
            }, {
                frequency: string;
                pattern: string;
                correlation: number;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            patterns: {
                frequency: string;
                pattern: string;
                correlation: number;
            }[];
            forecast: {
                confidence: number;
                nextHour: Record<string, number>;
                nextDay: Record<string, number>;
            };
            optimizations: {
                automated: boolean;
                area: string;
                recommendation: string;
                impact: "low" | "medium" | "high";
                effort: "low" | "medium" | "high";
            }[];
        }, {
            patterns: {
                frequency: string;
                pattern: string;
                correlation: number;
            }[];
            forecast: {
                confidence: number;
                nextHour: Record<string, number>;
                nextDay: Record<string, number>;
            };
            optimizations: {
                automated: boolean;
                area: string;
                recommendation: string;
                impact: "low" | "medium" | "high";
                effort: "low" | "medium" | "high";
            }[];
        }>;
        alerts: z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<["threshold_breach", "regression", "anomaly", "prediction"]>;
            metric: z.ZodString;
            value: z.ZodNumber;
            threshold: z.ZodNumber;
            severity: z.ZodEnum<["info", "warning", "critical"]>;
            actionable: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            value: number;
            type: "threshold_breach" | "regression" | "anomaly" | "prediction";
            metric: string;
            threshold: number;
            severity: "warning" | "critical" | "info";
            actionable: boolean;
        }, {
            value: number;
            type: "threshold_breach" | "regression" | "anomaly" | "prediction";
            metric: string;
            threshold: number;
            severity: "warning" | "critical" | "info";
            actionable: boolean;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        id: string;
        environment: "development" | "production" | "staging";
        anomalies: {
            description: string;
            metric: string;
            severity: "low" | "medium" | "high" | "critical";
            detected: string;
            possibleCauses: string[];
            autoResolved: boolean;
        }[];
        projectId: string;
        alerts: {
            value: number;
            type: "threshold_breach" | "regression" | "anomaly" | "prediction";
            metric: string;
            threshold: number;
            severity: "warning" | "critical" | "info";
            actionable: boolean;
        }[];
        aiAnalysis: {
            patterns: {
                frequency: string;
                pattern: string;
                correlation: number;
            }[];
            forecast: {
                confidence: number;
                nextHour: Record<string, number>;
                nextDay: Record<string, number>;
            };
            optimizations: {
                automated: boolean;
                area: string;
                recommendation: string;
                impact: "low" | "medium" | "high";
                effort: "low" | "medium" | "high";
            }[];
        };
        comparisons: {
            metric: string;
            change: number;
            baseline: number;
            trend: "stable" | "improvement" | "regression";
            current: number;
            changePercent: number;
            significance: "minor" | "major" | "negligible";
        }[];
        baseline: {
            timestamp: string;
            version: string;
            metrics: Record<string, number>;
        };
        performance: {
            errors: {
                count: number;
                rate: number;
                types: Record<string, number>;
            };
            throughput: {
                requestsPerSecond: number;
                transactionsPerSecond: number;
                concurrentUsers: number;
            };
            responseTime: {
                max: number;
                average: number;
                p95: number;
                p99: number;
            };
            resources: {
                cpuUsage: number;
                memoryUsage: number;
                diskUsage: number;
                networkUsage: number;
            };
        };
        current: {
            timestamp: string;
            version: string;
            metrics: Record<string, number>;
        };
    }, {
        timestamp: string;
        id: string;
        environment: "development" | "production" | "staging";
        anomalies: {
            description: string;
            metric: string;
            severity: "low" | "medium" | "high" | "critical";
            detected: string;
            possibleCauses: string[];
            autoResolved: boolean;
        }[];
        projectId: string;
        alerts: {
            value: number;
            type: "threshold_breach" | "regression" | "anomaly" | "prediction";
            metric: string;
            threshold: number;
            severity: "warning" | "critical" | "info";
            actionable: boolean;
        }[];
        aiAnalysis: {
            patterns: {
                frequency: string;
                pattern: string;
                correlation: number;
            }[];
            forecast: {
                confidence: number;
                nextHour: Record<string, number>;
                nextDay: Record<string, number>;
            };
            optimizations: {
                automated: boolean;
                area: string;
                recommendation: string;
                impact: "low" | "medium" | "high";
                effort: "low" | "medium" | "high";
            }[];
        };
        comparisons: {
            metric: string;
            change: number;
            baseline: number;
            trend: "stable" | "improvement" | "regression";
            current: number;
            changePercent: number;
            significance: "minor" | "major" | "negligible";
        }[];
        baseline: {
            timestamp: string;
            version: string;
            metrics: Record<string, number>;
        };
        performance: {
            errors: {
                count: number;
                rate: number;
                types: Record<string, number>;
            };
            throughput: {
                requestsPerSecond: number;
                transactionsPerSecond: number;
                concurrentUsers: number;
            };
            responseTime: {
                max: number;
                average: number;
                p95: number;
                p99: number;
            };
            resources: {
                cpuUsage: number;
                memoryUsage: number;
                diskUsage: number;
                networkUsage: number;
            };
        };
        current: {
            timestamp: string;
            version: string;
            metrics: Record<string, number>;
        };
    }>;
    insights: z.ZodArray<z.ZodObject<{
        category: z.ZodEnum<["coverage", "quality", "bugs", "performance"]>;
        type: z.ZodEnum<["success", "warning", "error", "info"]>;
        title: z.ZodString;
        description: z.ZodString;
        actionable: z.ZodBoolean;
        automated: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        type: "error" | "success" | "warning" | "info";
        description: string;
        title: string;
        category: "coverage" | "performance" | "quality" | "bugs";
        automated: boolean;
        actionable: boolean;
    }, {
        type: "error" | "success" | "warning" | "info";
        description: string;
        title: string;
        category: "coverage" | "performance" | "quality" | "bugs";
        automated: boolean;
        actionable: boolean;
    }>, "many">;
    trends: z.ZodObject<{
        overall: z.ZodArray<z.ZodObject<{
            date: z.ZodString;
            score: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            date: string;
            score: number;
        }, {
            date: string;
            score: number;
        }>, "many">;
        categories: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodObject<{
            date: z.ZodString;
            value: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            value: number;
            date: string;
        }, {
            value: number;
            date: string;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        categories: Record<string, {
            value: number;
            date: string;
        }[]>;
        overall: {
            date: string;
            score: number;
        }[];
    }, {
        categories: Record<string, {
            value: number;
            date: string;
        }[]>;
        overall: {
            date: string;
            score: number;
        }[];
    }>;
    goals: z.ZodArray<z.ZodObject<{
        metric: z.ZodString;
        current: z.ZodNumber;
        target: z.ZodNumber;
        deadline: z.ZodString;
        progress: z.ZodNumber;
        onTrack: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        metric: string;
        progress: number;
        target: number;
        current: number;
        deadline: string;
        onTrack: boolean;
    }, {
        metric: string;
        progress: number;
        target: number;
        current: number;
        deadline: string;
        onTrack: boolean;
    }>, "many">;
    recommendations: z.ZodArray<z.ZodObject<{
        priority: z.ZodEnum<["low", "medium", "high", "critical"]>;
        category: z.ZodEnum<["coverage", "quality", "bugs", "performance"]>;
        action: z.ZodString;
        impact: z.ZodString;
        effort: z.ZodEnum<["low", "medium", "high"]>;
        automated: z.ZodBoolean;
        roi: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        priority: "low" | "medium" | "high" | "critical";
        action: string;
        category: "coverage" | "performance" | "quality" | "bugs";
        automated: boolean;
        impact: string;
        effort: "low" | "medium" | "high";
        roi?: number | undefined;
    }, {
        priority: "low" | "medium" | "high" | "critical";
        action: string;
        category: "coverage" | "performance" | "quality" | "bugs";
        automated: boolean;
        impact: string;
        effort: "low" | "medium" | "high";
        roi?: number | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    id: string;
    recommendations: {
        priority: "low" | "medium" | "high" | "critical";
        action: string;
        category: "coverage" | "performance" | "quality" | "bugs";
        automated: boolean;
        impact: string;
        effort: "low" | "medium" | "high";
        roi?: number | undefined;
    }[];
    overallScore: number;
    trends: {
        categories: Record<string, {
            value: number;
            date: string;
        }[]>;
        overall: {
            date: string;
            score: number;
        }[];
    };
    insights: {
        type: "error" | "success" | "warning" | "info";
        description: string;
        title: string;
        category: "coverage" | "performance" | "quality" | "bugs";
        automated: boolean;
        actionable: boolean;
    }[];
    projectId: string;
    coverage: {
        timestamp: string;
        id: string;
        threshold: {
            minimum: number;
            target: number;
            adaptive: boolean;
            enforcement: "strict" | "warning" | "disabled";
        };
        trends: {
            date: string;
            coverage: number;
            change: number;
        }[];
        files: {
            path: string;
            coverage: number;
            uncoveredLines: number[];
            complexityScore: number;
        }[];
        projectId: string;
        branch: string;
        commit: string;
        linesCovered: number;
        linesTotal: number;
        branchesCovered: number;
        branchesTotal: number;
        functionsCovered: number;
        functionsTotal: number;
        statementsCovered: number;
        statementsTotal: number;
        coveragePercentage: number;
        pathCoverage: number;
        qualityScore: number;
        aiInsights: {
            suggestions: string[];
            predictedCoverage: number;
            improvementAreas: string[];
            riskAssessment: "low" | "medium" | "high" | "critical";
        };
    };
    performance: {
        timestamp: string;
        id: string;
        environment: "development" | "production" | "staging";
        anomalies: {
            description: string;
            metric: string;
            severity: "low" | "medium" | "high" | "critical";
            detected: string;
            possibleCauses: string[];
            autoResolved: boolean;
        }[];
        projectId: string;
        alerts: {
            value: number;
            type: "threshold_breach" | "regression" | "anomaly" | "prediction";
            metric: string;
            threshold: number;
            severity: "warning" | "critical" | "info";
            actionable: boolean;
        }[];
        aiAnalysis: {
            patterns: {
                frequency: string;
                pattern: string;
                correlation: number;
            }[];
            forecast: {
                confidence: number;
                nextHour: Record<string, number>;
                nextDay: Record<string, number>;
            };
            optimizations: {
                automated: boolean;
                area: string;
                recommendation: string;
                impact: "low" | "medium" | "high";
                effort: "low" | "medium" | "high";
            }[];
        };
        comparisons: {
            metric: string;
            change: number;
            baseline: number;
            trend: "stable" | "improvement" | "regression";
            current: number;
            changePercent: number;
            significance: "minor" | "major" | "negligible";
        }[];
        baseline: {
            timestamp: string;
            version: string;
            metrics: Record<string, number>;
        };
        performance: {
            errors: {
                count: number;
                rate: number;
                types: Record<string, number>;
            };
            throughput: {
                requestsPerSecond: number;
                transactionsPerSecond: number;
                concurrentUsers: number;
            };
            responseTime: {
                max: number;
                average: number;
                p95: number;
                p99: number;
            };
            resources: {
                cpuUsage: number;
                memoryUsage: number;
                diskUsage: number;
                networkUsage: number;
            };
        };
        current: {
            timestamp: string;
            version: string;
            metrics: Record<string, number>;
        };
    };
    quality: {
        timestamp: string;
        id: string;
        violations: {
            message: string;
            count: number;
            rule: string;
            severity: "critical" | "info" | "minor" | "major" | "blocker";
            file: string;
            effort: number;
            line?: number | undefined;
        }[];
        overallScore: number;
        trends: {
            date: string;
            score: number;
            change: number;
        }[];
        projectId: string;
        branch: string;
        commit: string;
        maintainabilityIndex: number;
        cyclomaticComplexity: number;
        cognitiveComplexity: number;
        technicalDebt: {
            minutes: number;
            ratio: number;
            classification: "D" | "A" | "B" | "C" | "E";
        };
        duplication: {
            percentage: number;
            blocks: number;
            lines: number;
        };
        aiAnalysis: {
            patterns: string[];
            refactoringOpportunities: {
                function: string;
                confidence: number;
                file: string;
                impact: "low" | "medium" | "high";
                suggestion: string;
            }[];
            hotspots: {
                issues: string[];
                file: string;
                riskScore: number;
            }[];
            forecast: {
                confidence: number;
                nextWeek: number;
                nextMonth: number;
            };
        };
        gates: {
            qualityGate: "failed" | "warning" | "passed";
            thresholds: Record<string, number>;
            blockers: string[];
            warnings: string[];
        };
    };
    bugs: {
        timestamp: string;
        id: string;
        severity: {
            low: number;
            medium: number;
            high: number;
            critical: number;
        };
        trends: {
            date: string;
            resolved: number;
            opened: number;
            backlog: number;
        }[];
        categories: Record<string, number>;
        projectId: string;
        performance: {
            timeToDetection: number;
            timeToResolution: number;
            firstTimeFixRate: number;
            reopenRate: number;
        };
        totalBugs: number;
        openBugs: number;
        resolvedBugs: number;
        criticalBugs: number;
        averageResolutionTime: number;
        bugVelocity: number;
        escapedBugs: number;
        regressionRate: number;
        defectDensity: number;
        aiClassification: {
            accuracy: number;
            predictions: {
                hotspots: string[];
                nextWeekBugs: number;
                riskAreas: string[];
            };
            patterns: {
                frequency: number;
                pattern: string;
                impact: "low" | "medium" | "high";
            }[];
            rootCauses: {
                frequency: number;
                cause: string;
                preventable: boolean;
            }[];
        };
    };
    goals: {
        metric: string;
        progress: number;
        target: number;
        current: number;
        deadline: string;
        onTrack: boolean;
    }[];
}, {
    timestamp: string;
    id: string;
    recommendations: {
        priority: "low" | "medium" | "high" | "critical";
        action: string;
        category: "coverage" | "performance" | "quality" | "bugs";
        automated: boolean;
        impact: string;
        effort: "low" | "medium" | "high";
        roi?: number | undefined;
    }[];
    overallScore: number;
    trends: {
        categories: Record<string, {
            value: number;
            date: string;
        }[]>;
        overall: {
            date: string;
            score: number;
        }[];
    };
    insights: {
        type: "error" | "success" | "warning" | "info";
        description: string;
        title: string;
        category: "coverage" | "performance" | "quality" | "bugs";
        automated: boolean;
        actionable: boolean;
    }[];
    projectId: string;
    coverage: {
        timestamp: string;
        id: string;
        threshold: {
            minimum: number;
            target: number;
            adaptive: boolean;
            enforcement: "strict" | "warning" | "disabled";
        };
        trends: {
            date: string;
            coverage: number;
            change: number;
        }[];
        files: {
            path: string;
            coverage: number;
            uncoveredLines: number[];
            complexityScore: number;
        }[];
        projectId: string;
        branch: string;
        commit: string;
        linesCovered: number;
        linesTotal: number;
        branchesCovered: number;
        branchesTotal: number;
        functionsCovered: number;
        functionsTotal: number;
        statementsCovered: number;
        statementsTotal: number;
        coveragePercentage: number;
        pathCoverage: number;
        qualityScore: number;
        aiInsights: {
            suggestions: string[];
            predictedCoverage: number;
            improvementAreas: string[];
            riskAssessment: "low" | "medium" | "high" | "critical";
        };
    };
    performance: {
        timestamp: string;
        id: string;
        environment: "development" | "production" | "staging";
        anomalies: {
            description: string;
            metric: string;
            severity: "low" | "medium" | "high" | "critical";
            detected: string;
            possibleCauses: string[];
            autoResolved: boolean;
        }[];
        projectId: string;
        alerts: {
            value: number;
            type: "threshold_breach" | "regression" | "anomaly" | "prediction";
            metric: string;
            threshold: number;
            severity: "warning" | "critical" | "info";
            actionable: boolean;
        }[];
        aiAnalysis: {
            patterns: {
                frequency: string;
                pattern: string;
                correlation: number;
            }[];
            forecast: {
                confidence: number;
                nextHour: Record<string, number>;
                nextDay: Record<string, number>;
            };
            optimizations: {
                automated: boolean;
                area: string;
                recommendation: string;
                impact: "low" | "medium" | "high";
                effort: "low" | "medium" | "high";
            }[];
        };
        comparisons: {
            metric: string;
            change: number;
            baseline: number;
            trend: "stable" | "improvement" | "regression";
            current: number;
            changePercent: number;
            significance: "minor" | "major" | "negligible";
        }[];
        baseline: {
            timestamp: string;
            version: string;
            metrics: Record<string, number>;
        };
        performance: {
            errors: {
                count: number;
                rate: number;
                types: Record<string, number>;
            };
            throughput: {
                requestsPerSecond: number;
                transactionsPerSecond: number;
                concurrentUsers: number;
            };
            responseTime: {
                max: number;
                average: number;
                p95: number;
                p99: number;
            };
            resources: {
                cpuUsage: number;
                memoryUsage: number;
                diskUsage: number;
                networkUsage: number;
            };
        };
        current: {
            timestamp: string;
            version: string;
            metrics: Record<string, number>;
        };
    };
    quality: {
        timestamp: string;
        id: string;
        violations: {
            message: string;
            count: number;
            rule: string;
            severity: "critical" | "info" | "minor" | "major" | "blocker";
            file: string;
            effort: number;
            line?: number | undefined;
        }[];
        overallScore: number;
        trends: {
            date: string;
            score: number;
            change: number;
        }[];
        projectId: string;
        branch: string;
        commit: string;
        maintainabilityIndex: number;
        cyclomaticComplexity: number;
        cognitiveComplexity: number;
        technicalDebt: {
            minutes: number;
            ratio: number;
            classification: "D" | "A" | "B" | "C" | "E";
        };
        duplication: {
            percentage: number;
            blocks: number;
            lines: number;
        };
        aiAnalysis: {
            patterns: string[];
            refactoringOpportunities: {
                function: string;
                confidence: number;
                file: string;
                impact: "low" | "medium" | "high";
                suggestion: string;
            }[];
            hotspots: {
                issues: string[];
                file: string;
                riskScore: number;
            }[];
            forecast: {
                confidence: number;
                nextWeek: number;
                nextMonth: number;
            };
        };
        gates: {
            qualityGate: "failed" | "warning" | "passed";
            thresholds: Record<string, number>;
            blockers: string[];
            warnings: string[];
        };
    };
    bugs: {
        timestamp: string;
        id: string;
        severity: {
            low: number;
            medium: number;
            high: number;
            critical: number;
        };
        trends: {
            date: string;
            resolved: number;
            opened: number;
            backlog: number;
        }[];
        categories: Record<string, number>;
        projectId: string;
        performance: {
            timeToDetection: number;
            timeToResolution: number;
            firstTimeFixRate: number;
            reopenRate: number;
        };
        totalBugs: number;
        openBugs: number;
        resolvedBugs: number;
        criticalBugs: number;
        averageResolutionTime: number;
        bugVelocity: number;
        escapedBugs: number;
        regressionRate: number;
        defectDensity: number;
        aiClassification: {
            accuracy: number;
            predictions: {
                hotspots: string[];
                nextWeekBugs: number;
                riskAreas: string[];
            };
            patterns: {
                frequency: number;
                pattern: string;
                impact: "low" | "medium" | "high";
            }[];
            rootCauses: {
                frequency: number;
                cause: string;
                preventable: boolean;
            }[];
        };
    };
    goals: {
        metric: string;
        progress: number;
        target: number;
        current: number;
        deadline: string;
        onTrack: boolean;
    }[];
}>;
export type QualityMetricsDashboard = z.infer<typeof QualityMetricsDashboardSchema>;
export interface CoverageTrackingService {
    getCoverage(projectId: string): Promise<CoverageMetric>;
    generateReport(projectId: string): Promise<CoverageReport>;
    updateThresholds(projectId: string, thresholds: any): Promise<void>;
    trackTrends(projectId: string, days: number): Promise<CoverageMetric[]>;
}
export interface CodeQualityService {
    getQualityMetrics(projectId: string): Promise<CodeQualityMetric>;
    getDashboard(projectId: string): Promise<CodeQualityDashboard>;
    enforceGates(projectId: string): Promise<boolean>;
    getRefactoringSuggestions(projectId: string): Promise<any[]>;
}
export interface BugTrackingService {
    getBugMetrics(projectId: string): Promise<BugMetric>;
    getDashboard(projectId: string): Promise<BugTrackingDashboard>;
    classifyBug(bug: any): Promise<any>;
    optimizeWorkflows(projectId: string): Promise<void>;
}
export interface PerformanceBenchmarkingService {
    getBenchmarks(projectId: string): Promise<PerformanceBenchmark>;
    getDashboard(projectId: string): Promise<PerformanceDashboard>;
    detectAnomalies(projectId: string): Promise<any[]>;
    optimizePerformance(projectId: string): Promise<any[]>;
}
export declare const QualityMetricsConfigSchema: z.ZodObject<{
    coverage: z.ZodObject<{
        enabled: z.ZodBoolean;
        thresholds: z.ZodObject<{
            line: z.ZodNumber;
            branch: z.ZodNumber;
            function: z.ZodNumber;
            statement: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            function: number;
            line: number;
            branch: number;
            statement: number;
        }, {
            function: number;
            line: number;
            branch: number;
            statement: number;
        }>;
        enforcement: z.ZodEnum<["strict", "warning", "disabled"]>;
        aiOptimization: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        enforcement: "strict" | "warning" | "disabled";
        thresholds: {
            function: number;
            line: number;
            branch: number;
            statement: number;
        };
        aiOptimization: boolean;
    }, {
        enabled: boolean;
        enforcement: "strict" | "warning" | "disabled";
        thresholds: {
            function: number;
            line: number;
            branch: number;
            statement: number;
        };
        aiOptimization: boolean;
    }>;
    quality: z.ZodObject<{
        enabled: z.ZodBoolean;
        gates: z.ZodRecord<z.ZodString, z.ZodNumber>;
        aiAnalysis: z.ZodBoolean;
        autoRefactoring: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        aiAnalysis: boolean;
        gates: Record<string, number>;
        autoRefactoring: boolean;
    }, {
        enabled: boolean;
        aiAnalysis: boolean;
        gates: Record<string, number>;
        autoRefactoring: boolean;
    }>;
    bugs: z.ZodObject<{
        enabled: z.ZodBoolean;
        autoClassification: z.ZodBoolean;
        workflowOptimization: z.ZodBoolean;
        preventionMode: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        autoClassification: boolean;
        workflowOptimization: boolean;
        preventionMode: boolean;
    }, {
        enabled: boolean;
        autoClassification: boolean;
        workflowOptimization: boolean;
        preventionMode: boolean;
    }>;
    performance: z.ZodObject<{
        enabled: z.ZodBoolean;
        baselineTracking: z.ZodBoolean;
        anomalyDetection: z.ZodBoolean;
        autoOptimization: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        baselineTracking: boolean;
        anomalyDetection: boolean;
        autoOptimization: boolean;
    }, {
        enabled: boolean;
        baselineTracking: boolean;
        anomalyDetection: boolean;
        autoOptimization: boolean;
    }>;
    reporting: z.ZodObject<{
        frequency: z.ZodEnum<["realtime", "hourly", "daily", "weekly"]>;
        formats: z.ZodArray<z.ZodEnum<["json", "pdf", "html", "slack"]>, "many">;
        stakeholders: z.ZodArray<z.ZodString, "many">;
        customMetrics: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        frequency: "daily" | "weekly" | "hourly" | "realtime";
        formats: ("html" | "json" | "pdf" | "slack")[];
        stakeholders: string[];
        customMetrics: string[];
    }, {
        frequency: "daily" | "weekly" | "hourly" | "realtime";
        formats: ("html" | "json" | "pdf" | "slack")[];
        stakeholders: string[];
        customMetrics: string[];
    }>;
}, "strip", z.ZodTypeAny, {
    coverage: {
        enabled: boolean;
        enforcement: "strict" | "warning" | "disabled";
        thresholds: {
            function: number;
            line: number;
            branch: number;
            statement: number;
        };
        aiOptimization: boolean;
    };
    performance: {
        enabled: boolean;
        baselineTracking: boolean;
        anomalyDetection: boolean;
        autoOptimization: boolean;
    };
    quality: {
        enabled: boolean;
        aiAnalysis: boolean;
        gates: Record<string, number>;
        autoRefactoring: boolean;
    };
    bugs: {
        enabled: boolean;
        autoClassification: boolean;
        workflowOptimization: boolean;
        preventionMode: boolean;
    };
    reporting: {
        frequency: "daily" | "weekly" | "hourly" | "realtime";
        formats: ("html" | "json" | "pdf" | "slack")[];
        stakeholders: string[];
        customMetrics: string[];
    };
}, {
    coverage: {
        enabled: boolean;
        enforcement: "strict" | "warning" | "disabled";
        thresholds: {
            function: number;
            line: number;
            branch: number;
            statement: number;
        };
        aiOptimization: boolean;
    };
    performance: {
        enabled: boolean;
        baselineTracking: boolean;
        anomalyDetection: boolean;
        autoOptimization: boolean;
    };
    quality: {
        enabled: boolean;
        aiAnalysis: boolean;
        gates: Record<string, number>;
        autoRefactoring: boolean;
    };
    bugs: {
        enabled: boolean;
        autoClassification: boolean;
        workflowOptimization: boolean;
        preventionMode: boolean;
    };
    reporting: {
        frequency: "daily" | "weekly" | "hourly" | "realtime";
        formats: ("html" | "json" | "pdf" | "slack")[];
        stakeholders: string[];
        customMetrics: string[];
    };
}>;
export type QualityMetricsConfig = z.infer<typeof QualityMetricsConfigSchema>;
//# sourceMappingURL=quality-metrics.d.ts.map