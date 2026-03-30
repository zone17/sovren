import {
  IContentCreationService,
  ContentDraft,
  Content,
  MediaFile,
  MediaAsset,
  ValidationResult,
  ContentMetadata,
} from '../../interfaces/content';
import { ICacheService } from '../../interfaces/ICacheService';
import { IEventBusService } from '../../interfaces/IEventBusService';
import { IAuditLogService } from '../../interfaces/IAuditLogService';
import { INotificationService } from '../../interfaces/INotificationService';
import { IDatabase } from '../../interfaces/IDatabase';
import { Logger } from '../../utils/logger';
import { ServiceError } from '../../utils/errors';
import * as Joi from 'joi';
import slugify from 'slugify';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { uploadMedia } from '../storage/StorageService';
import path from 'path';
/**
 * ContentCreationService handles all content creation operations including
 * draft management, media uploads, validation, and auto-save functionality.
 *
 * This service ensures content integrity, provides rich metadata extraction,
 * and integrates with the notification system for collaborative features.
 *
 * @implements IContentCreationService
 */
export class ContentCreationService implements IContentCreationService {
  private readonly logger: Logger;
  private readonly autosaveInterval = 30000; // 30 seconds
  private readonly maxFileSize = {
    image: 10 * 1024 * 1024, // 10MB
    video: 100 * 1024 * 1024, // 100MB
  };
  private readonly allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  private readonly allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg'];
  // Validation schema for content
  private readonly contentSchema = Joi.object({
    title: Joi.string().max(200).required(),
    content: Joi.string().max(100000).required(),
    summary: Joi.string().max(500).optional(),
    tags: Joi.array().items(Joi.string().alphanum().max(50)).max(10).optional(),
    category: Joi.string().max(50).optional(),
    status: Joi.string().valid('draft', 'ready', 'scheduled').optional(),
    publishAt: Joi.date().iso().optional(),
    visibility: Joi.string().valid('public', 'private', 'unlisted').optional(),
    allowComments: Joi.boolean().optional(),
    featured: Joi.boolean().optional(),
  });
  constructor(
    private readonly db: IDatabase,
    private readonly cache: ICacheService,
    private readonly eventBus: IEventBusService,
    private readonly auditLog: IAuditLogService,
    private readonly notification: INotificationService
  ) {
    this.logger = new Logger(ContentCreationService.name);
  }
  /**
   * Creates a new content item from a draft
   * @param draft - The content draft to create
   * @returns The created content with generated ID and metadata
   */
  public async create(draft: ContentDraft): Promise<Content> {
    try {
      this.logger.info('Creating new content', { title: draft.title });
      // Validate the draft
      const validation = await this.validateContent(draft);
      if (!validation.isValid) {
        throw new ServiceError('Content validation failed', {
          details: { errors: validation.errors },
        });
      }
      // Generate unique slug
      const slug = await this.generateSlug(draft.title);
      // Extract metadata
      const metadata = await this.extractMetadata(draft);
      // Create content record
      const content: Content = {
        id: uuidv4(),
        ...draft,
        slug,
        metadata,
        status: draft.status || 'draft',
        visibility: draft.visibility || 'public',
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        authorId: draft.authorId,
      };
      // Save to database
      await this.db.query(
        `INSERT INTO content (
          id, title, slug, content, summary, tags, category,
          status, visibility, author_id, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          content.id,
          content.title,
          content.slug,
          content.content,
          content.summary,
          JSON.stringify(content.tags),
          content.category,
          content.status,
          content.visibility,
          content.authorId,
          JSON.stringify(content.metadata),
          content.createdAt,
          content.updatedAt,
        ]
      );
      // Cache the content
      await this.cache.set(
        `content:${content.id}`,
        content,
        300 // 5 minutes
      );
      // Log the creation
      await this.auditLog.log({
        action: 'content.created',
        entityType: 'content',
        entityId: content.id,
        userId: content.authorId,
        details: {
          title: content.title,
          status: content.status,
        },
        timestamp: new Date(),
      });
      // Emit event
      await this.eventBus.emit('content.created', {
        contentId: content.id,
        authorId: content.authorId,
        title: content.title,
        timestamp: Date.now(),
      });
      // Notify collaborators if any
      if (draft.collaborators && draft.collaborators.length > 0) {
        await this.notifyCollaborators(content, draft.collaborators);
      }
      this.logger.info('Content created successfully', {
        contentId: content.id,
        slug: content.slug,
      });
      return content;
    } catch (error) {
      this.logger.error('Failed to create content', error);
      throw new ServiceError('Content creation failed', {
        cause: error,
        context: { title: draft.title },
      });
    }
  }
  /**
   * Uploads and processes media files
   * @param file - The media file to upload
   * @returns The processed media asset information
   */
  public async uploadMedia(file: MediaFile): Promise<MediaAsset> {
    try {
      this.logger.info('Uploading media file', {
        filename: file.filename,
        mimetype: file.mimetype,
      });
      // Validate file type and size
      this.validateMediaFile(file);
      // Generate unique filename
      const assetId = uuidv4();
      const fileExt = path.extname(file.filename);
      let storagePath = `/uploads/${assetId}${fileExt}`;
      // Process image if applicable
      let processedFile: Buffer = file.buffer;
      let thumbnailPath: string | undefined;
      if (this.allowedImageTypes.includes(file.mimetype)) {
        // Optimize image
        processedFile = await this.optimizeImage(file.buffer);
        // Generate thumbnail
        thumbnailPath = await this.generateThumbnail(file.buffer, assetId);
      }
      // Save to object storage (Supabase Storage in prod, local fallback in dev)
      const uploadResult = await uploadMedia(storagePath, processedFile, file.mimetype);
      storagePath = uploadResult.url;
      // Create media asset record
      const mediaAsset: MediaAsset = {
        id: assetId,
        filename: file.filename,
        url: storagePath,
        thumbnailUrl: thumbnailPath,
        mimetype: file.mimetype,
        size: processedFile.length,
        uploadedAt: new Date(),
        metadata: {
          originalSize: file.buffer.length,
          optimized: true,
        },
      };
      // Save to database
      await this.db.query(
        `INSERT INTO media_assets (
          id, filename, url, thumbnail_url, mimetype, size, metadata, uploaded_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          mediaAsset.id,
          mediaAsset.filename,
          mediaAsset.url,
          mediaAsset.thumbnailUrl,
          mediaAsset.mimetype,
          mediaAsset.size,
          JSON.stringify(mediaAsset.metadata),
          mediaAsset.uploadedAt,
        ]
      );
      // Log the upload
      await this.auditLog.log({
        action: 'media.uploaded',
        entityType: 'media',
        entityId: mediaAsset.id,
        details: {
          filename: mediaAsset.filename,
          size: mediaAsset.size,
          mimetype: mediaAsset.mimetype,
        },
        timestamp: new Date(),
      });
      // Emit event
      await this.eventBus.emit('media.uploaded', {
        assetId: mediaAsset.id,
        filename: mediaAsset.filename,
        timestamp: Date.now(),
      });
      this.logger.info('Media uploaded successfully', {
        assetId: mediaAsset.id,
      });
      return mediaAsset;
    } catch (error) {
      this.logger.error('Failed to upload media', error);
      throw new ServiceError('Media upload failed', {
        cause: error,
        context: { filename: file.filename },
      });
    }
  }
  /**
   * Validates content against business rules
   * @param draft - The content draft to validate
   * @returns Validation result with any errors
   */
  public async validateContent(draft: ContentDraft): Promise<ValidationResult> {
    try {
      const validation = this.contentSchema.validate(draft, {
        abortEarly: false,
      });
      if (validation.error) {
        return {
          isValid: false,
          errors: validation.error.details.map((detail) => ({
            field: detail.path.join('.'),
            message: detail.message,
            type: detail.type,
          })),
        };
      }
      // Additional business rule validations
      const errors = [];
      // Check for duplicate slug if title changed
      if (draft.title) {
        const slug = slugify(draft.title, { lower: true, strict: true });
        const existing = await this.db.query(
          'SELECT id FROM content WHERE slug = $1 AND id != $2',
          [slug, draft.id || '']
        );
        if (existing.rows.length > 0) {
          errors.push({
            field: 'title',
            message: 'A content with similar title already exists',
            type: 'duplicate',
          });
        }
      }
      // Validate publish date if scheduled
      if (draft.status === 'scheduled' && !draft.publishAt) {
        errors.push({
          field: 'publishAt',
          message: 'Publish date is required for scheduled content',
          type: 'required',
        });
      }
      if (draft.publishAt && new Date(draft.publishAt) <= new Date()) {
        errors.push({
          field: 'publishAt',
          message: 'Publish date must be in the future',
          type: 'invalid',
        });
      }
      return {
        isValid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      this.logger.error('Content validation failed', error);
      throw new ServiceError('Validation error', {
        cause: error,
      });
    }
  }
  /**
   * Auto-saves content draft
   * @param contentId - The content ID to auto-save
   * @param draft - Partial draft updates
   */
  public async autosave(contentId: string, draft: Partial<ContentDraft>): Promise<void> {
    try {
      const cacheKey = `autosave:${contentId}`;
      // Get existing autosave or content
      let existing = await this.cache.get<Partial<ContentDraft>>(cacheKey);
      if (!existing) {
        const content = await this.getContent(contentId);
        existing = content;
      }
      // Merge updates
      const updated = {
        ...existing,
        ...draft,
        lastAutosave: new Date(),
      };
      // Save to cache with extended TTL
      await this.cache.set(
        cacheKey,
        updated,
        600 // 10 minutes
      );
      // Save to database (autosave table)
      await this.db.query(
        `INSERT INTO content_autosaves (content_id, draft_data, saved_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (content_id)
         DO UPDATE SET draft_data = $2, saved_at = $3`,
        [contentId, JSON.stringify(updated), new Date()]
      );
      // Emit autosave event
      await this.eventBus.emit('content.autosaved', {
        contentId,
        timestamp: Date.now(),
      });
      this.logger.debug('Content auto-saved', { contentId });
    } catch (error) {
      // Don't throw on autosave failure, just log
      this.logger.error('Autosave failed', error);
    }
  }
  /**
   * Generates a unique URL slug from title
   * @param title - The title to generate slug from
   * @returns A unique URL-safe slug
   */
  public async generateSlug(title: string): Promise<string> {
    let baseSlug = slugify(title, {
      lower: true,
      strict: true,
      trim: true,
    });
    // Ensure minimum length
    if (baseSlug.length < 3) {
      baseSlug = `content-${baseSlug}`;
    }
    // Check for uniqueness and append number if needed
    let slug = baseSlug;
    let counter = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await this.db.query('SELECT id FROM content WHERE slug = $1', [slug]);
      if (existing.rows.length === 0) {
        break;
      }
      slug = `${baseSlug}-${counter}`;
      counter++;
      if (counter > 100) {
        // Failsafe to prevent infinite loop
        slug = `${baseSlug}-${uuidv4().slice(0, 8)}`;
        break;
      }
    }
    return slug;
  }
  /**
   * Extracts metadata from content
   * @param draft - The content draft to analyze
   * @returns Extracted metadata
   */
  public async extractMetadata(draft: ContentDraft): Promise<ContentMetadata> {
    const wordCount = draft.content.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200); // 200 words per minute
    // Extract first paragraph as excerpt if no summary
    let excerpt = draft.summary;
    if (!excerpt) {
      const firstParagraph = draft.content.split('\n\n')[0];
      excerpt = firstParagraph.slice(0, 200) + '...';
    }
    // Extract hashtags from content
    const hashtags = draft.content.match(/#\w+/g) || [];
    // Detect language (simplified - in production use a library)
    const language = this.detectLanguage(draft.content);
    return {
      wordCount,
      readingTime,
      excerpt,
      hashtags: [...new Set(hashtags)], // Remove duplicates
      language,
      hasMedia: draft.mediaIds ? draft.mediaIds.length > 0 : false,
      lastModified: new Date(),
    };
  }
  /**
   * Get content by ID
   * @param contentId - The content ID to retrieve
   * @returns The content item
   */
  public async getContent(contentId: string): Promise<Content> {
    // Check cache first
    const cached = await this.cache.get<Content>(`content:${contentId}`);
    if (cached) {
      return cached;
    }
    const result = await this.db.query('SELECT * FROM content WHERE id = $1', [contentId]);
    if (result.rows.length === 0) {
      throw new ServiceError('Content not found', {
        context: { contentId },
      });
    }
    const content = result.rows[0];
    await this.cache.set(`content:${contentId}`, content, 300);
    return content;
  }
  /**
   * Update an existing content item
   * @param contentId - The content ID to update
   * @param updates - Partial content updates
   * @returns The updated content
   */
  public async updateContent(contentId: string, updates: Partial<ContentDraft>): Promise<Content> {
    await this.getContent(contentId);
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    if (updates.title !== undefined) {
      fields.push(`title = $${paramIndex++}`);
      values.push(updates.title);
    }
    if (updates.content !== undefined) {
      fields.push(`content = $${paramIndex++}`);
      values.push(updates.content);
    }
    if (updates.summary !== undefined) {
      fields.push(`summary = $${paramIndex++}`);
      values.push(updates.summary);
    }
    if (updates.tags !== undefined) {
      fields.push(`tags = $${paramIndex++}`);
      values.push(JSON.stringify(updates.tags));
    }
    if (updates.category !== undefined) {
      fields.push(`category = $${paramIndex++}`);
      values.push(updates.category);
    }
    if (updates.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    fields.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());
    values.push(contentId);
    if (fields.length > 1) {
      await this.db.query(
        `UPDATE content SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
        values
      );
    }
    // Invalidate cache
    await this.cache.delete(`content:${contentId}`);
    // Emit event
    await this.eventBus.emit('content.updated', {
      contentId,
      updatedFields: Object.keys(updates),
      timestamp: Date.now(),
    });
    return this.getContent(contentId);
  }
  /**
   * Delete a content item
   * @param contentId - The content ID to delete
   */
  public async deleteContent(contentId: string): Promise<void> {
    await this.getContent(contentId); // Verify exists
    await this.db.query('DELETE FROM content WHERE id = $1', [contentId]);
    // Invalidate cache
    await this.cache.delete(`content:${contentId}`);
    // Emit event
    await this.eventBus.emit('content.deleted', {
      contentId,
      timestamp: Date.now(),
    });
    this.logger.info('Content deleted', { contentId });
  }
  /**
   * Validates media file type and size
   */
  private validateMediaFile(file: MediaFile): void {
    const isImage = this.allowedImageTypes.includes(file.mimetype);
    const isVideo = this.allowedVideoTypes.includes(file.mimetype);
    if (!isImage && !isVideo) {
      throw new ServiceError('Invalid file type', {
        context: {
          mimetype: file.mimetype,
          allowed: [...this.allowedImageTypes, ...this.allowedVideoTypes],
        },
      });
    }
    const maxSize = isImage ? this.maxFileSize.image : this.maxFileSize.video;
    if (file.size > maxSize) {
      throw new ServiceError('File too large', {
        context: {
          size: file.size,
          maxSize,
        },
      });
    }
  }
  /**
   * Optimizes image for web delivery
   */
  private async optimizeImage(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .resize(2048, 2048, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();
  }
  /**
   * Generates thumbnail for image
   */
  private async generateThumbnail(buffer: Buffer, assetId: string): Promise<string> {
    const thumbnail = await sharp(buffer)
      .resize(400, 400, {
        fit: 'cover',
      })
      .jpeg({ quality: 75 })
      .toBuffer();
    const thumbnailStoragePath = `thumbnails/${assetId}.jpg`;
    const result = await uploadMedia(thumbnailStoragePath, thumbnail, 'image/jpeg');
    return result.url;
  }
  /**
   * Simple language detection
   */
  private detectLanguage(text: string): string {
    // Simplified detection - in production use a proper library
    // eslint-disable-next-line no-control-regex
    const hasNonAscii = /[^\x00-\x7F]/.test(text);
    return hasNonAscii ? 'unknown' : 'en';
  }
  /**
   * Notifies collaborators about new content
   */
  private async notifyCollaborators(content: Content, collaborators: string[]): Promise<void> {
    for (const collaboratorId of collaborators) {
      await this.notification.send({
        recipientId: collaboratorId,
        type: 'content_collaboration',
        title: 'New collaborative content',
        message: `You've been added as a collaborator on "${content.title}"`,
        data: {
          contentId: content.id,
          authorId: content.authorId,
        },
        channels: ['in_app', 'email'],
      });
    }
  }
}
