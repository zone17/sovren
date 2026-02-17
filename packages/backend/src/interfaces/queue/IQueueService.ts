/**
 * Queue Service Interface
 * Provides abstraction over BullMQ queue management
 * Part of E0-001: BullMQ Infrastructure
 */

import type { Queue, QueueOptions, JobsOptions } from 'bullmq';

export interface IQueueService {
  /**
   * Create a named queue with optional configuration
   */
  createQueue(name: string, options?: Partial<QueueOptions>): void;

  /**
   * Add a job to a named queue
   * @returns The job ID
   */
  addJob<T>(queueName: string, jobName: string, data: T, options?: JobsOptions): Promise<string>;

  /**
   * Get a queue by name
   */
  getQueue(name: string): Queue | undefined;

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
