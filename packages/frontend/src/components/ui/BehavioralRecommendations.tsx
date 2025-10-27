// 🤖 Behavioral Recommendations Component
// Implementation of US-096: Behavior-based recommendations
// Elite engineering standards with real-time behavioral tracking and adaptive learning

'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  Activity,
  BarChart3,
  Bookmark,
  Brain,
  ChevronRight,
  Clock,
  Eye,
  Heart,
  MousePointer,
  Play,
  RefreshCw,
  Share2,
  TrendingUp,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

// Types for behavioral analysis
interface BehaviorPattern {
  userId: string;
  sessionId: string;
  patterns: {
    browsingPattern: 'explorer' | 'focused' | 'casual' | 'researcher';
    engagementStyle: 'quick' | 'deep' | 'social' | 'passive';
    contentConsumption: 'binge' | 'regular' | 'occasional' | 'sporadic';
    timePreference: 'morning' | 'afternoon' | 'evening' | 'night' | 'varied';
    devicePreference: 'mobile' | 'desktop' | 'tablet' | 'mixed';
  };
  metrics: {
    avgSessionDuration: number;
    avgContentTime: number;
    interactionFrequency: number;
    scrollVelocity: number;
    clickPatterns: number[];
    returnFrequency: number;
  };
  preferences: {
    categoryAffinity: Record<string, number>;
    creatorAffinity: Record<string, number>;
    topicInterest: Record<string, number>;
    contentTypePreference: Record<string, number>;
  };
  confidence: number;
  lastUpdated: Date;
  sampleSize: number;
}

interface BehavioralRecommendation {
  id: string;
  userId: string;
  contentId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  contentType: 'article' | 'video' | 'audio' | 'image' | 'live' | 'course';
  creatorName: string;
  category: string;
  tags: string[];
  behaviorScore: number;
  adaptationScore: number;
  reason: string;
  behaviorFactors: string[];
  generatedAt: Date;
  metadata: {
    estimatedReadTime?: number;
    difficulty?: string;
    isPremium: boolean;
    viewCount: number;
    engagementRate?: number;
  };
}

interface BehavioralAnalysisProps {
  userId: string;
  enableRealTimeTracking?: boolean;
  enablePatternRecognition?: boolean;
  enableAdaptiveLearning?: boolean;
  onPatternDetected?: (pattern: BehaviorPattern) => void;
  className?: string;
}

// Mock behavioral data
const mockBehaviorPattern: BehaviorPattern = {
  userId: 'user_123',
  sessionId: 'session_456',
  patterns: {
    browsingPattern: 'explorer',
    engagementStyle: 'deep',
    contentConsumption: 'regular',
    timePreference: 'evening',
    devicePreference: 'desktop',
  },
  metrics: {
    avgSessionDuration: 1847, // seconds
    avgContentTime: 312,
    interactionFrequency: 2.3,
    scrollVelocity: 1.4,
    clickPatterns: [100, 250, 180, 320, 150],
    returnFrequency: 0.78,
  },
  preferences: {
    categoryAffinity: {
      'AI & Technology': 0.89,
      'Creator Economy': 0.76,
      'Blockchain Development': 0.82,
      'Content Creation': 0.71,
    },
    creatorAffinity: {
      'Sarah Chen': 0.94,
      'Mike Rodriguez': 0.87,
      'Alex Thompson': 0.73,
    },
    topicInterest: {
      ai: 0.91,
      'content-creation': 0.84,
      blockchain: 0.78,
      productivity: 0.69,
    },
    contentTypePreference: {
      article: 0.78,
      video: 0.91,
      audio: 0.45,
      course: 0.82,
    },
  },
  confidence: 0.87,
  lastUpdated: new Date(),
  sampleSize: 142,
};

const mockBehavioralRecommendations: BehavioralRecommendation[] = [
  {
    id: 'behavioral_rec_001',
    userId: 'user_123',
    contentId: 'content_004',
    title: 'Deep Dive: Neural Networks for Content Recommendation',
    description:
      'An in-depth exploration of how neural networks power modern recommendation systems, with practical examples.',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=300&h=200&fit=crop',
    contentType: 'video',
    creatorName: 'Dr. Emily Watson',
    category: 'AI & Technology',
    tags: ['neural-networks', 'machine-learning', 'deep-learning', 'recommendations'],
    behaviorScore: 0.94,
    adaptationScore: 0.88,
    reason: 'Matches your deep engagement style and AI interests',
    behaviorFactors: [
      'Deep engagement pattern',
      'Evening consumption',
      'Video preference',
      'Technical content affinity',
    ],
    generatedAt: new Date(),
    metadata: {
      estimatedReadTime: 35,
      difficulty: 'advanced',
      isPremium: true,
      viewCount: 1847,
      engagementRate: 0.34,
    },
  },
  {
    id: 'behavioral_rec_002',
    userId: 'user_123',
    contentId: 'content_005',
    title: 'Building Creator Communities: A Strategic Approach',
    description:
      'Learn how successful creators build and nurture engaged communities around their content.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1556740758-90de374c12ad?w=300&h=200&fit=crop',
    contentType: 'course',
    creatorName: 'Marcus Johnson',
    category: 'Creator Economy',
    tags: ['community-building', 'creator-economy', 'engagement', 'strategy'],
    behaviorScore: 0.89,
    adaptationScore: 0.91,
    reason: 'Your explorer pattern suggests interest in comprehensive content',
    behaviorFactors: [
      'Explorer browsing pattern',
      'Course content preference',
      'Creator economy interest',
    ],
    generatedAt: new Date(),
    metadata: {
      estimatedReadTime: 120,
      difficulty: 'intermediate',
      isPremium: false,
      viewCount: 3421,
      engagementRate: 0.28,
    },
  },
  {
    id: 'behavioral_rec_003',
    userId: 'user_123',
    contentId: 'content_006',
    title: 'Smart Contracts on Bitcoin: Lightning Network Integration',
    description:
      'Explore advanced smart contract capabilities on Bitcoin and their integration with Lightning Network.',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=300&h=200&fit=crop',
    contentType: 'article',
    creatorName: 'Alex Rivera',
    category: 'Blockchain Development',
    tags: ['bitcoin', 'lightning-network', 'smart-contracts', 'development'],
    behaviorScore: 0.86,
    adaptationScore: 0.83,
    reason: 'Aligns with your technical interests and reading patterns',
    behaviorFactors: [
      'Technical content engagement',
      'Blockchain affinity',
      'Regular consumption pattern',
    ],
    generatedAt: new Date(),
    metadata: {
      estimatedReadTime: 18,
      difficulty: 'advanced',
      isPremium: true,
      viewCount: 2156,
      engagementRate: 0.31,
    },
  },
];

// Behavioral Pattern Visualization Component
const BehaviorPatternCard: React.FC<{ pattern: BehaviorPattern }> = ({ pattern }) => {
  const getPatternColor = (pattern: string) => {
    const colors = {
      explorer: 'bg-blue-100 text-blue-700',
      focused: 'bg-green-100 text-green-700',
      casual: 'bg-yellow-100 text-yellow-700',
      researcher: 'bg-purple-100 text-purple-700',
      quick: 'bg-orange-100 text-orange-700',
      deep: 'bg-indigo-100 text-indigo-700',
      social: 'bg-pink-100 text-pink-700',
      passive: 'bg-gray-100 text-gray-700',
    };
    return colors[pattern as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-600" />
          Behavioral Profile
          <Badge variant="outline" className="ml-auto">
            {Math.round(pattern.confidence * 100)}% confidence
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-600">Browsing Pattern</label>
            <Badge className={getPatternColor(pattern.patterns.browsingPattern)}>
              {pattern.patterns.browsingPattern}
            </Badge>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-600">Engagement Style</label>
            <Badge className={getPatternColor(pattern.patterns.engagementStyle)}>
              {pattern.patterns.engagementStyle}
            </Badge>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-600">Content Consumption</label>
            <Badge className={getPatternColor(pattern.patterns.contentConsumption)}>
              {pattern.patterns.contentConsumption}
            </Badge>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-600">Time Preference</label>
            <Badge className={getPatternColor(pattern.patterns.timePreference)}>
              {pattern.patterns.timePreference}
            </Badge>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">Engagement Metrics</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Avg Session Duration</span>
              <span>{Math.round(pattern.metrics.avgSessionDuration / 60)}m</span>
            </div>
            <Progress value={(pattern.metrics.avgSessionDuration / 3600) * 100} className="h-2" />

            <div className="flex justify-between text-sm">
              <span>Return Frequency</span>
              <span>{Math.round(pattern.metrics.returnFrequency * 100)}%</span>
            </div>
            <Progress value={pattern.metrics.returnFrequency * 100} className="h-2" />

            <div className="flex justify-between text-sm">
              <span>Interaction Rate</span>
              <span>{pattern.metrics.interactionFrequency.toFixed(1)}/min</span>
            </div>
            <Progress value={(pattern.metrics.interactionFrequency / 5) * 100} className="h-2" />
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">Content Preferences</h4>
          <div className="space-y-2">
            {Object.entries(pattern.preferences.categoryAffinity).map(([category, score]) => (
              <div key={category} className="flex justify-between items-center text-sm">
                <span className="truncate">{category}</span>
                <div className="flex items-center gap-2">
                  <Progress value={score * 100} className="h-2 w-16" />
                  <span className="text-xs font-medium w-8">{Math.round(score * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs text-gray-500 pt-2 border-t">
          Sample size: {pattern.sampleSize} interactions • Last updated:{' '}
          {pattern.lastUpdated.toLocaleDateString()}
        </div>
      </CardContent>
    </Card>
  );
};

// Behavioral Recommendation Card Component
const BehavioralRecommendationCard: React.FC<{
  recommendation: BehavioralRecommendation;
  onInteraction: (id: string, action: string) => void;
}> = ({ recommendation, onInteraction }) => {
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleAction = (action: string) => {
    onInteraction(recommendation.id, action);

    if (action === 'like') setIsLiked(!isLiked);
    if (action === 'save') setIsSaved(!isSaved);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-blue-500">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {recommendation.contentType}
                </Badge>
                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                  {Math.round(recommendation.behaviorScore * 100)}% behavioral match
                </Badge>
                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                  {Math.round(recommendation.adaptationScore * 100)}% adaptive
                </Badge>
                {recommendation.metadata.isPremium && (
                  <Badge
                    variant="default"
                    className="bg-gradient-to-r from-blue-500 to-purple-500 text-white"
                  >
                    Premium
                  </Badge>
                )}
              </div>

              <CardTitle
                className="text-lg font-semibold hover:text-blue-600 cursor-pointer transition-colors"
                onClick={() => handleAction('click')}
              >
                {recommendation.title}
              </CardTitle>

              {recommendation.description && (
                <p className="text-sm text-gray-600 line-clamp-2">{recommendation.description}</p>
              )}

              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {recommendation.metadata.viewCount.toLocaleString()}
                </span>
                {recommendation.metadata.estimatedReadTime && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {recommendation.metadata.estimatedReadTime}m
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {Math.round((recommendation.metadata.engagementRate || 0) * 100)}% engagement
                </span>
              </div>
            </div>

            {recommendation.thumbnailUrl && (
              <div className="ml-4">
                <img
                  src={recommendation.thumbnailUrl}
                  alt={recommendation.title}
                  className="w-20 h-20 object-cover rounded-lg"
                  loading="lazy"
                />
              </div>
            )}
          </div>

          {/* Behavioral Explanation */}
          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-700">Behavioral Match</span>
            </div>
            <p className="text-sm text-blue-600 mb-2">{recommendation.reason}</p>
            <div className="flex flex-wrap gap-1">
              {recommendation.behaviorFactors.map((factor, index) => (
                <Badge key={index} variant="outline" className="text-xs bg-blue-100 text-blue-600">
                  {factor}
                </Badge>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAction('like')}
                  className={cn('h-8 px-2', isLiked && 'text-red-500 bg-red-50')}
                >
                  <Heart className={cn('h-4 w-4', isLiked && 'fill-current')} />
                  <span className="text-xs ml-1">Like</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAction('save')}
                  className={cn('h-8 px-2', isSaved && 'text-blue-500 bg-blue-50')}
                >
                  <Bookmark className={cn('h-4 w-4', isSaved && 'fill-current')} />
                  <span className="text-xs ml-1">Save</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => handleAction('share')}
                >
                  <Share2 className="h-4 w-4" />
                  <span className="text-xs ml-1">Share</span>
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Creator:</span>
                <span className="text-xs font-medium">{recommendation.creatorName}</span>
              </div>
            </div>

            <Button
              variant="default"
              size="sm"
              onClick={() => handleAction('view')}
              className="h-8 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
            >
              {recommendation.contentType === 'video' ? (
                <Play className="h-3 w-3 mr-1" />
              ) : (
                <ChevronRight className="h-3 w-3 mr-1" />
              )}
              View
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// Main BehavioralRecommendations component
export const BehavioralRecommendations: React.FC<BehavioralAnalysisProps> = ({
  userId,
  enableRealTimeTracking = true,
  enablePatternRecognition = true,
  enableAdaptiveLearning = true,
  onPatternDetected,
  className,
}) => {
  const [behaviorPattern, setBehaviorPattern] = useState<BehaviorPattern | null>(null);
  const [recommendations, setRecommendations] = useState<BehavioralRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(enableRealTimeTracking);
  const [patternRecognition, setPatternRecognition] = useState(enablePatternRecognition);
  const [adaptiveLearning, setAdaptiveLearning] = useState(enableAdaptiveLearning);

  const trackingIntervalRef = useRef<NodeJS.Timeout>();
  const interactionCountRef = useRef(0);

  // 7.2.1: Track user behavior in real-time
  const trackBehavior = useCallback(() => {
    if (!tracking) return;

    // Simulate behavioral tracking
    const interactions = ['scroll', 'click', 'hover', 'view'];
    const randomInteraction = interactions[Math.floor(Math.random() * interactions.length)];

    interactionCountRef.current++;

    // Update behavior pattern every 10 interactions
    if (interactionCountRef.current % 10 === 0) {
      const updatedPattern = {
        ...mockBehaviorPattern,
        lastUpdated: new Date(),
        sampleSize: mockBehaviorPattern.sampleSize + interactionCountRef.current,
      };

      setBehaviorPattern(updatedPattern);

      if (onPatternDetected) {
        onPatternDetected(updatedPattern);
      }
    }
  }, [tracking, onPatternDetected]);

  // 7.2.2: Analyze interaction patterns
  const analyzeInteractionPatterns = useCallback(async () => {
    try {
      setLoading(true);

      // Simulate pattern analysis
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setBehaviorPattern(mockBehaviorPattern);
      setRecommendations(mockBehavioralRecommendations);

      if (onPatternDetected) {
        onPatternDetected(mockBehaviorPattern);
      }
    } catch (error) {
      toast({
        title: 'Analysis Error',
        description: 'Failed to analyze behavioral patterns',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [onPatternDetected]);

  // 7.2.3: Implement ML model training
  const trainAdaptiveModel = useCallback(async () => {
    if (!adaptiveLearning) return;

    try {
      // Simulate model training
      await new Promise((resolve) => setTimeout(resolve, 2000));

      toast({
        title: 'Model Updated',
        description: 'Adaptive learning model has been retrained with latest behavioral data',
      });

      // Refresh recommendations after model update
      await analyzeInteractionPatterns();
    } catch (error) {
      toast({
        title: 'Training Error',
        description: 'Failed to update adaptive model',
        variant: 'destructive',
      });
    }
  }, [adaptiveLearning, analyzeInteractionPatterns]);

  // Handle interaction tracking
  const handleInteraction = useCallback(
    (recommendationId: string, action: string) => {
      console.log('Behavioral interaction:', { recommendationId, action });

      // Track the interaction
      trackBehavior();

      // Trigger adaptive learning for significant interactions
      if (['like', 'save', 'view'].includes(action)) {
        trainAdaptiveModel();
      }
    },
    [trackBehavior, trainAdaptiveModel]
  );

  // Setup real-time tracking
  useEffect(() => {
    if (tracking) {
      trackingIntervalRef.current = setInterval(trackBehavior, 5000); // Track every 5 seconds
    } else {
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
      }
    }

    return () => {
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
      }
    };
  }, [tracking, trackBehavior]);

  // Initial analysis
  useEffect(() => {
    analyzeInteractionPatterns();
  }, [analyzeInteractionPatterns]);

  if (loading) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded w-3/4" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded" />
                <div className="h-4 bg-gray-200 rounded w-2/3" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-500" />
            Behavioral Recommendations
            {tracking && <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />}
          </h2>
          <p className="text-sm text-gray-600">
            AI-powered recommendations based on your real-time behavior patterns
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={analyzeInteractionPatterns}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Analysis
          </Button>
        </div>
      </div>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Behavioral Analysis Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <MousePointer className="h-4 w-4" />
                Real-time Tracking
              </label>
              <Switch checked={tracking} onCheckedChange={setTracking} />
              <p className="text-xs text-gray-500">
                Track interactions and behavior patterns in real-time
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Pattern Recognition
              </label>
              <Switch checked={patternRecognition} onCheckedChange={setPatternRecognition} />
              <p className="text-xs text-gray-500">Automatically detect behavioral patterns</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Adaptive Learning
              </label>
              <Switch checked={adaptiveLearning} onCheckedChange={setAdaptiveLearning} />
              <p className="text-xs text-gray-500">
                Continuously improve recommendations based on feedback
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="recommendations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="patterns">Behavior Patterns</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="recommendations" className="space-y-4">
          {recommendations.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <Activity className="h-12 w-12 mx-auto text-gray-400" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-600">Building Your Profile</h3>
                    <p className="text-sm text-gray-500">
                      Continue interacting with content to get behavioral recommendations!
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {recommendations.map((recommendation) => (
                <BehavioralRecommendationCard
                  key={recommendation.id}
                  recommendation={recommendation}
                  onInteraction={handleInteraction}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="patterns">
          {behaviorPattern ? (
            <BehaviorPatternCard pattern={behaviorPattern} />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <BarChart3 className="h-12 w-12 mx-auto text-gray-400" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-600">No Patterns Detected</h3>
                    <p className="text-sm text-gray-500">
                      More interaction data needed to identify behavioral patterns.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {interactionCountRef.current}
                  </div>
                  <p className="text-sm text-gray-600">Interactions Tracked</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {behaviorPattern ? Math.round(behaviorPattern.confidence * 100) : 0}%
                  </div>
                  <p className="text-sm text-gray-600">Pattern Confidence</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{recommendations.length}</div>
                  <p className="text-sm text-gray-600">Behavioral Matches</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {behaviorPattern ? behaviorPattern.sampleSize : 0}
                  </div>
                  <p className="text-sm text-gray-600">Sample Size</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BehavioralRecommendations;
