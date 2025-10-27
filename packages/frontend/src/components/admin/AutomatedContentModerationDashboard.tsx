import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  Brain,
  CheckCircle,
  Clock,
  Eye,
  FileText,
  Filter,
  Image,
  MessageSquare,
  RefreshCw,
  Settings,
  Shield,
  TrendingDown,
  TrendingUp,
  Users,
  Video,
  XCircle,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAutomatedContentModeration } from '../../services/automated-content-moderation-service';
import {
  ContentFilter,
  ContentModerationResult,
  ModerationAnalytics,
  ModerationKPI,
  ModerationOptimization,
  UserReport,
} from '../../types/automated-content-moderation';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

// === US-167: AI-Powered Content Moderation Tools Component ===
const AIModerationToolsPanel: React.FC = () => {
  const moderationService = useAutomatedContentModeration();
  const [recentModerationResults, setRecentModerationResults] = useState<ContentModerationResult[]>(
    []
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedContent, setSelectedContent] = useState<string | null>(null);

  const analyzeContent = useCallback(
    async (contentId: string, contentType: string) => {
      setIsAnalyzing(true);
      try {
        const result = await moderationService.analyzeContent(contentId, contentType);
        setRecentModerationResults((prev) => [result, ...prev.slice(0, 9)]);
      } catch (error) {
        console.error('Content analysis failed:', error);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [moderationService]
  );

  const escalateContent = useCallback(
    async (contentId: string, reason: string) => {
      try {
        await moderationService.escalateContent(contentId, reason);
        // Refresh results
        await analyzeContent(contentId, 'post');
      } catch (error) {
        console.error('Content escalation failed:', error);
      }
    },
    [moderationService, analyzeContent]
  );

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'flagged':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'escalated':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Bot className="w-6 h-6 text-blue-500" />
          <h3 className="text-lg font-semibold">AI-Powered Content Moderation</h3>
        </div>
        <Button
          onClick={() => analyzeContent(`content_${Date.now()}`, 'post')}
          disabled={isAnalyzing}
          className="flex items-center space-x-2"
        >
          {isAnalyzing ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Brain className="w-4 h-4" />
          )}
          <span>{isAnalyzing ? 'Analyzing...' : 'Analyze Content'}</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Eye className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Content Analyzed</p>
                <p className="text-2xl font-bold">12,847</p>
                <p className="text-xs text-muted-foreground">+234 today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Auto-Approved</p>
                <p className="text-2xl font-bold">11,203</p>
                <p className="text-xs text-muted-foreground">87.2% rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-sm font-medium">Flagged</p>
                <p className="text-2xl font-bold">892</p>
                <p className="text-xs text-muted-foreground">6.9% rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <XCircle className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-sm font-medium">Rejected</p>
                <p className="text-2xl font-bold">752</p>
                <p className="text-xs text-muted-foreground">5.9% rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <span>Recent Moderation Results</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentModerationResults.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No recent moderation results. Click "Analyze Content" to start.
              </div>
            ) : (
              recentModerationResults.map((result) => (
                <div
                  key={result.contentId}
                  className="flex justify-between items-center p-3 rounded-lg border cursor-pointer hover:bg-accent"
                  onClick={() => setSelectedContent(result.contentId)}
                >
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(result.status)}
                    <div>
                      <p className="font-medium">Content {result.contentId}</p>
                      <p className="text-sm text-muted-foreground">
                        {result.violations.length} violations detected
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={getSeverityColor(result.severity)}>{result.severity}</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        escalateContent(result.contentId, 'Manual escalation requested');
                      }}
                    >
                      Escalate
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// === US-168: Advanced Automated Content Filtering Component ===
const ContentFilteringPanel: React.FC = () => {
  const moderationService = useAutomatedContentModeration();
  const [filters, setFilters] = useState<ContentFilter[]>([]);
  const [filterMetrics, setFilterMetrics] = useState<Map<string, any>>(new Map());
  const [isOptimizing, setIsOptimizing] = useState<string | null>(null);

  useEffect(() => {
    // Initialize with mock filters
    const mockFilters: ContentFilter[] = [
      {
        id: 'text_filter_spam',
        name: 'Spam Detection Filter',
        type: 'text',
        enabled: true,
        confidence: 0.89,
        filterRules: [],
        performance: {
          accuracy: 0.94,
          falsePositives: 0.03,
          falseNegatives: 0.04,
          throughput: 1200,
          latency: 125,
        },
        selfOptimization: {
          enabled: true,
          learningRate: 0.01,
          adaptationThreshold: 0.1,
          lastOptimized: new Date().toISOString(),
        },
      },
      {
        id: 'image_filter_explicit',
        name: 'Explicit Content Filter',
        type: 'image',
        enabled: true,
        confidence: 0.92,
        filterRules: [],
        performance: {
          accuracy: 0.96,
          falsePositives: 0.02,
          falseNegatives: 0.03,
          throughput: 800,
          latency: 250,
        },
        selfOptimization: {
          enabled: true,
          learningRate: 0.005,
          adaptationThreshold: 0.05,
          lastOptimized: new Date().toISOString(),
        },
      },
    ];
    setFilters(mockFilters);
  }, []);

  const optimizeFilter = useCallback(
    async (filterId: string) => {
      setIsOptimizing(filterId);
      try {
        await moderationService.optimizeFilters(filterId);
        // Update filter performance
        setFilters((prev) =>
          prev.map((filter) =>
            filter.id === filterId
              ? {
                  ...filter,
                  performance: {
                    ...filter.performance,
                    accuracy: filter.performance.accuracy + 0.02,
                  },
                }
              : filter
          )
        );
      } catch (error) {
        console.error('Filter optimization failed:', error);
      } finally {
        setIsOptimizing(null);
      }
    },
    [moderationService]
  );

  const getFilterTypeIcon = (type: string) => {
    switch (type) {
      case 'text':
        return <FileText className="w-4 h-4" />;
      case 'image':
        return <Image className="w-4 h-4" />;
      case 'video':
        return <Video className="w-4 h-4" />;
      default:
        return <Filter className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Filter className="w-6 h-6 text-purple-500" />
          <h3 className="text-lg font-semibold">Advanced Content Filtering</h3>
        </div>
        <Button variant="outline" className="flex items-center space-x-2">
          <Settings className="w-4 h-4" />
          <span>Filter Settings</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {filters.map((filter) => (
          <Card key={filter.id}>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  {getFilterTypeIcon(filter.type)}
                  <span>{filter.name}</span>
                </div>
                <Badge variant={filter.enabled ? 'default' : 'secondary'}>
                  {filter.enabled ? 'Active' : 'Inactive'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Accuracy</p>
                  <div className="flex items-center space-x-2">
                    <Progress value={filter.performance.accuracy * 100} className="flex-1" />
                    <span className="text-sm font-medium">
                      {(filter.performance.accuracy * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium">Throughput</p>
                  <p className="text-lg font-bold">{filter.performance.throughput}/min</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">False Positives</p>
                  <p className="text-lg font-bold text-red-500">
                    {(filter.performance.falsePositives * 100).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Latency</p>
                  <p className="text-lg font-bold">{filter.performance.latency}ms</p>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm">
                    Self-optimization: {filter.selfOptimization.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={() => optimizeFilter(filter.id)}
                  disabled={isOptimizing === filter.id}
                  className="flex items-center space-x-1"
                >
                  {isOptimizing === filter.id ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <TrendingUp className="w-3 h-3" />
                  )}
                  <span>Optimize</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter Performance Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={[
                { time: '00:00', spam: 0.94, explicit: 0.96, harassment: 0.91 },
                { time: '04:00', spam: 0.95, explicit: 0.97, harassment: 0.92 },
                { time: '08:00', spam: 0.93, explicit: 0.95, harassment: 0.9 },
                { time: '12:00', spam: 0.96, explicit: 0.98, harassment: 0.94 },
                { time: '16:00', spam: 0.94, explicit: 0.96, harassment: 0.91 },
                { time: '20:00', spam: 0.95, explicit: 0.97, harassment: 0.93 },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis domain={[0.85, 1]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="spam" stroke="#8884d8" name="Spam Filter" />
              <Line type="monotone" dataKey="explicit" stroke="#82ca9d" name="Explicit Filter" />
              <Line
                type="monotone"
                dataKey="harassment"
                stroke="#ffc658"
                name="Harassment Filter"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

// === US-169: Autonomous User Reporting Systems Component ===
const UserReportingPanel: React.FC = () => {
  const moderationService = useAutomatedContentModeration();
  const [reports, setReports] = useState<UserReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<UserReport | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Load mock reports
    const mockReports: Partial<UserReport>[] = [
      {
        reporterId: 'user123',
        reportedContentId: 'content456',
        category: 'spam',
        description: 'This post is clearly spam content',
        evidence: [{ type: 'text', content: 'Evidence text', metadata: {} }],
      },
      {
        reporterId: 'user789',
        reportedUserId: 'user999',
        category: 'harassment',
        description: 'User is sending harassing messages',
        evidence: [{ type: 'screenshot', content: 'screenshot_url', metadata: {} }],
      },
    ];

    Promise.all(mockReports.map((report) => moderationService.processReport(report))).then(
      setReports
    );
  }, [moderationService]);

  const resolveReport = useCallback(
    async (reportId: string, action: string) => {
      setIsProcessing(true);
      try {
        await moderationService.resolveReport(reportId, {
          action,
          reason: `Resolved as: ${action}`,
          appealable: true,
          followUpRequired: false,
        });

        setReports((prev) =>
          prev.map((report) =>
            report.id === reportId ? { ...report, status: 'resolved' as const } : report
          )
        );
      } catch (error) {
        console.error('Report resolution failed:', error);
      } finally {
        setIsProcessing(false);
      }
    },
    [moderationService]
  );

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'spam':
        return <MessageSquare className="w-4 h-4 text-yellow-500" />;
      case 'harassment':
        return <Users className="w-4 h-4 text-red-500" />;
      case 'hate_speech':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-6 h-6 text-orange-500" />
          <h3 className="text-lg font-semibold">User Reporting System</h3>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline">{reports.length} Reports</Badge>
          <Button variant="outline" className="flex items-center space-x-2">
            <Bell className="w-4 h-4" />
            <span>Notifications</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Pending</p>
                <p className="text-2xl font-bold">
                  {reports.filter((r) => r.status === 'pending').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Eye className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-sm font-medium">Investigating</p>
                <p className="text-2xl font-bold">
                  {reports.filter((r) => r.status === 'investigating').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Resolved</p>
                <p className="text-2xl font-bold">
                  {reports.filter((r) => r.status === 'resolved').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <XCircle className="w-5 h-5 text-gray-500" />
              <div>
                <p className="text-sm font-medium">Dismissed</p>
                <p className="text-2xl font-bold">
                  {reports.filter((r) => r.status === 'dismissed').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className="flex justify-between items-center p-3 rounded-lg border cursor-pointer hover:bg-accent"
                onClick={() => setSelectedReport(report)}
              >
                <div className="flex items-center space-x-3">
                  {getCategoryIcon(report.category)}
                  <div>
                    <p className="font-medium">Report #{report.id.slice(-6)}</p>
                    <p className="text-sm text-muted-foreground">
                      {report.category} • AI Confidence:{' '}
                      {(report.aiAnalysis.confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={getPriorityColor(report.priority)}>{report.priority}</Badge>
                  <Badge variant="outline">{report.status}</Badge>
                  {report.status === 'pending' && (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        resolveReport(report.id, 'approved');
                      }}
                      disabled={isProcessing}
                    >
                      Resolve
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// === US-170: Autonomous Moderation Analytics Component ===
const ModerationAnalyticsPanel: React.FC = () => {
  const moderationService = useAutomatedContentModeration();
  const [analytics, setAnalytics] = useState<ModerationAnalytics | null>(null);
  const [kpis, setKpis] = useState<ModerationKPI[]>([]);
  const [optimizations, setOptimizations] = useState<ModerationOptimization[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('24h');

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const [analyticsData, kpiData, optimizationData] = await Promise.all([
          moderationService.generateAnalytics(selectedPeriod),
          moderationService.getKPIs(),
          moderationService.getOptimizationRecommendations(),
        ]);

        setAnalytics(analyticsData);
        setKpis(kpiData);
        setOptimizations(optimizationData);
      } catch (error) {
        console.error('Failed to load analytics:', error);
      }
    };

    loadAnalytics();
  }, [moderationService, selectedPeriod]);

  const renderKPICard = (kpi: ModerationKPI) => {
    const trendIcon =
      kpi.trend === 'improving' ? (
        <TrendingUp className="w-4 h-4 text-green-500" />
      ) : kpi.trend === 'declining' ? (
        <TrendingDown className="w-4 h-4 text-red-500" />
      ) : (
        <Activity className="w-4 h-4 text-gray-500" />
      );

    return (
      <Card key={kpi.id}>
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium">{kpi.name}</p>
              <p className="text-2xl font-bold">
                {kpi.currentValue.toFixed(kpi.unit === '%' ? 1 : 0)}
                {kpi.unit}
              </p>
              <p className="text-xs text-muted-foreground">
                Target: {kpi.targetValue}
                {kpi.unit}
              </p>
            </div>
            <div className="flex flex-col items-end">
              {trendIcon}
              <Progress value={(kpi.currentValue / kpi.targetValue) * 100} className="mt-2 w-16" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (!analytics) {
    return (
      <div className="flex justify-center items-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin" />
        <span className="ml-2">Loading analytics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <BarChart3 className="w-6 h-6 text-indigo-500" />
          <h3 className="text-lg font-semibold">Moderation Analytics</h3>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant={selectedPeriod === '24h' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedPeriod('24h')}
          >
            24h
          </Button>
          <Button
            variant={selectedPeriod === '7d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedPeriod('7d')}
          >
            7d
          </Button>
          <Button
            variant={selectedPeriod === '30d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedPeriod('30d')}
          >
            30d
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map(renderKPICard)}
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Content Processing Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={[
                    {
                      name: 'Auto Actions',
                      value: analytics.overview.automaticActions,
                      fill: '#8884d8',
                    },
                    {
                      name: 'Human Reviews',
                      value: analytics.overview.humanReviews,
                      fill: '#82ca9d',
                    },
                    { name: 'Escalations', value: analytics.overview.escalations, fill: '#ffc658' },
                  ]}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label
                ></Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between">
                  <span>Accuracy</span>
                  <span>{(analytics.performanceMetrics.accuracy * 100).toFixed(1)}%</span>
                </div>
                <Progress value={analytics.performanceMetrics.accuracy * 100} />
              </div>
              <div>
                <div className="flex justify-between">
                  <span>Precision</span>
                  <span>{(analytics.performanceMetrics.precision * 100).toFixed(1)}%</span>
                </div>
                <Progress value={analytics.performanceMetrics.precision * 100} />
              </div>
              <div>
                <div className="flex justify-between">
                  <span>Recall</span>
                  <span>{(analytics.performanceMetrics.recall * 100).toFixed(1)}%</span>
                </div>
                <Progress value={analytics.performanceMetrics.recall * 100} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trends and Recommendations */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Trends & Patterns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.trendsAndPatterns.map((trend) => (
                <Alert key={trend.id}>
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{trend.description}</p>
                        <p className="text-sm text-muted-foreground">{trend.recommendation}</p>
                      </div>
                      {trend.actionRequired && <Badge variant="destructive">Action Required</Badge>}
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Optimization Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {optimizations.map((opt) => (
                <div key={opt.id} className="p-3 rounded-lg border">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{opt.recommendation}</p>
                      <p className="text-sm text-muted-foreground">
                        Impact: +{(opt.impact.accuracy * 100).toFixed(1)}% accuracy
                      </p>
                    </div>
                    <Badge
                      variant={opt.implementation.priority === 'high' ? 'destructive' : 'default'}
                    >
                      {opt.implementation.priority}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// === Main Dashboard Component ===
const AutomatedContentModerationDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('ai-moderation');

  return (
    <div className="p-6 min-h-screen bg-background">
      <div className="mx-auto space-y-6 max-w-7xl">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Automated Content Moderation</h1>
            <p className="text-muted-foreground">
              AI-powered content moderation with real-time analytics and autonomous decision-making
            </p>
          </div>
          <Badge variant="outline" className="text-green-600 border-green-600">
            <Shield className="mr-1 w-3 h-3" />
            System Active
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="ai-moderation" className="flex items-center space-x-2">
              <Bot className="w-4 h-4" />
              <span>AI Moderation</span>
            </TabsTrigger>
            <TabsTrigger value="content-filtering" className="flex items-center space-x-2">
              <Filter className="w-4 h-4" />
              <span>Content Filtering</span>
            </TabsTrigger>
            <TabsTrigger value="user-reporting" className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4" />
              <span>User Reports</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4" />
              <span>Analytics</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai-moderation">
            <AIModerationToolsPanel />
          </TabsContent>

          <TabsContent value="content-filtering">
            <ContentFilteringPanel />
          </TabsContent>

          <TabsContent value="user-reporting">
            <UserReportingPanel />
          </TabsContent>

          <TabsContent value="analytics">
            <ModerationAnalyticsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AutomatedContentModerationDashboard;
