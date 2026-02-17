/**
 * Cross-Post Service
 * EPIC-009: Cross-platform publishing queue via BullMQ
 */

import { v4 as uuidv4 } from 'uuid';
import type { ICrossPostService, PublishRequest } from '../../interfaces/distribution/ICrossPostService';
import type { IQueueService } from '../../interfaces/queue/IQueueService';
import type { ILogger } from '../../interfaces/shared/ILogger';
import type { CrossPostEntry, SupportedPlatform } from '@sovren/shared/types/distribution';
import type { PlatformConnectionService } from './PlatformConnectionService';

export interface CrossPublishJobData {
  crossPostId: string;
  contentId: string;
  creatorId: string;
  platform: SupportedPlatform;
  useRepurposed: boolean;
}

const QUEUE_NAME = 'cross-publish';

export class CrossPostService implements ICrossPostService {
  private readonly db: any;
  private readonly queueService: IQueueService;
  private readonly platformService: PlatformConnectionService;
  private readonly logger: ILogger;

  constructor(
    db: any,
    queueService: IQueueService,
    platformService: PlatformConnectionService,
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
    const entries: CrossPostEntry[] = [];
    const batchJobId = uuidv4();

    for (const platform of request.platforms) {
      const crossPostId = uuidv4();
      const scheduledAt = request.schedule?.[platform] || null;
      const status = scheduledAt ? 'scheduled' : 'queued';

      // Insert cross_posts record
      const { error } = await this.db.from('cross_posts').insert({
        id: crossPostId,
        creator_id: creatorId,
        content_id: request.content_id,
        platform,
        status,
        scheduled_at: scheduledAt,
        bullmq_job_id: batchJobId,
      });

      if (error) {
        throw error;
      }

      // Calculate delay for scheduled posts
      let delay = 0;
      if (scheduledAt) {
        const scheduledTime = new Date(scheduledAt).getTime();
        delay = Math.max(0, scheduledTime - Date.now());
      }

      // Add job to BullMQ queue
      const jobData: CrossPublishJobData = {
        crossPostId,
        contentId: request.content_id,
        creatorId,
        platform,
        useRepurposed: request.use_repurposed || false,
      };

      await this.queueService.addJob<CrossPublishJobData>(
        QUEUE_NAME,
        `publish-${platform}`,
        jobData,
        { delay }
      );

      entries.push({
        id: crossPostId,
        content_id: request.content_id,
        platform,
        status,
        platform_post_id: null,
        platform_url: null,
        scheduled_at: scheduledAt,
        published_at: null,
        error_message: null,
      });
    }

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
