/**
 * Idempotency Cleanup Service
 *
 * Automated background service for cleaning up expired idempotency cache entries.
 * Runs on a configurable schedule and provides monitoring/statistics.
 *
 * @module services/IdempotencyCleanupService
 * @story PAY-010
 */

import { IdempotencyRepository } from '../repositories/IdempotencyRepository';
import { IdempotencyCleanupStats } from '../types/idempotency';

export interface CleanupConfig {
  /** Interval between cleanup runs in milliseconds (default: 1 hour) */
  interval_ms?: number;

  /** Whether to start cleanup automatically (default: true) */
  auto_start?: boolean;

  /** Maximum number of entries to delete per cleanup (default: unlimited) */
  max_delete_per_run?: number;

  /** Whether to log cleanup statistics (default: true) */
  enable_logging?: boolean;
}

export interface CleanupHistory {
  stats: IdempotencyCleanupStats;
  success: boolean;
  error?: string;
}

/**
 * Service for managing idempotency cache cleanup
 */
export class IdempotencyCleanupService {
  private static readonly DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

  private timer?: NodeJS.Timeout;
  private isRunning = false;
  private history: CleanupHistory[] = [];
  private config: Required<CleanupConfig>;

  constructor(
    private repository: IdempotencyRepository,
    config: CleanupConfig = {}
  ) {
    this.config = {
      interval_ms: config.interval_ms || IdempotencyCleanupService.DEFAULT_INTERVAL_MS,
      auto_start: config.auto_start ?? true,
      max_delete_per_run: config.max_delete_per_run || Infinity,
      enable_logging: config.enable_logging ?? true,
    };

    if (this.config.auto_start) {
      this.start();
    }
  }

  /**
   * Start automatic cleanup
   */
  start(): void {
    if (this.isRunning) {
      console.warn('Idempotency cleanup service is already running');
      return;
    }

    this.isRunning = true;

    // Run cleanup immediately
    this.runCleanup().catch((error) => {
      console.error('Initial cleanup failed:', error);
    });

    // Schedule periodic cleanup
    this.timer = setInterval(() => {
      this.runCleanup().catch((error) => {
        console.error('Scheduled cleanup failed:', error);
      });
    }, this.config.interval_ms);

    // Prevent timer from keeping process alive
    this.timer.unref();

    if (this.config.enable_logging) {
      console.log(
        `Idempotency cleanup service started (interval: ${this.config.interval_ms}ms)`
      );
    }
  }

  /**
   * Stop automatic cleanup
   */
  stop(): void {
    if (!this.isRunning) {
      console.warn('Idempotency cleanup service is not running');
      return;
    }

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    this.isRunning = false;

    if (this.config.enable_logging) {
      console.log('Idempotency cleanup service stopped');
    }
  }

  /**
   * Run cleanup manually
   */
  async runCleanup(): Promise<CleanupHistory> {
    const startTime = Date.now();

    try {
      const stats = await this.repository.cleanupExpired();

      const history: CleanupHistory = {
        stats,
        success: true,
      };

      this.addToHistory(history);

      if (this.config.enable_logging && stats.deleted_count > 0) {
        console.log(
          `Idempotency cleanup: removed ${stats.deleted_count} expired entries ` +
            `in ${stats.duration_ms}ms`
        );
      }

      return history;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      const history: CleanupHistory = {
        stats: {
          deleted_count: 0,
          cleanup_at: new Date(),
          duration_ms: Date.now() - startTime,
        },
        success: false,
        error: errorMessage,
      };

      this.addToHistory(history);

      if (this.config.enable_logging) {
        console.error('Idempotency cleanup failed:', errorMessage);
      }

      throw error;
    }
  }

  /**
   * Get cleanup statistics
   */
  getStats(): {
    is_running: boolean;
    total_cleanups: number;
    successful_cleanups: number;
    failed_cleanups: number;
    total_deleted: number;
    last_cleanup: CleanupHistory | null;
    average_duration_ms: number;
  } {
    const successfulCleanups = this.history.filter((h) => h.success);
    const totalDeleted = this.history.reduce(
      (sum, h) => sum + h.stats.deleted_count,
      0
    );
    const avgDuration =
      this.history.length > 0
        ? this.history.reduce((sum, h) => sum + h.stats.duration_ms, 0) /
          this.history.length
        : 0;

    return {
      is_running: this.isRunning,
      total_cleanups: this.history.length,
      successful_cleanups: successfulCleanups.length,
      failed_cleanups: this.history.length - successfulCleanups.length,
      total_deleted: totalDeleted,
      last_cleanup: this.history[this.history.length - 1] || null,
      average_duration_ms: Math.round(avgDuration),
    };
  }

  /**
   * Get cleanup history
   */
  getHistory(limit = 10): CleanupHistory[] {
    return this.history.slice(-limit);
  }

  /**
   * Clear cleanup history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Get repository statistics
   */
  async getRepositoryStats(): Promise<{
    total_entries: number;
    expired_entries: number;
    oldest_entry: Date | null;
    newest_entry: Date | null;
  }> {
    return this.repository.getStats();
  }

  /**
   * Add cleanup result to history
   */
  private addToHistory(history: CleanupHistory): void {
    this.history.push(history);

    // Keep only last 100 entries
    if (this.history.length > 100) {
      this.history = this.history.slice(-100);
    }
  }
}
