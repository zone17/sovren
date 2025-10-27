/**
 * Content type definitions specifically for React Query hooks
 * These types are simplified for API interactions
 */

export type ContentType = 'article' | 'video' | 'audio' | 'image' | 'poll' | 'livestream';
export type ContentStatus = 'draft' | 'published' | 'archived' | 'deleted';

export interface Content {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorPicture?: string;
  title: string;
  description?: string;
  content: string; // Main content (markdown, HTML, or plain text)
  type: ContentType;
  category?: string;
  tags: string[];
  coverImage?: string;
  mediaUrl?: string; // For video/audio content
  isPremium: boolean;
  price?: number; // In sats for premium content
  viewCount: number;
  likeCount: number;
  zapCount: number;
  commentCount: number;
  shareCount: number;
  status: ContentStatus;
  publishedAt?: string;
  scheduledAt?: string;
  createdAt: string;
  updatedAt: string;
  nostrEventId?: string; // NOSTR event ID if published to NOSTR
}

export interface ContentItemDetail extends Content {
  // Extended content data when fetching individual item
  creator: {
    id: string;
    pubkey: string;
    name: string;
    picture?: string;
    verified: boolean;
    followerCount: number;
  };
  stats: {
    totalRevenue: number;
    uniqueViewers: number;
    averageWatchTime?: number; // For video/audio
    completionRate?: number; // For video/audio
    engagementRate: number;
  };
  relatedContent?: {
    id: string;
    title: string;
    coverImage?: string;
    type: ContentType;
  }[];
  comments?: {
    id: string;
    authorId: string;
    authorName: string;
    authorPicture?: string;
    content: string;
    createdAt: string;
  }[];
}

export interface ContentFilters {
  creatorId?: string;
  type?: ContentType;
  category?: string;
  tags?: string[];
  search?: string;
  sortBy?: 'recent' | 'popular' | 'trending' | 'revenue';
  isPremium?: boolean;
  status?: ContentStatus;
  limit?: number;
}

export interface ContentResponse {
  content: Content[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateContentInput {
  title: string;
  description?: string;
  content: string;
  type: ContentType;
  category?: string;
  tags?: string[];
  coverImage?: string;
  mediaUrl?: string;
  isPremium?: boolean;
  price?: number;
  status?: ContentStatus;
  scheduledAt?: string;
}

export interface UpdateContentInput extends Partial<CreateContentInput> {
  // All fields optional for updates
}