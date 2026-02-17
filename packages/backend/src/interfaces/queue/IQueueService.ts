/**
 * Queue Service Interface
 * Framework-agnostic abstraction over job queue management
 * Part of E0-001: BullMQ Infrastructure
 */

import type { IJobProcessor } from './IJobProcessor';

export interface QueueJobOptions {
  jobId?: string;
  priority?: number;
  attempts?: number;
  backoff?: { type: string; delay: number };
  delay?: number;
  removeOnComplete?: boolean | { count: number };
  removeOnFail?: boolean | { count: number };
}

export interface QueueCreateOptions {
  defaultJobOptions?: QueueJobOptions;
}

export interface IQueueService {
  /**
   * Create a named queue with optional configuration
   */
  createQueue(name: string, options?: QueueCreateOptions): void;

  /**
   * Add a job to a named queue
   * @returns The job ID
   */
  addJob<T>(queueName: string, jobName: string, data: T, options?: QueueJobOptions): Promise<string>;

  /**
   * Register a job processor (worker) for a queue
   */
  registerProcessor<T>(processor: IJobProcessor<T>): void;

  /**
   * Get all registered queue names
   */
  getQueueNames(): string[];

  /**
   * Check if the queue service is healthy (Redis connected, queues responding)
   */
  isHealthy(): Promise<boolean>;

  /**
   * Close all queues and workers gracefully
   */
  closeAll(): Promise<void>;
}
