/**
 * QueueService Implementation
 * Wraps BullMQ Queue and Worker classes for centralized queue management
 * Reuses the shared Redis connection from lib/redis.ts
 * Part of E0-001: BullMQ Infrastructure
 */

import { Queue, Worker, QueueOptions, JobsOptions, Job } from 'bullmq';
import type { IQueueService } from '../../interfaces/queue/IQueueService';
import type { IJobProcessor } from '../../interfaces/queue/IJobProcessor';
import type { ILogger } from '../../interfaces/shared/ILogger';
import { getRedisClient } from '../../lib/redis';

/** Module-level singleton reference for health-check access without DI */
let singletonInstance: QueueService | null = null;

export function getQueueServiceInstance(): QueueService | null {
  return singletonInstance;
}

export class QueueService implements IQueueService {
  private readonly queues: Map<string, Queue> = new Map();
  private readonly workers: Map<string, Worker> = new Map();
  private readonly logger: ILogger;

  constructor(logger: ILogger) {
    this.logger = logger;
    singletonInstance = this;
  }

  createQueue(name: string, options?: Partial<QueueOptions>): void {
    if (this.queues.has(name)) {
      this.logger.warn(`[QueueService] Queue "${name}" already exists, skipping creation`);
      return;
    }

    const redis = getRedisClient();
    const queue = new Queue(name, {
      connection: redis.duplicate(),
      defaultJobOptions: {
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
      ...options,
    });

    this.queues.set(name, queue);
    this.logger.info(`[QueueService] Queue "${name}" created`);
  }

  async addJob<T>(
    queueName: string,
    jobName: string,
    data: T,
    options?: JobsOptions
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

  getQueue(name: string): Queue | undefined {
    return this.queues.get(name);
  }

  getQueueNames(): string[] {
    return Array.from(this.queues.keys());
  }

  /**
   * Register a job processor and create a Worker for it.
   * The worker uses a duplicate of the shared Redis connection.
   */
  registerProcessor<T>(processor: IJobProcessor<T>): void {
    if (this.workers.has(processor.name)) {
      this.logger.warn(
        `[QueueService] Processor "${processor.name}" already registered, skipping`
      );
      return;
    }

    // Ensure the queue exists
    if (!this.queues.has(processor.queueName)) {
      this.createQueue(processor.queueName);
    }

    const redis = getRedisClient();
    const worker = new Worker<T>(
      processor.queueName,
      async (job: Job<T>) => processor.process(job),
      {
        connection: redis.duplicate(),
        concurrency: processor.concurrency ?? 1,
      }
    );

    if (processor.onCompleted) {
      worker.on('completed', (job: Job<T>) => {
        processor.onCompleted!(job).catch((err) => {
          this.logger.error(
            `[QueueService] onCompleted handler error for "${processor.name}"`,
            { error: err.message }
          );
        });
      });
    }

    if (processor.onFailed) {
      worker.on('failed', (job: Job<T> | undefined, err: Error) => {
        if (job) {
          processor.onFailed!(job, err).catch((handlerErr) => {
            this.logger.error(
              `[QueueService] onFailed handler error for "${processor.name}"`,
              { error: handlerErr.message }
            );
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
      for (const [name, queue] of this.queues) {
        // Attempt to get waiting count as a connectivity check
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
    const workerClosePromises = Array.from(this.workers.entries()).map(
      async ([name, worker]) => {
        try {
          await worker.close();
          this.logger.info(`[QueueService] Worker "${name}" closed`);
        } catch (err) {
          this.logger.error(`[QueueService] Error closing worker "${name}"`, {
            error: (err as Error).message,
          });
        }
      }
    );
    await Promise.all(workerClosePromises);
    this.workers.clear();

    // Then close queues
    const queueClosePromises = Array.from(this.queues.entries()).map(
      async ([name, queue]) => {
        try {
          await queue.close();
          this.logger.info(`[QueueService] Queue "${name}" closed`);
        } catch (err) {
          this.logger.error(`[QueueService] Error closing queue "${name}"`, {
            error: (err as Error).message,
          });
        }
      }
    );
    await Promise.all(queueClosePromises);
    this.queues.clear();

    this.logger.info('[QueueService] All queues and workers closed');
  }
}
