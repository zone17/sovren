/**
 * 🤖 **RECOMMENDATION WIDGET COMPONENT**
 *
 * Elite React component for AI-powered content recommendations
 * Implements US-095 through US-098 frontend functionality
 *
 * Features:
 * - Personalized content recommendations (US-095)
 * - Behavioral tracking integration (US-096)
 * - Similar content suggestions (US-097)
 * - User feedback collection (US-098)
 *
 * @author Sovren Platform Team
 * @version 1.0.0
 */

import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Skeleton,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useBehaviorTracking } from '@/hooks/useBehaviorTracking';
import { useFeedback } from '@/hooks/useFeedback';
import { useRecommendations } from '@/hooks/useRecommendations';
import { cn } from '@/lib/utils';
import type { FeedbackType, RecommendationResponse } from '@/types/ai-recommendations';
import {
  Bookmark,
  Clock,
  Eye,
  Info,
  MoreHorizontal,
  Share2,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

// ===== Types =====

interface RecommendationWidgetProps {
  context: 'homepage' | 'post_read' | 'search_results' | 'category_browse' | 'profile_visit';
  contentId?: string;
  limit?: number;
  className?: string;
  showExplanations?: boolean;
  showFeedbackButtons?: boolean;
  onRecommendationClick?: (contentId: string, position: number) => void;
  onFeedbackSubmitted?: (contentId: string, feedbackType: FeedbackType) => void;
}

interface RecommendationItemProps {
  recommendation: RecommendationResponse['recommendations'][0];
  position: number;
  showExplanation: boolean;
  showFeedbackButtons: boolean;
  onItemClick: (contentId: string, position: number) => void;
  onFeedback: (contentId: string, feedbackType: FeedbackType, position: number) => void;
  onDismiss: (contentId: string, position: number) => void;
}

// ===== Recommendation Item Component =====

const RecommendationItem: React.FC<RecommendationItemProps> = ({
  recommendation,
  position,
  showExplanation,
  showFeedbackButtons,
  onItemClick,
  onFeedback,
  onDismiss,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<FeedbackType | null>(null);
  const { trackBehavior } = useBehaviorTracking();

  const handleClick = useCallback(async () => {
    // Track recommendation click
    await trackBehavior({
      event_type: 'recommendation_click',
      content_id: recommendation.content_id,
      content_type: recommendation.content_type,
      source_location: 'recommendation_widget',
      interaction_quality: 0.8,
    });

    onItemClick(recommendation.content_id, position);
  }, [recommendation, position, onItemClick, trackBehavior]);

  const handleFeedback = useCallback(
    async (feedbackType: FeedbackType) => {
      setFeedbackGiven(feedbackType);

      // Track feedback behavior
      await trackBehavior({
        event_type: feedbackType === 'like' ? 'feedback_positive' : 'feedback_negative',
        content_id: recommendation.content_id,
        source_location: 'recommendation_widget',
      });

      onFeedback(recommendation.content_id, feedbackType, position);
    },
    [recommendation.content_id, position, onFeedback, trackBehavior]
  );

  const handleDismiss = useCallback(async () => {
    // Track dismissal
    await trackBehavior({
      event_type: 'recommendation_dismiss',
      content_id: recommendation.content_id,
      source_location: 'recommendation_widget',
    });

    onDismiss(recommendation.content_id, position);
  }, [recommendation.content_id, position, onDismiss, trackBehavior]);

  const confidenceColor = useMemo(() => {
    if (recommendation.confidence_score >= 0.8) return 'bg-green-100 text-green-800';
    if (recommendation.confidence_score >= 0.6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  }, [recommendation.confidence_score]);

  const algorithmIcon = useMemo(() => {
    switch (recommendation.algorithm_used) {
      case 'collaborative':
        return <Target className="h-3 w-3" />;
      case 'content_based':
        return <Sparkles className="h-3 w-3" />;
      case 'behavioral':
        return <TrendingUp className="h-3 w-3" />;
      case 'hybrid':
        return <Eye className="h-3 w-3" />;
      default:
        return <MoreHorizontal className="h-3 w-3" />;
    }
  }, [recommendation.algorithm_used]);

  return (
    <Card
      className={cn(
        'group transition-all duration-200 hover:shadow-md border-l-4',
        recommendation.recommendation_score >= 0.8 ? 'border-l-green-500' : 'border-l-blue-500'
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle
              className="text-base line-clamp-2 cursor-pointer hover:text-blue-600"
              onClick={handleClick}
            >
              {recommendation.title}
            </CardTitle>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">
                {algorithmIcon}
                {recommendation.algorithm_used}
              </Badge>
              <Badge variant="outline" className={cn('text-xs', confidenceColor)}>
                {Math.round(recommendation.confidence_score * 100)}% match
              </Badge>
              {recommendation.estimated_read_time && (
                <Badge variant="outline" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  {recommendation.estimated_read_time}m
                </Badge>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Author Information */}
        <div className="flex items-center gap-2 mb-3">
          {recommendation.author.avatar_url && (
            <img
              src={recommendation.author.avatar_url}
              alt={recommendation.author.display_name}
              className="h-6 w-6 rounded-full"
            />
          )}
          <span className="text-sm text-gray-600">
            {recommendation.author.display_name || recommendation.author.username}
          </span>
          <span className="text-xs text-gray-400">
            {new Date(recommendation.published_at).toLocaleDateString()}
          </span>
        </div>

        {/* Excerpt */}
        {recommendation.excerpt && (
          <p className="text-sm text-gray-700 line-clamp-2 mb-3">{recommendation.excerpt}</p>
        )}

        {/* Tags */}
        {recommendation.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {recommendation.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {recommendation.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{recommendation.tags.length - 3} more
              </Badge>
            )}
          </div>
        )}

        {/* Explanation */}
        {showExplanation && recommendation.explanation && (
          <div className="bg-gray-50 rounded-md p-3 mb-3">
            <div className="flex items-center gap-2 mb-1">
              <Info className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium text-gray-700">Why this recommendation?</span>
            </div>
            <p className="text-xs text-gray-600">{recommendation.explanation}</p>
            {recommendation.reasoning_factors.length > 0 && (
              <div className="mt-2">
                <div className="flex flex-wrap gap-1">
                  {recommendation.reasoning_factors.slice(0, 3).map((factor, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {factor}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleClick} className="text-xs">
              Read More
            </Button>
            <Button variant="ghost" size="sm" className="text-xs">
              <Share2 className="h-3 w-3 mr-1" />
              Share
            </Button>
            <Button variant="ghost" size="sm" className="text-xs">
              <Bookmark className="h-3 w-3 mr-1" />
              Save
            </Button>
          </div>

          {/* Feedback Buttons */}
          {showFeedbackButtons && (
            <div className="flex items-center gap-1">
              <Button
                variant={feedbackGiven === 'like' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleFeedback('like')}
                disabled={feedbackGiven !== null}
                className="h-8 w-8 p-0"
              >
                <ThumbsUp className="h-3 w-3" />
              </Button>
              <Button
                variant={feedbackGiven === 'dislike' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleFeedback('dislike')}
                disabled={feedbackGiven !== null}
                className="h-8 w-8 p-0"
              >
                <ThumbsDown className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// ===== Main Recommendation Widget =====

export const RecommendationWidget: React.FC<RecommendationWidgetProps> = ({
  context,
  contentId,
  limit = 5,
  className,
  showExplanations = true,
  showFeedbackButtons = true,
  onRecommendationClick,
  onFeedbackSubmitted,
}) => {
  const { user } = useAuth();
  const { trackBehavior } = useBehaviorTracking();
  const { submitFeedback } = useFeedback();

  const [dismissedItems, setDismissedItems] = useState<Set<string>>(new Set());
  const [viewStartTime] = useState(Date.now());

  // Get recommendations
  const {
    data: recommendationsData,
    isLoading,
    error,
    refetch,
  } = useRecommendations({
    context,
    content_id: contentId,
    limit: limit + dismissedItems.size, // Request extra to account for dismissed items
    include_explanation: showExplanations,
  });

  // Track widget view
  useEffect(() => {
    if (user && recommendationsData) {
      trackBehavior({
        event_type: 'category_browse',
        source_location: `recommendation_widget_${context}`,
        dwell_time: 0,
        interaction_quality: 0.5,
      });
    }
  }, [user, recommendationsData, context, trackBehavior]);

  // Track dwell time on unmount
  useEffect(() => {
    return () => {
      if (user) {
        const dwellTime = Math.floor((Date.now() - viewStartTime) / 1000);
        trackBehavior({
          event_type: 'category_browse',
          source_location: `recommendation_widget_${context}`,
          dwell_time: dwellTime,
          interaction_quality: dwellTime > 10 ? 0.8 : 0.3,
        });
      }
    };
  }, [user, viewStartTime, context, trackBehavior]);

  const handleItemClick = useCallback(
    (contentId: string, position: number) => {
      onRecommendationClick?.(contentId, position);
    },
    [onRecommendationClick]
  );

  const handleFeedback = useCallback(
    async (contentId: string, feedbackType: FeedbackType, position: number) => {
      if (!recommendationsData) return;

      try {
        await submitFeedback({
          content_id: contentId,
          feedback_type: feedbackType,
          recommendation_source: `widget_${context}`,
          recommendation_algorithm: recommendationsData.metadata.algorithm_used,
          position_in_list: position,
        });

        onFeedbackSubmitted?.(contentId, feedbackType);
      } catch (error) {
        console.error('Failed to submit feedback:', error);
      }
    },
    [recommendationsData, context, submitFeedback, onFeedbackSubmitted]
  );

  const handleDismiss = useCallback((contentId: string, position: number) => {
    setDismissedItems((prev) => new Set(prev).add(contentId));
  }, []);

  // Filter out dismissed items
  const filteredRecommendations = useMemo(() => {
    if (!recommendationsData?.recommendations) return [];

    return recommendationsData.recommendations
      .filter((rec) => !dismissedItems.has(rec.content_id))
      .slice(0, limit);
  }, [recommendationsData, dismissedItems, limit]);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-500" />
          <h3 className="font-semibold">Recommended for You</h3>
        </div>
        {Array.from({ length: limit }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-3/4" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-20" />
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-3 w-full mb-2" />
              <Skeleton className="h-3 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={className}>
        <Alert>
          <AlertDescription>
            Failed to load recommendations.
            <Button variant="link" onClick={() => refetch()} className="p-0 ml-1">
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Empty state
  if (!filteredRecommendations.length) {
    return (
      <div className={cn('text-center py-8', className)}>
        <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="font-semibold text-gray-600 mb-2">No recommendations yet</h3>
        <p className="text-sm text-gray-500">
          Interact with more content to get personalized recommendations
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-500" />
          <h3 className="font-semibold">Recommended for You</h3>
          {recommendationsData?.metadata && (
            <Badge variant="outline" className="text-xs">
              {recommendationsData.metadata.algorithm_used}
            </Badge>
          )}
        </div>

        {recommendationsData?.metadata && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-xs">
                <Info className="h-3 w-3 mr-1" />
                How it works
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>How Recommendations Work</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Our AI analyzes your reading patterns, preferences, and interactions to suggest
                  content you'll love.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">
                      <strong>Collaborative:</strong> Based on similar users
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    <span className="text-sm">
                      <strong>Content-based:</strong> Similar topics and tags
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-sm">
                      <strong>Behavioral:</strong> Your activity patterns
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-orange-500" />
                    <span className="text-sm">
                      <strong>Hybrid:</strong> Combines all methods
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Algorithm used: {recommendationsData.metadata.algorithm_used} • Processing time:{' '}
                  {recommendationsData.metadata.processing_time_ms}ms
                </p>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Recommendation Items */}
      <div className="space-y-3">
        {filteredRecommendations.map((recommendation, index) => (
          <RecommendationItem
            key={recommendation.content_id}
            recommendation={recommendation}
            position={index}
            showExplanation={showExplanations}
            showFeedbackButtons={showFeedbackButtons}
            onItemClick={handleItemClick}
            onFeedback={handleFeedback}
            onDismiss={handleDismiss}
          />
        ))}
      </div>

      {/* Load More Button */}
      {filteredRecommendations.length <
        (recommendationsData?.metadata.total_recommendations || 0) && (
        <div className="text-center pt-4">
          <Button variant="outline" onClick={() => refetch()}>
            Load More Recommendations
          </Button>
        </div>
      )}
    </div>
  );
};

export default RecommendationWidget;
