/**
 * Cross-Post Service
 * EPIC-009: Cross-platform publishing queue via BullMQ
 */

import { v4 as uuidv4 } from 'uuid';
import type { ICrossPostService, PublishRequest } from '../../interfaces/distribution/ICrossPostService';
import type { IQueueService } from '../../interfaces/queue/IQueueService';
import type { ILogger } from '../../interfaces/shared/ILogger';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';
import type { CrossPostEntry, SupportedPlatform } from '@sovren/shared/types/distribution';
import type { IPlatformConnectionService } from '../../interfaces/distribution/IPlatformConnectionService';

export interface CrossPublishJobData {
  crossPostId: string;
  contentId: string;
  creatorId: string;
  platform: SupportedPlatform;
  useRepurposed: boolean;
}

const QUEUE_NAME = 'cross-publish';
const MAX_CROSS_POST_TARGETS = 10;

export class CrossPostService implements ICrossPostService {
  private readonly db: ISupabaseClient;
  private readonly queueService: IQueueService;
  private readonly platformService: IPlatformConnectionService;
  private readonly logger: ILogger;

  constructor(
    db: ISupabaseClient,
    queueService: IQueueService,
    platformService: IPlatformConnectionService,
    logger: ILogger
  ) {
    this.db = db;
    this.queueService = queueService;
    this.platformService = platformService;
    this.logger = logger;

    // Ensure the queue exists
    this.queueService.createQueue(QUEUE_NAME, {
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }

  async publish(
    creatorId: string,
    request: PublishRequest
  ): Promise<{ job_id: string; platforms: CrossPostEntry[] }> {
    if (request.platforms.length > MAX_CROSS_POST_TARGETS) {
      throw new Error(
        `Cannot cross-post to more than ${MAX_CROSS_POST_TARGETS} platforms at once (received ${request.platforms.length})`
      );
    }

    const batchJobId = uuidv4();

    // Build all cross_posts rows upfront
    const crossPostRows = request.platforms.map(platform => {
      const scheduledAt = request.schedule?.[platform] || null;
      return {
        id: uuidv4(),
        creator_id: creatorId,
        content_id: request.content_id,
        platform,
        status: scheduledAt ? 'scheduled' : 'queued',
        scheduled_at: scheduledAt,
        bullmq_job_id: batchJobId,
      };
    });

    // Batch insert all rows in a single DB round-trip
    const { data: inserted, error } = await this.db
      .from('cross_posts')
      .insert(crossPostRows)
      .select('id, platform, status, scheduled_at');

    if (error) {
      throw error;
    }

    // Queue BullMQ jobs for each inserted row
    for (const row of inserted || []) {
      let delay = 0;
      if (row.scheduled_at) {
        const scheduledTime = new Date(row.scheduled_at).getTime();
        delay = Math.max(0, scheduledTime - Date.now());
      }

      const jobData: CrossPublishJobData = {
        crossPostId: row.id,
        contentId: request.content_id,
        creatorId,
        platform: row.platform,
        useRepurposed: request.use_repurposed || false,
      };

      await this.queueService.addJob<CrossPublishJobData>(
        QUEUE_NAME,
        `publish-${row.platform}`,
        jobData,
        { delay }
      );
    }

    const entries: CrossPostEntry[] = (inserted || []).map(row => ({
      id: row.id,
      content_id: request.content_id,
      platform: row.platform,
      status: row.status,
      platform_post_id: null,
      platform_url: null,
      scheduled_at: row.scheduled_at,
      published_at: null,
      error_message: null,
    }));

    this.logger.info('[CrossPostService] Content queued for publishing', {
      creatorId,
      contentId: request.content_id,
      platforms: request.platforms,
      batchJobId,
    });

    return { job_id: batchJobId, platforms: entries };
  }

  async getStatus(creatorId: string, contentId: string): Promise<CrossPostEntry[]> {
    const { data, error } = await this.db
      .from('cross_posts')
      .select('id, content_id, platform, status, platform_post_id, platform_url, scheduled_at, published_at, error_message')
      .eq('creator_id', creatorId)
      .eq('content_id', contentId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  }

  async cancel(creatorId: string, crossPostId: string): Promise<void> {
    const { error } = await this.db
      .from('cross_posts')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', crossPostId)
      .eq('creator_id', creatorId)
      .in('status', ['queued', 'scheduled']);

    if (error) {
      throw error;
    }

    this.logger.info('[CrossPostService] Cross-post cancelled', {
      creatorId,
      crossPostId,
    });
  }
}
