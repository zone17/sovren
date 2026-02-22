/**
 * QueueService Implementation
 * Wraps BullMQ Queue and Worker classes for centralized queue management
 * Reuses the shared Redis connection config from lib/redis.ts
 * Part of E0-001: BullMQ Infrastructure
 */

import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import type {
  IQueueService,
  QueueCreateOptions,
  QueueJobOptions,
} from '../../interfaces/queue/IQueueService';
import type { IJobProcessor, JobContext } from '../../interfaces/queue/IJobProcessor';
import type { ILogger } from '../../interfaces/shared/ILogger';
import { getRedisClient } from '../../lib/redis';

/**
 * Module-level singleton reference — kept for backward compatibility.
 * @deprecated Resolve IQueueService from the DI container via TYPES.QueueService instead.
 * TODO: Remove getInstance() shim after all consumers migrate to DI
 */
let singletonInstance: QueueService | null = null;

/** @deprecated Use the DI container to resolve IQueueService (TYPES.QueueService). */
export function getQueueServiceInstance(): QueueService | null {
  return singletonInstance;
}

/**
 * Create a BullMQ-compatible Redis connection.
 * BullMQ workers use blocking commands (BRPOPLPUSH, BLMOVE) that require
 * maxRetriesPerRequest: null — the shared client's default won't work.
 */
function createBullMQConnection(): Redis {
  const baseClient = getRedisClient();
  const opts = baseClient.options;
  return new Redis({
    host: opts.host,
    port: opts.port,
    password: opts.password,
    db: opts.db,
    maxRetriesPerRequest: null, // Required for BullMQ blocking commands
    enableReadyCheck: false,
  });
}

export class QueueService implements IQueueService {
  private readonly queues: Map<string, Queue> = new Map();
  private readonly workers: Map<string, Worker> = new Map();
  private readonly logger: ILogger;

  constructor(logger: ILogger) {
    this.logger = logger;
    singletonInstance = this;
  }

  createQueue(name: string, options?: QueueCreateOptions): void {
    if (this.queues.has(name)) {
      this.logger.warn(`[QueueService] Queue "${name}" already exists, skipping creation`);
      return;
    }

    const queue = new Queue(name, {
      connection: createBullMQConnection(),
      defaultJobOptions: {
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
        ...options?.defaultJobOptions,
      },
    });

    this.queues.set(name, queue);
    this.logger.info(`[QueueService] Queue "${name}" created`);
  }

  async addJob<T>(
    queueName: string,
    jobName: string,
    data: T,
    options?: QueueJobOptions
  ): Promise<string> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`[QueueService] Queue "${queueName}" not found. Call createQueue() first.`);
    }

    const job = await queue.add(jobName, data, options);
    this.logger.info(`[QueueService] Job "${jobName}" added to queue "${queueName}"`, {
      jobId: job.id,
    });
    return job.id!;
  }

  async removeJob(queueName: string, jobId: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      this.logger.warn(`[QueueService] Cannot remove job — queue "${queueName}" not found`);
      return;
    }

    try {
      const job = await queue.getJob(jobId);
      if (job) {
        await job.remove();
        this.logger.info(`[QueueService] Job "${jobId}" removed from queue "${queueName}"`);
      }
    } catch (err) {
      // Best-effort: job may have already completed or been cleaned up
      this.logger.warn(`[QueueService] Could not remove job "${jobId}" from queue "${queueName}"`, {
        error: (err as Error).message,
      });
    }
  }

  /**
   * Get the underlying BullMQ Queue for admin tooling (Bull Board).
   * NOT on the IQueueService interface — this is an implementation detail.
   */
  getQueue(name: string): Queue | undefined {
    return this.queues.get(name);
  }

  getQueueNames(): string[] {
    return Array.from(this.queues.keys());
  }

  /**
   * Register a job processor and create a Worker for it.
   * Adapts the framework-agnostic IJobProcessor to BullMQ's Worker.
   */
  registerProcessor<T>(processor: IJobProcessor<T>): void {
    if (this.workers.has(processor.name)) {
      this.logger.warn(`[QueueService] Processor "${processor.name}" already registered, skipping`);
      return;
    }

    // Ensure the queue exists
    if (!this.queues.has(processor.queueName)) {
      this.createQueue(processor.queueName);
    }

    const worker = new Worker<T>(
      processor.queueName,
      async (job: Job<T>) => processor.process(toJobContext(job)),
      {
        connection: createBullMQConnection(),
        concurrency: processor.concurrency ?? 1,
        ...(processor.limiter && { limiter: processor.limiter }),
      }
    );

    if (processor.onCompleted) {
      worker.on('completed', (job: Job<T>) => {
        processor.onCompleted!(toJobContext(job)).catch((err) => {
          this.logger.error(`[QueueService] onCompleted handler error for "${processor.name}"`, {
            error: err.message,
          });
        });
      });
    }

    if (processor.onFailed) {
      worker.on('failed', (job: Job<T> | undefined, err: Error) => {
        if (job) {
          processor.onFailed!(toJobContext(job), err).catch((handlerErr) => {
            this.logger.error(`[QueueService] onFailed handler error for "${processor.name}"`, {
              error: handlerErr.message,
            });
          });
        }
      });
    }

    worker.on('error', (err) => {
      this.logger.error(`[QueueService] Worker error for "${processor.name}"`, {
        error: err.message,
      });
    });

    this.workers.set(processor.name, worker);
    this.logger.info(
      `[QueueService] Processor "${processor.name}" registered for queue "${processor.queueName}"`
    );
  }

  async isHealthy(): Promise<boolean> {
    try {
      for (const [, queue] of this.queues) {
        await queue.getWaitingCount();
      }
      return true;
    } catch {
      return false;
    }
  }

  async closeAll(): Promise<void> {
    this.logger.info('[QueueService] Closing all queues and workers...');

    // Close workers first so no new jobs are picked up
    const workerClosePromises = Array.from(this.workers.entries()).map(async ([name, worker]) => {
      try {
        await worker.close();
        this.logger.info(`[QueueService] Worker "${name}" closed`);
      } catch (err) {
        this.logger.error(`[QueueService] Error closing worker "${name}"`, {
          error: (err as Error).message,
        });
      }
    });
    await Promise.all(workerClosePromises);
    this.workers.clear();

    // Then close queues
    const queueClosePromises = Array.from(this.queues.entries()).map(async ([name, queue]) => {
      try {
        await queue.close();
        this.logger.info(`[QueueService] Queue "${name}" closed`);
      } catch (err) {
        this.logger.error(`[QueueService] Error closing queue "${name}"`, {
          error: (err as Error).message,
        });
      }
    });
    await Promise.all(queueClosePromises);
    this.queues.clear();

    this.logger.info('[QueueService] All queues and workers closed');
    // Clear the backward-compat singleton so a disposed instance is never returned
    singletonInstance = null;
  }
}

/** Adapt a BullMQ Job to our framework-agnostic JobContext */
function toJobContext<T>(job: Job<T>): JobContext<T> {
  return {
    id: job.id ?? '',
    data: job.data,
    attemptsMade: job.attemptsMade,
  };
}
