/**
 * Cross-Platform Publish Job Processor
 * EPIC-009: BullMQ worker for publishing content to external platforms
 */

import type { IJobProcessor, JobContext } from '../../interfaces/queue/IJobProcessor';
import type { ILogger } from '../../interfaces/shared/ILogger';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';
import type { CrossPublishJobData } from './CrossPostService';
import type { IPlatformConnectionService } from '../../interfaces/distribution/IPlatformConnectionService';
import type { FormattedContent } from '@sovren/shared/types/distribution';

export class CrossPublishProcessor implements IJobProcessor<CrossPublishJobData> {
  readonly name = 'cross-platform-publisher';
  readonly queueName = 'cross-publish';
  readonly concurrency = 5;

  private readonly db: ISupabaseClient;
  private readonly platformService: IPlatformConnectionService;
  private readonly logger: ILogger;

  constructor(db: ISupabaseClient, platformService: IPlatformConnectionService, logger: ILogger) {
    this.db = db;
    this.platformService = platformService;
    this.logger = logger;
  }

  async process(job: JobContext<CrossPublishJobData>): Promise<void> {
    const { crossPostId, contentId, creatorId, platform, useRepurposed } = job.data;

    this.logger.info('[CrossPublishProcessor] Processing publish job', {
      jobId: job.id,
      crossPostId,
      platform,
    });

    // Conditional update: only transition to 'publishing' if not already cancelled (avoids TOCTOU race)
    const { data: updated } = await this.db
      .from('cross_posts')
      .update({ status: 'publishing', attempt_count: job.attemptsMade + 1, updated_at: new Date().toISOString() })
      .eq('id', crossPostId)
      .neq('status', 'cancelled')
      .select('id');

    if (!updated || updated.length === 0) {
      this.logger.info('[CrossPublishProcessor] Job was cancelled, skipping', { crossPostId });
      return;
    }

    // Load content
    let contentText = '';
    let backlink = `${process.env.FRONTEND_URL || 'https://sovren.app'}/content/${contentId}`;

    if (useRepurposed) {
      const { data: repurposed } = await this.db
        .from('repurposed_content')
        .select('text, backlink_url')
        .eq('source_content_id', contentId)
        .eq('platform', platform)
        .eq('approved', true)
        .single();

      if (repurposed) {
        contentText = repurposed.text;
        backlink = repurposed.backlink_url;
      }
    }

    if (!contentText) {
      const { data: content } = await this.db
        .from('content')
        .select('title, body')
        .eq('id', contentId)
        .single();

      if (!content) {
        throw new Error(`Content ${contentId} not found`);
      }

      contentText = content.title ? `${content.title}\n\n${content.body || ''}` : (content.body || '');
    }

    // Format content per platform constraints
    const adapter = this.platformService.getAdapter(platform);
    const maxLength = adapter.constraints.max_text_length;

    let formattedText = contentText;
    const backlinkSuffix = `\n\n${backlink}`;

    if (formattedText.length + backlinkSuffix.length > maxLength) {
      formattedText = formattedText.substring(0, maxLength - backlinkSuffix.length - 3) + '...';
    }
    formattedText += backlinkSuffix;

    const formattedContent: FormattedContent = {
      text: formattedText,
      backlink_url: backlink,
    };

    // Get decrypted token and publish
    const accessToken = await this.platformService.getDecryptedToken(creatorId, platform);
    const result = await adapter.publish(
      { access_token: accessToken, refresh_token: null, expires_at: null, scopes: [] },
      formattedContent
    );

    // Update cross_posts with success
    await this.db
      .from('cross_posts')
      .update({
        status: 'published',
        platform_post_id: result.platform_post_id,
        platform_url: result.url,
        published_at: result.published_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', crossPostId);

    this.logger.info('[CrossPublishProcessor] Published successfully', {
      crossPostId,
      platform,
      platformPostId: result.platform_post_id,
    });
  }

  static async recoverStaleJobs(db: ISupabaseClient, logger: ILogger, staleCutoffMinutes = 10): Promise<number> {
    const cutoff = new Date(Date.now() - staleCutoffMinutes * 60 * 1000).toISOString();

    const { data, error } = await db
      .from('cross_posts')
      .update({ status: 'queued', error_message: 'Recovered from stale publishing state', updated_at: new Date().toISOString() })
      .eq('status', 'publishing')
      .lt('updated_at', cutoff)
      .select('id');

    if (error) {
      logger.error('[CrossPublishProcessor] Failed to recover stale jobs', { error: error.message });
      return 0;
    }

    const count = data?.length || 0;
    if (count > 0) {
      logger.warn('[CrossPublishProcessor] Recovered stale publishing jobs', { count });
    }
    return count;
  }

  async onFailed(job: JobContext<CrossPublishJobData>, error: Error): Promise<void> {
    const { crossPostId, platform } = job.data;

    this.logger.error('[CrossPublishProcessor] Publish failed', {
      crossPostId,
      platform,
      error: error.message,
      attempts: job.attemptsMade,
    });

    await this.db
      .from('cross_posts')
      .update({
        status: 'failed',
        error_message: error.message,
        attempt_count: job.attemptsMade,
        updated_at: new Date().toISOString(),
      })
      .eq('id', crossPostId);
  }
}
