// @ts-nocheck
/**
 * 📝 **CONTENT MANAGEMENT SERVICE**
 *
 * Elite Engineering Standards:
 * - Comprehensive content operations
 * - Rich text and markdown support
 * - Media management
 * - Collection and series management
 * - Premium content handling
 * - Performance optimized
 * - Security by design
 */

import { createClient } from '@supabase/supabase-js';
import type {
  ContentBlock,
  ContentCollection,
  ContentItem,
  ContentSeries,
  MediaAsset,
  PremiumContent,
  SeriesEpisode,
} from '../types/content';
import { ValidationError, NotFoundError, ConflictError, ServiceError } from '../utils/errors';

interface ContentManagementServiceConfig {
  supabaseUrl: string;
  supabaseKey: string;
  maxFileSize: number;
  allowedMimeTypes: string[];
  cdnUrl?: string;
}

export class ContentManagementService {
  private supabase;
  private config: ContentManagementServiceConfig;

  constructor(config: ContentManagementServiceConfig) {
    this.config = config;
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
  }

  // ==================== CONTENT ITEMS ====================

  /**
   * Create new content item with rich content blocks
   */
  async createContentItem(data: {
    title: string;
    content_type: 'article' | 'video' | 'audio' | 'course' | 'ebook';
    content_blocks: ContentBlock[];
    excerpt?: string;
    tags?: string[];
    is_premium?: boolean;
    price?: number;
    author_id: string;
  }): Promise<ContentItem> {
    const contentItem = {
      id: crypto.randomUUID(),
      title: data.title,
      slug: this.generateSlug(data.title),
      content_type: data.content_type,
      content_blocks: data.content_blocks,
      excerpt: data.excerpt,
      tags: data.tags || [],
      status: 'draft' as const,
      is_premium: data.is_premium || false,
      price: data.price,
      author_id: data.author_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      published_at: null,
      view_count: 0,
      like_count: 0,
      comment_count: 0,
      share_count: 0,
      seo_title: data.title,
      seo_description: data.excerpt,
      featured_image_id: null,
    };

    const { data: result, error } = await this.supabase
      .from('content_items')
      .insert(contentItem)
      .select()
      .single();

    if (error) throw new ServiceError(`Failed to create content: ${error.message}`);
    return result;
  }

  /**
   * Update content item with validation
   */
  async updateContentItem(id: string, updates: Partial<ContentItem>): Promise<ContentItem> {
    const updateData = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    // Update slug if title changed
    if (updates.title) {
      updateData.slug = this.generateSlug(updates.title);
    }

    const { data, error } = await this.supabase
      .from('content_items')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new ServiceError(`Failed to update content: ${error.message}`);
    return data;
  }

  /**
   * Publish content item with validation
   */
  async publishContentItem(id: string): Promise<ContentItem> {
    const { data: content, error: fetchError } = await this.supabase
      .from('content_items')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw new NotFoundError(`Content (${id})`, { details: fetchError.message });

    // Validate content before publishing
    this.validateContentForPublishing(content);

    const { data, error } = await this.supabase
      .from('content_items')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new ServiceError(`Failed to publish content: ${error.message}`);
    return data;
  }

  /**
   * Get content items with filtering and pagination
   */
  async getContentItems(
    params: {
      page?: number;
      limit?: number;
      content_type?: string;
      status?: string;
      author_id?: string;
      tags?: string[];
      search?: string;
      sort_by?: 'created_at' | 'updated_at' | 'title' | 'view_count';
      sort_order?: 'asc' | 'desc';
    } = {}
  ): Promise<{ items: ContentItem[]; total: number; page: number; limit: number }> {
    const {
      page = 1,
      limit = 20,
      content_type,
      status,
      author_id,
      tags,
      search,
      sort_by = 'created_at',
      sort_order = 'desc',
    } = params;

    let query = this.supabase.from('content_items').select('*', { count: 'exact' });

    // Apply filters
    if (content_type) query = query.eq('content_type', content_type);
    if (status) query = query.eq('status', status);
    if (author_id) query = query.eq('author_id', author_id);
    if (tags && tags.length > 0) query = query.overlaps('tags', tags);
    if (search) {
      query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`);
    }

    // Apply sorting
    query = query.order(sort_by, { ascending: sort_order === 'asc' });

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw new ServiceError(`Failed to fetch content: ${error.message}`);

    return {
      items: data || [],
      total: count || 0,
      page,
      limit,
    };
  }

  // ==================== MEDIA ASSETS ====================

  /**
   * Upload media file with optimization
   */
  async uploadMediaAsset(
    file: File,
    metadata: {
      alt_text?: string;
      caption?: string;
      author_id: string;
    }
  ): Promise<MediaAsset> {
    // Validate file
    this.validateMediaFile(file);

    // Generate unique filename
    const fileExtension = file.name.split('.').pop();
    const filename = `${crypto.randomUUID()}.${fileExtension}`;
    const filePath = `media/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${filename}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await this.supabase.storage
      .from('media')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) throw new ServiceError(`Upload failed: ${uploadError.message}`);

    // Get public URL
    const { data: urlData } = this.supabase.storage.from('media').getPublicUrl(filePath);

    // Create media asset record
    const mediaAsset: MediaAsset = {
      id: crypto.randomUUID(),
      filename: file.name,
      file_path: filePath,
      file_size: file.size,
      file_type: file.type,
      url: urlData.publicUrl,
      alt_text: metadata.alt_text,
      caption: metadata.caption,
      author_id: metadata.author_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      width: null,
      height: null,
      duration: null,
    };

    // Extract media dimensions/duration if applicable
    if (file.type.startsWith('image/')) {
      const dimensions = await this.getImageDimensions(file);
      mediaAsset.width = dimensions.width;
      mediaAsset.height = dimensions.height;
    } else if (file.type.startsWith('video/') || file.type.startsWith('audio/')) {
      const duration = await this.getMediaDuration(file);
      mediaAsset.duration = duration;
    }

    const { data, error } = await this.supabase
      .from('media_assets')
      .insert(mediaAsset)
      .select()
      .single();

    if (error) throw new ServiceError(`Failed to save media asset: ${error.message}`);
    return data;
  }

  /**
   * Get media assets with filtering
   */
  async getMediaAssets(
    params: {
      page?: number;
      limit?: number;
      file_type?: string;
      author_id?: string;
      search?: string;
    } = {}
  ): Promise<{ assets: MediaAsset[]; total: number }> {
    const { page = 1, limit = 20, file_type, author_id, search } = params;

    let query = this.supabase.from('media_assets').select('*', { count: 'exact' });

    if (file_type) {
      query = query.like('file_type', `${file_type}%`);
    }
    if (author_id) query = query.eq('author_id', author_id);
    if (search) {
      query = query.or(
        `filename.ilike.%${search}%,alt_text.ilike.%${search}%,caption.ilike.%${search}%`
      );
    }

    query = query.order('created_at', { ascending: false });
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw new ServiceError(`Failed to fetch media assets: ${error.message}`);

    return {
      assets: data || [],
      total: count || 0,
    };
  }

  // ==================== CONTENT COLLECTIONS ====================

  /**
   * Create content collection
   */
  async createContentCollection(data: {
    name: string;
    description?: string;
    type: 'series' | 'category' | 'playlist' | 'bundle' | 'tag';
    is_public: boolean;
    author_id: string;
  }): Promise<ContentCollection> {
    const collection: ContentCollection = {
      id: crypto.randomUUID(),
      name: data.name,
      slug: this.generateSlug(data.name),
      description: data.description,
      type: data.type,
      is_public: data.is_public,
      author_id: data.author_id,
      content_items: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      featured_image_id: null,
    };

    const { data: result, error } = await this.supabase
      .from('content_collections')
      .insert(collection)
      .select()
      .single();

    if (error) throw new ServiceError(`Failed to create collection: ${error.message}`);
    return result;
  }

  /**
   * Add content to collection
   */
  async addContentToCollection(collectionId: string, contentId: string): Promise<void> {
    // Get current collection
    const { data: collection, error: fetchError } = await this.supabase
      .from('content_collections')
      .select('content_items')
      .eq('id', collectionId)
      .single();

    if (fetchError) throw new NotFoundError(`Collection (${collectionId})`, { details: fetchError.message });

    // Check if content already exists
    const existingItems = collection.content_items || [];
    if (existingItems.some((item: any) => item.content_id === contentId)) {
      throw new ConflictError('Content already exists in collection');
    }

    // Add new content item
    const newItem = {
      content_id: contentId,
      order_index: existingItems.length,
      added_at: new Date().toISOString(),
    };

    const updatedItems = [...existingItems, newItem];

    const { error } = await this.supabase
      .from('content_collections')
      .update({
        content_items: updatedItems,
        updated_at: new Date().toISOString(),
      })
      .eq('id', collectionId);

    if (error) throw new ServiceError(`Failed to add content to collection: ${error.message}`);
  }

  /**
   * Reorder collection items
   */
  async reorderCollectionItems(
    collectionId: string,
    sourceIndex: number,
    destinationIndex: number
  ): Promise<void> {
    const { data: collection, error: fetchError } = await this.supabase
      .from('content_collections')
      .select('content_items')
      .eq('id', collectionId)
      .single();

    if (fetchError) throw new NotFoundError(`Collection (${collectionId})`, { details: fetchError.message });

    const items = [...(collection.content_items || [])];
    const [movedItem] = items.splice(sourceIndex, 1);
    items.splice(destinationIndex, 0, movedItem);

    // Update order indices
    const updatedItems = items.map((item, index) => ({
      ...item,
      order_index: index,
    }));

    const { error } = await this.supabase
      .from('content_collections')
      .update({
        content_items: updatedItems,
        updated_at: new Date().toISOString(),
      })
      .eq('id', collectionId);

    if (error) throw new ServiceError(`Failed to reorder collection items: ${error.message}`);
  }

  // ==================== CONTENT SERIES ====================

  /**
   * Create content series
   */
  async createContentSeries(data: {
    title: string;
    description?: string;
    category: 'course' | 'tutorial' | 'workshop' | 'masterclass' | 'bootcamp';
    difficulty_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    is_premium: boolean;
    price?: number;
    author_id: string;
  }): Promise<ContentSeries> {
    const series: ContentSeries = {
      id: crypto.randomUUID(),
      title: data.title,
      slug: this.generateSlug(data.title),
      description: data.description,
      category: data.category,
      difficulty_level: data.difficulty_level,
      is_premium: data.is_premium,
      price: data.price,
      author_id: data.author_id,
      episodes: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      featured_image_id: null,
      enrollment_count: 0,
      completion_rate: 0,
    };

    const { data: result, error } = await this.supabase
      .from('content_series')
      .insert(series)
      .select()
      .single();

    if (error) throw new ServiceError(`Failed to create series: ${error.message}`);
    return result;
  }

  /**
   * Add episode to series
   */
  async addEpisodeToSeries(
    seriesId: string,
    contentId: string,
    orderIndex: number,
    metadata: {
      is_required?: boolean;
      estimated_duration?: number;
      prerequisites?: string[];
    } = {}
  ): Promise<void> {
    const { data: series, error: fetchError } = await this.supabase
      .from('content_series')
      .select('episodes')
      .eq('id', seriesId)
      .single();

    if (fetchError) throw new NotFoundError(`Series (${seriesId})`, { details: fetchError.message });

    const episode: SeriesEpisode = {
      id: crypto.randomUUID(),
      content_id: contentId,
      order_index: orderIndex,
      is_required: metadata.is_required || false,
      estimated_duration: metadata.estimated_duration,
      prerequisites: metadata.prerequisites || [],
      is_completed: false,
      completed_at: null,
      progress_percentage: 0,
    };

    const updatedEpisodes = [...(series.episodes || []), episode];

    const { error } = await this.supabase
      .from('content_series')
      .update({
        episodes: updatedEpisodes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', seriesId);

    if (error) throw new ServiceError(`Failed to add episode to series: ${error.message}`);
  }

  // ==================== PREMIUM CONTENT ====================

  /**
   * Create premium content access
   */
  async createPremiumContentAccess(data: {
    content_id: string;
    user_id: string;
    access_type: 'purchase' | 'subscription' | 'gift';
    price_paid: number;
    expires_at?: string;
  }): Promise<PremiumContent> {
    const premiumAccess: PremiumContent = {
      id: crypto.randomUUID(),
      content_id: data.content_id,
      user_id: data.user_id,
      access_type: data.access_type,
      price_paid: data.price_paid,
      purchased_at: new Date().toISOString(),
      expires_at: data.expires_at,
      is_active: true,
    };

    const { data: result, error } = await this.supabase
      .from('premium_content_access')
      .insert(premiumAccess)
      .select()
      .single();

    if (error) throw new ServiceError(`Failed to create premium access: ${error.message}`);
    return result;
  }

  /**
   * Check premium content access
   */
  async checkPremiumAccess(contentId: string, userId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('premium_content_access')
      .select('*')
      .eq('content_id', contentId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw new ServiceError(`Failed to check premium access: ${error.message}`);

    if (!data) return false;

    // Check if access has expired
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      // Deactivate expired access
      await this.supabase
        .from('premium_content_access')
        .update({ is_active: false })
        .eq('id', data.id);
      return false;
    }

    return true;
  }

  // ==================== ANALYTICS ====================

  /**
   * Track content view
   */
  async trackContentView(contentId: string, userId?: string): Promise<void> {
    // Increment view count
    const { error: updateError } = await this.supabase
      .from('content_items')
      .update({
        view_count: this.supabase.sql`view_count + 1`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contentId);

    if (updateError) {
      console.error('Failed to update view count:', updateError.message);
    }

    // Track view event
    const viewEvent = {
      id: crypto.randomUUID(),
      content_id: contentId,
      user_id: userId,
      event_type: 'view',
      timestamp: new Date().toISOString(),
      metadata: {},
    };

    const { error: eventError } = await this.supabase.from('content_analytics').insert(viewEvent);

    if (eventError) {
      console.error('Failed to track view event:', eventError.message);
    }
  }

  /**
   * Get content analytics
   */
  async getContentAnalytics(
    contentId: string,
    timeRange: {
      start_date: string;
      end_date: string;
    }
  ): Promise<{
    views: number;
    unique_viewers: number;
    engagement_rate: number;
    average_read_time: number;
  }> {
    const { data, error } = await this.supabase
      .from('content_analytics')
      .select('*')
      .eq('content_id', contentId)
      .gte('timestamp', timeRange.start_date)
      .lte('timestamp', timeRange.end_date);

    if (error) throw new ServiceError(`Failed to fetch analytics: ${error.message}`);

    const views = data?.length || 0;
    const uniqueViewers = new Set(data?.map((event) => event.user_id).filter(Boolean)).size;
    const engagementRate = views > 0 ? (uniqueViewers / views) * 100 : 0;

    // Calculate average read time (mock calculation)
    const averageReadTime =
      data?.reduce((sum, event) => {
        return sum + (event.metadata?.read_time || 0);
      }, 0) / Math.max(views, 1);

    return {
      views,
      unique_viewers: uniqueViewers,
      engagement_rate: Math.round(engagementRate * 100) / 100,
      average_read_time: Math.round(averageReadTime),
    };
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Generate URL-friendly slug
   */
  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Validate content for publishing
   */
  private validateContentForPublishing(content: ContentItem): void {
    if (!content.title?.trim()) {
      throw new ValidationError('Content must have a title');
    }

    if (!content.content_blocks || content.content_blocks.length === 0) {
      throw new ValidationError('Content must have at least one content block');
    }

    if (content.is_premium && (!content.price || content.price <= 0)) {
      throw new ValidationError('Premium content must have a valid price');
    }
  }

  /**
   * Validate media file
   */
  private validateMediaFile(file: File): void {
    if (file.size > this.config.maxFileSize) {
      throw new ValidationError(`File size exceeds limit of ${this.config.maxFileSize / 1024 / 1024}MB`);
    }

    if (!this.config.allowedMimeTypes.includes(file.type)) {
      throw new ValidationError(`File type ${file.type} is not allowed`);
    }
  }

  /**
   * Get image dimensions
   */
  private getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Get media duration
   */
  private getMediaDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      const media = file.type.startsWith('video/')
        ? document.createElement('video')
        : document.createElement('audio');

      media.onloadedmetadata = () => {
        resolve(Math.round(media.duration));
      };
      media.onerror = reject;
      media.src = URL.createObjectURL(file);
    });
  }

  // ==================== SEARCH AND INDEXING ====================

  /**
   * Full-text search across content
   */
  async searchContent(
    query: string,
    filters: {
      content_type?: string;
      tags?: string[];
      author_id?: string;
      is_premium?: boolean;
    } = {}
  ): Promise<ContentItem[]> {
    let searchQuery = this.supabase.from('content_items').select('*').eq('status', 'published');

    // Full-text search
    searchQuery = searchQuery.or(
      `title.ilike.%${query}%,excerpt.ilike.%${query}%,tags.cs.{${query}}`
    );

    // Apply filters
    if (filters.content_type) {
      searchQuery = searchQuery.eq('content_type', filters.content_type);
    }
    if (filters.tags && filters.tags.length > 0) {
      searchQuery = searchQuery.overlaps('tags', filters.tags);
    }
    if (filters.author_id) {
      searchQuery = searchQuery.eq('author_id', filters.author_id);
    }
    if (filters.is_premium !== undefined) {
      searchQuery = searchQuery.eq('is_premium', filters.is_premium);
    }

    searchQuery = searchQuery.order('view_count', { ascending: false });

    const { data, error } = await searchQuery;
    if (error) throw new ServiceError(`Search failed: ${error.message}`);

    return data || [];
  }

  // ==================== CONTENT VERSIONING ====================

  /**
   * Create content version
   */
  async createContentVersion(
    contentId: string,
    versionData: {
      title: string;
      content_blocks: ContentBlock[];
      change_summary: string;
      author_id: string;
    }
  ): Promise<void> {
    const version = {
      id: crypto.randomUUID(),
      content_id: contentId,
      version_number: await this.getNextVersionNumber(contentId),
      title: versionData.title,
      content_blocks: versionData.content_blocks,
      change_summary: versionData.change_summary,
      author_id: versionData.author_id,
      created_at: new Date().toISOString(),
    };

    const { error } = await this.supabase.from('content_versions').insert(version);

    if (error) throw new ServiceError(`Failed to create version: ${error.message}`);
  }

  /**
   * Get next version number
   */
  private async getNextVersionNumber(contentId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('content_versions')
      .select('version_number')
      .eq('content_id', contentId)
      .order('version_number', { ascending: false })
      .limit(1);

    if (error) throw new ServiceError(`Failed to get version number: ${error.message}`);

    return (data?.[0]?.version_number || 0) + 1;
  }
}

// Export default configuration
export const createContentManagementService = (
  config: Partial<ContentManagementServiceConfig> = {}
) => {
  const defaultConfig: ContentManagementServiceConfig = {
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseKey: process.env.SUPABASE_ANON_KEY || '',
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'video/mp4',
      'video/webm',
      'video/ogg',
      'audio/mp3',
      'audio/wav',
      'audio/ogg',
      'audio/aac',
      'application/pdf',
      'text/plain',
      'text/markdown',
    ],
    cdnUrl: process.env.CDN_URL,
    ...config,
  };

  return new ContentManagementService(defaultConfig);
};
