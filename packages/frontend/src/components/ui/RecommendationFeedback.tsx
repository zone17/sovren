// 🤖 Recommendation Feedback Component
// Implementation of US-098: Recommendation feedback system
// Elite engineering standards with comprehensive feedback collection and model updates

'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  Award,
  Brain,
  CheckCircle,
  Gift,
  Heart,
  MessageSquare,
  Send,
  Star,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';

// Types for feedback system
interface RecommendationFeedback {
  id: string;
  userId: string;
  recommendationId: string;
  contentId: string;
  feedbackType: 'explicit' | 'implicit';
  rating?: number;
  action: 'like' | 'dislike' | 'save' | 'share' | 'click' | 'ignore' | 'hide' | 'report';
  relevanceScore?: number;
  satisfaction?: number;
  reason?: string;
  context: {
    timeSpent?: number;
    didComplete?: boolean;
    sharedTo?: string[];
    timestamp: Date;
    sessionId: string;
  };
  metadata?: Record<string, unknown>;
}

interface FeedbackAnalytics {
  userId: string;
  period: 'day' | 'week' | 'month' | 'quarter';
  metrics: {
    totalRecommendations: number;
    totalFeedback: number;
    feedbackRate: number;
    avgRating: number;
    satisfactionScore: number;
    clickThroughRate: number;
    conversionRate: number;
  };
  distribution: {
    ratingDistribution: Record<string, number>;
    actionDistribution: Record<string, number>;
    categoryPerformance: Record<string, number>;
    algorithmPerformance: Record<string, number>;
  };
  trends: {
    ratingTrend: number[];
    engagementTrend: number[];
    diversityTrend: number[];
  };
  generatedAt: Date;
}

interface RecommendationFeedbackProps {
  recommendationId: string;
  contentId: string;
  enableQuickFeedback?: boolean;
  enableDetailedFeedback?: boolean;
  enableIncentives?: boolean;
  onFeedbackSubmitted?: (feedback: RecommendationFeedback) => void;
  className?: string;
}

// Mock data
const mockFeedbackAnalytics: FeedbackAnalytics = {
  userId: 'user_123',
  period: 'week',
  metrics: {
    totalRecommendations: 156,
    totalFeedback: 89,
    feedbackRate: 0.57,
    avgRating: 4.2,
    satisfactionScore: 0.84,
    clickThroughRate: 0.31,
    conversionRate: 0.18,
  },
  distribution: {
    ratingDistribution: {
      '1': 3,
      '2': 7,
      '3': 15,
      '4': 28,
      '5': 36,
    },
    actionDistribution: {
      like: 45,
      save: 23,
      share: 12,
      click: 67,
      ignore: 34,
      hide: 8,
      dislike: 5,
    },
    categoryPerformance: {
      'AI & Technology': 4.6,
      'Creator Economy': 4.1,
      'Blockchain Development': 4.4,
      'Content Creation': 3.9,
    },
    algorithmPerformance: {
      'collaborative-v1': 4.3,
      'content-based-v1': 3.8,
      'hybrid-v1': 4.5,
      'behavioral-v1': 4.2,
    },
  },
  trends: {
    ratingTrend: [3.8, 4.0, 4.1, 4.2, 4.3, 4.2, 4.2],
    engagementTrend: [0.28, 0.3, 0.29, 0.31, 0.33, 0.31, 0.32],
    diversityTrend: [0.65, 0.68, 0.71, 0.69, 0.72, 0.71, 0.73],
  },
  generatedAt: new Date(),
};

// Quick Feedback Component
const QuickFeedback: React.FC<{
  onFeedback: (action: string, rating?: number) => void;
  disabled: boolean;
}> = ({ onFeedback, disabled }) => {
  const [selectedRating, setSelectedRating] = useState(0);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  const quickActions = [
    { action: 'like', icon: ThumbsUp, label: 'Helpful', color: 'text-green-600 bg-green-50' },
    { action: 'dislike', icon: ThumbsDown, label: 'Not helpful', color: 'text-red-600 bg-red-50' },
    { action: 'save', icon: Heart, label: 'Love it', color: 'text-pink-600 bg-pink-50' },
    {
      action: 'hide',
      icon: XCircle,
      label: 'Not interested',
      color: 'text-muted-foreground bg-muted',
    },
  ];

  const handleQuickAction = (action: string) => {
    setSelectedAction(action);
    onFeedback(action);
  };

  const handleRating = (rating: number) => {
    setSelectedRating(rating);
    onFeedback('like', rating);
  };

  return (
    <div className='space-y-4'>
      <div className='space-y-2'>
        <h4 className='text-sm font-medium'>How was this recommendation?</h4>
        <div className='flex items-center gap-1'>
          {[1, 2, 3, 4, 5].map(star => (
            <Button
              key={star}
              variant='ghost'
              size='sm'
              onClick={() => handleRating(star)}
              disabled={disabled}
              className={cn(
                'h-8 w-8 p-0 hover:scale-110 transition-transform',
                star <= selectedRating && 'text-yellow-500'
              )}
            >
              <Star className={cn('h-4 w-4', star <= selectedRating && 'fill-current')} />
            </Button>
          ))}
        </div>
        {selectedRating > 0 && (
          <p className='text-xs text-green-600'>Thanks for rating! ({selectedRating}/5 stars)</p>
        )}
      </div>

      <div className='space-y-2'>
        <h4 className='text-sm font-medium'>Quick actions:</h4>
        <div className='grid grid-cols-2 gap-2'>
          {quickActions.map(item => {
            const Icon = item.icon;
            const isSelected = selectedAction === item.action;

            return (
              <Button
                key={item.action}
                variant='ghost'
                size='sm'
                onClick={() => handleQuickAction(item.action)}
                disabled={disabled}
                className={cn(
                  'h-10 justify-start gap-2 transition-all',
                  isSelected ? item.color : 'hover:' + item.color
                )}
              >
                <Icon className='h-4 w-4' />
                <span className='text-xs'>{item.label}</span>
                {isSelected && <CheckCircle className='h-3 w-3 ml-auto' />}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Detailed Feedback Component
const DetailedFeedback: React.FC<{
  onFeedback: (feedback: Partial<RecommendationFeedback>) => void;
  disabled: boolean;
}> = ({ onFeedback, disabled }) => {
  const [rating, setRating] = useState(0);
  const [relevance, setRelevance] = useState(0);
  const [satisfaction, setSatisfaction] = useState(0);
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState('');
  const [suggestions, setSuggestions] = useState('');

  const handleSubmit = () => {
    const feedback: Partial<RecommendationFeedback> = {
      rating,
      relevanceScore: relevance / 5,
      satisfaction: satisfaction / 5,
      reason: reason || undefined,
      metadata: {
        category,
        suggestions: suggestions || undefined,
        feedbackType: 'detailed',
      },
    };

    onFeedback(feedback);
  };

  const isValid = rating > 0 && relevance > 0 && satisfaction > 0;

  return (
    <div className='space-y-6'>
      <div className='space-y-4'>
        <div className='space-y-2'>
          <Label className='text-sm font-medium'>Overall Rating</Label>
          <div className='flex items-center gap-1'>
            {[1, 2, 3, 4, 5].map(star => (
              <Button
                key={star}
                variant='ghost'
                size='sm'
                onClick={() => setRating(star)}
                disabled={disabled}
                className={cn('h-8 w-8 p-0', star <= rating && 'text-yellow-500')}
              >
                <Star className={cn('h-4 w-4', star <= rating && 'fill-current')} />
              </Button>
            ))}
          </div>
        </div>

        <div className='space-y-2'>
          <Label className='text-sm font-medium'>Relevance to your interests</Label>
          <div className='flex items-center gap-1'>
            {[1, 2, 3, 4, 5].map(star => (
              <Button
                key={star}
                variant='ghost'
                size='sm'
                onClick={() => setRelevance(star)}
                disabled={disabled}
                className={cn('h-8 w-8 p-0', star <= relevance && 'text-blue-500')}
              >
                <Star className={cn('h-4 w-4', star <= relevance && 'fill-current')} />
              </Button>
            ))}
          </div>
        </div>

        <div className='space-y-2'>
          <Label className='text-sm font-medium'>Recommendation quality</Label>
          <div className='flex items-center gap-1'>
            {[1, 2, 3, 4, 5].map(star => (
              <Button
                key={star}
                variant='ghost'
                size='sm'
                onClick={() => setSatisfaction(star)}
                disabled={disabled}
                className={cn('h-8 w-8 p-0', star <= satisfaction && 'text-green-500')}
              >
                <Star className={cn('h-4 w-4', star <= satisfaction && 'fill-current')} />
              </Button>
            ))}
          </div>
        </div>

        <div className='space-y-2'>
          <Label className='text-sm font-medium'>Why did you like/dislike this?</Label>
          <Select value={category} onValueChange={setCategory} disabled={disabled}>
            <SelectTrigger>
              <SelectValue placeholder='Select a reason...' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='relevant'>Highly relevant to my interests</SelectItem>
              <SelectItem value='quality'>High quality content</SelectItem>
              <SelectItem value='timing'>Perfect timing</SelectItem>
              <SelectItem value='creator'>I follow this creator</SelectItem>
              <SelectItem value='not-relevant'>Not relevant to me</SelectItem>
              <SelectItem value='poor-quality'>Poor quality content</SelectItem>
              <SelectItem value='seen-before'>Already seen this</SelectItem>
              <SelectItem value='wrong-level'>Wrong difficulty level</SelectItem>
              <SelectItem value='other'>Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-2'>
          <Label className='text-sm font-medium'>Additional comments (optional)</Label>
          <Textarea
            placeholder='Tell us more about your experience...'
            value={reason}
            onChange={e => setReason(e.target.value)}
            disabled={disabled}
            className='min-h-[80px]'
          />
        </div>

        <div className='space-y-2'>
          <Label className='text-sm font-medium'>Suggestions for improvement (optional)</Label>
          <Textarea
            placeholder='How can we improve our recommendations?'
            value={suggestions}
            onChange={e => setSuggestions(e.target.value)}
            disabled={disabled}
            className='min-h-[60px]'
          />
        </div>
      </div>

      <Button onClick={handleSubmit} disabled={!isValid || disabled} className='w-full'>
        <Send className='h-4 w-4 mr-2' />
        Submit Feedback
      </Button>
    </div>
  );
};

// Feedback Incentives Component
const FeedbackIncentives: React.FC<{
  feedbackCount: number;
  rewardsEarned: number;
}> = ({ feedbackCount, rewardsEarned }) => {
  const milestones = [
    { count: 5, reward: 'Bronze Contributor', icon: Award, color: 'text-orange-600 bg-orange-50' },
    {
      count: 20,
      reward: 'Silver Contributor',
      icon: Award,
      color: 'text-muted-foreground bg-muted',
    },
    { count: 50, reward: 'Gold Contributor', icon: Award, color: 'text-yellow-600 bg-yellow-50' },
    { count: 100, reward: 'Feedback Champion', icon: Award, color: 'text-purple-600 bg-purple-50' },
  ];

  const nextMilestone = milestones.find(m => m.count > feedbackCount);
  const progress = nextMilestone ? (feedbackCount / nextMilestone.count) * 100 : 100;

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <h4 className='text-sm font-medium'>Feedback Rewards</h4>
        <Badge variant='outline' className='text-xs'>
          {feedbackCount} feedback given
        </Badge>
      </div>

      {nextMilestone && (
        <div className='space-y-2'>
          <div className='flex justify-between text-xs'>
            <span>Progress to {nextMilestone.reward}</span>
            <span>
              {feedbackCount}/{nextMilestone.count}
            </span>
          </div>
          <Progress value={progress} className='h-2' />
          <p className='text-xs text-muted-foreground'>
            {nextMilestone.count - feedbackCount} more feedback to unlock!
          </p>
        </div>
      )}

      <div className='space-y-2'>
        <h5 className='text-xs font-medium text-muted-foreground'>Earned Badges:</h5>
        <div className='flex flex-wrap gap-2'>
          {milestones
            .filter(m => m.count <= feedbackCount)
            .map((milestone, index) => {
              const Icon = milestone.icon;
              return (
                <div
                  key={index}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-full text-xs',
                    milestone.color
                  )}
                >
                  <Icon className='h-3 w-3' />
                  {milestone.reward}
                </div>
              );
            })}
        </div>
      </div>

      {rewardsEarned > 0 && (
        <div className='flex items-center gap-2 p-2 bg-green-50 rounded-lg'>
          <Gift className='h-4 w-4 text-green-600' />
          <span className='text-sm text-green-700'>
            You've earned {rewardsEarned} reward points!
          </span>
        </div>
      )}
    </div>
  );
};

// Feedback Analytics Component
const FeedbackAnalyticsView: React.FC<{ analytics: FeedbackAnalytics }> = ({ analytics }) => {
  return (
    <div className='space-y-6'>
      {/* Key Metrics */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
        <Card>
          <CardContent className='pt-6'>
            <div className='text-center'>
              <div className='text-2xl font-bold text-blue-600'>
                {Math.round(analytics.metrics.feedbackRate * 100)}%
              </div>
              <p className='text-sm text-muted-foreground'>Feedback Rate</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='pt-6'>
            <div className='text-center'>
              <div className='text-2xl font-bold text-green-600'>
                {analytics.metrics.avgRating.toFixed(1)}
              </div>
              <p className='text-sm text-muted-foreground'>Avg Rating</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='pt-6'>
            <div className='text-center'>
              <div className='text-2xl font-bold text-purple-600'>
                {Math.round(analytics.metrics.satisfactionScore * 100)}%
              </div>
              <p className='text-sm text-muted-foreground'>Satisfaction</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='pt-6'>
            <div className='text-center'>
              <div className='text-2xl font-bold text-orange-600'>
                {Math.round(analytics.metrics.clickThroughRate * 100)}%
              </div>
              <p className='text-sm text-muted-foreground'>Click Rate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rating Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className='text-lg'>Rating Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-3'>
            {Object.entries(analytics.distribution.ratingDistribution).map(([rating, count]) => (
              <div key={rating} className='flex items-center gap-3'>
                <span className='text-sm font-medium w-8'>{rating}★</span>
                <div className='flex-1'>
                  <Progress
                    value={(count / analytics.metrics.totalFeedback) * 100}
                    className='h-3'
                  />
                </div>
                <span className='text-sm text-muted-foreground w-8'>{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Algorithm Performance */}
      <Card>
        <CardHeader>
          <CardTitle className='text-lg'>Algorithm Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-3'>
            {Object.entries(analytics.distribution.algorithmPerformance).map(
              ([algorithm, rating]) => (
                <div key={algorithm} className='flex items-center justify-between'>
                  <span className='text-sm font-medium'>{algorithm}</span>
                  <div className='flex items-center gap-2'>
                    <Progress value={(rating / 5) * 100} className='h-2 w-20' />
                    <span className='text-sm text-muted-foreground'>{rating.toFixed(1)}</span>
                  </div>
                </div>
              )
            )}
          </div>
        </CardContent>
      </Card>

      {/* Trends */}
      <Card>
        <CardHeader>
          <CardTitle className='text-lg'>Trends (Last 7 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            <div>
              <div className='flex justify-between text-sm mb-2'>
                <span>Rating Trend</span>
                <span className='text-green-600'>
                  ↗ +
                  {(analytics.trends.ratingTrend[6] - analytics.trends.ratingTrend[0]).toFixed(1)}
                </span>
              </div>
              <div className='flex items-end gap-1 h-16'>
                {analytics.trends.ratingTrend.map((value, index) => (
                  <div
                    key={index}
                    className='flex-1 bg-blue-200 rounded-t'
                    style={{ height: `${(value / 5) * 100}%` }}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className='flex justify-between text-sm mb-2'>
                <span>Engagement Trend</span>
                <span className='text-green-600'>
                  ↗ +
                  {(
                    (analytics.trends.engagementTrend[6] - analytics.trends.engagementTrend[0]) *
                    100
                  ).toFixed(1)}
                  %
                </span>
              </div>
              <div className='flex items-end gap-1 h-16'>
                {analytics.trends.engagementTrend.map((value, index) => (
                  <div
                    key={index}
                    className='flex-1 bg-green-200 rounded-t'
                    style={{ height: `${value * 100}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Main RecommendationFeedback component
export const RecommendationFeedback: React.FC<RecommendationFeedbackProps> = ({
  recommendationId,
  contentId,
  enableQuickFeedback = true,
  enableDetailedFeedback = true,
  enableIncentives = true,
  onFeedbackSubmitted,
  className,
}) => {
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackCount, setFeedbackCount] = useState(23);
  const [rewardsEarned, setRewardsEarned] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showDetailed, setShowDetailed] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [analytics, setAnalytics] = useState<FeedbackAnalytics>(mockFeedbackAnalytics);
  const [loading, setLoading] = useState(false);

  // 7.4.1 & 7.4.2: Handle feedback submission
  const handleFeedback = useCallback(
    async (action: string, rating?: number, additionalData?: Partial<RecommendationFeedback>) => {
      if (feedbackSubmitted) return;

      try {
        setLoading(true);

        const feedback: RecommendationFeedback = {
          id: `feedback_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          userId: 'user_123',
          recommendationId,
          contentId,
          feedbackType: rating || additionalData ? 'explicit' : 'implicit',
          rating,
          action: action as RecommendationFeedback['action'],
          context: {
            timestamp: new Date(),
            sessionId: 'current_session',
          },
          ...additionalData,
        };

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 800));

        setFeedbackSubmitted(true);
        setFeedbackCount(prev => prev + 1);

        if (rating && rating >= 4) {
          setRewardsEarned(prev => prev + 10);
        }

        onFeedbackSubmitted?.(feedback);

        toast.success('Thank you!', 'Your feedback helps improve our recommendations.');

        // 7.4.7: Trigger model update simulation
        setTimeout(() => {
          toast.success(
            'Model Updated',
            'Your feedback has been incorporated into our recommendation model.'
          );
        }, 2000);
      } catch (_error) {
        toast.error('Feedback Error', 'Unable to submit feedback. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [feedbackSubmitted, recommendationId, contentId, onFeedbackSubmitted]
  );

  const handleDetailedFeedback = useCallback(
    (feedbackData: Partial<RecommendationFeedback>) => {
      handleFeedback('like', feedbackData.rating, feedbackData);
    },
    [handleFeedback]
  );

  if (feedbackSubmitted) {
    return (
      <div className={cn('p-4', className)}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className='text-center space-y-4'
        >
          <div className='mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center'>
            <CheckCircle className='h-6 w-6 text-green-600' />
          </div>
          <div>
            <h3 className='text-lg font-semibold text-foreground'>Feedback Received!</h3>
            <p className='text-sm text-muted-foreground'>
              Thank you for helping us improve our recommendations.
            </p>
          </div>
          {enableIncentives && rewardsEarned > 0 && (
            <div className='flex items-center justify-center gap-2 p-2 bg-yellow-50 rounded-lg'>
              <Gift className='h-4 w-4 text-yellow-600' />
              <span className='text-sm text-yellow-700'>
                +{rewardsEarned} reward points earned!
              </span>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      <Card>
        <CardHeader>
          <CardTitle className='text-lg flex items-center gap-2'>
            <MessageSquare className='h-5 w-5 text-blue-600' />
            Share Your Feedback
          </CardTitle>
          <p className='text-sm text-muted-foreground'>
            Help us improve by sharing your thoughts on this recommendation
          </p>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue='quick' className='space-y-4'>
            <TabsList className='grid w-full grid-cols-3'>
              {enableQuickFeedback && <TabsTrigger value='quick'>Quick</TabsTrigger>}
              {enableDetailedFeedback && <TabsTrigger value='detailed'>Detailed</TabsTrigger>}
              <TabsTrigger value='analytics'>Analytics</TabsTrigger>
            </TabsList>

            {enableQuickFeedback && (
              <TabsContent value='quick'>
                <QuickFeedback onFeedback={handleFeedback} disabled={loading} />
              </TabsContent>
            )}

            {enableDetailedFeedback && (
              <TabsContent value='detailed'>
                <DetailedFeedback onFeedback={handleDetailedFeedback} disabled={loading} />
              </TabsContent>
            )}

            <TabsContent value='analytics'>
              <FeedbackAnalyticsView analytics={analytics} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {enableIncentives && (
        <Card>
          <CardHeader>
            <CardTitle className='text-lg flex items-center gap-2'>
              <Award className='h-5 w-5 text-purple-600' />
              Feedback Rewards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FeedbackIncentives feedbackCount={feedbackCount} rewardsEarned={rewardsEarned} />
          </CardContent>
        </Card>
      )}

      {/* Model Update Status */}
      <Card className='bg-gradient-to-r from-blue-50 to-purple-50'>
        <CardContent className='pt-6'>
          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <div className='flex items-center gap-2'>
                <Brain className='h-5 w-5 text-blue-600' />
                <span className='text-sm font-medium text-blue-700'>AI Learning Status</span>
              </div>
              <p className='text-xs text-blue-600'>
                Your feedback is continuously improving our recommendation models
              </p>
            </div>
            <div className='text-right'>
              <div className='text-lg font-bold text-purple-600'>{feedbackCount}</div>
              <p className='text-xs text-purple-600'>contributions</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RecommendationFeedback;
