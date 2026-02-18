/**
 * Job Processor Interface
 * Framework-agnostic contract for job processors
 * Part of E0-001: BullMQ Infrastructure
 */

export interface JobContext<T = unknown> {
  /** Unique job ID */
  id: string;
  /** Job data payload */
  data: T;
  /** Number of attempts so far */
  attemptsMade: number;
}

export interface IJobProcessor<T = unknown> {
  /** Unique processor name */
  readonly name: string;

  /** Queue this processor handles jobs for */
  readonly queueName: string;

  /** Concurrency limit for this processor (default: 1) */
  readonly concurrency?: number;

  /** Rate limiter for this processor (BullMQ Worker limiter) */
  readonly limiter?: {
    /** Maximum number of jobs to process in the duration window */
    max: number;
    /** Duration of the rate limit window in milliseconds */
    duration: number;
  };

  /** Process a single job */
  process(job: JobContext<T>): Promise<void>;

  /** Called when a job completes successfully */
  onCompleted?(job: JobContext<T>): Promise<void>;

  /** Called when a job fails after all retries */
  onFailed?(job: JobContext<T>, error: Error): Promise<void>;
}
