import { ContentCreationService } from '../ContentCreationService';
import { ICacheService } from '../../../interfaces/ICacheService';
import { IEventBusService } from '../../../interfaces/IEventBusService';
import { IAuditLogService } from '../../../interfaces/IAuditLogService';
import { INotificationService } from '../../../interfaces/INotificationService';
import { IDatabase } from '../../../interfaces/IDatabase';
import { ServiceError } from '../../../utils/errors';
import { ContentDraft, MediaFile } from '../../../interfaces/content';

// Mock dependencies
const mockDb = {
  query: jest.fn(),
} as unknown as IDatabase;

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  exists: jest.fn(),
} as unknown as ICacheService;

const mockEventBus = {
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
} as unknown as IEventBusService;

const mockAuditLog = {
  log: jest.fn(),
  query: jest.fn(),
} as unknown as IAuditLogService;

const mockNotification = {
  send: jest.fn(),
  sendBulk: jest.fn(),
} as unknown as INotificationService;

describe('ContentCreationService', () => {
  let service: ContentCreationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContentCreationService(
      mockDb,
      mockCache,
      mockEventBus,
      mockAuditLog,
      mockNotification
    );
  });

  describe('create', () => {
    const validDraft: ContentDraft = {
      title: 'Test Article',
      content: 'This is a test article content that is quite long and detailed.',
      summary: 'Test summary',
      tags: ['test', 'article'],
      category: 'technology',
      status: 'draft',
      visibility: 'public',
      authorId: 'user-123',
    };

    it('should create content successfully', async () => {
      // Arrange
      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // slug check
        .mockResolvedValueOnce({ rows: [] }); // insert

      // Act
      const result = await service.create(validDraft);

      // Assert
      expect(result).toMatchObject({
        title: validDraft.title,
        content: validDraft.content,
        status: 'draft',
        visibility: 'public',
        authorId: 'user-123',
      });
      expect(result.id).toBeDefined();
      expect(result.slug).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.wordCount).toBeGreaterThan(0);
      expect(result.metadata.readingTime).toBeGreaterThan(0);
    });

    it('should emit content.created event', async () => {
      // Arrange
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      // Act
      await service.create(validDraft);

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'content.created',
        expect.objectContaining({
          title: validDraft.title,
          authorId: validDraft.authorId,
        })
      );
    });

    it('should log content creation to audit trail', async () => {
      // Arrange
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      // Act
      await service.create(validDraft);

      // Assert
      expect(mockAuditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'content.created',
          entityType: 'content',
          userId: validDraft.authorId,
        })
      );
    });

    it('should cache created content', async () => {
      // Arrange
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      // Act
      const result = await service.create(validDraft);

      // Assert
      expect(mockCache.set).toHaveBeenCalledWith(
        `content:${result.id}`,
        expect.objectContaining({
          title: validDraft.title,
        }),
        300
      );
    });

    it('should notify collaborators if specified', async () => {
      // Arrange
      const draftWithCollaborators = {
        ...validDraft,
        collaborators: ['user-456', 'user-789'],
      };
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      // Act
      await service.create(draftWithCollaborators);

      // Assert
      expect(mockNotification.send).toHaveBeenCalledTimes(2);
      expect(mockNotification.send).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'user-456',
          type: 'content_collaboration',
        })
      );
    });

    it('should throw error for invalid content', async () => {
      // Arrange
      const invalidDraft = {
        ...validDraft,
        title: '', // Invalid: empty title
      };

      // Act & Assert
      await expect(service.create(invalidDraft)).rejects.toThrow(ServiceError);
    });

    it('should handle duplicate slug by appending number', async () => {
      // Arrange
      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'existing' }] }) // First slug exists
        .mockResolvedValueOnce({ rows: [] }) // Second slug available
        .mockResolvedValueOnce({ rows: [] }); // Insert

      // Act
      const result = await service.create(validDraft);

      // Assert
      expect(result.slug).toMatch(/test-article-\d+/);
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      (mockDb.query as jest.Mock).mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(service.create(validDraft)).rejects.toThrow(ServiceError);
    });
  });

  describe('uploadMedia', () => {
    const validImageFile: MediaFile = {
      filename: 'test-image.jpg',
      mimetype: 'image/jpeg',
      buffer: Buffer.from('fake-image-data'),
      size: 1024 * 1024, // 1MB
    };

    it('should upload image successfully', async () => {
      // Arrange
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      // Act
      const result = await service.uploadMedia(validImageFile);

      // Assert
      expect(result).toMatchObject({
        filename: 'test-image.jpg',
        mimetype: 'image/jpeg',
      });
      expect(result.id).toBeDefined();
      expect(result.url).toBeDefined();
      expect(result.thumbnailUrl).toBeDefined();
    });

    it('should emit media.uploaded event', async () => {
      // Arrange
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      // Act
      await service.uploadMedia(validImageFile);

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'media.uploaded',
        expect.objectContaining({
          filename: 'test-image.jpg',
        })
      );
    });

    it('should log media upload to audit trail', async () => {
      // Arrange
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      // Act
      await service.uploadMedia(validImageFile);

      // Assert
      expect(mockAuditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'media.uploaded',
          entityType: 'media',
        })
      );
    });

    it('should reject files that are too large', async () => {
      // Arrange
      const largeFile: MediaFile = {
        ...validImageFile,
        size: 11 * 1024 * 1024, // 11MB (over limit)
      };

      // Act & Assert
      await expect(service.uploadMedia(largeFile)).rejects.toThrow(ServiceError);
    });

    it('should reject unsupported file types', async () => {
      // Arrange
      const invalidFile: MediaFile = {
        ...validImageFile,
        mimetype: 'application/pdf',
      };

      // Act & Assert
      await expect(service.uploadMedia(invalidFile)).rejects.toThrow(ServiceError);
    });

    it('should handle video files', async () => {
      // Arrange
      const videoFile: MediaFile = {
        filename: 'test-video.mp4',
        mimetype: 'video/mp4',
        buffer: Buffer.from('fake-video-data'),
        size: 50 * 1024 * 1024, // 50MB
      };
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      // Act
      const result = await service.uploadMedia(videoFile);

      // Assert
      expect(result.mimetype).toBe('video/mp4');
      expect(result.thumbnailUrl).toBeUndefined(); // No thumbnail for videos
    });
  });

  describe('validateContent', () => {
    it('should validate valid content', async () => {
      // Arrange
      const draft: ContentDraft = {
        title: 'Valid Title',
        content: 'Valid content here',
        tags: ['valid', 'tags'],
        authorId: 'user-123',
      };
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      // Act
      const result = await service.validateContent(draft);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should detect title too long', async () => {
      // Arrange
      const draft: ContentDraft = {
        title: 'a'.repeat(201), // Over 200 char limit
        content: 'Content',
        authorId: 'user-123',
      };

      // Act
      const result = await service.validateContent(draft);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'title',
        })
      );
    });

    it('should detect duplicate slug', async () => {
      // Arrange
      const draft: ContentDraft = {
        title: 'Existing Article',
        content: 'Content',
        authorId: 'user-123',
      };
      (mockDb.query as jest.Mock).mockResolvedValue({
        rows: [{ id: 'existing-id' }],
      });

      // Act
      const result = await service.validateContent(draft);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'title',
          type: 'duplicate',
        })
      );
    });

    it('should require publishAt for scheduled content', async () => {
      // Arrange
      const draft: ContentDraft = {
        title: 'Scheduled Post',
        content: 'Content',
        status: 'scheduled',
        authorId: 'user-123',
      };
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      // Act
      const result = await service.validateContent(draft);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'publishAt',
          message: expect.stringContaining('required'),
        })
      );
    });

    it('should validate publishAt is in future', async () => {
      // Arrange
      const draft: ContentDraft = {
        title: 'Scheduled Post',
        content: 'Content',
        status: 'scheduled',
        publishAt: new Date('2020-01-01'), // Past date
        authorId: 'user-123',
      };
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      // Act
      const result = await service.validateContent(draft);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'publishAt',
          message: expect.stringContaining('future'),
        })
      );
    });

    it('should validate tags are alphanumeric', async () => {
      // Arrange
      const draft: ContentDraft = {
        title: 'Post',
        content: 'Content',
        tags: ['valid-tag!'], // Invalid: contains special char
        authorId: 'user-123',
      };

      // Act
      const result = await service.validateContent(draft);

      // Assert
      expect(result.isValid).toBe(false);
    });

    it('should limit tags to 10', async () => {
      // Arrange
      const draft: ContentDraft = {
        title: 'Post',
        content: 'Content',
        tags: Array(11).fill('tag'), // 11 tags (over limit)
        authorId: 'user-123',
      };

      // Act
      const result = await service.validateContent(draft);

      // Assert
      expect(result.isValid).toBe(false);
    });
  });

  describe('autosave', () => {
    it('should save draft to cache', async () => {
      // Arrange
      const contentId = 'content-123';
      const draft = { content: 'Updated content' };
      (mockCache.get as jest.Mock).mockResolvedValue(null);
      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{ id: contentId, title: 'Original' }],
        })
        .mockResolvedValueOnce({ rows: [] });

      // Act
      await service.autosave(contentId, draft);

      // Assert
      expect(mockCache.set).toHaveBeenCalledWith(
        `autosave:${contentId}`,
        expect.objectContaining({
          content: 'Updated content',
          title: 'Original',
        }),
        600
      );
    });

    it('should save to database autosaves table', async () => {
      // Arrange
      const contentId = 'content-123';
      const draft = { content: 'Updated' };
      (mockCache.get as jest.Mock).mockResolvedValue({ title: 'Cached' });
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      // Act
      await service.autosave(contentId, draft);

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO content_autosaves'),
        expect.arrayContaining([contentId])
      );
    });

    it('should emit autosaved event', async () => {
      // Arrange
      const contentId = 'content-123';
      (mockCache.get as jest.Mock).mockResolvedValue({ title: 'Cached' });
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      // Act
      await service.autosave(contentId, {});

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'content.autosaved',
        expect.objectContaining({ contentId })
      );
    });

    it('should not throw on failure', async () => {
      // Arrange
      (mockCache.get as jest.Mock).mockRejectedValue(new Error('Cache error'));

      // Act & Assert - Should not throw
      await expect(
        service.autosave('content-123', {})
      ).resolves.toBeUndefined();
    });
  });

  describe('generateSlug', () => {
    it('should generate slug from title', async () => {
      // Arrange
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      // Act
      const slug = await service.generateSlug('Hello World!');

      // Assert
      expect(slug).toBe('hello-world');
    });

    it('should handle special characters', async () => {
      // Arrange
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      // Act
      const slug = await service.generateSlug('Hello & Goodbye @ 2024');

      // Assert
      expect(slug).toBe('hello-goodbye-2024');
    });

    it('should append number for duplicates', async () => {
      // Arrange
      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: '1' }] }) // First exists
        .mockResolvedValueOnce({ rows: [{ id: '2' }] }) // Second exists
        .mockResolvedValueOnce({ rows: [] }); // Third available

      // Act
      const slug = await service.generateSlug('Duplicate Title');

      // Assert
      expect(slug).toBe('duplicate-title-2');
    });

    it('should add prefix for short slugs', async () => {
      // Arrange
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      // Act
      const slug = await service.generateSlug('Hi');

      // Assert
      expect(slug).toBe('content-hi');
    });

    it('should handle infinite loop protection', async () => {
      // Arrange - Always return duplicate
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [{ id: '1' }] });

      // Act
      const slug = await service.generateSlug('Always Duplicate');

      // Assert - Should append UUID after 100 attempts
      expect(slug).toMatch(/always-duplicate-[a-f0-9]{8}/);
    });
  });

  describe('extractMetadata', () => {
    it('should calculate word count and reading time', async () => {
      // Arrange
      const draft: ContentDraft = {
        title: 'Test',
        content: 'This is a test article. '.repeat(40), // 200 words
        authorId: 'user-123',
      };

      // Act
      const metadata = await service.extractMetadata(draft);

      // Assert
      expect(metadata.wordCount).toBe(200);
      expect(metadata.readingTime).toBe(1); // 200 words / 200 wpm
    });

    it('should extract excerpt from content if no summary', async () => {
      // Arrange
      const draft: ContentDraft = {
        title: 'Test',
        content: 'First paragraph here.\n\nSecond paragraph here.',
        authorId: 'user-123',
      };

      // Act
      const metadata = await service.extractMetadata(draft);

      // Assert
      expect(metadata.excerpt).toContain('First paragraph');
      expect(metadata.excerpt).not.toContain('Second paragraph');
    });

    it('should use provided summary as excerpt', async () => {
      // Arrange
      const draft: ContentDraft = {
        title: 'Test',
        content: 'Content here',
        summary: 'Custom summary',
        authorId: 'user-123',
      };

      // Act
      const metadata = await service.extractMetadata(draft);

      // Assert
      expect(metadata.excerpt).toBe('Custom summary');
    });

    it('should extract hashtags', async () => {
      // Arrange
      const draft: ContentDraft = {
        title: 'Test',
        content: 'Check out #nodejs and #typescript. Also #nodejs again.',
        authorId: 'user-123',
      };

      // Act
      const metadata = await service.extractMetadata(draft);

      // Assert
      expect(metadata.hashtags).toEqual(['#nodejs', '#typescript']);
    });

    it('should detect media presence', async () => {
      // Arrange
      const draft: ContentDraft = {
        title: 'Test',
        content: 'Content',
        mediaIds: ['media-1', 'media-2'],
        authorId: 'user-123',
      };

      // Act
      const metadata = await service.extractMetadata(draft);

      // Assert
      expect(metadata.hasMedia).toBe(true);
    });

    it('should handle empty content gracefully', async () => {
      // Arrange
      const draft: ContentDraft = {
        title: 'Test',
        content: '',
        authorId: 'user-123',
      };

      // Act
      const metadata = await service.extractMetadata(draft);

      // Assert
      expect(metadata.wordCount).toBe(0);
      expect(metadata.readingTime).toBe(0);
      expect(metadata.hashtags).toEqual([]);
    });
  });
});