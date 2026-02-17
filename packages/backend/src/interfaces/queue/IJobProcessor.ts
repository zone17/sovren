/**
 * Job Processor Interface
 * Defines the contract for BullMQ job processors
 * Part of E0-001: BullMQ Infrastructure
 */

import type { Job } from 'bullmq';

export interface IJobProcessor<T = unknown> {
  /** Unique processor name */
  readonly name: string;

  /** Queue this processor handles jobs for */
  readonly queueName: string;

  /** Concurrency limit for this processor (default: 1) */
  readonly concurrency?: number;

  /** Process a single job */
  process(job: Job<T>): Promise<void>;

  /** Called when a job completes successfully */
  onCompleted?(job: Job<T>): Promise<void>;

  /** Called when a job fails after all retries */
  onFailed?(job: Job<T>, error: Error): Promise<void>;
}
