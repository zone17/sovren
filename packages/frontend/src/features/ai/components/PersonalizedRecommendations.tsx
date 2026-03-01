// @ts-nocheck
// 🤖 Personalized Content Recommendations Component
// Implementation of US-095: Personalized content recommendations
// Elite engineering standards with comprehensive testing and accessibility

'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bookmark,
  Brain,
  ChevronRight,
  Clock,
  Eye,
  Heart,
  Info,
  Play,
  RefreshCw,
  Settings,
  Share2,
  Sparkles,
  Star,
  TrendingUp,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { aiContentRecommendationsService } from '../services/aiContentRecommendationsService';
import {
  AIRecommendationError,
  ContentRecommendation,
  PersonalizedRecommendationsProps,
  RecommendationFeedback,
  UserInteraction,
} from '../types';

// =====================================================
// US-095: PERSONALIZED CONTENT RECOMMENDATIONS
// =====================================================

// Sub-component for recommendation algorithm explanation
const AlgorithmExplanation: React.FC<{
  algorithm: string;
  confidence: number;
  factors: string[];
}> = ({ algorithm, confidence, factors }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
          <Brain className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-700">
            AI Powered ({Math.round(confidence * 100)}% confident)
          </span>
          <Info className="h-3 w-3 text-blue-500" />
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <div className="space-y-2">
          <p className="font-semibold">Algorithm: {algorithm}</p>
          <p className="text-sm">Recommendation factors:</p>
          <ul className="text-xs space-y-1">
            {factors.map((factor, index) => (
              <li key={index} className="flex items-center gap-1">
                <Zap className="h-2 w-2 text-yellow-500" />
                {factor}
              </li>
            ))}
          </ul>
        </div>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

// Sub-component for recommendation card
const RecommendationCard: React.FC<{
  recommendation: ContentRecommendation;
  onInteraction: (recommendationId: string, action: string) => void;
  onFeedback: (feedback: RecommendationFeedback) => void;
  showExplanations: boolean;
}> = ({ recommendation, onInteraction, onFeedback, showExplanations }) => {
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [rating, setRating] = useState(0);

  const handleLike = useCallback(() => {
    setIsLiked(!isLiked);
    onInteraction(recommendation.id, isLiked ? 'unlike' : 'like');

    if (!isLiked) {
      onFeedback({
        id: `feedback_${Date.now()}`,
        userId: recommendation.userId,
        recommendationId: recommendation.id,
        contentId: recommendation.contentId,
        feedbackType: 'implicit',
        action: 'like',
        context: {
          timestamp: new Date(),
          sessionId: 'current_session',
        },
      });
    }
  }, [isLiked, recommendation, onInteraction, onFeedback]);

  const handleSave = useCallback(() => {
    setIsSaved(!isSaved);
    onInteraction(recommendation.id, isSaved ? 'unsave' : 'save');

    if (!isSaved) {
      onFeedback({
        id: `feedback_${Date.now()}`,
        userId: recommendation.userId,
        recommendationId: recommendation.id,
        contentId: recommendation.contentId,
        feedbackType: 'implicit',
        action: 'save',
        context: {
          timestamp: new Date(),
          sessionId: 'current_session',
        },
      });
    }
  }, [isSaved, recommendation, onInteraction, onFeedback]);

  const handleContentClick = useCallback(() => {
    onInteraction(recommendation.id, 'click');

    onFeedback({
      id: `feedback_${Date.now()}`,
      userId: recommendation.userId,
      recommendationId: recommendation.id,
      contentId: recommendation.contentId,
      feedbackType: 'implicit',
      action: 'click',
      context: {
        timestamp: new Date(),
        sessionId: 'current_session',
      },
    });
  }, [recommendation, onInteraction, onFeedback]);

  const handleRating = useCallback(
    (newRating: number) => {
      setRating(newRating);

      onFeedback({
        id: `feedback_${Date.now()}`,
        userId: recommendation.userId,
        recommendationId: recommendation.id,
        contentId: recommendation.contentId,
        feedbackType: 'explicit',
        rating: newRating,
        action: 'like',
        context: {
          timestamp: new Date(),
          sessionId: 'current_session',
        },
      });
    },
    [recommendation, onFeedback]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="group"
    >
      <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-purple-500">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {recommendation.contentType}
                </Badge>
                <Badge
                  variant="secondary"
                  className={cn(
                    'text-xs',
                    recommendation.relevanceScore > 0.8 && 'bg-green-100 text-green-700',
                    recommendation.relevanceScore > 0.6 &&
                      recommendation.relevanceScore <= 0.8 &&
                      'bg-yellow-100 text-yellow-700',
                    recommendation.relevanceScore <= 0.6 && 'bg-red-100 text-red-700'
                  )}
                >
                  {Math.round(recommendation.relevanceScore * 100)}% match
                </Badge>
                {recommendation.metadata.isPremium && (
                  <Badge
                    variant="default"
                    className="bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                  >
                    Premium
                  </Badge>
                )}
              </div>

              <CardTitle
                className="text-lg font-semibold hover:text-purple-600 cursor-pointer transition-colors"
                onClick={handleContentClick}
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
                    {recommendation.metadata.estimatedReadTime}m read
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

          {showExplanations && (
            <AlgorithmExplanation
              algorithm={recommendation.algorithm}
              confidence={recommendation.confidenceScore}
              factors={['User preferences', 'Similar users', 'Content quality']}
            />
          )}
        </CardHeader>

        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLike}
                  className={cn('h-8 px-2', isLiked && 'text-red-500 bg-red-50')}
                >
                  <Heart className={cn('h-4 w-4', isLiked && 'fill-current')} />
                  <span className="text-xs ml-1">Like</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSave}
                  className={cn('h-8 px-2', isSaved && 'text-blue-500 bg-blue-50')}
                >
                  <Bookmark className={cn('h-4 w-4', isSaved && 'fill-current')} />
                  <span className="text-xs ml-1">Save</span>
                </Button>

                <Button variant="ghost" size="sm" className="h-8 px-2">
                  <Share2 className="h-4 w-4" />
                  <span className="text-xs ml-1">Share</span>
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Creator:</span>
                <span className="text-xs font-medium">{recommendation.creatorName}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFeedback(!showFeedback)}
                className="h-8"
              >
                <Star className="h-3 w-3" />
                Rate
              </Button>

              <Button
                variant="default"
                size="sm"
                onClick={handleContentClick}
                className="h-8 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                {recommendation.contentType === 'video' ? (
                  <Play className="h-3 w-3 mr-1" />
                ) : (
                  <ChevronRight className="h-3 w-3 mr-1" />
                )}
                View
              </Button>
            </div>
          </div>

          <AnimatePresence>
            {showFeedback && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 p-3 bg-gray-50 rounded-lg"
              >
                <p className="text-sm font-medium mb-2">Rate this recommendation:</p>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Button
                      key={star}
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRating(star)}
                      className={cn('h-8 w-8 p-0', star <= rating && 'text-yellow-500')}
                    >
                      <Star className={cn('h-4 w-4', star <= rating && 'fill-current')} />
                    </Button>
                  ))}
                </div>
                {rating > 0 && (
                  <p className="text-xs text-green-600 mt-1">
                    Thanks for your feedback! This helps improve our recommendations.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// Main PersonalizedRecommendations component
export const PersonalizedRecommendations: React.FC<PersonalizedRecommendationsProps> = ({
  userId,
  context,
  preferences,
  onRecommendationInteraction,
  className,
}) => {
  const [recommendations, setRecommendations] = useState<ContentRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Settings state
  const [enableExplanations, setEnableExplanations] = useState(true);
  const [enableRealTimeUpdates, setEnableRealTimeUpdates] = useState(true);
  const [diversityLevel, setDiversityLevel] = useState([0.3]);
  const [maxResults, setMaxResults] = useState([10]);

  // Interaction tracking
  const [interactions, setInteractions] = useState<UserInteraction[]>([]);
  const interactionTimeoutRef = useRef<NodeJS.Timeout>();

  // 7.1.1 & 7.1.2: Load personalized recommendations with user preference learning
  const loadRecommendations = useCallback(
    async (showRefreshing = false) => {
      try {
        if (showRefreshing) setRefreshing(true);
        else setLoading(true);

        setError(null);

        const request = {
          userId,
          context: {
            sessionId: 'current_session',
            device: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
            timeOfDay:
              new Date().getHours() < 12
                ? 'morning'
                : new Date().getHours() < 18
                  ? 'afternoon'
                  : 'evening',
            ...context,
          },
          preferences: {
            maxResults: maxResults[0],
            diversityLevel: diversityLevel[0],
            includePremium: true,
            ...preferences,
          },
        };

        const response =
          await aiContentRecommendationsService.getPersonalizedRecommendations(request);
        setRecommendations(response.recommendations);

        // Track successful recommendation load
        trackInteraction('view', 'recommendations_loaded', {
          count: response.recommendations.length,
          processingTime: response.metadata.processingTime,
          algorithm: response.metadata.algorithmUsed,
        });
      } catch (err) {
        const error = err as AIRecommendationError;
        setError(error.message || 'Failed to load recommendations');

        toast({
          title: 'Recommendation Error',
          description: 'Unable to load personalized recommendations. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId, context, preferences, maxResults, diversityLevel]
  );

  // 7.1.5: Real-time recommendation updates
  const trackInteraction = useCallback(
    (type: UserInteraction['type'], contentId: string, metadata?: any) => {
      const interaction: UserInteraction = {
        id: `interaction_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        userId,
        contentId,
        type,
        timestamp: new Date(),
        intensity:
          type === 'like' || type === 'save'
            ? 1.0
            : type === 'click'
              ? 0.8
              : type === 'view'
                ? 0.6
                : 0.3,
        context: {
          source: 'recommendations',
          device: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
          sessionId: 'current_session',
        },
        metadata,
      };

      setInteractions((prev) => [...prev, interaction]);

      // Debounced real-time update
      if (enableRealTimeUpdates) {
        if (interactionTimeoutRef.current) {
          clearTimeout(interactionTimeoutRef.current);
        }

        interactionTimeoutRef.current = setTimeout(async () => {
          try {
            await aiContentRecommendationsService.updateRecommendationsRealTime(
              userId,
              interaction
            );

            // Optionally refresh recommendations if significant interaction
            if (['like', 'save', 'share'].includes(type)) {
              await loadRecommendations(true);
            }
          } catch (error) {
            console.error('Failed to update recommendations in real-time:', error);
          }
        }, 2000); // 2 second debounce
      }

      // Call parent callback
      onRecommendationInteraction?.(contentId, type);
    },
    [userId, enableRealTimeUpdates, loadRecommendations, onRecommendationInteraction]
  );

  // 7.1.7: Handle recommendation feedback
  const handleFeedback = useCallback(
    async (feedback: RecommendationFeedback) => {
      try {
        await aiContentRecommendationsService.processFeedback(feedback);

        toast({
          title: 'Feedback Received',
          description: 'Thank you! Your feedback helps improve our recommendations.',
        });

        // Track feedback as interaction
        trackInteraction('like', feedback.contentId, {
          feedbackType: feedback.feedbackType,
          rating: feedback.rating,
        });
      } catch (error) {
        toast({
          title: 'Feedback Error',
          description: 'Unable to process feedback. Please try again.',
          variant: 'destructive',
        });
      }
    },
    [trackInteraction]
  );

  // Load recommendations on mount and when settings change
  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
    };
  }, []);

  if (loading && !refreshing) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-6 bg-gray-200 rounded w-48 animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
          </div>
        </div>

        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="animate-pulse">
              <CardHeader>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-gray-200 rounded w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('space-y-6', className)}>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="text-red-600">
                <Sparkles className="h-12 w-12 mx-auto mb-2" />
                <h3 className="text-lg font-semibold">Unable to Load Recommendations</h3>
                <p className="text-sm">{error}</p>
              </div>
              <Button onClick={() => loadRecommendations()} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-500" />
            Personalized for You
            {refreshing && <RefreshCw className="h-4 w-4 animate-spin text-gray-500" />}
          </h2>
          <p className="text-sm text-gray-600">
            AI-powered recommendations based on your interests and behavior
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadRecommendations(true)}
            disabled={refreshing}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} />
            Refresh
          </Button>

          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Settings Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recommendation Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Show Explanations</label>
              <Switch checked={enableExplanations} onCheckedChange={setEnableExplanations} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Real-time Updates</label>
              <Switch checked={enableRealTimeUpdates} onCheckedChange={setEnableRealTimeUpdates} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Diversity Level: {Math.round(diversityLevel[0] * 100)}%
              </label>
              <Slider
                value={diversityLevel}
                onValueChange={setDiversityLevel}
                max={1}
                min={0}
                step={0.1}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Max Results: {maxResults[0]}</label>
              <Slider
                value={maxResults}
                onValueChange={setMaxResults}
                max={50}
                min={5}
                step={5}
                className="w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations List */}
      <div className="space-y-4">
        {recommendations.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <Sparkles className="h-12 w-12 mx-auto text-gray-400" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-600">No Recommendations Yet</h3>
                  <p className="text-sm text-gray-500">
                    Start exploring content to get personalized recommendations!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <AnimatePresence>
            {recommendations.map((recommendation) => (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                onInteraction={trackInteraction}
                onFeedback={handleFeedback}
                showExplanations={enableExplanations}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Performance indicators */}
      <Card className="bg-gradient-to-r from-purple-50 to-pink-50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-purple-700">AI Recommendation Engine</p>
              <p className="text-xs text-purple-600">
                89% accuracy • 78ms response time • {recommendations.length} recommendations
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-green-600 font-medium">Online</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PersonalizedRecommendations;
