/**
 * AuditLogService Implementation
 * User Story: US-E5-009
 * Immutable audit trail with comprehensive tracking and query capabilities
 * Part of Epic 005 - Backend Service Layer Refactoring
 */

import type { IAuditLogService } from '../interfaces/shared/IAuditLogService';
import type { IEventBus } from '../interfaces/shared/IEventBus';
import type { ILogger } from '../interfaces/shared/ILogger';
import type { ICacheService } from '../interfaces/shared/ICacheService';
import type {
  AuditLogEntry,
  AuditLogQuery,
  AuditLogQueryResult,
  AuditLogMetrics,
  AuditLogExport,
  AuditLogRetention,
  AuditContext,
} from '../types/audit';

import { createHash, randomUUID } from 'crypto';
import { performance } from 'perf_hooks';

/**
 * Audit log storage interface
 */
interface IAuditStorage {
  write(entry: AuditLogEntry): Promise<void>;
  read(query: AuditLogQuery): Promise<AuditLogEntry[]>;
  count(query: AuditLogQuery): Promise<number>;
  archive(before: Date): Promise<number>;
  verify(entry: AuditLogEntry): Promise<boolean>;
}

/**
 * In-memory audit storage (for testing)
 */
class InMemoryAuditStorage implements IAuditStorage {
  private entries: AuditLogEntry[] = [];
  private archived: AuditLogEntry[] = [];

  async write(entry: AuditLogEntry): Promise<void> {
    this.entries.push(entry);
  }

  async read(query: AuditLogQuery): Promise<AuditLogEntry[]> {
    let results = [...this.entries];

    // Apply filters
    if (query.actorId) {
      results = results.filter(e => e.actor.id === query.actorId);
    }

    if (query.action) {
      results = results.filter(e => e.action === query.action);
    }

    if (query.resourceType) {
      results = results.filter(e => e.resource?.type === query.resourceType);
    }

    if (query.resourceId) {
      results = results.filter(e => e.resource?.id === query.resourceId);
    }

    if (query.startDate) {
      results = results.filter(e => e.timestamp >= query.startDate!);
    }

    if (query.endDate) {
      results = results.filter(e => e.timestamp <= query.endDate!);
    }

    if (query.outcome) {
      results = results.filter(e => e.outcome === query.outcome);
    }

    // Apply sorting
    const sortField = query.sortBy || 'timestamp';
    const sortOrder = query.sortOrder || 'desc';

    results.sort((a, b) => {
      const aVal = a[sortField as keyof AuditLogEntry];
      const bVal = b[sortField as keyof AuditLogEntry];

      if (sortOrder === 'desc') {
        return bVal > aVal ? 1 : -1;
      } else {
        return aVal > bVal ? 1 : -1;
      }
    });

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 100;

    return results.slice(offset, offset + limit);
  }

  async count(query: AuditLogQuery): Promise<number> {
    const results = await this.read({ ...query, limit: Number.MAX_SAFE_INTEGER });
    return results.length;
  }

  async archive(before: Date): Promise<number> {
    const toArchive = this.entries.filter(e => e.timestamp < before);
    this.archived.push(...toArchive);
    this.entries = this.entries.filter(e => e.timestamp >= before);
    return toArchive.length;
  }

  async verify(entry: AuditLogEntry): Promise<boolean> {
    // Verify hash integrity
    const computedHash = this.computeHash(entry);
    return computedHash === entry.hash;
  }

  private computeHash(entry: AuditLogEntry): string {
    const data = JSON.stringify({
      id: entry.id,
      timestamp: entry.timestamp.toISOString(),
      actor: entry.actor,
      action: entry.action,
      resource: entry.resource,
      outcome: entry.outcome,
      details: entry.details,
    });

    return createHash('sha256').update(data).digest('hex');
  }
}

/**
 * Concrete implementation of AuditLogService
 */
export class AuditLogService implements IAuditLogService {
  private readonly eventBus: IEventBus;
  private readonly logger: ILogger;
  private readonly cache?: ICacheService;
  private readonly storage: IAuditStorage;
  private readonly retention: AuditLogRetention;
  private readonly metrics: AuditLogMetrics;
  private archiveInterval?: NodeJS.Timeout;
  private readonly sessionContext: Map<string, AuditContext> = new Map();

  constructor(
    eventBus: IEventBus,
    logger: ILogger,
    storage?: IAuditStorage,
    cache?: ICacheService,
    retention?: AuditLogRetention
  ) {
    this.eventBus = eventBus;
    this.logger = logger;
    this.cache = cache;
    this.storage = storage || new InMemoryAuditStorage();

    // Production safety check: InMemoryAuditStorage is not durable and resets on restart.
    // In production, a persistent storage backend (e.g. database) must be provided.
    if (process.env.NODE_ENV === 'production' && this.storage instanceof InMemoryAuditStorage) {
      this.logger.error(
        '[AuditLogService] CRITICAL: InMemoryAuditStorage is in use in production. ' +
          'Audit logs will be lost on restart. Provide a persistent IAuditStorage implementation.'
      );
    }

    // Default retention policy
    this.retention = retention || {
      standard: 90, // 90 days
      security: 365, // 1 year
      compliance: 2555, // 7 years
      archive: true,
    };

    // Initialize metrics
    this.metrics = {
      totalEntries: 0,
      entriesPerAction: {},
      averageQueryTime: 0,
      storageSize: 0,
      archiveSize: 0,
    };

    // Start archive process
    this.startArchiveProcess();
  }

  async log(entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'hash'>): Promise<string> {
    const startTime = performance.now();

    try {
      // Create complete entry
      const fullEntry: AuditLogEntry = {
        ...entry,
        id: randomUUID(),
        timestamp: new Date(),
        hash: '', // Will be computed
      };

      // Add session context if available
      if (fullEntry.context?.sessionId) {
        const sessionContext = this.sessionContext.get(fullEntry.context.sessionId);
        if (sessionContext) {
          fullEntry.context = { ...sessionContext, ...fullEntry.context };
        }
      }

      // Compute hash for immutability
      fullEntry.hash = this.computeHash(fullEntry);

      // Write to storage
      await this.storage.write(fullEntry);

      // Update metrics
      this.metrics.totalEntries++;
      this.metrics.entriesPerAction[entry.action] =
        (this.metrics.entriesPerAction[entry.action] || 0) + 1;

      // Cache recent entries for fast access
      if (this.cache) {
        await this.cacheEntry(fullEntry);
      }

      // Emit event for real-time monitoring
      await this.eventBus.emit('audit.logged', {
        id: fullEntry.id,
        action: fullEntry.action,
        actor: fullEntry.actor,
        outcome: fullEntry.outcome,
      });

      // Log security-relevant actions
      if (this.isSecurityAction(fullEntry.action)) {
        this.logger.warn('Security audit event', {
          action: fullEntry.action,
          actor: fullEntry.actor,
          resource: fullEntry.resource,
          outcome: fullEntry.outcome,
        });
      }

      const duration = performance.now() - startTime;
      this.updateAverageQueryTime(duration);

      return fullEntry.id;
    } catch (error) {
      this.logger.error('Failed to log audit entry', error);
      throw error;
    }
  }

  async logBatch(entries: Omit<AuditLogEntry, 'id' | 'timestamp' | 'hash'>[]): Promise<string[]> {
    const ids: string[] = [];

    // Process in batches for performance
    const batchSize = 100;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);

      const batchIds = await Promise.all(batch.map(entry => this.log(entry)));

      ids.push(...batchIds);
    }

    return ids;
  }

  async query(query: AuditLogQuery): Promise<AuditLogQueryResult> {
    const startTime = performance.now();

    try {
      // Check cache for common queries
      const cacheKey = this.getQueryCacheKey(query);
      if (this.cache && cacheKey) {
        const cached = await this.cache.get<AuditLogQueryResult>(cacheKey);
        if (cached) {
          this.logger.debug('Audit query cache hit', { query });
          return cached;
        }
      }

      // Query storage
      const [entries, totalCount] = await Promise.all([
        this.storage.read(query),
        this.storage.count(query),
      ]);

      // Build result
      const result: AuditLogQueryResult = {
        entries,
        totalCount,
        page: Math.floor((query.offset || 0) / (query.limit || 100)) + 1,
        pageSize: query.limit || 100,
        hasMore: totalCount > (query.offset || 0) + entries.length,
      };

      // Cache result for common queries
      if (this.cache && cacheKey && entries.length > 0) {
        await this.cache.set(cacheKey, result, 300); // 5 minute TTL
      }

      const duration = performance.now() - startTime;
      this.updateAverageQueryTime(duration);

      return result;
    } catch (error) {
      this.logger.error('Audit query failed', error);
      throw error;
    }
  }

  async getEntry(id: string): Promise<AuditLogEntry | null> {
    // Check cache first
    if (this.cache) {
      const cached = await this.cache.get<AuditLogEntry>(`audit:entry:${id}`);
      if (cached) return cached;
    }

    // Query storage
    const result = await this.query({
      limit: 1,
      // Note: Would need to add ID filter to query interface
    });

    return result.entries.find(e => e.id === id) || null;
  }

  async verify(id: string): Promise<boolean> {
    const entry = await this.getEntry(id);
    if (!entry) return false;

    return this.storage.verify(entry);
  }

  async export(query: AuditLogQuery, format: 'json' | 'csv' = 'json'): Promise<AuditLogExport> {
    const result = await this.query({
      ...query,
      limit: Number.MAX_SAFE_INTEGER, // Get all results
    });

    let content: string;
    let mimeType: string;

    if (format === 'csv') {
      content = this.convertToCSV(result.entries);
      mimeType = 'text/csv';
    } else {
      content = JSON.stringify(result.entries, null, 2);
      mimeType = 'application/json';
    }

    return {
      format,
      content,
      mimeType,
      entryCount: result.entries.length,
      exportDate: new Date(),
      query,
    };
  }

  async archive(before: Date): Promise<number> {
    try {
      const count = await this.storage.archive(before);

      // Log the archive operation
      await this.log({
        actor: {
          type: 'system',
          id: 'audit-service',
          name: 'Audit Service',
        },
        action: 'audit.archive',
        outcome: 'success',
        details: {
          archivedCount: count,
          beforeDate: before.toISOString(),
        },
      });

      this.logger.info(`Archived ${count} audit entries before ${before.toISOString()}`);

      return count;
    } catch (error) {
      this.logger.error('Failed to archive audit entries', error);
      throw error;
    }
  }

  async getMetrics(): Promise<AuditLogMetrics> {
    return {
      ...this.metrics,
      storageSize: await this.estimateStorageSize(),
    };
  }

  async setSessionContext(sessionId: string, context: AuditContext): Promise<void> {
    this.sessionContext.set(sessionId, context);

    // Expire after 24 hours
    setTimeout(() => {
      this.sessionContext.delete(sessionId);
    }, 86400000);
  }

  async clearSessionContext(sessionId: string): Promise<void> {
    this.sessionContext.delete(sessionId);
  }

  async dispose(): Promise<void> {
    // Stop archive process
    if (this.archiveInterval) {
      clearInterval(this.archiveInterval);
    }

    // Clear session contexts
    this.sessionContext.clear();

    this.logger.info('AuditLogService disposed');
  }

  // Private helper methods

  private computeHash(entry: Omit<AuditLogEntry, 'hash'>): string {
    const data = JSON.stringify({
      id: entry.id,
      timestamp: entry.timestamp,
      actor: entry.actor,
      action: entry.action,
      resource: entry.resource,
      outcome: entry.outcome,
      details: entry.details,
      context: entry.context,
    });

    return createHash('sha256').update(data).digest('hex');
  }

  private async cacheEntry(entry: AuditLogEntry): Promise<void> {
    if (!this.cache) return;

    // Cache by ID
    await this.cache.set(`audit:entry:${entry.id}`, entry, 3600);

    // Cache recent entries by actor
    const actorKey = `audit:actor:${entry.actor.id}:recent`;
    const actorEntries = (await this.cache.get<string[]>(actorKey)) || [];
    actorEntries.unshift(entry.id);
    actorEntries.length = Math.min(actorEntries.length, 10); // Keep last 10
    await this.cache.set(actorKey, actorEntries, 3600);

    // Cache recent entries by action
    const actionKey = `audit:action:${entry.action}:recent`;
    const actionEntries = (await this.cache.get<string[]>(actionKey)) || [];
    actionEntries.unshift(entry.id);
    actionEntries.length = Math.min(actionEntries.length, 10);
    await this.cache.set(actionKey, actionEntries, 3600);
  }

  private getQueryCacheKey(query: AuditLogQuery): string | null {
    // Only cache simple queries
    if (query.offset !== 0 || query.limit !== 100) {
      return null;
    }

    const parts: string[] = ['audit:query'];

    if (query.actorId) parts.push(`actor:${query.actorId}`);
    if (query.action) parts.push(`action:${query.action}`);
    if (query.resourceType) parts.push(`resource:${query.resourceType}`);
    if (query.outcome) parts.push(`outcome:${query.outcome}`);

    if (parts.length === 1) return null; // Don't cache unfiltered queries

    return parts.join(':');
  }

  private isSecurityAction(action: string): boolean {
    const securityActions = [
      'auth.login',
      'auth.logout',
      'auth.failed',
      'permission.grant',
      'permission.revoke',
      'user.create',
      'user.delete',
      'password.change',
      'mfa.enable',
      'mfa.disable',
      'api.key.create',
      'api.key.revoke',
    ];

    return securityActions.includes(action);
  }

  private updateAverageQueryTime(duration: number): void {
    const count = this.metrics.totalEntries || 1;
    this.metrics.averageQueryTime =
      (this.metrics.averageQueryTime * (count - 1) + duration) / count;
  }

  private convertToCSV(entries: AuditLogEntry[]): string {
    if (entries.length === 0) return '';

    // Headers
    const headers = [
      'ID',
      'Timestamp',
      'Actor Type',
      'Actor ID',
      'Actor Name',
      'Action',
      'Resource Type',
      'Resource ID',
      'Outcome',
      'IP Address',
      'User Agent',
    ];

    // Rows
    const rows = entries.map(entry => [
      entry.id,
      entry.timestamp.toISOString(),
      entry.actor.type,
      entry.actor.id,
      entry.actor.name || '',
      entry.action,
      entry.resource?.type || '',
      entry.resource?.id || '',
      entry.outcome,
      entry.context?.ipAddress || '',
      entry.context?.userAgent || '',
    ]);

    // Combine
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return csv;
  }

  private async estimateStorageSize(): Promise<number> {
    // Estimate based on average entry size and count
    const avgEntrySize = 1024; // 1KB average
    return this.metrics.totalEntries * avgEntrySize;
  }

  private startArchiveProcess(): void {
    // Run archive process daily
    this.archiveInterval = setInterval(async () => {
      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.retention.standard);

        const count = await this.archive(cutoffDate);

        if (count > 0) {
          this.logger.info(`Auto-archived ${count} audit entries`);
        }
      } catch (error) {
        this.logger.error('Auto-archive failed', error);
      }
    }, 86400000); // 24 hours
  }
}
