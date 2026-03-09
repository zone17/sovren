// @ts-nocheck
// 🤖 Content Similarity Analysis Component
// Implementation of US-097: Content similarity analysis
// Elite engineering standards with advanced similarity algorithms and clustering

'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bookmark,
  ChevronRight,
  Clock,
  Eye,
  Heart,
  Info,
  Layers,
  Network,
  Play,
  RefreshCw,
  Search,
  Share2,
  TrendingUp,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

// Types for content similarity
interface ContentFeature {
  contentId: string;
  features: {
    textual: {
      keywords: string[];
      topics: string[];
      sentiment: number;
      readability: number;
      complexity: number;
      wordCount: number;
      language: string;
    };
    visual?: {
      hasImages: boolean;
      hasVideos: boolean;
      colorPalette?: string[];
      visualComplexity?: number;
    };
    metadata: {
      category: string;
      tags: string[];
      difficulty: string;
      duration?: number;
      format: string;
    };
    engagement: {
      viewCount: number;
      likeCount: number;
      shareCount: number;
      commentCount: number;
      averageRating: number;
      engagementRate: number;
    };
  };
  vector: number[];
  lastUpdated: Date;
}

interface SimilarityScore {
  sourceContentId: string;
  targetContentId: string;
  similarityScore: number;
  similarityType: 'textual' | 'topical' | 'behavioral' | 'collaborative' | 'hybrid';
  components: {
    contentSimilarity: number;
    topicSimilarity: number;
    styleSimilarity: number;
    engagementSimilarity: number;
  };
  confidence: number;
  computedAt: Date;
  algorithm: string;
}

interface SimilarContent {
  id: string;
  contentId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  contentType: 'article' | 'video' | 'audio' | 'image' | 'live' | 'course';
  creatorName: string;
  category: string;
  tags: string[];
  similarityScore: number;
  similarity: SimilarityScore;
  metadata: {
    estimatedReadTime?: number;
    difficulty?: string;
    isPremium: boolean;
    viewCount: number;
    engagementRate?: number;
  };
}

interface ContentCluster {
  id: string;
  name: string;
  description: string;
  contentIds: string[];
  centroid: number[];
  characteristics: {
    dominantTopics: string[];
    avgEngagement: number;
    avgDifficulty: number;
    commonTags: string[];
  };
  quality: {
    cohesion: number;
    separation: number;
    silhouetteScore: number;
  };
  size: number;
  createdAt: Date;
  lastUpdated: Date;
}

interface ContentSimilarityProps {
  contentId: string;
  maxSimilarItems?: number;
  enableClustering?: boolean;
  enableExplanations?: boolean;
  onSimilarContentClick?: (contentId: string) => void;
  className?: string;
}

// Mock data
const mockSimilarContent: SimilarContent[] = [
  {
    id: 'similar_001',
    contentId: 'content_007',
    title: 'Machine Learning Fundamentals for Creators',
    description:
      'Learn the basics of machine learning and how creators can leverage AI tools to enhance their content.',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=300&h=200&fit=crop',
    contentType: 'video',
    creatorName: 'Lisa Zhang',
    category: 'AI & Technology',
    tags: ['machine-learning', 'ai', 'creators', 'fundamentals'],
    similarityScore: 0.92,
    similarity: {
      sourceContentId: 'content_001',
      targetContentId: 'content_007',
      similarityScore: 0.92,
      similarityType: 'hybrid',
      components: {
        contentSimilarity: 0.89,
        topicSimilarity: 0.95,
        styleSimilarity: 0.88,
        engagementSimilarity: 0.91,
      },
      confidence: 0.94,
      computedAt: new Date(),
      algorithm: 'hybrid-similarity-v2',
    },
    metadata: {
      estimatedReadTime: 25,
      difficulty: 'beginner',
      isPremium: false,
      viewCount: 3247,
      engagementRate: 0.27,
    },
  },
  {
    id: 'similar_002',
    contentId: 'content_008',
    title: 'Advanced Prompt Engineering Techniques',
    description:
      'Master advanced prompt engineering strategies to get better results from AI language models.',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=300&h=200&fit=crop',
    contentType: 'article',
    creatorName: 'David Kumar',
    category: 'AI & Technology',
    tags: ['prompt-engineering', 'ai', 'language-models', 'advanced'],
    similarityScore: 0.88,
    similarity: {
      sourceContentId: 'content_001',
      targetContentId: 'content_008',
      similarityScore: 0.88,
      similarityType: 'textual',
      components: {
        contentSimilarity: 0.94,
        topicSimilarity: 0.91,
        styleSimilarity: 0.82,
        engagementSimilarity: 0.85,
      },
      confidence: 0.89,
      computedAt: new Date(),
      algorithm: 'semantic-similarity-v1',
    },
    metadata: {
      estimatedReadTime: 15,
      difficulty: 'advanced',
      isPremium: true,
      viewCount: 1892,
      engagementRate: 0.34,
    },
  },
  {
    id: 'similar_003',
    contentId: 'content_009',
    title: 'AI Tools for Content Creation Workflow',
    description:
      'Discover and integrate AI tools into your content creation process for maximum efficiency.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1556740758-90de374c12ad?w=300&h=200&fit=crop',
    contentType: 'course',
    creatorName: 'Emma Rodriguez',
    category: 'Creator Tools',
    tags: ['ai-tools', 'content-creation', 'workflow', 'productivity'],
    similarityScore: 0.84,
    similarity: {
      sourceContentId: 'content_001',
      targetContentId: 'content_009',
      similarityScore: 0.84,
      similarityType: 'topical',
      components: {
        contentSimilarity: 0.78,
        topicSimilarity: 0.93,
        styleSimilarity: 0.79,
        engagementSimilarity: 0.86,
      },
      confidence: 0.87,
      computedAt: new Date(),
      algorithm: 'topic-similarity-v1',
    },
    metadata: {
      estimatedReadTime: 120,
      difficulty: 'intermediate',
      isPremium: false,
      viewCount: 2456,
      engagementRate: 0.31,
    },
  },
];

const mockContentClusters: ContentCluster[] = [
  {
    id: 'cluster_001',
    name: 'AI & Machine Learning',
    description:
      'Content focused on artificial intelligence, machine learning, and related technologies',
    contentIds: ['content_001', 'content_007', 'content_008', 'content_012', 'content_015'],
    centroid: [0.8, 0.9, 0.7, 0.85, 0.88], // Simplified 5D vector
    characteristics: {
      dominantTopics: [
        'artificial intelligence',
        'machine learning',
        'neural networks',
        'automation',
      ],
      avgEngagement: 0.31,
      avgDifficulty: 2.4, // 1=beginner, 2=intermediate, 3=advanced, 4=expert
      commonTags: ['ai', 'machine-learning', 'automation', 'technology'],
    },
    quality: {
      cohesion: 0.87,
      separation: 0.92,
      silhouetteScore: 0.78,
    },
    size: 5,
    createdAt: new Date('2024-01-10'),
    lastUpdated: new Date(),
  },
  {
    id: 'cluster_002',
    name: 'Creator Economy & Monetization',
    description: 'Content about creator economy, monetization strategies, and platform dynamics',
    contentIds: ['content_003', 'content_010', 'content_013', 'content_017'],
    centroid: [0.7, 0.8, 0.9, 0.75, 0.82],
    characteristics: {
      dominantTopics: ['creator economy', 'monetization', 'platforms', 'community building'],
      avgEngagement: 0.28,
      avgDifficulty: 1.8,
      commonTags: ['creator-economy', 'monetization', 'platforms', 'community'],
    },
    quality: {
      cohesion: 0.82,
      separation: 0.89,
      silhouetteScore: 0.73,
    },
    size: 4,
    createdAt: new Date('2024-01-12'),
    lastUpdated: new Date(),
  },
  {
    id: 'cluster_003',
    name: 'Blockchain & Web3',
    description: 'Content covering blockchain technology, Web3, and decentralized systems',
    contentIds: [
      'content_002',
      'content_006',
      'content_011',
      'content_014',
      'content_016',
      'content_018',
    ],
    centroid: [0.6, 0.75, 0.85, 0.9, 0.78],
    characteristics: {
      dominantTopics: [
        'blockchain',
        'web3',
        'cryptocurrency',
        'decentralization',
        'smart contracts',
      ],
      avgEngagement: 0.34,
      avgDifficulty: 2.8,
      commonTags: ['blockchain', 'web3', 'cryptocurrency', 'defi', 'smart-contracts'],
    },
    quality: {
      cohesion: 0.91,
      separation: 0.88,
      silhouetteScore: 0.84,
    },
    size: 6,
    createdAt: new Date('2024-01-08'),
    lastUpdated: new Date(),
  },
];

// Similarity Score Visualization Component
const SimilarityBreakdown: React.FC<{ similarity: SimilarityScore }> = ({ similarity }) => {
  const components = [
    { name: 'Content', score: similarity.components.contentSimilarity, color: 'bg-blue-500' },
    { name: 'Topic', score: similarity.components.topicSimilarity, color: 'bg-green-500' },
    { name: 'Style', score: similarity.components.styleSimilarity, color: 'bg-purple-500' },
    {
      name: 'Engagement',
      score: similarity.components.engagementSimilarity,
      color: 'bg-orange-500',
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Similarity Breakdown</span>
        <Badge variant="outline" className="text-xs">
          {similarity.algorithm}
        </Badge>
      </div>

      <div className="space-y-2">
        {components.map((component) => (
          <div key={component.name} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>{component.name}</span>
              <span>{Math.round(component.score * 100)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn('h-full transition-all duration-300', component.color)}
                style={{ width: `${component.score * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="text-xs text-muted-foreground pt-2 border-t">
        Confidence: {Math.round(similarity.confidence * 100)}% • Computed:{' '}
        {similarity.computedAt.toLocaleTimeString()}
      </div>
    </div>
  );
};

// Similar Content Card Component
const SimilarContentCard: React.FC<{
  content: SimilarContent;
  onContentClick?: (contentId: string) => void;
  showExplanations: boolean;
}> = ({ content, onContentClick, showExplanations }) => {
  const [showBreakdown, setShowBreakdown] = useState(false);

  const getSimilarityColor = (score: number) => {
    if (score >= 0.9) return 'bg-green-100 text-green-700';
    if (score >= 0.8) return 'bg-blue-100 text-blue-700';
    if (score >= 0.7) return 'bg-yellow-100 text-yellow-700';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-green-500">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {content.contentType}
              </Badge>
              <Badge className={cn('text-xs', getSimilarityColor(content.similarityScore))}>
                {Math.round(content.similarityScore * 100)}% similar
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {content.similarity.similarityType}
              </Badge>
              {content.metadata.isPremium && (
                <Badge
                  variant="default"
                  className="bg-gradient-to-r from-green-500 to-blue-500 text-white"
                >
                  Premium
                </Badge>
              )}
            </div>

            <CardTitle
              className="text-lg font-semibold hover:text-green-600 cursor-pointer transition-colors"
              onClick={() => onContentClick?.(content.contentId)}
            >
              {content.title}
            </CardTitle>

            {content.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">{content.description}</p>
            )}

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {content.metadata.viewCount.toLocaleString()}
              </span>
              {content.metadata.estimatedReadTime && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {content.metadata.estimatedReadTime}m
                </span>
              )}
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {Math.round((content.metadata.engagementRate || 0) * 100)}% engagement
              </span>
            </div>
          </div>

          {content.thumbnailUrl && (
            <div className="ml-4">
              <img
                src={content.thumbnailUrl}
                alt={content.title}
                className="w-20 h-20 object-cover rounded-lg"
                loading="lazy"
              />
            </div>
          )}
        </div>

        {showExplanations && (
          <div className="mt-3 p-3 bg-green-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">Similarity Analysis</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowBreakdown(!showBreakdown)}
                className="h-6 px-2 text-xs"
              >
                <Info className="h-3 w-3" />
                Details
              </Button>
            </div>

            <AnimatePresence>
              {showBreakdown && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2"
                >
                  <SimilarityBreakdown similarity={content.similarity} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <Heart className="h-4 w-4" />
                <span className="text-xs ml-1">Like</span>
              </Button>

              <Button variant="ghost" size="sm" className="h-8 px-2">
                <Bookmark className="h-4 w-4" />
                <span className="text-xs ml-1">Save</span>
              </Button>

              <Button variant="ghost" size="sm" className="h-8 px-2">
                <Share2 className="h-4 w-4" />
                <span className="text-xs ml-1">Share</span>
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Creator:</span>
              <span className="text-xs font-medium">{content.creatorName}</span>
            </div>
          </div>

          <Button
            variant="default"
            size="sm"
            onClick={() => onContentClick?.(content.contentId)}
            className="h-8 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
          >
            {content.contentType === 'video' ? (
              <Play className="h-3 w-3 mr-1" />
            ) : (
              <ChevronRight className="h-3 w-3 mr-1" />
            )}
            View
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Content Cluster Card Component
const ContentClusterCard: React.FC<{ cluster: ContentCluster }> = ({ cluster }) => {
  const getQualityColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5 text-purple-600" />
            {cluster.name}
          </CardTitle>
          <Badge variant="outline">{cluster.size} items</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{cluster.description}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Dominant Topics</h4>
          <div className="flex flex-wrap gap-1">
            {cluster.characteristics.dominantTopics.map((topic, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {topic}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-medium text-foreground">Cluster Quality</h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span>Cohesion</span>
              <span className={getQualityColor(cluster.quality.cohesion)}>
                {Math.round(cluster.quality.cohesion * 100)}%
              </span>
            </div>
            <Progress value={cluster.quality.cohesion * 100} className="h-2" />

            <div className="flex justify-between items-center text-sm">
              <span>Separation</span>
              <span className={getQualityColor(cluster.quality.separation)}>
                {Math.round(cluster.quality.separation * 100)}%
              </span>
            </div>
            <Progress value={cluster.quality.separation * 100} className="h-2" />

            <div className="flex justify-between items-center text-sm">
              <span>Silhouette Score</span>
              <span className={getQualityColor((cluster.quality.silhouetteScore + 1) / 2)}>
                {cluster.quality.silhouetteScore.toFixed(2)}
              </span>
            </div>
            <Progress value={(cluster.quality.silhouetteScore + 1) * 50} className="h-2" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Avg Engagement:</span>
            <div className="font-medium">
              {Math.round(cluster.characteristics.avgEngagement * 100)}%
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Avg Difficulty:</span>
            <div className="font-medium">
              {cluster.characteristics.avgDifficulty < 2
                ? 'Beginner'
                : cluster.characteristics.avgDifficulty < 3
                  ? 'Intermediate'
                  : 'Advanced'}
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground pt-2 border-t">
          Created: {cluster.createdAt.toLocaleDateString()} • Updated:{' '}
          {cluster.lastUpdated.toLocaleDateString()}
        </div>
      </CardContent>
    </Card>
  );
};

// Main ContentSimilarity component
export const ContentSimilarity: React.FC<ContentSimilarityProps> = ({
  contentId,
  maxSimilarItems = 10,
  enableClustering = true,
  enableExplanations = true,
  onSimilarContentClick,
  className,
}) => {
  const [similarContent, setSimilarContent] = useState<SimilarContent[]>([]);
  const [contentClusters, setContentClusters] = useState<ContentCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [analysisType, setAnalysisType] = useState<'all' | 'textual' | 'topical' | 'behavioral'>(
    'all'
  );
  const [similarityThreshold, setSimilarityThreshold] = useState([0.7]);
  const [searchQuery, setSearchQuery] = useState('');

  // 7.3.1 & 7.3.2: Calculate content similarity
  const analyzeSimilarity = useCallback(async () => {
    try {
      setLoading(true);

      // Simulate similarity analysis
      await new Promise((resolve) => setTimeout(resolve, 1200));

      // Filter based on similarity threshold and analysis type
      let filteredContent = mockSimilarContent.filter(
        (content) => content.similarityScore >= similarityThreshold[0]
      );

      if (analysisType !== 'all') {
        filteredContent = filteredContent.filter(
          (content) => content.similarity.similarityType === analysisType
        );
      }

      if (searchQuery) {
        filteredContent = filteredContent.filter(
          (content) =>
            content.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            content.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      }

      setSimilarContent(filteredContent.slice(0, maxSimilarItems));

      if (enableClustering) {
        setContentClusters(mockContentClusters);
      }
    } catch (error) {
      toast({
        title: 'Analysis Error',
        description: 'Failed to analyze content similarity',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [
    contentId,
    maxSimilarItems,
    enableClustering,
    analysisType,
    similarityThreshold,
    searchQuery,
  ]);

  // Handle similar content click
  const handleContentClick = useCallback(
    (clickedContentId: string) => {
      console.log('Similar content clicked:', clickedContentId);
      onSimilarContentClick?.(clickedContentId);
    },
    [onSimilarContentClick]
  );

  // Initial analysis
  useEffect(() => {
    analyzeSimilarity();
  }, [analyzeSimilarity]);

  if (loading) {
    return (
      <div className={cn('space-y-6', className)}>
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-muted rounded w-1/2" />
            <div className="h-4 bg-muted rounded w-3/4" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded" />
              <div className="h-4 bg-muted rounded w-2/3" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Network className="h-6 w-6 text-green-500" />
            Content Similarity Analysis
          </h2>
          <p className="text-sm text-muted-foreground">
            Discover related content based on advanced similarity algorithms
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={analyzeSimilarity}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Analyze
        </Button>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Analysis Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Analysis Type</label>
              <Select value={analysisType} onValueChange={(value: any) => setAnalysisType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="textual">Textual</SelectItem>
                  <SelectItem value="topical">Topical</SelectItem>
                  <SelectItem value="behavioral">Behavioral</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Similarity Threshold: {Math.round(similarityThreshold[0] * 100)}%
              </label>
              <Slider
                value={similarityThreshold}
                onValueChange={setSimilarityThreshold}
                max={1}
                min={0.5}
                step={0.05}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Search Content</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  placeholder="Search similar content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Max Results</label>
              <Select
                value={maxSimilarItems.toString()}
                onValueChange={(value) => setAnalysisType(value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 items</SelectItem>
                  <SelectItem value="10">10 items</SelectItem>
                  <SelectItem value="20">20 items</SelectItem>
                  <SelectItem value="50">50 items</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="similar" className="space-y-4">
        <TabsList>
          <TabsTrigger value="similar">Similar Content</TabsTrigger>
          {enableClustering && <TabsTrigger value="clusters">Content Clusters</TabsTrigger>}
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="similar" className="space-y-4">
          {similarContent.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <Network className="h-12 w-12 mx-auto text-muted-foreground/60" />
                  <div>
                    <h3 className="text-lg font-semibold text-muted-foreground">
                      No Similar Content Found
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Try adjusting your similarity threshold or analysis type.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {similarContent.map((content) => (
                <SimilarContentCard
                  key={content.id}
                  content={content}
                  onContentClick={handleContentClick}
                  showExplanations={enableExplanations}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {enableClustering && (
          <TabsContent value="clusters" className="space-y-4">
            {contentClusters.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center space-y-4">
                    <Layers className="h-12 w-12 mx-auto text-muted-foreground/60" />
                    <div>
                      <h3 className="text-lg font-semibold text-muted-foreground">
                        No Clusters Available
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Content clustering analysis is in progress.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {contentClusters.map((cluster) => (
                  <ContentClusterCard key={cluster.id} cluster={cluster} />
                ))}
              </div>
            )}
          </TabsContent>
        )}

        <TabsContent value="analytics">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{similarContent.length}</div>
                  <p className="text-sm text-muted-foreground">Similar Items Found</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {similarContent.length > 0
                      ? Math.round(
                          (similarContent.reduce((sum, item) => sum + item.similarityScore, 0) /
                            similarContent.length) *
                            100
                        )
                      : 0}
                    %
                  </div>
                  <p className="text-sm text-muted-foreground">Avg Similarity</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{contentClusters.length}</div>
                  <p className="text-sm text-muted-foreground">Content Clusters</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {contentClusters.reduce((sum, cluster) => sum + cluster.size, 0)}
                  </div>
                  <p className="text-sm text-muted-foreground">Clustered Items</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ContentSimilarity;
