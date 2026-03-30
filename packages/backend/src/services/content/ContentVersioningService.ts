import type {
  IContentVersioningService,
  ContentVersion,
  Content,
  VersionDiff,
} from '../../interfaces/content';
import type { ICacheService } from '../../interfaces/ICacheService';
import type { IEventBusService } from '../../interfaces/IEventBusService';
import type { IAuditLogService } from '../../interfaces/IAuditLogService';
import type { IDatabase } from '../../interfaces/IDatabase';
import { Logger } from '../../utils/logger';
import { ServiceError } from '../../utils/errors';
import { v4 as uuidv4 } from 'uuid';
/**
 * JSON Patch operation as per RFC 6902
 */
interface JsonPatchOperation {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  value?: any;
  from?: string;
}
/**
 * ContentVersioningService manages content version history with efficient delta storage.
 *
 * Key Features:
 * - Complete version history tracking
 * - Efficient delta storage using JSON Patch (RFC 6902)
 * - Version comparison and diff viewing
 * - Rollback functionality
 * - Intelligent version pruning for storage optimization
 * - Full audit trail with metadata
 *
 * Storage Strategy:
 * - Every 10th version: Full snapshot for fast access
 * - Other versions: Delta (JSON Patch) from previous version
 * - Automatic pruning of old versions (configurable retention)
 *
 * @implements IContentVersioningService
 */
export class ContentVersioningService implements IContentVersioningService {
  private readonly logger: Logger;
  private readonly snapshotInterval = 10; // Full snapshot every N versions
  private readonly maxVersionsToKeep = 100; // Maximum versions to retain
  private readonly cachePrefix = 'content:version:';
  private readonly cacheTTL = 1800; // 30 minutes
  constructor(
    private readonly db: IDatabase,
    private readonly cache: ICacheService,
    private readonly eventBus: IEventBusService,
    private readonly auditLog: IAuditLogService
  ) {
    this.logger = new Logger(ContentVersioningService.name);
  }
  /**
   * Creates a new version of the content
   * Implements efficient delta storage with periodic snapshots
   *
   * @param content - The current content state
   * @param message - Optional version message/comment
   * @returns Created version record
   */
  public async createVersion(content: Content, message?: string): Promise<ContentVersion> {
    try {
      this.logger.info('Creating new version', {
        contentId: content.id,
        currentVersion: content.version,
      });
      // Get the latest version number for this content
      const latestVersionResult = await this.db.query(
        `SELECT version_number FROM content_versions
         WHERE content_id = $1
         ORDER BY version_number DESC
         LIMIT 1`,
        [content.id]
      );
      const nextVersionNumber =
        latestVersionResult.rows.length > 0 ? latestVersionResult.rows[0].version_number + 1 : 1;
      // Determine if this should be a snapshot or delta
      const isSnapshot = nextVersionNumber % this.snapshotInterval === 0;
      let delta: JsonPatchOperation[] | null = null;
      let snapshot: Content | null = null;
      if (isSnapshot || nextVersionNumber === 1) {
        // Store full snapshot
        snapshot = content;
        this.logger.debug('Storing full snapshot', { versionNumber: nextVersionNumber });
      } else {
        // Generate delta from previous version
        const previousVersion = await this.getPreviousVersion(content.id, nextVersionNumber - 1);
        delta = this.generateDelta(previousVersion, content);
        this.logger.debug('Storing delta', {
          versionNumber: nextVersionNumber,
          operations: delta.length,
        });
      }
      // Create version record
      const version: ContentVersion = {
        id: uuidv4(),
        contentId: content.id,
        versionNumber: nextVersionNumber,
        delta: delta || undefined,
        snapshot: snapshot || undefined,
        createdBy: content.authorId,
        createdAt: new Date(),
        message,
      };
      // Save to database
      await this.db.query(
        `INSERT INTO content_versions (
          id, content_id, version_number, delta, snapshot,
          created_by, created_at, message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          version.id,
          version.contentId,
          version.versionNumber,
          delta ? JSON.stringify(delta) : null,
          snapshot ? JSON.stringify(snapshot) : null,
          version.createdBy,
          version.createdAt,
          version.message,
        ]
      );
      // Cache the version
      await this.cache.set(`${this.cachePrefix}${version.id}`, version, this.cacheTTL);
      // Update content version number
      await this.db.query('UPDATE content SET version = $1, updated_at = $2 WHERE id = $3', [
        nextVersionNumber,
        new Date(),
        content.id,
      ]);
      // Log the version creation
      await this.auditLog.log({
        action: 'content.version.created',
        entityType: 'content_version',
        entityId: version.id,
        userId: content.authorId,
        details: {
          contentId: content.id,
          versionNumber: nextVersionNumber,
          isSnapshot,
          message: message || 'No message',
        },
        timestamp: new Date(),
      });
      // Emit event
      await this.eventBus.emit('content.version.created', {
        versionId: version.id,
        contentId: content.id,
        versionNumber: nextVersionNumber,
        timestamp: Date.now(),
      });
      // Check if we need to prune old versions
      await this.autoPruneVersions(content.id);
      this.logger.info('Version created successfully', {
        versionId: version.id,
        versionNumber: nextVersionNumber,
      });
      return version;
    } catch (error) {
      this.logger.error('Failed to create version', error);
      throw new ServiceError('Version creation failed', {
        cause: error,
        context: { contentId: content.id },
      });
    }
  }
  /**
   * Retrieves all versions for a content item
   *
   * @param contentId - The content ID
   * @returns Array of versions, ordered by version number (newest first)
   */
  public async getVersions(contentId: string): Promise<ContentVersion[]> {
    try {
      this.logger.debug('Fetching version history', { contentId });
      const result = await this.db.query(
        `SELECT * FROM content_versions
         WHERE content_id = $1
         ORDER BY version_number DESC`,
        [contentId]
      );
      const versions = result.rows.map((row) => this.mapRowToVersion(row));
      this.logger.debug('Retrieved versions', {
        contentId,
        count: versions.length,
      });
      return versions;
    } catch (error) {
      this.logger.error('Failed to fetch versions', error);
      throw new ServiceError('Failed to retrieve version history', {
        cause: error,
        context: { contentId },
      });
    }
  }
  /**
   * Retrieves a specific version by ID
   *
   * @param versionId - The version ID
   * @returns The version record
   */
  public async getVersion(versionId: string): Promise<ContentVersion> {
    try {
      // Check cache first
      const cached = await this.cache.get<ContentVersion>(`${this.cachePrefix}${versionId}`);
      if (cached) {
        this.logger.debug('Version retrieved from cache', { versionId });
        return cached;
      }
      // Fetch from database
      const result = await this.db.query('SELECT * FROM content_versions WHERE id = $1', [
        versionId,
      ]);
      if (result.rows.length === 0) {
        throw new ServiceError('Version not found', {
          context: { versionId },
        });
      }
      const version = this.mapRowToVersion(result.rows[0]);
      // Cache it
      await this.cache.set(`${this.cachePrefix}${versionId}`, version, this.cacheTTL);
      return version;
    } catch (error) {
      this.logger.error('Failed to fetch version', error);
      throw new ServiceError('Failed to retrieve version', {
        cause: error,
        context: { versionId },
      });
    }
  }
  /**
   * Reverts content to a specific version
   * Creates a new version with the reverted content
   *
   * @param contentId - The content ID
   * @param versionId - The version ID to revert to
   * @returns The reverted content (as a new version)
   */
  public async revert(contentId: string, versionId: string): Promise<Content> {
    try {
      this.logger.info('Reverting content', { contentId, versionId });
      // Get the target version
      const targetVersion = await this.getVersion(versionId);
      if (targetVersion.contentId !== contentId) {
        throw new ServiceError('Version does not belong to this content', {
          context: { contentId, versionId },
        });
      }
      // Reconstruct the content at that version
      const revertedContent = await this.reconstructContent(contentId, targetVersion.versionNumber);
      // Update the current content
      await this.db.query(
        `UPDATE content
         SET title = $1, content = $2, summary = $3, tags = $4,
             category = $5, metadata = $6, updated_at = $7
         WHERE id = $8`,
        [
          revertedContent.title,
          revertedContent.content,
          revertedContent.summary,
          JSON.stringify(revertedContent.tags),
          revertedContent.category,
          JSON.stringify(revertedContent.metadata),
          new Date(),
          contentId,
        ]
      );
      // Create a new version for this revert
      const newVersion = await this.createVersion(
        revertedContent,
        `Reverted to version ${targetVersion.versionNumber}`
      );
      // Log the revert
      await this.auditLog.log({
        action: 'content.reverted',
        entityType: 'content',
        entityId: contentId,
        userId: revertedContent.authorId,
        details: {
          targetVersionId: versionId,
          targetVersionNumber: targetVersion.versionNumber,
          newVersionNumber: newVersion.versionNumber,
        },
        timestamp: new Date(),
      });
      // Emit event
      await this.eventBus.emit('content.reverted', {
        contentId,
        versionId,
        newVersionNumber: newVersion.versionNumber,
        timestamp: Date.now(),
      });
      // Invalidate cache
      await this.cache.delete(`content:${contentId}`);
      this.logger.info('Content reverted successfully', {
        contentId,
        revertedToVersion: targetVersion.versionNumber,
      });
      return revertedContent;
    } catch (error) {
      this.logger.error('Failed to revert content', error);
      throw new ServiceError('Content revert failed', {
        cause: error,
        context: { contentId, versionId },
      });
    }
  }
  /**
   * Compares two versions and returns the differences
   *
   * @param versionId1 - First version ID
   * @param versionId2 - Second version ID
   * @returns Detailed diff showing additions, removals, and modifications
   */
  public async compareVersions(versionId1: string, versionId2: string): Promise<VersionDiff> {
    try {
      this.logger.debug('Comparing versions', { versionId1, versionId2 });
      // Get both versions
      const version1 = await this.getVersion(versionId1);
      const version2 = await this.getVersion(versionId2);
      // Ensure they belong to the same content
      if (version1.contentId !== version2.contentId) {
        throw new ServiceError('Versions belong to different content items', {
          context: { versionId1, versionId2 },
        });
      }
      // Reconstruct full content for both versions
      const content1 = await this.reconstructContent(version1.contentId, version1.versionNumber);
      const content2 = await this.reconstructContent(version2.contentId, version2.versionNumber);
      // Generate diff
      const diff = this.calculateDiff(content1, content2);
      this.logger.debug('Version comparison complete', {
        addedFields: diff.added.length,
        removedFields: diff.removed.length,
        modifiedFields: diff.modified.length,
      });
      return diff;
    } catch (error) {
      this.logger.error('Failed to compare versions', error);
      throw new ServiceError('Version comparison failed', {
        cause: error,
        context: { versionId1, versionId2 },
      });
    }
  }
  /**
   * Merges two versions (simplified implementation)
   * In production, this would need conflict resolution logic
   *
   * @param versionId1 - First version ID
   * @param versionId2 - Second version ID
   * @returns Merged content
   */
  public async mergeVersions(versionId1: string, versionId2: string): Promise<Content> {
    try {
      this.logger.info('Merging versions', { versionId1, versionId2 });
      // Get both versions
      const version1 = await this.getVersion(versionId1);
      const version2 = await this.getVersion(versionId2);
      // Ensure they belong to the same content
      if (version1.contentId !== version2.contentId) {
        throw new ServiceError('Cannot merge versions from different content', {
          context: { versionId1, versionId2 },
        });
      }
      // Reconstruct both versions
      const content1 = await this.reconstructContent(version1.contentId, version1.versionNumber);
      const content2 = await this.reconstructContent(version2.contentId, version2.versionNumber);
      // Simple merge: Take later version's title/summary, merge content
      const merged: Content = {
        ...content2,
        content: this.mergeContent(content1.content, content2.content),
        tags: [...new Set([...(content1.tags || []), ...(content2.tags || [])])],
        metadata: {
          ...content2.metadata,
          lastModified: new Date(),
        },
      };
      // Create new version with merged content
      await this.createVersion(
        merged,
        `Merged versions ${version1.versionNumber} and ${version2.versionNumber}`
      );
      this.logger.info('Versions merged successfully', {
        versionId1,
        versionId2,
      });
      return merged;
    } catch (error) {
      this.logger.error('Failed to merge versions', error);
      throw new ServiceError('Version merge failed', {
        cause: error,
        context: { versionId1, versionId2 },
      });
    }
  }
  /**
   * Prunes old versions keeping only the specified number of latest versions
   * Always preserves snapshot versions for efficient reconstruction
   *
   * @param contentId - The content ID
   * @param keepLast - Number of latest versions to keep
   */
  public async pruneOldVersions(contentId: string, keepLast: number): Promise<void> {
    try {
      this.logger.info('Pruning old versions', { contentId, keepLast });
      // Get all versions
      const allVersions = await this.getVersions(contentId);
      if (allVersions.length <= keepLast) {
        this.logger.debug('No pruning needed', {
          currentCount: allVersions.length,
          keepLast,
        });
        return;
      }
      // Identify versions to delete (excluding snapshots)
      const toDelete = allVersions
        .slice(keepLast)
        .filter((v) => v.versionNumber % this.snapshotInterval !== 0)
        .map((v) => v.id);
      if (toDelete.length === 0) {
        this.logger.debug('No versions to prune (all are snapshots or recent)');
        return;
      }
      // Delete old versions
      await this.db.query(
        `DELETE FROM content_versions
         WHERE id = ANY($1::uuid[])`,
        [toDelete]
      );
      // Clear cache for deleted versions
      for (const versionId of toDelete) {
        await this.cache.delete(`${this.cachePrefix}${versionId}`);
      }
      // Log the pruning
      await this.auditLog.log({
        action: 'content.versions.pruned',
        entityType: 'content',
        entityId: contentId,
        details: {
          deletedCount: toDelete.length,
          remainingCount: allVersions.length - toDelete.length,
        },
        timestamp: new Date(),
      });
      this.logger.info('Old versions pruned', {
        contentId,
        deletedCount: toDelete.length,
      });
    } catch (error) {
      this.logger.error('Failed to prune versions', error);
      throw new ServiceError('Version pruning failed', {
        cause: error,
        context: { contentId, keepLast },
      });
    }
  }
  // ============================================================================
  // Private Helper Methods
  // ============================================================================
  /**
   * Generates a JSON Patch delta between two content versions
   */
  private generateDelta(oldContent: Content, newContent: Content): JsonPatchOperation[] {
    const operations: JsonPatchOperation[] = [];
    // Compare each field
    const fields: (keyof Content)[] = [
      'title',
      'content',
      'summary',
      'tags',
      'category',
      'status',
      'visibility',
      'metadata',
    ];
    for (const field of fields) {
      const oldValue = oldContent[field];
      const newValue = newContent[field];
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        operations.push({
          op: 'replace',
          path: `/${String(field)}`,
          value: newValue,
        });
      }
    }
    return operations;
  }
  /**
   * Applies a JSON Patch delta to reconstruct content
   */
  private applyDelta(content: Content, delta: JsonPatchOperation[]): Content {
    const result = { ...content };
    for (const operation of delta) {
      const field = operation.path.substring(1) as keyof Content;
      switch (operation.op) {
        case 'replace':
        case 'add':
          (result as any)[field] = operation.value;
          break;
        case 'remove':
          delete (result as any)[field];
          break;
        // 'move', 'copy', 'test' operations not commonly needed for our use case
      }
    }
    return result;
  }
  /**
   * Reconstructs content at a specific version by applying deltas
   */
  private async reconstructContent(contentId: string, targetVersion: number): Promise<Content> {
    // Find the nearest snapshot at or before target version
    const snapshotResult = await this.db.query(
      `SELECT * FROM content_versions
       WHERE content_id = $1
       AND version_number <= $2
       AND snapshot IS NOT NULL
       ORDER BY version_number DESC
       LIMIT 1`,
      [contentId, targetVersion]
    );
    if (snapshotResult.rows.length === 0) {
      throw new ServiceError('No snapshot found for reconstruction', {
        context: { contentId, targetVersion },
      });
    }
    const snapshotVersion = this.mapRowToVersion(snapshotResult.rows[0]);
    let content = snapshotVersion.snapshot!;
    // If target is the snapshot, we're done
    if (snapshotVersion.versionNumber === targetVersion) {
      return content;
    }
    // Apply deltas from snapshot to target version
    const deltasResult = await this.db.query(
      `SELECT * FROM content_versions
       WHERE content_id = $1
       AND version_number > $2
       AND version_number <= $3
       ORDER BY version_number ASC`,
      [contentId, snapshotVersion.versionNumber, targetVersion]
    );
    for (const row of deltasResult.rows) {
      const version = this.mapRowToVersion(row);
      if (version.delta) {
        content = this.applyDelta(content, version.delta);
      }
    }
    return content;
  }
  /**
   * Gets the previous version's content
   */
  private async getPreviousVersion(contentId: string, versionNumber: number): Promise<Content> {
    return this.reconstructContent(contentId, versionNumber);
  }
  /**
   * Calculates a detailed diff between two content versions
   */
  private calculateDiff(content1: Content, content2: Content): VersionDiff {
    const added: string[] = [];
    const removed: string[] = [];
    const modified: Array<{ field: string; oldValue: any; newValue: any }> = [];
    const allFields = new Set([...Object.keys(content1), ...Object.keys(content2)]);
    for (const field of allFields) {
      const val1 = (content1 as any)[field];
      const val2 = (content2 as any)[field];
      if (val1 === undefined && val2 !== undefined) {
        added.push(field);
      } else if (val1 !== undefined && val2 === undefined) {
        removed.push(field);
      } else if (JSON.stringify(val1) !== JSON.stringify(val2)) {
        modified.push({
          field,
          oldValue: val1,
          newValue: val2,
        });
      }
    }
    return { added, removed, modified };
  }
  /**
   * Simple content merge (in production, use a proper merge algorithm)
   */
  private mergeContent(content1: string, content2: string): string {
    // Simple merge: If contents are different, concatenate with separator
    if (content1 === content2) {
      return content1;
    }
    return `${content1}\n\n--- Merged Content ---\n\n${content2}`;
  }
  /**
   * Automatically prunes versions if exceeding max limit
   */
  private async autoPruneVersions(contentId: string): Promise<void> {
    const versions = await this.getVersions(contentId);
    if (versions.length > this.maxVersionsToKeep) {
      await this.pruneOldVersions(contentId, this.maxVersionsToKeep);
    }
  }
  /**
   * Maps database row to ContentVersion object
   */
  private mapRowToVersion(row: any): ContentVersion {
    return {
      id: row.id,
      contentId: row.content_id,
      versionNumber: row.version_number,
      delta: row.delta ? JSON.parse(row.delta) : undefined,
      snapshot: row.snapshot ? JSON.parse(row.snapshot) : undefined,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      message: row.message,
    };
  }
}
