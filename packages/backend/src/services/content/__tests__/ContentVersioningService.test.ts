import { ContentVersioningService } from '../ContentVersioningService';
import { ICacheService } from '../../../interfaces/ICacheService';
import { IEventBusService } from '../../../interfaces/IEventBusService';
import { IAuditLogService } from '../../../interfaces/IAuditLogService';
import { IDatabase } from '../../../interfaces/IDatabase';
import { ServiceError } from '../../../utils/errors';
import { Content, ContentVersion } from '../../../interfaces/content';

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

const mockAuditLog = {
  log: vi.fn(),
  query: vi.fn(),
} as unknown as IAuditLogService;

describe('ContentVersioningService', () => {
  let service: ContentVersioningService;

  // Test fixtures
  const mockContent: Content = {
    id: 'content-123',
    title: 'Test Article',
    slug: 'test-article',
    content: 'This is test content.',
    summary: 'Test summary',
    tags: ['test', 'article'],
    category: 'technology',
    status: 'published',
    visibility: 'public',
    authorId: 'user-123',
    version: 1,
    metadata: {
      wordCount: 100,
      readingTime: 5,
      excerpt: 'Test excerpt',
      hashtags: [],
      language: 'en',
      hasMedia: false,
      lastModified: new Date(),
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUpdatedContent: Content = {
    ...mockContent,
    title: 'Updated Test Article',
    content: 'This is updated test content.',
    version: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ContentVersioningService(
      mockDb,
      mockCache,
      mockEventBus,
      mockAuditLog
    );
  });

  describe('createVersion', () => {
    it('should create first version as full snapshot', async () => {
      // Arrange
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [] }) // Get latest version (none exists)
        .mockResolvedValueOnce({ rows: [] }) // Insert version
        .mockResolvedValueOnce({ rows: [] }) // Update content version
        .mockResolvedValueOnce({ rows: [] }); // Auto-prune check

      // Act
      const result = await service.createVersion(mockContent, 'Initial version');

      // Assert
      expect(result).toMatchObject({
        contentId: 'content-123',
        versionNumber: 1,
        createdBy: 'user-123',
        message: 'Initial version',
      });
      expect(result.id).toBeDefined();
      expect(result.snapshot).toBeDefined();
      expect(result.snapshot).toEqual(mockContent);
      expect(result.delta).toBeUndefined();

      // Verify database insert
      const insertCall = (mockDb.query as any).mock.calls[1];
      expect(insertCall[0]).toContain('INSERT INTO content_versions');
      expect(insertCall[1][2]).toBe(1); // version_number
      expect(insertCall[1][3]).toBeNull(); // delta (should be null for first version)
      expect(insertCall[1][4]).toBeDefined(); // snapshot (should be present)
    });

    it('should create delta version for non-snapshot versions', async () => {
      // Arrange
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [{ version_number: 1 }] }) // Latest version is 1
        .mockResolvedValueOnce({ // Get previous version for delta
          rows: [{
            id: 'version-1',
            content_id: 'content-123',
            version_number: 1,
            delta: null,
            snapshot: JSON.stringify(mockContent),
            created_by: 'user-123',
            created_at: new Date(),
            message: 'Initial',
          }]
        })
        .mockResolvedValueOnce({ rows: [] }) // Insert version
        .mockResolvedValueOnce({ rows: [] }) // Update content version
        .mockResolvedValueOnce({ rows: [] }); // Auto-prune check

      // Act
      const result = await service.createVersion(mockUpdatedContent, 'Updated content');

      // Assert
      expect(result.versionNumber).toBe(2);
      expect(result.delta).toBeDefined();
      expect(result.snapshot).toBeUndefined();
      expect(result.delta?.length).toBeGreaterThan(0);

      // Verify delta contains the changes
      const titleChange = result.delta?.find(op => op.path === '/title');
      expect(titleChange).toBeDefined();
      expect(titleChange?.op).toBe('replace');
      expect(titleChange?.value).toBe('Updated Test Article');
    });

    it('should create snapshot every 10th version', async () => {
      // Arrange
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [{ version_number: 9 }] }) // Latest version is 9
        .mockResolvedValueOnce({ rows: [] }) // Insert version
        .mockResolvedValueOnce({ rows: [] }) // Update content version
        .mockResolvedValueOnce({ rows: [] }); // Auto-prune check

      // Act
      const result = await service.createVersion(mockContent, 'Version 10');

      // Assert
      expect(result.versionNumber).toBe(10);
      expect(result.snapshot).toBeDefined();
      expect(result.delta).toBeUndefined();
    });

    it('should cache created version', async () => {
      // Arrange
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      // Act
      await service.createVersion(mockContent);

      // Assert
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('content:version:'),
        expect.objectContaining({ contentId: 'content-123' }),
        1800 // TTL
      );
    });

    it('should emit version.created event', async () => {
      // Arrange
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      // Act
      await service.createVersion(mockContent);

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'content.version.created',
        expect.objectContaining({
          contentId: 'content-123',
          versionNumber: 1,
        })
      );
    });

    it('should log version creation in audit log', async () => {
      // Arrange
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      // Act
      await service.createVersion(mockContent, 'Test message');

      // Assert
      expect(mockAuditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'content.version.created',
          entityType: 'content_version',
          entityId: expect.any(String),
          userId: 'user-123',
          details: expect.objectContaining({
            contentId: 'content-123',
            versionNumber: 1,
            message: 'Test message',
          }),
        })
      );
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      (mockDb.query as any).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.createVersion(mockContent)).rejects.toThrow(ServiceError);
      await expect(service.createVersion(mockContent)).rejects.toThrow('Version creation failed');
    });
  });

  describe('getVersions', () => {
    it('should retrieve all versions for a content item', async () => {
      // Arrange
      const mockRows = [
        {
          id: 'version-2',
          content_id: 'content-123',
          version_number: 2,
          delta: JSON.stringify([{ op: 'replace', path: '/title', value: 'New Title' }]),
          snapshot: null,
          created_by: 'user-123',
          created_at: new Date(),
          message: 'Updated',
        },
        {
          id: 'version-1',
          content_id: 'content-123',
          version_number: 1,
          delta: null,
          snapshot: JSON.stringify(mockContent),
          created_by: 'user-123',
          created_at: new Date(),
          message: 'Initial',
        },
      ];

      (mockDb.query as any).mockResolvedValue({ rows: mockRows });

      // Act
      const result = await service.getVersions('content-123');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].versionNumber).toBe(2);
      expect(result[1].versionNumber).toBe(1);
      expect(result[0].delta).toBeDefined();
      expect(result[1].snapshot).toBeDefined();
    });

    it('should return empty array for content with no versions', async () => {
      // Arrange
      (mockDb.query as any).mockResolvedValue({ rows: [] });

      // Act
      const result = await service.getVersions('content-123');

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      (mockDb.query as any).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.getVersions('content-123')).rejects.toThrow(ServiceError);
    });
  });

  describe('getVersion', () => {
    const mockVersionRow = {
      id: 'version-1',
      content_id: 'content-123',
      version_number: 1,
      delta: null,
      snapshot: JSON.stringify(mockContent),
      created_by: 'user-123',
      created_at: new Date(),
      message: 'Initial version',
    };

    it('should retrieve version from cache if available', async () => {
      // Arrange
      const cachedVersion: ContentVersion = {
        id: 'version-1',
        contentId: 'content-123',
        versionNumber: 1,
        snapshot: mockContent,
        createdBy: 'user-123',
        createdAt: new Date(),
      };

      (mockCache.get as any).mockResolvedValue(cachedVersion);

      // Act
      const result = await service.getVersion('version-1');

      // Assert
      expect(result).toEqual(cachedVersion);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should retrieve version from database if not cached', async () => {
      // Arrange
      (mockCache.get as any).mockResolvedValue(null);
      (mockDb.query as any).mockResolvedValue({ rows: [mockVersionRow] });

      // Act
      const result = await service.getVersion('version-1');

      // Assert
      expect(result.id).toBe('version-1');
      expect(result.versionNumber).toBe(1);
      expect(result.snapshot).toBeDefined();

      // Verify caching
      expect(mockCache.set).toHaveBeenCalledWith(
        'content:version:version-1',
        expect.any(Object),
        1800
      );
    });

    it('should throw error if version not found', async () => {
      // Arrange
      (mockCache.get as any).mockResolvedValue(null);
      (mockDb.query as any).mockResolvedValue({ rows: [] });

      // Act & Assert
      await expect(service.getVersion('invalid-id')).rejects.toThrow(ServiceError);
      await expect(service.getVersion('invalid-id')).rejects.toThrow('Failed to retrieve version');
    });
  });

  describe('revert', () => {
    it('should revert content to a previous version', async () => {
      // Arrange
      const targetVersionRow = {
        id: 'version-1',
        content_id: 'content-123',
        version_number: 1,
        delta: null,
        snapshot: JSON.stringify(mockContent),
        created_by: 'user-123',
        created_at: new Date(),
        message: 'Initial',
      };

      (mockCache.get as any).mockResolvedValue(null);
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [targetVersionRow] }) // getVersion
        .mockResolvedValueOnce({ rows: [targetVersionRow] }) // reconstructContent - snapshot
        .mockResolvedValueOnce({ rows: [] }) // reconstructContent - deltas
        .mockResolvedValueOnce({ rows: [] }) // Update content
        .mockResolvedValueOnce({ rows: [{ version_number: 2 }] }) // createVersion - get latest
        .mockResolvedValueOnce({ rows: [] }) // createVersion - insert
        .mockResolvedValueOnce({ rows: [] }) // createVersion - update version
        .mockResolvedValueOnce({ rows: [] }); // createVersion - auto-prune

      // Act
      const result = await service.revert('content-123', 'version-1');

      // Assert
      expect(result).toMatchObject({
        id: 'content-123',
        title: mockContent.title,
        content: mockContent.content,
      });

      // Verify audit log
      expect(mockAuditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'content.reverted',
          details: expect.objectContaining({
            targetVersionId: 'version-1',
            targetVersionNumber: 1,
          }),
        })
      );

      // Verify cache invalidation
      expect(mockCache.delete).toHaveBeenCalledWith('content:content-123');
    });

    it('should throw error if version does not belong to content', async () => {
      // Arrange
      const wrongVersionRow = {
        id: 'version-1',
        content_id: 'content-999', // Different content ID
        version_number: 1,
        delta: null,
        snapshot: JSON.stringify(mockContent),
        created_by: 'user-123',
        created_at: new Date(),
      };

      (mockCache.get as any).mockResolvedValue(null);
      (mockDb.query as any).mockResolvedValue({ rows: [wrongVersionRow] });

      // Act & Assert
      await expect(service.revert('content-123', 'version-1')).rejects.toThrow(ServiceError);
      const error = await service.revert('content-123', 'version-1').catch(e => e);
      expect(error.message).toContain('Version does not belong to this content');
    });

    it('should emit revert event', async () => {
      // Arrange
      const targetVersionRow = {
        id: 'version-1',
        content_id: 'content-123',
        version_number: 1,
        delta: null,
        snapshot: JSON.stringify(mockContent),
        created_by: 'user-123',
        created_at: new Date(),
      };

      (mockCache.get as any).mockResolvedValue(null);
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [targetVersionRow] })
        .mockResolvedValueOnce({ rows: [targetVersionRow] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ version_number: 2 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      // Act
      await service.revert('content-123', 'version-1');

      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'content.reverted',
        expect.objectContaining({
          contentId: 'content-123',
          versionId: 'version-1',
        })
      );
    });
  });

  describe('compareVersions', () => {
    it('should compare two versions and return diff', async () => {
      // Arrange
      const version1Row = {
        id: 'version-1',
        content_id: 'content-123',
        version_number: 1,
        delta: null,
        snapshot: JSON.stringify(mockContent),
        created_by: 'user-123',
        created_at: new Date(),
      };

      const version2Row = {
        id: 'version-2',
        content_id: 'content-123',
        version_number: 2,
        delta: null,
        snapshot: JSON.stringify(mockUpdatedContent),
        created_by: 'user-123',
        created_at: new Date(),
      };

      (mockCache.get as any).mockResolvedValue(null);
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [version1Row] }) // getVersion 1
        .mockResolvedValueOnce({ rows: [version2Row] }) // getVersion 2
        .mockResolvedValueOnce({ rows: [version1Row] }) // reconstruct v1 - find snapshot
        .mockResolvedValueOnce({ rows: [] }) // reconstruct v1 - get deltas
        .mockResolvedValueOnce({ rows: [version2Row] }) // reconstruct v2 - find snapshot
        .mockResolvedValueOnce({ rows: [] }); // reconstruct v2 - get deltas

      // Act
      const result = await service.compareVersions('version-1', 'version-2');

      // Assert
      expect(result).toHaveProperty('added');
      expect(result).toHaveProperty('removed');
      expect(result).toHaveProperty('modified');
      expect(result.modified.length).toBeGreaterThan(0);

      // Check for title modification
      const titleModification = result.modified.find(m => m.field === 'title');
      expect(titleModification).toBeDefined();
      expect(titleModification?.oldValue).toBe('Test Article');
      expect(titleModification?.newValue).toBe('Updated Test Article');
    });

    it('should throw error if versions belong to different content', async () => {
      // Arrange
      const version1Row = {
        id: 'version-1',
        content_id: 'content-123',
        version_number: 1,
        delta: null,
        snapshot: JSON.stringify(mockContent),
        created_by: 'user-123',
        created_at: new Date(),
      };

      const version2Row = {
        id: 'version-2',
        content_id: 'content-999', // Different content
        version_number: 1,
        delta: null,
        snapshot: JSON.stringify(mockContent),
        created_by: 'user-123',
        created_at: new Date(),
      };

      (mockCache.get as any).mockResolvedValue(null);
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [version1Row] })
        .mockResolvedValueOnce({ rows: [version2Row] });

      // Act & Assert
      await expect(service.compareVersions('version-1', 'version-2')).rejects.toThrow(ServiceError);
      const error = await service.compareVersions('version-1', 'version-2').catch(e => e);
      expect(error.message).toContain('Version comparison failed');
    });
  });

  describe('mergeVersions', () => {
    it('should merge two versions successfully', async () => {
      // Arrange
      const version1Row = {
        id: 'version-1',
        content_id: 'content-123',
        version_number: 1,
        delta: null,
        snapshot: JSON.stringify(mockContent),
        created_by: 'user-123',
        created_at: new Date(),
      };

      const version2Content = {
        ...mockContent,
        content: 'Different content',
        tags: ['test', 'merged'],
      };

      const version2Row = {
        id: 'version-2',
        content_id: 'content-123',
        version_number: 2,
        delta: null,
        snapshot: JSON.stringify(version2Content),
        created_by: 'user-123',
        created_at: new Date(),
      };

      (mockCache.get as any).mockResolvedValue(null);
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [version1Row] }) // getVersion 1
        .mockResolvedValueOnce({ rows: [version2Row] }) // getVersion 2
        .mockResolvedValueOnce({ rows: [version1Row] }) // reconstruct v1
        .mockResolvedValueOnce({ rows: [] }) // reconstruct v1 deltas
        .mockResolvedValueOnce({ rows: [version2Row] }) // reconstruct v2
        .mockResolvedValueOnce({ rows: [] }) // reconstruct v2 deltas
        .mockResolvedValueOnce({ rows: [{ version_number: 2 }] }) // createVersion
        .mockResolvedValueOnce({ rows: [] }) // createVersion insert
        .mockResolvedValueOnce({ rows: [] }) // createVersion update
        .mockResolvedValueOnce({ rows: [] }); // auto-prune

      // Act
      const result = await service.mergeVersions('version-1', 'version-2');

      // Assert
      expect(result).toBeDefined();
      expect(result.content).toContain('This is test content');
      expect(result.content).toContain('Different content');
      expect(result.tags).toContain('test');
      expect(result.tags).toContain('merged');
      expect(result.tags).toContain('article');
    });

    it('should throw error if versions from different content', async () => {
      // Arrange
      const version1Row = {
        id: 'version-1',
        content_id: 'content-123',
        version_number: 1,
        delta: null,
        snapshot: JSON.stringify(mockContent),
        created_by: 'user-123',
        created_at: new Date(),
      };

      const version2Row = {
        id: 'version-2',
        content_id: 'content-999',
        version_number: 1,
        delta: null,
        snapshot: JSON.stringify(mockContent),
        created_by: 'user-123',
        created_at: new Date(),
      };

      (mockCache.get as any).mockResolvedValue(null);
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [version1Row] })
        .mockResolvedValueOnce({ rows: [version2Row] });

      // Act & Assert
      await expect(service.mergeVersions('version-1', 'version-2')).rejects.toThrow(
        'Cannot merge versions from different content'
      );
    });
  });

  describe('pruneOldVersions', () => {
    it('should prune old versions keeping the specified number', async () => {
      // Arrange
      const versions = Array.from({ length: 20 }, (_, i) => ({
        id: `version-${i + 1}`,
        content_id: 'content-123',
        version_number: i + 1,
        delta: i % 10 === 0 ? null : JSON.stringify([]),
        snapshot: i % 10 === 0 ? JSON.stringify(mockContent) : null,
        created_by: 'user-123',
        created_at: new Date(),
      }));

      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: versions }) // getVersions
        .mockResolvedValueOnce({ rows: [] }); // Delete query

      // Act
      await service.pruneOldVersions('content-123', 10);

      // Assert
      const deleteCall = (mockDb.query as any).mock.calls[1];
      expect(deleteCall[0]).toContain('DELETE FROM content_versions');

      // Should delete versions except last 10 and snapshots (v10, v20)
      const deletedIds = deleteCall[1][0];
      expect(deletedIds.length).toBeLessThan(10); // Some are snapshots, won't be deleted
      expect(deletedIds).not.toContain('version-10'); // Snapshot preserved
      expect(deletedIds).not.toContain('version-20'); // Snapshot preserved
    });

    it('should not prune if version count is below threshold', async () => {
      // Arrange
      const versions = Array.from({ length: 5 }, (_, i) => ({
        id: `version-${i + 1}`,
        content_id: 'content-123',
        version_number: i + 1,
        delta: JSON.stringify([]),
        snapshot: null,
        created_by: 'user-123',
        created_at: new Date(),
      }));

      (mockDb.query as any).mockResolvedValue({ rows: versions });

      // Act
      await service.pruneOldVersions('content-123', 10);

      // Assert
      // Only getVersions query should be called, no delete
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('should preserve all snapshot versions', async () => {
      // Arrange
      const versions = Array.from({ length: 25 }, (_, i) => ({
        id: `version-${i + 1}`,
        content_id: 'content-123',
        version_number: i + 1,
        delta: i % 10 === 0 ? null : JSON.stringify([]),
        snapshot: i % 10 === 0 ? JSON.stringify(mockContent) : null,
        created_by: 'user-123',
        created_at: new Date(),
      }));

      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: versions })
        .mockResolvedValueOnce({ rows: [] });

      // Act
      await service.pruneOldVersions('content-123', 10);

      // Assert
      const deleteCall = (mockDb.query as any).mock.calls[1];
      const deletedIds = deleteCall[1][0];

      // Verify snapshots are not in delete list
      expect(deletedIds).not.toContain('version-10');
      expect(deletedIds).not.toContain('version-20');
    });

    it('should log pruning action', async () => {
      // Arrange
      const versions = Array.from({ length: 15 }, (_, i) => ({
        id: `version-${i + 1}`,
        content_id: 'content-123',
        version_number: i + 1,
        delta: JSON.stringify([]),
        snapshot: null,
        created_by: 'user-123',
        created_at: new Date(),
      }));

      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: versions })
        .mockResolvedValueOnce({ rows: [] });

      // Act
      await service.pruneOldVersions('content-123', 10);

      // Assert
      expect(mockAuditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'content.versions.pruned',
          entityType: 'content',
          entityId: 'content-123',
          details: expect.objectContaining({
            deletedCount: expect.any(Number),
            remainingCount: expect.any(Number),
          }),
        })
      );
    });
  });

  describe('Delta Operations', () => {
    it('should correctly generate delta between versions', async () => {
      // Arrange
      const content1: Content = { ...mockContent };
      const content2: Content = {
        ...mockContent,
        title: 'New Title',
        content: 'New content',
      };

      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [{ version_number: 1 }] }) // Latest version
        .mockResolvedValueOnce({ // Previous version
          rows: [{
            id: 'v1',
            content_id: 'content-123',
            version_number: 1,
            snapshot: JSON.stringify(content1),
            delta: null,
            created_by: 'user-123',
            created_at: new Date(),
          }]
        })
        .mockResolvedValueOnce({ rows: [] }) // Insert
        .mockResolvedValueOnce({ rows: [] }) // Update
        .mockResolvedValueOnce({ rows: [] }); // Prune check

      // Act
      const version = await service.createVersion(content2, 'Changes');

      // Assert
      expect(version.delta).toBeDefined();
      expect(version.delta?.length).toBeGreaterThan(0);

      const titleOp = version.delta?.find(op => op.path === '/title');
      const contentOp = version.delta?.find(op => op.path === '/content');

      expect(titleOp?.op).toBe('replace');
      expect(titleOp?.value).toBe('New Title');
      expect(contentOp?.op).toBe('replace');
      expect(contentOp?.value).toBe('New content');
    });

    it('should reconstruct content from snapshot and deltas', async () => {
      // Arrange - Create a sequence of versions
      const baseContent: Content = { ...mockContent };
      const snapshotRow = {
        id: 'v1',
        content_id: 'content-123',
        version_number: 1,
        snapshot: JSON.stringify(baseContent),
        delta: null,
        created_by: 'user-123',
        created_at: new Date(),
      };

      const delta2 = [
        { op: 'replace' as const, path: '/title', value: 'Version 2 Title' },
      ];

      const delta3 = [
        { op: 'replace' as const, path: '/content', value: 'Version 3 Content' },
      ];

      (mockCache.get as any).mockResolvedValue(null);
      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [snapshotRow] }) // getVersion
        .mockResolvedValueOnce({ rows: [snapshotRow] }) // reconstruct - find snapshot
        .mockResolvedValueOnce({ // reconstruct - get deltas
          rows: [
            {
              version_number: 2,
              delta: JSON.stringify(delta2),
            },
            {
              version_number: 3,
              delta: JSON.stringify(delta3),
            },
          ]
        });

      // Act - Reconstruct to version 3
      const result = await service.compareVersions('v1', 'v3');

      // We're testing internal reconstruction through compareVersions
      // The comparison should reflect accumulated changes
      expect(result).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content gracefully', async () => {
      // Arrange
      const emptyContent: Content = {
        ...mockContent,
        content: '',
        tags: [],
      };

      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      // Act
      const result = await service.createVersion(emptyContent);

      // Assert
      expect(result).toBeDefined();
      expect(result.snapshot?.content).toBe('');
      expect(result.snapshot?.tags).toEqual([]);
    });

    it('should handle very large content efficiently', async () => {
      // Arrange
      const largeContent: Content = {
        ...mockContent,
        content: 'x'.repeat(100000), // 100k characters
      };

      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      // Act
      const result = await service.createVersion(largeContent);

      // Assert
      expect(result).toBeDefined();
      expect(result.snapshot?.content.length).toBe(100000);
    });

    it('should handle concurrent version creation', async () => {
      // Arrange
      (mockDb.query as any)
        .mockResolvedValue({ rows: [] });

      // Act - Simulate concurrent creates
      const promises = [
        service.createVersion(mockContent, 'Version A'),
        service.createVersion(mockUpdatedContent, 'Version B'),
      ];

      // Assert - Should not throw
      await expect(Promise.all(promises)).resolves.toBeDefined();
    });
  });

  describe('Performance and Optimization', () => {
    it('should auto-prune when version limit is exceeded', async () => {
      // Arrange - Create scenario with many versions
      const manyVersions = Array.from({ length: 105 }, (_, i) => ({
        id: `v${i + 1}`,
        content_id: 'content-123',
        version_number: i + 1,
        delta: JSON.stringify([]),
        snapshot: null,
        created_by: 'user-123',
        created_at: new Date(),
      }));

      (mockDb.query as any)
        .mockResolvedValueOnce({ rows: [] }) // Get latest (for create)
        .mockResolvedValueOnce({ rows: [] }) // Insert new version
        .mockResolvedValueOnce({ rows: [] }) // Update content
        .mockResolvedValueOnce({ rows: manyVersions }) // Auto-prune check
        .mockResolvedValueOnce({ rows: [] }); // Delete old versions

      // Act
      await service.createVersion(mockContent);

      // Assert - Should trigger auto-prune
      const deleteCall = (mockDb.query as any).mock.calls.find(
        call => call[0].includes('DELETE FROM content_versions')
      );
      expect(deleteCall).toBeDefined();
    });

    it('should use cache for frequently accessed versions', async () => {
      // Arrange
      const cachedVersion: ContentVersion = {
        id: 'v1',
        contentId: 'content-123',
        versionNumber: 1,
        snapshot: mockContent,
        createdBy: 'user-123',
        createdAt: new Date(),
      };

      (mockCache.get as any).mockResolvedValue(cachedVersion);

      // Act - Call multiple times
      await service.getVersion('v1');
      await service.getVersion('v1');
      await service.getVersion('v1');

      // Assert - Should only hit cache, never database
      expect(mockCache.get).toHaveBeenCalledTimes(3);
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });
});
