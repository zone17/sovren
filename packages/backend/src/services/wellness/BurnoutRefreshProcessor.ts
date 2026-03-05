/**
 * Burnout Refresh Job Processor
 * Recalculates burnout risk scores for creators with sufficient baseline data
 * EPIC-007: Creator Wellness System
 */

import type { IJobProcessor, JobContext } from '../../interfaces/queue/IJobProcessor';
import type { IBurnoutScoringService } from '../../interfaces/wellness/IBurnoutScoringService';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';
import type { ILogger } from '../../interfaces/shared/ILogger';

export interface BurnoutRefreshJobData {
  creatorId: string;
}

export class BurnoutRefreshProcessor implements IJobProcessor<BurnoutRefreshJobData> {
  readonly name = 'burnout-refresh';
  readonly queueName = 'burnout-refresh';
  readonly concurrency = 3;

  constructor(
    private readonly db: ISupabaseClient,
    private readonly burnoutService: IBurnoutScoringService,
    private readonly logger: ILogger
  ) {}

  async process(job: JobContext<BurnoutRefreshJobData>): Promise<void> {
    const { creatorId } = job.data;

    this.logger.info('[BurnoutRefreshProcessor] Refreshing burnout score', {
      jobId: job.id,
      creatorId,
    });

    await this.burnoutService.calculateScore(creatorId);

    this.logger.info('[BurnoutRefreshProcessor] Score refreshed', {
      jobId: job.id,
      creatorId,
    });
  }

  async onFailed(job: JobContext<BurnoutRefreshJobData>, error: Error): Promise<void> {
    this.logger.error('[BurnoutRefreshProcessor] Refresh failed', {
      creatorId: job.data.creatorId,
      error: error.message,
      attempts: job.attemptsMade,
    });
  }
}
