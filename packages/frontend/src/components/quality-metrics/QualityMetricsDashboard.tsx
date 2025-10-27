import {
  Activity,
  AlertCircle,
  Brain,
  Download,
  Filter,
  Refresh,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BugMetric,
  CodeQualityMetric,
  CoverageMetric,
  PerformanceBenchmark,
} from '../../../../shared/src/types/quality-metrics';
import { useQualityMetricsService } from '../../hooks/useQualityMetricsService';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

/**
 * Comprehensive Quality Metrics Dashboard Component
 * Supports US-159 through US-162 implementations
 */

interface QualityMetricsDashboardProps {
  projectId: string;
  realTimeUpdates?: boolean;
  showAIInsights?: boolean;
  customization?: {
    layout?: 'grid' | 'single-column';
    visibleMetrics?: Array<'coverage' | 'quality' | 'bugs' | 'performance'>;
    refreshInterval?: number;
  };
}

export const QualityMetricsDashboard: React.FC<QualityMetricsDashboardProps> = ({
  projectId,
  realTimeUpdates = true,
  showAIInsights = true,
  customization = {
    layout: 'grid',
    visibleMetrics: ['coverage', 'quality', 'bugs', 'performance'],
    refreshInterval: 30000, // 30 seconds
  },
}) => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [timeframe, setTimeframe] = useState<string>('day');
  const [filters, setFilters] = useState<any>({});
  const [searchQuery, setSearchQuery] = useState<string>('');

  const {
    dashboard,
    loading,
    error,
    refreshDashboard,
    exportReport,
    updateConfiguration,
    isConnected,
  } = useQualityMetricsService(projectId, {
    realTimeUpdates,
    refreshInterval: customization.refreshInterval,
  });

  /**
   * US-159: Coverage Tracking Component
   */
  const CoverageTrackingComponent: React.FC<{ coverage: CoverageMetric }> = ({ coverage }) => {
    const coverageData = useMemo(
      () => [
        {
          name: 'Lines',
          covered: coverage.linesCovered,
          total: coverage.linesTotal,
          percentage: coverage.coveragePercentage,
        },
        {
          name: 'Branches',
          covered: coverage.branchesCovered,
          total: coverage.branchesTotal,
          percentage: (coverage.branchesCovered / coverage.branchesTotal) * 100,
        },
        {
          name: 'Functions',
          covered: coverage.functionsCovered,
          total: coverage.functionsTotal,
          percentage: (coverage.functionsCovered / coverage.functionsTotal) * 100,
        },
        {
          name: 'Statements',
          covered: coverage.statementsCovered,
          total: coverage.statementsTotal,
          percentage: (coverage.statementsCovered / coverage.statementsTotal) * 100,
        },
      ],
      [coverage]
    );

    const getCoverageColor = (percentage: number) => {
      if (percentage >= 80) return 'text-green-600';
      if (percentage >= 60) return 'text-yellow-600';
      return 'text-red-600';
    };

    const getCoverageStatus = (percentage: number) => {
      if (percentage >= coverage.threshold.target) return 'excellent';
      if (percentage >= coverage.threshold.minimum) return 'good';
      return 'needs-improvement';
    };

    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold">
            Code Coverage Tracking
            <Badge variant="outline" className="ml-2">
              US-159
            </Badge>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Badge
              variant={
                getCoverageStatus(coverage.coveragePercentage) === 'excellent'
                  ? 'default'
                  : getCoverageStatus(coverage.coveragePercentage) === 'good'
                    ? 'secondary'
                    : 'destructive'
              }
            >
              {coverage.coveragePercentage.toFixed(1)}%
            </Badge>
            {coverage.threshold.adaptive && (
              <Badge variant="outline">
                <Brain className="w-3 h-3 mr-1" />
                AI Optimized
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Overall Coverage Progress */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Overall Coverage</span>
                <span
                  className={`text-sm font-bold ${getCoverageColor(coverage.coveragePercentage)}`}
                >
                  {coverage.coveragePercentage.toFixed(1)}%
                </span>
              </div>
              <Progress
                value={coverage.coveragePercentage}
                className="h-3"
                indicatorClassName={
                  coverage.coveragePercentage >= 80
                    ? 'bg-green-500'
                    : coverage.coveragePercentage >= 60
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                }
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Min: {coverage.threshold.minimum}%</span>
                <span>Target: {coverage.threshold.target}%</span>
              </div>
            </div>

            {/* Coverage Breakdown */}
            <div className="grid grid-cols-2 gap-4">
              {coverageData.map((item) => (
                <div key={item.name} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">{item.name}</span>
                    <span className="text-xs text-gray-500">
                      {item.covered}/{item.total}
                    </span>
                  </div>
                  <Progress value={item.percentage} className="h-2" />
                  <span className={`text-xs ${getCoverageColor(item.percentage)}`}>
                    {item.percentage.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>

            {/* Coverage Trends */}
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Coverage Trends</h4>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={coverage.trends}>
                  <defs>
                    <linearGradient id="coverageGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(date) => new Date(date).toLocaleDateString()}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip
                    labelFormatter={(date) => new Date(date).toLocaleDateString()}
                    formatter={(value: number) => [`${value.toFixed(1)}%`, 'Coverage']}
                  />
                  <Area
                    type="monotone"
                    dataKey="coverage"
                    stroke="#22c55e"
                    fillOpacity={1}
                    fill="url(#coverageGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* AI Insights */}
            {showAIInsights && coverage.aiInsights && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center mb-2">
                  <Brain className="w-4 h-4 text-blue-600 mr-2" />
                  <span className="text-sm font-medium text-blue-800">AI Insights</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-blue-700">Predicted Coverage</span>
                    <span className="text-xs font-medium text-blue-800">
                      {coverage.aiInsights.predictedCoverage}%
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-xs text-blue-700">Risk Assessment:</span>
                    <Badge
                      variant={
                        coverage.aiInsights.riskAssessment === 'low' ? 'default' : 'secondary'
                      }
                      className="ml-2 text-xs"
                    >
                      {coverage.aiInsights.riskAssessment}
                    </Badge>
                  </div>
                  {coverage.aiInsights.suggestions.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs text-blue-700 mb-1">Top Suggestions:</div>
                      <ul className="text-xs space-y-1">
                        {coverage.aiInsights.suggestions.slice(0, 2).map((suggestion, index) => (
                          <li key={index} className="flex items-start">
                            <span className="text-blue-500 mr-1">•</span>
                            <span className="text-blue-800">{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  /**
   * US-160: Code Quality Metrics Component
   */
  const CodeQualityComponent: React.FC<{ quality: CodeQualityMetric }> = ({ quality }) => {
    const qualityMetrics = useMemo(
      () => [
        { name: 'Overall Score', value: quality.overallScore, max: 100, unit: '%' },
        { name: 'Maintainability', value: quality.maintainabilityIndex, max: 100, unit: '%' },
        {
          name: 'Cyclomatic Complexity',
          value: quality.cyclomaticComplexity,
          max: 20,
          unit: '',
          inverse: true,
        },
        {
          name: 'Technical Debt',
          value: quality.technicalDebt.ratio,
          max: 100,
          unit: '%',
          inverse: true,
        },
      ],
      [quality]
    );

    const getQualityColor = (value: number, max: number, inverse = false) => {
      const percentage = (value / max) * 100;
      if (inverse) {
        if (percentage <= 20) return 'text-green-600';
        if (percentage <= 50) return 'text-yellow-600';
        return 'text-red-600';
      } else {
        if (percentage >= 80) return 'text-green-600';
        if (percentage >= 60) return 'text-yellow-600';
        return 'text-red-600';
      }
    };

    const severityColors = {
      blocker: 'bg-red-600',
      critical: 'bg-red-500',
      major: 'bg-orange-500',
      minor: 'bg-yellow-500',
      info: 'bg-blue-500',
    };

    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold">
            Code Quality Metrics
            <Badge variant="outline" className="ml-2">
              US-160
            </Badge>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Badge
              variant={
                quality.gates.qualityGate === 'passed'
                  ? 'default'
                  : quality.gates.qualityGate === 'warning'
                    ? 'secondary'
                    : 'destructive'
              }
            >
              {quality.gates.qualityGate.toUpperCase()}
            </Badge>
            <Badge variant="outline">Grade {quality.technicalDebt.classification}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Quality Metrics Grid */}
            <div className="grid grid-cols-2 gap-4">
              {qualityMetrics.map((metric) => (
                <div key={metric.name} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{metric.name}</span>
                    <span
                      className={`text-sm font-bold ${getQualityColor(metric.value, metric.max, metric.inverse)}`}
                    >
                      {metric.value.toFixed(1)}
                      {metric.unit}
                    </span>
                  </div>
                  <Progress
                    value={
                      metric.inverse
                        ? 100 - (metric.value / metric.max) * 100
                        : (metric.value / metric.max) * 100
                    }
                    className="h-2"
                    indicatorClassName={
                      getQualityColor(metric.value, metric.max, metric.inverse) === 'text-green-600'
                        ? 'bg-green-500'
                        : getQualityColor(metric.value, metric.max, metric.inverse) ===
                            'text-yellow-600'
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                    }
                  />
                </div>
              ))}
            </div>

            {/* Violations Breakdown */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Code Violations</h4>
              <div className="grid grid-cols-5 gap-2">
                {Object.entries(
                  quality.violations.reduce(
                    (acc, violation) => {
                      acc[violation.severity] = (acc[violation.severity] || 0) + violation.count;
                      return acc;
                    },
                    {} as Record<string, number>
                  )
                ).map(([severity, count]) => (
                  <div key={severity} className="text-center">
                    <div
                      className={`w-full h-2 rounded ${severityColors[severity as keyof typeof severityColors]}`}
                    ></div>
                    <div className="text-xs mt-1 capitalize">{severity}</div>
                    <div className="text-xs font-bold">{count}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Technical Debt Visualization */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Technical Debt</h4>
              <div className="flex items-center justify-between">
                <span className="text-sm">Total Debt</span>
                <span className="text-sm font-medium">
                  {Math.round(quality.technicalDebt.minutes / 60)}h{' '}
                  {quality.technicalDebt.minutes % 60}m
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Debt Ratio</span>
                <span className="text-sm font-medium text-red-600">
                  {quality.technicalDebt.ratio.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Quality Trends */}
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Quality Trends</h4>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={quality.trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(date) => new Date(date).toLocaleDateString()}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip
                    labelFormatter={(date) => new Date(date).toLocaleDateString()}
                    formatter={(value: number) => [`${value.toFixed(1)}`, 'Quality Score']}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* AI Refactoring Suggestions */}
            {showAIInsights && quality.aiAnalysis && (
              <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center mb-2">
                  <Brain className="w-4 h-4 text-purple-600 mr-2" />
                  <span className="text-sm font-medium text-purple-800">
                    AI Refactoring Suggestions
                  </span>
                </div>
                <div className="space-y-2">
                  {quality.aiAnalysis.refactoringOpportunities
                    .slice(0, 3)
                    .map((opportunity, index) => (
                      <div key={index} className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="text-xs font-medium text-purple-800">
                            {opportunity.file}::{opportunity.function}
                          </div>
                          <div className="text-xs text-purple-700 mt-1">
                            {opportunity.suggestion}
                          </div>
                        </div>
                        <Badge
                          variant={opportunity.impact === 'high' ? 'default' : 'secondary'}
                          className="ml-2 text-xs"
                        >
                          {opportunity.impact}
                        </Badge>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  /**
   * US-161: Bug Tracking Component
   */
  const BugTrackingComponent: React.FC<{ bugs: BugMetric }> = ({ bugs }) => {
    const bugData = useMemo(
      () => [
        { name: 'Critical', value: bugs.severity.critical, color: '#dc2626' },
        { name: 'High', value: bugs.severity.high, color: '#ea580c' },
        { name: 'Medium', value: bugs.severity.medium, color: '#ca8a04' },
        { name: 'Low', value: bugs.severity.low, color: '#16a34a' },
      ],
      [bugs]
    );

    const getBugTrendIcon = (current: number, previous: number) => {
      if (current > previous) return <TrendingUp className="w-4 h-4 text-red-600" />;
      if (current < previous) return <TrendingDown className="w-4 h-4 text-green-600" />;
      return <Activity className="w-4 h-4 text-gray-600" />;
    };

    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold">
            Bug Tracking & Resolution
            <Badge variant="outline" className="ml-2">
              US-161
            </Badge>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Badge
              variant={
                bugs.openBugs === 0 ? 'default' : bugs.openBugs <= 5 ? 'secondary' : 'destructive'
              }
            >
              {bugs.openBugs} Open
            </Badge>
            <Badge variant="outline">Velocity: {bugs.bugVelocity.toFixed(1)}/day</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Bug Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{bugs.openBugs}</div>
                <div className="text-xs text-gray-500">Open Bugs</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{bugs.resolvedBugs}</div>
                <div className="text-xs text-gray-500">Resolved</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {bugs.averageResolutionTime.toFixed(1)}h
                </div>
                <div className="text-xs text-gray-500">Avg Resolution</div>
              </div>
            </div>

            {/* Bug Severity Distribution */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Severity Distribution</h4>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie
                    data={bugData}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {bugData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Bug Performance Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">First Time Fix Rate</span>
                  <span className="text-sm font-medium">
                    {bugs.performance.firstTimeFixRate.toFixed(1)}%
                  </span>
                </div>
                <Progress value={bugs.performance.firstTimeFixRate} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Reopen Rate</span>
                  <span className="text-sm font-medium text-red-600">
                    {bugs.performance.reopenRate.toFixed(1)}%
                  </span>
                </div>
                <Progress
                  value={bugs.performance.reopenRate}
                  className="h-2"
                  indicatorClassName="bg-red-500"
                />
              </div>
            </div>

            {/* Bug Trends */}
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Bug Trends</h4>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={bugs.trends}>
                  <defs>
                    <linearGradient id="openBugsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#dc2626" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="resolvedBugsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(date) => new Date(date).toLocaleDateString()}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip labelFormatter={(date) => new Date(date).toLocaleDateString()} />
                  <Area
                    type="monotone"
                    dataKey="opened"
                    stackId="1"
                    stroke="#dc2626"
                    fill="url(#openBugsGradient)"
                    name="Opened"
                  />
                  <Area
                    type="monotone"
                    dataKey="resolved"
                    stackId="2"
                    stroke="#16a34a"
                    fill="url(#resolvedBugsGradient)"
                    name="Resolved"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* AI Predictions */}
            {showAIInsights && bugs.aiClassification && (
              <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center mb-2">
                  <Brain className="w-4 h-4 text-orange-600 mr-2" />
                  <span className="text-sm font-medium text-orange-800">AI Bug Predictions</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-orange-700">Next Week Bugs</span>
                    <span className="text-xs font-medium text-orange-800">
                      ~{bugs.aiClassification.predictions.nextWeekBugs}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-orange-700">Classification Accuracy</span>
                    <span className="text-xs font-medium text-orange-800">
                      {(bugs.aiClassification.accuracy * 100).toFixed(1)}%
                    </span>
                  </div>
                  {bugs.aiClassification.predictions.hotspots.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs text-orange-700 mb-1">Risk Hotspots:</div>
                      <div className="flex flex-wrap gap-1">
                        {bugs.aiClassification.predictions.hotspots
                          .slice(0, 3)
                          .map((hotspot, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {hotspot}
                            </Badge>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  /**
   * US-162: Performance Benchmarking Component
   */
  const PerformanceBenchmarkingComponent: React.FC<{ performance: PerformanceBenchmark }> = ({
    performance,
  }) => {
    const performanceMetrics = useMemo(
      () => [
        {
          name: 'Response Time',
          current: performance.performance.responseTime.average,
          baseline: performance.baseline.metrics.responseTime || 100,
          unit: 'ms',
          inverse: true,
        },
        {
          name: 'Throughput',
          current: performance.performance.throughput.requestsPerSecond,
          baseline: performance.baseline.metrics.throughput || 100,
          unit: 'req/s',
          inverse: false,
        },
        {
          name: 'CPU Usage',
          current: performance.performance.resources.cpuUsage,
          baseline: performance.baseline.metrics.cpuUsage || 50,
          unit: '%',
          inverse: true,
        },
        {
          name: 'Memory Usage',
          current: performance.performance.resources.memoryUsage,
          baseline: performance.baseline.metrics.memoryUsage || 50,
          unit: '%',
          inverse: true,
        },
      ],
      [performance]
    );

    const getPerformanceColor = (current: number, baseline: number, inverse = false) => {
      const change = ((current - baseline) / baseline) * 100;
      if (inverse) {
        if (change <= -10) return 'text-green-600'; // Improvement
        if (change <= 10) return 'text-yellow-600'; // Stable
        return 'text-red-600'; // Regression
      } else {
        if (change >= 10) return 'text-green-600'; // Improvement
        if (change >= -10) return 'text-yellow-600'; // Stable
        return 'text-red-600'; // Regression
      }
    };

    const getPerformanceIcon = (current: number, baseline: number, inverse = false) => {
      const change = ((current - baseline) / baseline) * 100;
      const isImprovement = inverse ? change < 0 : change > 0;

      if (Math.abs(change) < 5) return <Activity className="w-4 h-4 text-gray-600" />;
      return isImprovement ? (
        <TrendingUp className="w-4 h-4 text-green-600" />
      ) : (
        <TrendingDown className="w-4 h-4 text-red-600" />
      );
    };

    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold">
            Performance Benchmarking
            <Badge variant="outline" className="ml-2">
              US-162
            </Badge>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Badge variant={performance.performance.errors.rate < 1 ? 'default' : 'destructive'}>
              {performance.performance.errors.rate.toFixed(2)}% Error Rate
            </Badge>
            <Badge variant="outline">{performance.environment.toUpperCase()}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Performance Metrics Grid */}
            <div className="grid grid-cols-2 gap-4">
              {performanceMetrics.map((metric) => {
                const change = ((metric.current - metric.baseline) / metric.baseline) * 100;
                return (
                  <div key={metric.name} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{metric.name}</span>
                      <div className="flex items-center space-x-1">
                        {getPerformanceIcon(metric.current, metric.baseline, metric.inverse)}
                        <span
                          className={`text-sm font-bold ${getPerformanceColor(metric.current, metric.baseline, metric.inverse)}`}
                        >
                          {metric.current.toFixed(1)}
                          {metric.unit}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>
                        Baseline: {metric.baseline.toFixed(1)}
                        {metric.unit}
                      </span>
                      <span className={change >= 0 ? 'text-red-600' : 'text-green-600'}>
                        {change >= 0 ? '+' : ''}
                        {change.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Response Time Percentiles */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Response Time Distribution</h4>
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center">
                  <div className="text-lg font-bold">
                    {performance.performance.responseTime.average.toFixed(0)}
                  </div>
                  <div className="text-xs text-gray-500">Avg</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold">
                    {performance.performance.responseTime.p95.toFixed(0)}
                  </div>
                  <div className="text-xs text-gray-500">P95</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold">
                    {performance.performance.responseTime.p99.toFixed(0)}
                  </div>
                  <div className="text-xs text-gray-500">P99</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold">
                    {performance.performance.responseTime.max.toFixed(0)}
                  </div>
                  <div className="text-xs text-gray-500">Max</div>
                </div>
              </div>
            </div>

            {/* Throughput and Concurrency */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Requests/sec</span>
                  <span className="text-sm font-medium">
                    {performance.performance.throughput.requestsPerSecond.toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Concurrent Users</span>
                  <span className="text-sm font-medium">
                    {performance.performance.throughput.concurrentUsers}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Error Count</span>
                  <span className="text-sm font-medium text-red-600">
                    {performance.performance.errors.count}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Error Rate</span>
                  <span className="text-sm font-medium text-red-600">
                    {performance.performance.errors.rate.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Resource Usage */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Resource Usage</h4>
              <div className="space-y-2">
                {['CPU', 'Memory', 'Disk'].map((resource) => {
                  const usage =
                    resource === 'CPU'
                      ? performance.performance.resources.cpuUsage
                      : resource === 'Memory'
                        ? performance.performance.resources.memoryUsage
                        : performance.performance.resources.diskUsage;
                  return (
                    <div key={resource} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs">{resource} Usage</span>
                        <span className="text-xs font-medium">{usage.toFixed(1)}%</span>
                      </div>
                      <Progress
                        value={usage}
                        className="h-2"
                        indicatorClassName={
                          usage < 70 ? 'bg-green-500' : usage < 85 ? 'bg-yellow-500' : 'bg-red-500'
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Anomalies and Alerts */}
            {performance.anomalies.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="text-sm font-medium flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2 text-yellow-600" />
                  Performance Anomalies
                </h4>
                <div className="space-y-2">
                  {performance.anomalies.slice(0, 3).map((anomaly, index) => (
                    <Alert key={index} variant="destructive">
                      <AlertDescription className="text-xs">
                        <strong>{anomaly.metric}:</strong> {anomaly.description}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}

            {/* AI Optimizations */}
            {showAIInsights && performance.aiAnalysis && (
              <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center mb-2">
                  <Brain className="w-4 h-4 text-green-600 mr-2" />
                  <span className="text-sm font-medium text-green-800">
                    AI Performance Optimizations
                  </span>
                </div>
                <div className="space-y-2">
                  {performance.aiAnalysis.optimizations.slice(0, 3).map((optimization, index) => (
                    <div key={index} className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-xs font-medium text-green-800">
                          {optimization.area}
                        </div>
                        <div className="text-xs text-green-700 mt-1">
                          {optimization.recommendation}
                        </div>
                      </div>
                      <div className="flex space-x-1 ml-2">
                        <Badge
                          variant={optimization.impact === 'high' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {optimization.impact}
                        </Badge>
                        {optimization.automated && (
                          <Badge variant="outline" className="text-xs">
                            <Zap className="w-3 h-3 mr-1" />
                            Auto
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  /**
   * Main Dashboard Render
   */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span>Loading Quality Metrics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load quality metrics: {error}</AlertDescription>
      </Alert>
    );
  }

  if (!dashboard) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>No quality metrics data available for this project.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Quality Metrics Dashboard</h1>
          <p className="text-gray-600">
            Comprehensive code quality, coverage, bug tracking, and performance monitoring
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={isConnected ? 'default' : 'destructive'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setSearchQuery('')}>
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
          <Button variant="outline" size="sm" onClick={refreshDashboard}>
            <Refresh className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportReport('pdf')}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Overall Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Overall Quality Score</span>
            <Badge
              variant={
                dashboard.overallScore >= 80
                  ? 'default'
                  : dashboard.overallScore >= 60
                    ? 'secondary'
                    : 'destructive'
              }
              className="text-lg px-3 py-1"
            >
              {dashboard.overallScore.toFixed(1)}%
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={dashboard.overallScore} className="h-4" />
          <div className="flex justify-between text-sm text-gray-500 mt-2">
            <span>Poor (0-40)</span>
            <span>Fair (40-60)</span>
            <span>Good (60-80)</span>
            <span>Excellent (80-100)</span>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="coverage">Coverage</TabsTrigger>
          <TabsTrigger value="quality">Quality</TabsTrigger>
          <TabsTrigger value="bugs">Bugs</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div
            className={`grid gap-6 ${customization.layout === 'grid' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}
          >
            {customization.visibleMetrics?.includes('coverage') && (
              <CoverageTrackingComponent coverage={dashboard.coverage} />
            )}
            {customization.visibleMetrics?.includes('quality') && (
              <CodeQualityComponent quality={dashboard.quality} />
            )}
            {customization.visibleMetrics?.includes('bugs') && (
              <BugTrackingComponent bugs={dashboard.bugs} />
            )}
            {customization.visibleMetrics?.includes('performance') && (
              <PerformanceBenchmarkingComponent performance={dashboard.performance} />
            )}
          </div>
        </TabsContent>

        <TabsContent value="coverage">
          <CoverageTrackingComponent coverage={dashboard.coverage} />
        </TabsContent>

        <TabsContent value="quality">
          <CodeQualityComponent quality={dashboard.quality} />
        </TabsContent>

        <TabsContent value="bugs">
          <BugTrackingComponent bugs={dashboard.bugs} />
        </TabsContent>

        <TabsContent value="performance">
          <PerformanceBenchmarkingComponent performance={dashboard.performance} />
        </TabsContent>
      </Tabs>

      {/* Insights and Recommendations */}
      {dashboard.insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Brain className="w-5 h-5 mr-2" />
              AI-Powered Insights & Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {dashboard.recommendations.slice(0, 6).map((recommendation, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge
                      variant={
                        recommendation.priority === 'high' || recommendation.priority === 'critical'
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {recommendation.priority}
                    </Badge>
                    <Badge variant="outline">{recommendation.category}</Badge>
                  </div>
                  <h4 className="font-medium text-sm">{recommendation.action}</h4>
                  <p className="text-xs text-gray-600">{recommendation.impact}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Effort: {recommendation.effort}</span>
                    {recommendation.automated && (
                      <Badge variant="outline" className="text-xs">
                        <Zap className="w-3 h-3 mr-1" />
                        Auto-fix
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default QualityMetricsDashboard;
