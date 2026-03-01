// @ts-nocheck
/**
 * 📈 **GROWTH FORECASTING CHART - ELITE ENGINEERING**
 *
 * Implementation of US-175.3: GrowthForecastingChart Component
 *
 * Features:
 * - Multi-scenario growth forecasting (optimistic, realistic, pessimistic)
 * - Goal tracking with progress monitoring
 * - Interactive growth timeline with milestone markers
 * - Growth strategy recommendations
 * - Likelihood scoring for different scenarios
 * - Mobile-first responsive design
 * - Real-time growth data updates
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorBoundary } from '@/monitoring/ErrorBoundary';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/useToast';
import { AlertCircle, BarChart3, Target, Zap } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { z } from 'zod';

// Date utilities - replacing date-fns with native JS
const format = (date: Date, formatStr: string): string => {
  if (formatStr === 'MMM dd') {
    return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  }
  if (formatStr === 'MMM yyyy') {
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  return date.toLocaleDateString();
};

const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

// =====================================================
// TYPES AND VALIDATION
// =====================================================

const ForecastScenarioSchema = z.enum(['optimistic', 'realistic', 'pessimistic', 'custom']);
const GrowthMetricSchema = z.enum([
  'followers',
  'engagement',
  'revenue',
  'content_views',
  'subscribers',
]);
const TimeframeSchema = z.enum(['1month', '3months', '6months', '1year', '2years']);

interface GrowthFilters {
  scenario: z.infer<typeof ForecastScenarioSchema>;
  metric: z.infer<typeof GrowthMetricSchema>;
  timeframe: z.infer<typeof TimeframeSchema>;
  includeGoals: boolean;
  showConfidenceInterval: boolean;
  customGrowthRate?: number;
}

interface GrowthScenario {
  scenario: string;
  likelihood: number;
  growth_rate: number;
  projected_value: number;
  confidence_score: number;
  color: string;
}

interface GrowthGoal {
  goal_id: string;
  target_value: number;
  target_date: string;
  current_progress: number;
  likelihood: number;
  status: 'on_track' | 'at_risk' | 'behind' | 'achieved';
}

// =====================================================
// CONSTANTS AND THEMES
// =====================================================

const SCENARIO_COLORS = {
  optimistic: '#10B981',
  realistic: '#0EA5E9',
  pessimistic: '#F59E0B',
  custom: '#8B5CF6',
};

const GOAL_STATUS_COLORS = {
  on_track: '#10B981',
  at_risk: '#F59E0B',
  behind: '#EF4444',
  achieved: '#6366F1',
};

const METRIC_LABELS = {
  followers: 'Followers',
  engagement: 'Engagement Rate',
  revenue: 'Revenue',
  content_views: 'Content Views',
  subscribers: 'Subscribers',
};

const TIMEFRAME_LABELS = {
  '1month': '1 Month',
  '3months': '3 Months',
  '6months': '6 Months',
  '1year': '1 Year',
  '2years': '2 Years',
};

// =====================================================
// MOCK DATA HOOKS (TO BE REPLACED WITH REAL API)
// =====================================================

const useGrowthForecasting = (filters: any) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mockData = {
    forecasts: [
      {
        scenario: 'optimistic',
        likelihood: 0.25,
        growth_rate: 15.2,
        projected_value: 125000,
        confidence_score: 0.78,
        color: SCENARIO_COLORS.optimistic,
      },
      {
        scenario: 'realistic',
        likelihood: 0.6,
        growth_rate: 8.5,
        projected_value: 85000,
        confidence_score: 0.92,
        color: SCENARIO_COLORS.realistic,
      },
      {
        scenario: 'pessimistic',
        likelihood: 0.15,
        growth_rate: 3.2,
        projected_value: 52000,
        confidence_score: 0.85,
        color: SCENARIO_COLORS.pessimistic,
      },
    ],
    goals: [
      {
        goal_id: 'goal_1',
        target_value: 100000,
        target_date: '2024-12-31',
        current_progress: 0.72,
        likelihood: 0.84,
        status: 'on_track' as const,
      },
      {
        goal_id: 'goal_2',
        target_value: 150000,
        target_date: '2025-06-30',
        current_progress: 0.45,
        likelihood: 0.62,
        status: 'at_risk' as const,
      },
    ],
    strategies: [
      {
        strategy_id: 'strat_1',
        title: 'Content Optimization',
        description: 'Increase posting frequency and optimize for engagement',
        impact: 'high',
        effort: 'medium',
        timeline: '2-4 weeks',
      },
      {
        strategy_id: 'strat_2',
        title: 'Audience Expansion',
        description: 'Target new demographics and expand reach',
        impact: 'medium',
        effort: 'high',
        timeline: '6-8 weeks',
      },
    ],
  };

  const refetch = useCallback(async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsLoading(false);
  }, []);

  return {
    ...mockData,
    isLoading,
    error,
    refetch,
  };
};

// =====================================================
// MAIN COMPONENT
// =====================================================

export const GrowthForecastingChart: React.FC = () => {
  const { toast } = useToast();
  const [filters, setFilters] = useState<GrowthFilters>({
    scenario: 'realistic',
    metric: 'followers',
    timeframe: '6months',
    includeGoals: true,
    showConfidenceInterval: true,
  });

  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [showStrategies, setShowStrategies] = useState(false);

  const { forecasts, goals, strategies, isLoading, error, refetch } = useGrowthForecasting(filters);

  // =====================================================
  // COMPUTED VALUES
  // =====================================================

  const chartData = useMemo(() => {
    if (!forecasts?.length) return [];

    const timeframeDays = {
      '1month': 30,
      '3months': 90,
      '6months': 180,
      '1year': 365,
      '2years': 730,
    }[filters.timeframe];

    const dataPoints = Math.min(12, timeframeDays / 30); // Monthly data points
    const currentValue = 50000; // Base value

    return Array.from({ length: dataPoints + 1 }, (_, index) => {
      const date = addDays(new Date(), (index * timeframeDays) / dataPoints);
      const progress = index / dataPoints;

      const chartPoint: any = {
        date: format(date, 'MMM yyyy'),
        month: index,
      };

      forecasts.forEach((forecast: any) => {
        const growth = Math.pow(1 + forecast.growth_rate / 100, progress);
        chartPoint[forecast.scenario] = Math.round(currentValue * growth);

        if (filters.showConfidenceInterval) {
          const variance = forecast.confidence_score * 0.15;
          chartPoint[`${forecast.scenario}_upper`] = Math.round(
            chartPoint[forecast.scenario] * (1 + variance)
          );
          chartPoint[`${forecast.scenario}_lower`] = Math.round(
            chartPoint[forecast.scenario] * (1 - variance)
          );
        }
      });

      return chartPoint;
    });
  }, [forecasts, filters.timeframe, filters.showConfidenceInterval]);

  const goalProgress = useMemo(() => {
    if (!goals?.length) return [];

    return goals.map((goal: any) => ({
      ...goal,
      progress_percentage: goal.current_progress * 100,
      status_color: GOAL_STATUS_COLORS[goal.status],
      estimated_completion: new Date(goal.target_date),
      days_remaining: Math.ceil(
        (new Date(goal.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ),
    }));
  }, [goals]);

  const selectedScenarioData = useMemo(() => {
    if (!forecasts?.length) return null;
    return forecasts.find((f: any) => f.scenario === filters.scenario);
  }, [forecasts, filters.scenario]);

  // =====================================================
  // EVENT HANDLERS
  // =====================================================

  const handleFilterChange = useCallback((key: keyof GrowthFilters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleGoalSelect = useCallback(
    (goalId: string) => {
      setSelectedGoal(goalId === selectedGoal ? null : goalId);
    },
    [selectedGoal]
  );

  const handleStrategyToggle = useCallback(() => {
    setShowStrategies(!showStrategies);
  }, [showStrategies]);

  const handleGenerateNewForecast = useCallback(async () => {
    try {
      await refetch();
      toast({
        title: 'Forecast Updated',
        description: 'New growth forecast generated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Forecast Failed',
        description: 'Unable to generate new forecast. Please try again.',
        variant: 'destructive',
      });
    }
  }, [refetch, toast]);

  // =====================================================
  // RENDER HELPERS
  // =====================================================

  const renderScenarioCard = (scenario: GrowthScenario, index: number) => (
    <Card
      key={index}
      className={`cursor-pointer transition-all duration-200 ${
        filters.scenario === scenario.scenario ? 'ring-2 ring-blue-500' : 'hover:shadow-md'
      }`}
      onClick={() => handleFilterChange('scenario', scenario.scenario)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium capitalize">{scenario.scenario}</CardTitle>
          <Badge style={{ backgroundColor: scenario.color, color: 'white' }} className="text-xs">
            {(scenario.likelihood * 100).toFixed(0)}% likely
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-2xl font-bold" style={{ color: scenario.color }}>
            {scenario.projected_value.toLocaleString()}
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Growth Rate: {scenario.growth_rate}%</span>
            <Badge variant="outline">
              {(scenario.confidence_score * 100).toFixed(0)}% confidence
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderGoalCard = (goal: any, index: number) => (
    <Card
      key={index}
      className={`cursor-pointer transition-all duration-200 ${
        selectedGoal === goal.goal_id ? 'ring-2 ring-blue-500' : 'hover:shadow-md'
      }`}
      onClick={() => handleGoalSelect(goal.goal_id)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Goal: {goal.target_value.toLocaleString()}
          </CardTitle>
          <Badge style={{ backgroundColor: goal.status_color, color: 'white' }} className="text-xs">
            {goal.status.replace('_', ' ')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: `${goal.progress_percentage}%`,
                backgroundColor: goal.status_color,
              }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span>{goal.progress_percentage.toFixed(1)}% complete</span>
            <span>{goal.days_remaining} days left</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Likelihood: {(goal.likelihood * 100).toFixed(0)}%
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderStrategies = () => (
    <div className="space-y-4">
      {strategies?.map((strategy: any, index: number) => (
        <Card key={index}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">{strategy.title}</CardTitle>
              <div className="flex space-x-2">
                <Badge
                  variant={
                    strategy.impact === 'high'
                      ? 'default'
                      : strategy.impact === 'medium'
                        ? 'secondary'
                        : 'outline'
                  }
                >
                  {strategy.impact} impact
                </Badge>
                <Badge variant="outline">{strategy.effort} effort</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">{strategy.description}</p>
            <div className="text-xs text-muted-foreground">Timeline: {strategy.timeline}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  // =====================================================
  // MAIN RENDER
  // =====================================================

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Forecasting Error</h3>
          <p className="text-muted-foreground mb-4">Unable to load growth forecasting data.</p>
          <Button onClick={handleGenerateNewForecast}>Retry Forecast</Button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center space-x-2">
              <BarChart3 className="w-8 h-8" />
              <span>Growth Forecasting</span>
            </h1>
            <p className="text-muted-foreground">
              Multi-scenario growth predictions with goal tracking and strategic recommendations
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handleStrategyToggle}>
              <Target className="w-4 h-4 mr-2" />
              {showStrategies ? 'Hide' : 'Show'} Strategies
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleGenerateNewForecast}
              disabled={isLoading}
            >
              <Zap className="w-4 h-4 mr-2" />
              Update Forecast
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Forecast Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label>Growth Metric</Label>
                <Select
                  value={filters.metric}
                  onValueChange={(value) => handleFilterChange('metric', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(METRIC_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Timeframe</Label>
                <Select
                  value={filters.timeframe}
                  onValueChange={(value) => handleFilterChange('timeframe', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIMEFRAME_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={filters.includeGoals}
                    onCheckedChange={(value) => handleFilterChange('includeGoals', value)}
                  />
                  <Label>Show Goals</Label>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={filters.showConfidenceInterval}
                    onCheckedChange={(value) => handleFilterChange('showConfidenceInterval', value)}
                  />
                  <Label>Confidence Intervals</Label>
                </div>
              </div>

              {filters.scenario === 'custom' && (
                <div className="space-y-2">
                  <Label>Custom Growth Rate: {filters.customGrowthRate || 5}%</Label>
                  <Slider
                    value={[filters.customGrowthRate || 5]}
                    onValueChange={(value) => handleFilterChange('customGrowthRate', value[0])}
                    max={50}
                    min={-10}
                    step={0.5}
                    className="w-full"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <>
            {/* Scenario Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {forecasts?.map(renderScenarioCard)}
            </div>

            {/* Main Chart */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Growth Forecast - {METRIC_LABELS[filters.metric]}</CardTitle>
                  {selectedScenarioData && (
                    <Badge style={{ backgroundColor: selectedScenarioData.color, color: 'white' }}>
                      {selectedScenarioData.scenario} scenario
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value: any) => [value?.toLocaleString(), '']} />
                    <Legend />

                    {forecasts?.map((forecast: any, index: number) => (
                      <Line
                        key={forecast.scenario}
                        type="monotone"
                        dataKey={forecast.scenario}
                        stroke={forecast.color}
                        strokeWidth={filters.scenario === forecast.scenario ? 3 : 2}
                        strokeOpacity={filters.scenario === forecast.scenario ? 1 : 0.6}
                        name={forecast.scenario}
                        dot={{ fill: forecast.color, r: 4 }}
                      />
                    ))}

                    {/* Goal reference lines */}
                    {filters.includeGoals &&
                      goalProgress?.map((goal: any, index: number) => (
                        <ReferenceLine
                          key={goal.goal_id}
                          y={goal.target_value}
                          stroke={goal.status_color}
                          strokeDasharray="5 5"
                          label={{
                            value: `Goal: ${goal.target_value.toLocaleString()}`,
                            position: 'topRight',
                          }}
                        />
                      ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Goals and Strategies */}
            <Tabs defaultValue="goals" className="space-y-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="goals">Goals & Progress</TabsTrigger>
                <TabsTrigger value="strategies">Growth Strategies</TabsTrigger>
              </TabsList>

              <TabsContent value="goals" className="space-y-6">
                {filters.includeGoals && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {goalProgress?.map(renderGoalCard)}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="strategies" className="space-y-6">
                {showStrategies && renderStrategies()}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default GrowthForecastingChart;
