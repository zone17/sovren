// 🤖 AI ANALYTICS DASHBOARD
// Enterprise-grade AI insights visualization inspired by Google/Netflix/Stripe

import React, { useEffect, useState } from 'react';
import { predictiveAnalytics } from '../ai/predictiveAnalytics';

interface DashboardMetrics {
  userBehaviorPredictions: any[];
  performanceForecasts: any[];
  featureInsights: any[];
  anomalies: any[];
  recommendations: any;
}

interface AnomalyProps {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  confidence: number;
  suggestedActions: string[];
}

// 🎨 SEVERITY COLORS
const getSeverityColor = (severity: string): string => {
  const colors = {
    low: 'bg-green-100 text-green-800 border-green-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    critical: 'bg-red-100 text-red-800 border-red-200',
  };
  return colors[severity as keyof typeof colors] || colors.low;
};

// 🔮 CONFIDENCE BADGE
const ConfidenceBadge: React.FC<{ confidence: number }> = ({ confidence }) => {
  const getConfidenceColor = (conf: number): string => {
    if (conf >= 90) return 'bg-green-100 text-green-800';
    if (conf >= 75) return 'bg-blue-100 text-blue-800';
    if (conf >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(confidence)}`}
    >
      {confidence.toFixed(1)}% confidence
    </span>
  );
};

// 📈 TREND INDICATOR
const TrendIndicator: React.FC<{ trend: 'improving' | 'degrading' | 'stable' | number }> = ({
  trend,
}) => {
  if (typeof trend === 'number') {
    const isPositive = trend > 0;
    return (
      <span className={`flex items-center ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? '📈' : '📉'}
        <span className="ml-1 text-sm">{(trend * 100).toFixed(1)}%</span>
      </span>
    );
  }

  const trendIcons = {
    improving: '📈',
    degrading: '📉',
    stable: '➡️',
  };

  const trendColors = {
    improving: 'text-green-600',
    degrading: 'text-red-600',
    stable: 'text-gray-600',
  };

  return (
    <span className={`flex items-center ${trendColors[trend]}`}>
      {trendIcons[trend]}
      <span className="ml-1 text-sm capitalize">{trend}</span>
    </span>
  );
};

// 🚨 ANOMALY CARD
const AnomalyCard: React.FC<{ anomaly: AnomalyProps }> = ({ anomaly }) => (
  <div className={`border rounded-lg p-4 ${getSeverityColor(anomaly.severity)}`}>
    <div className="flex justify-between items-start mb-2">
      <div className="flex items-center">
        <span className="text-lg mr-2">🚨</span>
        <h4 className="font-semibold">{anomaly.type.replace('_', ' ').toUpperCase()}</h4>
      </div>
      <span
        className={`px-2 py-1 rounded text-xs font-bold uppercase ${anomaly.severity === 'critical' ? 'bg-red-600 text-white' : ''}`}
      >
        {anomaly.severity}
      </span>
    </div>

    <p className="text-sm mb-3">{anomaly.description}</p>

    <div className="flex justify-between items-center mb-3">
      <ConfidenceBadge confidence={anomaly.confidence * 100} />
    </div>

    <div className="space-y-1">
      <h5 className="text-xs font-semibold uppercase tracking-wide">Suggested Actions:</h5>
      {anomaly.suggestedActions.map((action, index) => (
        <div key={index} className="text-xs flex items-center">
          <span className="mr-2">•</span>
          {action}
        </div>
      ))}
    </div>
  </div>
);

// 📊 PERFORMANCE FORECAST CARD
const PerformanceForecastCard: React.FC<{ forecast: any }> = ({ forecast }) => (
  <div className="bg-white rounded-lg shadow p-6 border">
    <div className="flex justify-between items-start mb-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">{forecast.metric}</h3>
        <p className="text-sm text-gray-600">Forecast for {forecast.timeframe}</p>
      </div>
      <TrendIndicator trend={forecast.trend} />
    </div>

    <div className="grid grid-cols-2 gap-4 mb-4">
      <div>
        <p className="text-xs text-gray-500">Current Value</p>
        <p className="text-2xl font-bold text-gray-900">{forecast.currentValue.toFixed(2)}</p>
      </div>
      <div>
        <p className="text-xs text-gray-500">Predicted Value</p>
        <p className="text-2xl font-bold text-blue-600">{forecast.predictedValue.toFixed(2)}</p>
      </div>
    </div>

    <div className="mb-4">
      <ConfidenceBadge confidence={forecast.confidence * 100} />
    </div>

    <div>
      <h4 className="text-sm font-medium text-gray-700 mb-2">Influencing Factors:</h4>
      <div className="flex flex-wrap gap-1">
        {forecast.factors.map((factor: string, index: number) => (
          <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
            {factor.replace('_', ' ')}
          </span>
        ))}
      </div>
    </div>
  </div>
);

// 🎯 USER BEHAVIOR PREDICTION CARD
const UserBehaviorCard: React.FC<{ pattern: any }> = ({ pattern }) => (
  <div className="bg-white rounded-lg shadow p-6 border">
    <div className="flex justify-between items-start mb-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">User Behavior Analysis</h3>
        <p className="text-sm text-gray-600">User: {pattern.userId}</p>
      </div>
      <span
        className={`px-3 py-1 rounded-full text-sm font-medium ${
          pattern.churnRisk === 'low'
            ? 'bg-green-100 text-green-800'
            : pattern.churnRisk === 'medium'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-red-100 text-red-800'
        }`}
      >
        {pattern.churnRisk} churn risk
      </span>
    </div>

    <div className="grid grid-cols-3 gap-4 mb-4">
      <div className="text-center">
        <p className="text-xs text-gray-500">Conversion Probability</p>
        <p className="text-xl font-bold text-green-600">
          {(pattern.conversionProbability * 100).toFixed(1)}%
        </p>
      </div>
      <div className="text-center">
        <p className="text-xs text-gray-500">Session Duration</p>
        <p className="text-xl font-bold text-blue-600">
          {Math.round(pattern.sessionDuration / 1000)}s
        </p>
      </div>
      <div className="text-center">
        <p className="text-xs text-gray-500">Scroll Depth</p>
        <p className="text-xl font-bold text-purple-600">{pattern.scrollDepth}%</p>
      </div>
    </div>

    <div className="flex justify-between items-center">
      <div>
        <p className="text-sm font-medium text-gray-700">Predicted Next Action:</p>
        <p className="text-lg font-semibold text-gray-900 capitalize">{pattern.nextAction}</p>
      </div>
      <ConfidenceBadge confidence={pattern.confidence * 100} />
    </div>
  </div>
);

// 🎨 FEATURE INSIGHT CARD
const FeatureInsightCard: React.FC<{ insight: any }> = ({ insight }) => (
  <div className="bg-white rounded-lg shadow p-6 border">
    <div className="flex justify-between items-start mb-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">{insight.feature}</h3>
        <p className="text-sm text-gray-600">{insight.userSegment.replace('_', ' ')}</p>
      </div>
      <div className="text-right">
        <p className="text-xs text-gray-500">Impact Score</p>
        <p className="text-2xl font-bold text-purple-600">{insight.impactScore.toFixed(1)}</p>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-4 mb-4">
      <div>
        <p className="text-xs text-gray-500">Usage</p>
        <p className="text-xl font-bold text-blue-600">{insight.usage.toFixed(1)}%</p>
      </div>
      <div>
        <p className="text-xs text-gray-500">Trend</p>
        <TrendIndicator trend={insight.trend} />
      </div>
    </div>

    <div className="p-3 bg-blue-50 rounded-lg">
      <p className="text-sm font-medium text-blue-800">💡 Optimization Suggestion:</p>
      <p className="text-sm text-blue-700">{insight.optimizationSuggestion}</p>
    </div>
  </div>
);

// 🎯 MAIN AI DASHBOARD COMPONENT
const AIDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    userBehaviorPredictions: [],
    performanceForecasts: [],
    featureInsights: [],
    anomalies: [],
    recommendations: null,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const loadAIInsights = async () => {
      try {
        setLoading(true);

        // Simulate some user sessions for demo
        const demoUserId = 'user_123';
        const sessionData = {
          duration: 45000,
          clicks: [{ timestamp: Date.now() }],
          maxScrollDepth: 75,
          deviceType: 'desktop',
          referrer: 'google',
        };

        const [userBehavior, performanceForecasts, featureInsights, anomalies, recommendations] =
          await Promise.all([
            predictiveAnalytics.predictUserBehavior(demoUserId, sessionData),
            Promise.all([
              predictiveAnalytics.forecastPerformance('LCP', '24h'),
              predictiveAnalytics.forecastPerformance('FID', '7d'),
              predictiveAnalytics.forecastPerformance('CLS', '1h'),
            ]),
            predictiveAnalytics.analyzeFeatureUsage(),
            predictiveAnalytics.detectAnomalies(),
            predictiveAnalytics.getRealtimeRecommendations(demoUserId),
          ]);

        setMetrics({
          userBehaviorPredictions: [userBehavior],
          performanceForecasts,
          featureInsights,
          anomalies,
          recommendations,
        });
      } catch (error) {
        console.error('Failed to load AI insights:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAIInsights();

    // Refresh insights every 5 minutes
    const interval = setInterval(loadAIInsights, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const tabs = [
    { id: 'overview', name: 'AI Overview', icon: '🤖' },
    { id: 'predictions', name: 'Predictions', icon: '🔮' },
    { id: 'anomalies', name: 'Anomalies', icon: '🚨' },
    { id: 'optimization', name: 'Optimization', icon: '⚡' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">🤖</div>
          <p className="text-gray-600">Loading AI insights...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 🎯 HEADER */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">🤖 AI Analytics Dashboard</h1>
            <p className="text-blue-100 mt-2">Advanced ML-powered insights and predictions</p>
          </div>
          <div className="text-right">
            <p className="text-blue-100 text-sm">Last Updated</p>
            <p className="font-semibold">{new Date().toLocaleTimeString()}</p>
          </div>
        </div>
      </div>

      {/* 📊 TABS */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* 📋 CONTENT */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="flex items-center">
                <span className="text-2xl mr-3">👥</span>
                <div>
                  <p className="text-sm text-gray-500">Active Users</p>
                  <p className="text-xl font-bold">1,247</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="flex items-center">
                <span className="text-2xl mr-3">🎯</span>
                <div>
                  <p className="text-sm text-gray-500">Conversion Rate</p>
                  <p className="text-xl font-bold">12.3%</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="flex items-center">
                <span className="text-2xl mr-3">⚡</span>
                <div>
                  <p className="text-sm text-gray-500">Performance Score</p>
                  <p className="text-xl font-bold">94</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <div className="flex items-center">
                <span className="text-2xl mr-3">🚨</span>
                <div>
                  <p className="text-sm text-gray-500">Active Alerts</p>
                  <p className="text-xl font-bold text-red-600">{metrics.anomalies.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Anomalies */}
          {metrics.anomalies.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">🚨 Active Anomalies</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {metrics.anomalies.slice(0, 4).map((anomaly, index) => (
                  <AnomalyCard key={index} anomaly={anomaly} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'predictions' && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">🔮 AI Predictions</h2>

          {/* User Behavior Predictions */}
          <div>
            <h3 className="text-lg font-medium mb-4">User Behavior Analysis</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {metrics.userBehaviorPredictions.map((pattern, index) => (
                <UserBehaviorCard key={index} pattern={pattern} />
              ))}
            </div>
          </div>

          {/* Performance Forecasts */}
          <div>
            <h3 className="text-lg font-medium mb-4">Performance Forecasts</h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {metrics.performanceForecasts.map((forecast, index) => (
                <PerformanceForecastCard key={index} forecast={forecast} />
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'anomalies' && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">🚨 Anomaly Detection</h2>

          {metrics.anomalies.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-6xl">✅</span>
              <h3 className="text-lg font-medium text-gray-900 mt-4">No Anomalies Detected</h3>
              <p className="text-gray-500">All systems are operating within normal parameters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {metrics.anomalies.map((anomaly, index) => (
                <AnomalyCard key={index} anomaly={anomaly} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'optimization' && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">⚡ Feature Optimization</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {metrics.featureInsights.map((insight, index) => (
              <FeatureInsightCard key={index} insight={insight} />
            ))}
          </div>

          {/* AI Recommendations */}
          {metrics.recommendations && (
            <div className="bg-blue-50 rounded-lg p-6 border">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">🎯 AI Recommendations</h3>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-blue-800">Personalized Content:</h4>
                  <p className="text-blue-700">
                    {metrics.recommendations.personalizedContent.length} suggestions available
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-blue-800">UI Optimizations:</h4>
                  <p className="text-blue-700">
                    {metrics.recommendations.uiOptimizations.length} improvements suggested
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-blue-800">Performance Hints:</h4>
                  <p className="text-blue-700">
                    {metrics.recommendations.performanceHints.length} optimizations identified
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIDashboard;
