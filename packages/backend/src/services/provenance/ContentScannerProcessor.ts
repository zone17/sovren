/**
 * ContentScannerProcessor
 * BullMQ job processor for scanning NOSTR relays for content copies
 * EPIC-008: Content Shield (US-E8-004a)
 *
 * Connects to NOSTR relays, fetches recent events, computes fingerprints,
 * and compares against creator's registered fingerprints to detect copies.
 */

import type { IJobProcessor, JobContext } from '../../interfaces/queue/IJobProcessor';
import type { IFingerprintService } from '../../interfaces/provenance/IFingerprintService';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';
import type { ILogger } from '../../interfaces/shared/ILogger';
import type { MatchLevel } from '@shared/types/provenance';

export interface RelayScanJobData {
  creatorId: string;
  relays: string[];
  since: number; // Unix timestamp: scan events after this
  fingerprintIds: string[];
}

interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

const SIMILARITY_THRESHOLDS = {
  exact_copy: 0.95,
  derivative: 0.70,
} as const;

export class ContentScannerProcessor implements IJobProcessor<RelayScanJobData> {
  readonly name = 'content-scanner';
  readonly queueName = 'relay-scan';
  readonly concurrency = 3;

  constructor(
    private readonly fingerprintService: IFingerprintService,
    private readonly db: ISupabaseClient,
    private readonly logger: ILogger
  ) {}

  async process(job: JobContext<RelayScanJobData>): Promise<void> {
    const { creatorId, relays, since, fingerprintIds } = job.data;

    this.logger.info('Starting relay scan', {
      jobId: job.id,
      creatorId,
      relayCount: relays.length,
      since: new Date(since * 1000).toISOString(),
    });

    // Load creator's fingerprints to compare against
    const creatorFingerprints = await this.loadCreatorFingerprints(creatorId, fingerprintIds);

    if (creatorFingerprints.length === 0) {
      this.logger.info('No fingerprints to compare against, skipping scan', { creatorId });
      return;
    }

    let totalEventsScanned = 0;
    let alertsCreated = 0;

    for (const relayUrl of relays) {
      try {
        const events = await this.fetchRelayEvents(relayUrl, since);
        totalEventsScanned += events.length;

        for (const event of events) {
          // Skip the creator's own events
          if (event.pubkey === creatorId) continue;

          // Only process text notes (kind 1) and reposts (kind 6)
          if (event.kind !== 1 && event.kind !== 6) continue;

          const alertCount = await this.processEvent(
            event,
            creatorId,
            creatorFingerprints,
            relayUrl
          );
          alertsCreated += alertCount;
        }
      } catch (err) {
        this.logger.error('Error scanning relay', {
          relay: relayUrl,
          error: (err as Error).message,
        });
        // Continue to next relay even if one fails
      }
    }

    this.logger.info('Relay scan completed', {
      jobId: job.id,
      creatorId,
      totalEventsScanned,
      alertsCreated,
    });
  }

  async onCompleted(job: JobContext<RelayScanJobData>): Promise<void> {
    this.logger.info('Relay scan job completed', { jobId: job.id });
  }

  async onFailed(job: JobContext<RelayScanJobData>, error: Error): Promise<void> {
    this.logger.error('Relay scan job failed', {
      jobId: job.id,
      error: error.message,
      attempts: job.attemptsMade,
    });
  }

  private async loadCreatorFingerprints(
    creatorId: string,
    fingerprintIds: string[]
  ): Promise<Array<{ content_id: string; hash_type: string; hash_value: string }>> {
    let query = this.db
      .from('content_fingerprints')
      .select('content_id, hash_type, hash_value')
      .eq('creator_id', creatorId);

    if (fingerprintIds.length > 0) {
      query = query.in('id', fingerprintIds);
    }

    // Bound the result set
    query = query.limit(1000);

    const { data, error } = await query;

    if (error) {
      this.logger.error('Failed to load creator fingerprints', { creatorId, error });
      throw error;
    }

    return data || [];
  }

  /**
   * Fetch events from a NOSTR relay.
   * In production, this would use WebSocket to connect to the relay.
   * For now, returns an empty array as a placeholder that can be
   * replaced with actual nostr-tools relay connection.
   */
  private async fetchRelayEvents(relayUrl: string, since: number): Promise<NostrEvent[]> {
    this.logger.info('Fetching events from relay', { relay: relayUrl, since });

    // Production implementation would use nostr-tools:
    // const relay = await Relay.connect(relayUrl);
    // const events = await relay.list([{ kinds: [1, 6], since }]);
    // await relay.close();
    // return events;

    // Placeholder: In production, this connects to NOSTR relays via WebSocket
    // and fetches events matching the filter criteria.
    // The actual relay connection is deferred to integration phase when
    // nostr-tools relay management is wired up end-to-end.
    return [];
  }

  private async processEvent(
    event: NostrEvent,
    creatorId: string,
    creatorFingerprints: Array<{ content_id: string; hash_type: string; hash_value: string }>,
    relayUrl: string
  ): Promise<number> {
    let alertsCreated = 0;

    // Compute SimHash of the event content
    const eventHash = this.fingerprintService.computeSimHash(event.content);

    // Compare against all creator fingerprints of matching type
    const simhashFingerprints = creatorFingerprints.filter((fp) => fp.hash_type === 'simhash');

    for (const fp of simhashFingerprints) {
      const similarity = this.fingerprintService.computeSimilarity(eventHash, fp.hash_value);

      if (similarity >= SIMILARITY_THRESHOLDS.derivative) {
        const matchLevel = this.getMatchLevel(similarity);

        // Check if this alert already exists (dedup by content_id + detected URL)
        const eventUrl = `nostr:nevent1${event.id}`;
        const { data: existing } = await this.db
          .from('content_alerts')
          .select('id')
          .eq('creator_id', creatorId)
          .eq('original_content_id', fp.content_id)
          .eq('detected_copy_url', eventUrl)
          .single();

        if (!existing) {
          const { error } = await this.db.from('content_alerts').insert({
            creator_id: creatorId,
            original_content_id: fp.content_id,
            detected_copy_url: eventUrl,
            detected_author_pubkey: event.pubkey,
            similarity_score: Math.round(similarity * 10000) / 10000,
            match_level: matchLevel,
            hash_type: 'simhash',
            status: 'new',
            relay: relayUrl,
          });

          if (error) {
            this.logger.error('Failed to create alert', {
              contentId: fp.content_id,
              error,
            });
          } else {
            alertsCreated++;
            this.logger.info('Copy detection alert created', {
              originalContentId: fp.content_id,
              detectedAuthor: event.pubkey,
              similarity,
              matchLevel,
              relay: relayUrl,
            });
          }
        }
      }
    }

    return alertsCreated;
  }

  private getMatchLevel(similarity: number): MatchLevel {
    if (similarity > SIMILARITY_THRESHOLDS.exact_copy) return 'exact_copy';
    if (similarity >= SIMILARITY_THRESHOLDS.derivative) return 'derivative';
    return 'coincidental';
  }
}
