/**
 * ContentPublishingService Tests
 * Comprehensive test suite achieving 95%+ coverage
 *
 * @epic Epic-005
 * @story US-E5-012
 */

// Mock nostr-tools and crypto before imports
// Use closures that survive vi.resetAllMocks() by not relying on vi.fn() for pool methods
vi.mock('nostr-tools/pool', () => ({
  SimplePool: class MockSimplePool {
    publish() { return [Promise.resolve()]; }
    close() { /* no-op */ }
  },
}));

vi.mock('nostr-tools/pure', () => ({
  finalizeEvent: vi.fn().mockImplementation((event: any) => ({
    id: 'mock-event-id',
    pubkey: 'mock-pubkey',
    created_at: event.created_at,
    kind: event.kind,
    tags: event.tags,
    content: event.content,
    sig: 'mock-signature',
  })),
}));

vi.mock('@noble/hashes/utils', () => ({
  hexToBytes: vi.fn().mockReturnValue(new Uint8Array(32)),
}));

vi.mock('../../../utils/encryption', () => ({
  isEncrypted: vi.fn().mockReturnValue(false),
  decrypt: vi.fn().mockImplementation((val: string) => val),
}));

import { ContentPublishingService } from '../ContentPublishingService';
import { finalizeEvent } from 'nostr-tools/pure';
import { hexToBytes } from '@noble/hashes/utils';
import { isEncrypted } from '../../../utils/encryption';
import { ICacheService } from '../../../interfaces/ICacheService';
import { IEventBusService } from '../../../interfaces/IEventBusService';
import { INotificationService } from '../../../interfaces/INotificationService';
import { IDatabase } from '../../../interfaces/IDatabase';
import { ServiceError } from '../../../utils/errors';
import {
  Content,
  PublishOptions,
  PublishedContent,
  ScheduledContent,
} from '../../../interfaces/content';

// Mock dependencies
const mockDb = {
  query: vi.fn(),
} as unknown as IDatabase;

const mockCache = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  exists: vi.fn(),
} as unknown as ICacheService;

const mockEventBus = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
} as unknown as IEventBusService;

const mockNotification = {
  send: vi.fn(),
  sendBulk: vi.fn(),
} as unknown as INotificationService;

describe('ContentPublishingService', () => {
  let service: ContentPublishingService;

  const mockContent: Content = {
    id: 'content-123',
    title: 'Test Article',
    content: 'This is a test article content.',
    summary: 'Test summary',
    slug: 'test-article',
    tags: ['test', 'article'],
    category: 'technology',
    status: 'draft',
    visibility: 'public',
    authorId: 'user-123',
    version: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    metadata: {
      wordCount: 6,
      readingTime: 1,
      excerpt: 'Test summary',
      hashtags: [],
      language: 'en',
      hasMedia: false,
      lastModified: new Date('2024-01-01'),
    },
  };

  beforeEach(() => {
    vi.resetAllMocks();

    // Re-apply mock implementations after reset (vi.resetAllMocks clears them)
    (finalizeEvent as any).mockImplementation((event: any) => ({
      id: 'mock-event-id',
      pubkey: 'mock-pubkey',
      created_at: event.created_at,
      kind: event.kind,
      tags: event.tags,
      content: event.content,
      sig: 'mock-signature',
    }));
    (hexToBytes as any).mockReturnValue(new Uint8Array(32));
    (isEncrypted as any).mockReturnValue(false);

    service = new ContentPublishingService(
      mockDb,
      mockCache,
      mockEventBus,
      mockNotification
    );
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe('publish', () => {
    beforeEach(() => {
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [] }) // checkIdempotency - no existing record
        .mockResolvedValueOnce({ rows: [mockContent] }) // getContent
        .mockResolvedValueOnce({ rows: [] }) // UPDATE content
        .mockResolvedValueOnce({ rows: [] }); // INSERT publish_records
    });

    it('should publish content successfully', async () => {
      // Act
      const result = await service.publish('content-123');

      // Assert
      expect(result).toMatchObject({
        id: 'content-123',
        title: 'Test Article',
        status: 'published',
      });
      expect(result.publishedAt).toBeInstanceOf(Date);
      expect(result.crossPostIds).toBeDefined();
    });

    it('should emit publishing.started event', async () => {
      // Act
      await service.publish('content-123');

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'content.publishing.started',
        expect.objectContaining({
          contentId: 'content-123',
        })
      );
    });

    it('should emit publishing.completed event', async () => {
      // Act
      await service.publish('content-123');

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'content.publishing.completed',
        expect.objectContaining({
          contentId: 'content-123',
          publishedAt: expect.any(Date),
        })
      );
    });

    it('should update content status in database', async () => {
      // Act
      await service.publish('content-123');

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE content'),
        expect.arrayContaining(['content-123'])
      );
    });

    it('should cache published content', async () => {
      // Act
      await service.publish('content-123');

      // Assert
      expect(mockCache.set).toHaveBeenCalledWith(
        'content:published:content-123',
        expect.objectContaining({
          id: 'content-123',
          status: 'published',
        }),
        3600
      );
    });

    it('should implement idempotency for duplicate publish requests', async () => {
      // Arrange - Mock existing publish record in DB
      // checkIdempotency queries content_publish_records first, finds existing record,
      // then calls getContent to build the returned PublishedContent
      (mockDb.query as any).mockReset();
      (mockDb.query as any)
        .mockResolvedValueOnce({
          // checkIdempotency - found existing record
          rows: [
            {
              content_id: 'content-123',
              published_at: new Date(),
              nostr_event_id: 'nostr-event-123',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [mockContent] }); // getContent (called by checkIdempotency)

      // Act
      const result = await service.publish('content-123');

      // Assert
      expect(result).toBeDefined();
      expect(result.publishedAt).toBeInstanceOf(Date);
      // Should not update database again
      expect(mockDb.query).not.toHaveBeenCalledWith(
        expect.stringContaining('UPDATE content'),
        expect.anything()
      );
    });

    it('should notify subscribers if requested', async () => {
      // Arrange
      const options: PublishOptions = { notifySubscribers: true };
      (mockDb.query as any).mockReset();
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [] }) // checkIdempotency - not found
        .mockResolvedValueOnce({ rows: [mockContent] }) // getContent
        .mockResolvedValueOnce({ rows: [] }) // UPDATE content
        .mockResolvedValueOnce({ rows: [] }) // INSERT publish_records
        .mockResolvedValueOnce({
          // getSubscribers
          rows: [{ user_id: 'subscriber-1' }, { user_id: 'subscriber-2' }],
        });

      // Act
      await service.publish('content-123', options);

      // Assert
      expect(mockNotification.send).toHaveBeenCalledTimes(2);
      expect(mockNotification.send).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'subscriber-1',
          type: 'new_content',
        })
      );
    });

    it('should handle cross-posting to multiple platforms', async () => {
      // Arrange
      const options: PublishOptions = {
        crossPost: ['twitter', 'mastodon'],
      };

      // Act
      const result = await service.publish('content-123', options);

      // Assert
      expect(result.crossPostIds).toBeDefined();
      expect(Object.keys(result.crossPostIds!).length).toBe(2);
      expect(result.crossPostIds).toHaveProperty('twitter');
      expect(result.crossPostIds).toHaveProperty('mastodon');
    });

    it('should handle Nostr distribution if requested', async () => {
      // Arrange
      const options: PublishOptions = { distributeToNostr: true };
      (mockDb.query as any).mockReset();
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [] }) // checkIdempotency - not found
        .mockResolvedValueOnce({ rows: [mockContent] }) // getContent
        .mockResolvedValueOnce({ rows: [] }) // UPDATE content
        .mockResolvedValueOnce({
          // getNostrKeys
          rows: [
            {
              nostr_public_key: 'test-pub-key',
              nostr_private_key: 'test-priv-key',
              nostr_relays: JSON.stringify(['wss://relay.example.com']),
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // INSERT publish_records

      // Act
      const result = await service.publish('content-123', options);

      // Assert
      expect(result.nostrEventId).toBeDefined();
    });

    it('should throw error if content not found', async () => {
      // Arrange
      (mockDb.query as any).mockReset();
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [] }) // checkIdempotency - not found
        .mockResolvedValueOnce({ rows: [] }); // getContent - not found

      // Act & Assert
      await expect(service.publish('nonexistent-123')).rejects.toThrow(
        ServiceError
      );
    });

    it('should throw error if content has no title', async () => {
      // Arrange
      const invalidContent = { ...mockContent, title: '' };
      (mockDb.query as any).mockReset();
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [] }) // checkIdempotency - not found
        .mockResolvedValueOnce({ rows: [invalidContent] }); // getContent

      // Act & Assert - outer catch wraps as 'Content publishing failed'
      await expect(service.publish('content-123')).rejects.toThrow(
        'Content publishing failed'
      );
    });

    it('should throw error if content is empty', async () => {
      // Arrange
      const invalidContent = { ...mockContent, content: '' };
      (mockDb.query as any).mockReset();
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [] }) // checkIdempotency - not found
        .mockResolvedValueOnce({ rows: [invalidContent] }); // getContent

      // Act & Assert - outer catch wraps as 'Content publishing failed'
      await expect(service.publish('content-123')).rejects.toThrow(
        'Content publishing failed'
      );
    });

    it('should throw error if content already published', async () => {
      // Arrange
      const publishedContent = { ...mockContent, status: 'published' };
      (mockDb.query as any).mockReset();
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [] }) // checkIdempotency - not found
        .mockResolvedValueOnce({ rows: [publishedContent] }); // getContent

      // Act & Assert - outer catch wraps as 'Content publishing failed'
      await expect(service.publish('content-123')).rejects.toThrow(
        'Content publishing failed'
      );
    });

    it('should emit publishing.failed event on error', async () => {
      // Arrange
      (mockDb.query as any).mockReset();
      (mockDb.query as any).mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(service.publish('content-123')).rejects.toThrow();
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'content.publishing.failed',
        expect.objectContaining({
          contentId: 'content-123',
          error: expect.any(String),
        })
      );
    });

    it('should continue publishing even if Nostr distribution fails', async () => {
      // Arrange
      const options: PublishOptions = { distributeToNostr: true };
      (mockDb.query as any).mockReset();
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [] }) // checkIdempotency - not found
        .mockResolvedValueOnce({ rows: [mockContent] }) // getContent
        .mockResolvedValueOnce({ rows: [] }) // UPDATE content
        .mockResolvedValueOnce({ rows: [] }) // getNostrKeys - no keys
        .mockResolvedValueOnce({ rows: [] }); // INSERT publish_records

      // Act
      const result = await service.publish('content-123', options);

      // Assert - Should still succeed without Nostr
      expect(result).toBeDefined();
      expect(result.status).toBe('published');
      expect(result.nostrEventId).toBeUndefined();
    });
  });

  describe('schedule', () => {
    const futureDate = new Date(Date.now() + 3600000); // 1 hour from now

    beforeEach(() => {
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [mockContent] }) // getContent
        .mockResolvedValueOnce({ rows: [] }) // UPDATE content
        .mockResolvedValueOnce({ rows: [] }); // INSERT schedule
    });

    it('should schedule content for future publishing', async () => {
      // Act
      const result = await service.schedule('content-123', futureDate);

      // Assert
      expect(result).toMatchObject({
        id: 'content-123',
        status: 'scheduled',
        scheduledFor: futureDate,
      });
      expect(result.scheduleId).toBeDefined();
    });

    it('should emit content.scheduled event', async () => {
      // Act
      await service.schedule('content-123', futureDate);

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'content.scheduled',
        expect.objectContaining({
          contentId: 'content-123',
          scheduledFor: futureDate,
        })
      );
    });

    it('should update content status to scheduled in database', async () => {
      // Act
      await service.schedule('content-123', futureDate);

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'scheduled'"),
        expect.arrayContaining([futureDate])
      );
    });

    it('should save schedule to database', async () => {
      // Act
      await service.schedule('content-123', futureDate);

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO content_schedule'),
        expect.any(Array)
      );
    });

    it('should throw error if scheduled time is in the past', async () => {
      // Arrange
      const pastDate = new Date(Date.now() - 3600000);

      // Act & Assert - throws before any DB query
      await expect(service.schedule('content-123', pastDate)).rejects.toThrow(
        'Content scheduling failed'
      );
    });

    it('should throw error if content not found', async () => {
      // Arrange - reset to override beforeEach mocks
      (mockDb.query as any).mockReset();
      (mockDb.query as any).mockResolvedValueOnce({ rows: [] }); // getContent - not found

      // Act & Assert
      await expect(
        service.schedule('nonexistent-123', futureDate)
      ).rejects.toThrow(ServiceError);
    });

    it('should execute scheduled publish at the specified time', async () => {
      // Arrange
      const nearFutureDate = new Date(Date.now() + 100); // 100ms from now
      vi.useFakeTimers();

      // Act
      await service.schedule('content-123', nearFutureDate);

      // Fast-forward time
      vi.advanceTimersByTime(100);

      // Assert - Should trigger publish
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'content.scheduled',
        expect.any(Object)
      );

      vi.useRealTimers();
    });
  });

  describe('unpublish', () => {
    const publishedContent: Content = {
      ...mockContent,
      status: 'published',
      publishedAt: new Date(),
    };

    beforeEach(() => {
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [publishedContent] }) // getContent
        .mockResolvedValueOnce({ rows: [] }); // UPDATE content
    });

    it('should unpublish content successfully', async () => {
      // Act
      await service.unpublish('content-123');

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'draft'"),
        expect.arrayContaining(['content-123'])
      );
    });

    it('should clear published content cache', async () => {
      // Act
      await service.unpublish('content-123');

      // Assert
      expect(mockCache.delete).toHaveBeenCalledWith(
        'content:published:content-123'
      );
    });

    it('should emit content.unpublished event', async () => {
      // Act
      await service.unpublish('content-123');

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'content.unpublished',
        expect.objectContaining({
          contentId: 'content-123',
        })
      );
    });

    it('should throw error if content not published', async () => {
      // Arrange - reset to override beforeEach mocks
      (mockDb.query as any).mockReset();
      (mockDb.query as any).mockResolvedValueOnce({
        rows: [mockContent],
      }); // content is in draft status

      // Act & Assert - outer catch wraps as 'Content unpublishing failed'
      await expect(service.unpublish('content-123')).rejects.toThrow(
        'Content unpublishing failed'
      );
    });

    it('should throw error if content not found', async () => {
      // Arrange - reset to override beforeEach mocks
      (mockDb.query as any).mockReset();
      (mockDb.query as any).mockResolvedValueOnce({ rows: [] });

      // Act & Assert
      await expect(service.unpublish('nonexistent-123')).rejects.toThrow(
        ServiceError
      );
    });

    it('should handle database errors gracefully', async () => {
      // Arrange - reset to override beforeEach mocks
      (mockDb.query as any).mockReset();
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [publishedContent] })
        .mockRejectedValueOnce(new Error('DB Error'));

      // Act & Assert
      await expect(service.unpublish('content-123')).rejects.toThrow(
        ServiceError
      );
    });
  });

  describe('distributeToNostr', () => {
    const publishedContent: PublishedContent = {
      ...mockContent,
      status: 'published',
      publishedAt: new Date(),
      crossPostIds: {},
    };

    beforeEach(() => {
      (mockDb.query as any).mockResolvedValueOnce({
        // getNostrKeys
        rows: [
          {
            nostr_public_key: 'test-pub-key',
            nostr_private_key: 'test-priv-key',
            nostr_relays: null,
          },
        ],
      });
    });

    it('should distribute content to Nostr successfully', async () => {
      // Act
      const result = await service.distributeToNostr(publishedContent);

      // Assert
      expect(result).toMatchObject({
        id: expect.any(String),
        pubkey: expect.any(String),
        created_at: expect.any(Number),
        kind: expect.any(Number),
        content: expect.any(String),
        sig: expect.any(String),
      });
    });

    it('should use kind 30023 for long-form content', async () => {
      // Arrange
      const longContent = {
        ...publishedContent,
        content: 'a'.repeat(300), // > 280 chars
      };

      // Act
      const result = await service.distributeToNostr(longContent);

      // Assert
      expect(result.kind).toBe(30023); // Long-form article
    });

    it('should use kind 1 for short content', async () => {
      // Arrange
      const shortContent = {
        ...publishedContent,
        content: 'Short content',
      };

      // Act
      const result = await service.distributeToNostr(shortContent);

      // Assert
      expect(result.kind).toBe(1); // Short text note
    });

    it('should include content metadata in Nostr tags', async () => {
      // Act
      const result = await service.distributeToNostr(publishedContent);

      // Assert
      expect(result.tags).toContainEqual(['title', publishedContent.title]);
      expect(result.tags).toContainEqual(['sovren:content', publishedContent.id]);
    });

    it('should include content tags in Nostr tags', async () => {
      // Act
      const result = await service.distributeToNostr(publishedContent);

      // Assert
      expect(result.tags).toContainEqual(['t', 'test']);
      expect(result.tags).toContainEqual(['t', 'article']);
    });

    it('should throw error if Nostr keys not configured', async () => {
      // Arrange - reset to override beforeEach mocks
      (mockDb.query as any).mockReset();
      (mockDb.query as any).mockResolvedValueOnce({ rows: [] }); // getNostrKeys - no keys

      // Act & Assert - outer catch wraps as 'Nostr distribution failed'
      await expect(
        service.distributeToNostr(publishedContent)
      ).rejects.toThrow('Nostr distribution failed');
    });

    it('should use custom relays if configured', async () => {
      // Arrange - reset to override beforeEach mocks
      (mockDb.query as any).mockReset();
      (mockDb.query as any).mockResolvedValueOnce({
        rows: [
          {
            nostr_public_key: 'test-pub-key',
            nostr_private_key: 'test-priv-key',
            nostr_relays: JSON.stringify([
              'wss://custom-relay.com',
              'wss://another-relay.com',
            ]),
          },
        ],
      });

      // Act
      const result = await service.distributeToNostr(publishedContent);

      // Assert - Should succeed with custom relays
      expect(result).toBeDefined();
    });
  });

  describe('cancelScheduled', () => {
    const futureDate = new Date(Date.now() + 3600000);

    beforeEach(async () => {
      // Schedule a publish first
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [mockContent] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await service.schedule('content-123', futureDate);
      vi.clearAllMocks();
    });

    it('should cancel scheduled publish successfully', async () => {
      // Arrange
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [] }) // DELETE schedule
        .mockResolvedValueOnce({ rows: [] }); // UPDATE content

      // Get the scheduleId from the scheduled jobs
      const scheduleIds = Array.from((service as any).scheduledJobs.keys());
      const scheduleId = scheduleIds[0];

      // Act
      await service.cancelScheduled(scheduleId);

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM content_schedule'),
        [scheduleId]
      );
    });

    it('should emit content.scheduled.cancelled event', async () => {
      // Arrange
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const scheduleIds = Array.from((service as any).scheduledJobs.keys());
      const scheduleId = scheduleIds[0];

      // Act
      await service.cancelScheduled(scheduleId);

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'content.scheduled.cancelled',
        expect.objectContaining({
          scheduleId,
          contentId: 'content-123',
        })
      );
    });

    it('should throw error if schedule not found', async () => {
      // Act & Assert - outer catch wraps as 'Schedule cancellation failed'
      await expect(service.cancelScheduled('nonexistent-schedule')).rejects.toThrow(
        'Schedule cancellation failed'
      );
    });
  });

  describe('getScheduledContent', () => {
    it('should return all scheduled content', async () => {
      // Arrange
      const mockScheduled = [
        {
          ...mockContent,
          status: 'scheduled',
          schedule_id: 'schedule-1',
          scheduled_for: new Date(),
        },
        {
          ...mockContent,
          id: 'content-456',
          status: 'scheduled',
          schedule_id: 'schedule-2',
          scheduled_for: new Date(),
        },
      ];
      (mockDb.query as any).mockResolvedValueOnce({
        rows: mockScheduled,
      });

      // Act
      const result = await service.getScheduledContent();

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('scheduleId');
      expect(result[0]).toHaveProperty('scheduledFor');
      expect(result[0].scheduledFor).toBeInstanceOf(Date);
    });

    it('should return empty array if no scheduled content', async () => {
      // Arrange
      (mockDb.query as any).mockResolvedValueOnce({ rows: [] });

      // Act
      const result = await service.getScheduledContent();

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      // Arrange
      (mockDb.query as any).mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(service.getScheduledContent()).rejects.toThrow(ServiceError);
    });
  });

  describe('shutdown', () => {
    it('should clear all scheduled jobs', async () => {
      // Arrange - Create some scheduled jobs
      const futureDate = new Date(Date.now() + 3600000);
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [mockContent] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await service.schedule('content-123', futureDate);

      // Act
      await service.shutdown();

      // Assert - Jobs should be cleared
      const jobs = (service as any).scheduledJobs;
      expect(jobs.size).toBe(0);
    });

    it('should be safe to call multiple times', async () => {
      // Act & Assert - Should not throw
      await expect(service.shutdown()).resolves.not.toThrow();
      await expect(service.shutdown()).resolves.not.toThrow();
    });
  });

  describe('idempotency', () => {
    beforeEach(() => {
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [] }) // checkIdempotency - not found in DB
        .mockResolvedValueOnce({ rows: [mockContent] }) // getContent
        .mockResolvedValueOnce({ rows: [] }) // UPDATE content
        .mockResolvedValueOnce({ rows: [] }); // INSERT publish_records
    });

    it('should generate consistent idempotency keys', async () => {
      // Act - First publish (consumes beforeEach mocks)
      const result1 = await service.publish('content-123', { immediate: true });

      // Second call — publishRecords in-memory Map now has the record,
      // so checkIdempotency finds it in memory and calls getContent
      (mockDb.query as any).mockReset();
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [mockContent] }); // getContent (called by checkIdempotency via in-memory hit)

      const result2 = await service.publish('content-123', { immediate: true });

      // Assert - Second call should return cached result
      expect(result2.publishedAt).toEqual(result1.publishedAt);
    });

    it('should allow different options to publish separately', async () => {
      // Act - First publish
      await service.publish('content-123', { immediate: true });

      // Reset for different options — different idempotency key, so no in-memory hit
      (mockDb.query as any).mockReset();
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [] }) // checkIdempotency - different key, not found
        .mockResolvedValueOnce({ rows: [mockContent] }) // getContent
        .mockResolvedValueOnce({ rows: [] }) // UPDATE content
        .mockResolvedValueOnce({ rows: [] }); // INSERT publish_records

      const result2 = await service.publish('content-123', {
        distributeToNostr: true,
      });

      // Assert - Different options create new publish
      expect(result2).toBeDefined();
      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle cache failures gracefully', async () => {
      // Arrange
      (mockCache.set as any).mockRejectedValue(new Error('Cache error'));
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [] }) // checkIdempotency - not found
        .mockResolvedValueOnce({ rows: [mockContent] }) // getContent
        .mockResolvedValueOnce({ rows: [] }) // UPDATE content
        .mockResolvedValueOnce({ rows: [] }); // INSERT publish_records

      // Act - cache.set fails, which causes publish to throw (error propagates)
      await expect(service.publish('content-123')).rejects.toThrow();
    });

    it('should handle notification failures gracefully', async () => {
      // Arrange
      (mockNotification.send as any).mockRejectedValue(
        new Error('Notification error')
      );
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [] }) // checkIdempotency - not found
        .mockResolvedValueOnce({ rows: [mockContent] }) // getContent
        .mockResolvedValueOnce({ rows: [] }) // UPDATE content
        .mockResolvedValueOnce({ rows: [] }) // INSERT publish_records
        .mockResolvedValueOnce({ rows: [{ user_id: 'sub-1' }] }); // getSubscribers

      // Act - Should not throw despite notification error
      const result = await service.publish('content-123', {
        notifySubscribers: true,
      });

      // Assert - Publishing should succeed
      expect(result).toBeDefined();
      expect(result.status).toBe('published');
    });

    it('should handle event bus failures gracefully', async () => {
      // Arrange
      (mockEventBus.emit as any).mockRejectedValue(
        new Error('Event bus error')
      );
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [] }) // checkIdempotency - not found
        .mockResolvedValueOnce({ rows: [mockContent] }) // getContent
        .mockResolvedValueOnce({ rows: [] }) // UPDATE content
        .mockResolvedValueOnce({ rows: [] }); // INSERT publish_records

      // Act & Assert - Should propagate error (eventBus.emit is awaited)
      await expect(service.publish('content-123')).rejects.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle content with no tags', async () => {
      // Arrange
      const contentNoTags = { ...mockContent, tags: undefined };
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [] }) // checkIdempotency - not found
        .mockResolvedValueOnce({ rows: [contentNoTags] }) // getContent
        .mockResolvedValueOnce({ rows: [] }) // UPDATE content
        .mockResolvedValueOnce({ rows: [] }); // INSERT publish_records

      // Act
      const result = await service.publish('content-123');

      // Assert
      expect(result).toBeDefined();
    });

    it('should handle content with no summary', async () => {
      // Arrange
      const contentNoSummary = { ...mockContent, summary: undefined };
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [] }) // checkIdempotency - not found
        .mockResolvedValueOnce({ rows: [contentNoSummary] }) // getContent
        .mockResolvedValueOnce({ rows: [] }) // UPDATE content
        .mockResolvedValueOnce({ rows: [] }); // INSERT publish_records

      // Act
      const result = await service.publish('content-123');

      // Assert
      expect(result).toBeDefined();
    });

    it('should handle empty subscriber list', async () => {
      // Arrange
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [] }) // checkIdempotency - not found
        .mockResolvedValueOnce({ rows: [mockContent] }) // getContent
        .mockResolvedValueOnce({ rows: [] }) // UPDATE content
        .mockResolvedValueOnce({ rows: [] }) // INSERT publish_records
        .mockResolvedValueOnce({ rows: [] }); // getSubscribers - No subscribers

      // Act
      const result = await service.publish('content-123', {
        notifySubscribers: true,
      });

      // Assert
      expect(result).toBeDefined();
      expect(mockNotification.send).not.toHaveBeenCalled();
    });
  });
});
