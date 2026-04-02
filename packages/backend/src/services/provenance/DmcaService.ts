/**
 * DmcaService
 * DMCA report generation (JSON format)
 * EPIC-008: Content Shield (US-E8-004c)
 */

import type { DmcaReport, MatchLevel, RelayConfirmation } from '@shared/types/provenance';
import type { IDmcaService } from '../../interfaces/provenance/IDmcaService';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';
import type { ILogger } from '../../interfaces/shared/ILogger';
import { NotFoundError } from '../../utils/errors';

export class DmcaService implements IDmcaService {
  constructor(
    private readonly db: ISupabaseClient,
    private readonly logger: ILogger
  ) {}

  async generateReport(creatorId: string, alertId: string): Promise<DmcaReport> {
    // Get the alert
    const { data: alert, error: alertError } = await this.db
      .from('content_alerts')
      .select('*')
      .eq('id', alertId)
      .eq('creator_id', creatorId)
      .single();

    if (alertError || !alert) {
      throw new NotFoundError(`Alert ${alertId}`);
    }

    // Get provenance record for the original content
    const { data: provenance, error: provError } = await this.db
      .from('provenance_records')
      .select('*')
      .eq('content_id', alert.original_content_id)
      .single();

    if (provError || !provenance) {
      throw new NotFoundError(`Provenance record for content ${alert.original_content_id}`);
    }

    this.logger.info('DMCA report generated', { alertId, creatorId });

    // Cast DB row fields to their proper types
    const alertRow = alert as Record<string, unknown>;
    const provRow = provenance as Record<string, unknown>;

    return {
      title: 'DMCA Takedown Report',
      generated_at: new Date().toISOString(),
      claimant: {
        pubkey: creatorId,
        nip05: '', // Would be resolved from user profile
        display_name: '', // Would be resolved from user profile
      },
      original_content: {
        content_id: alertRow.original_content_id as string,
        published_at: provRow.created_at as string,
        provenance_signature: provRow.signature as string,
        nostr_event_id: provRow.nostr_event_id as string,
        content_hash: provRow.content_hash as string,
        relay_confirmations: (provRow.relay_confirmations as RelayConfirmation[]) || [],
      },
      infringing_content: {
        url: alertRow.detected_copy_url as string,
        author_pubkey: alertRow.detected_author_pubkey as string | null,
        detected_at: alertRow.detected_at as string,
        similarity_score: parseFloat(alertRow.similarity_score as string),
        match_level: alertRow.match_level as MatchLevel,
      },
      verification_url: `https://sovren.dev/verify/${alertRow.original_content_id as string}`,
    };
  }
}
