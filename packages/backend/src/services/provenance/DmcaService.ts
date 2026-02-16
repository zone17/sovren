/**
 * DmcaService
 * DMCA report generation (JSON format)
 * EPIC-008: Content Shield (US-E8-004c)
 */

import type { DmcaReport } from '@sovren/shared/types/provenance';
import type { IDmcaService } from '../../interfaces/provenance/IDmcaService';
import { NotFoundError } from '../../utils/errors';

interface SupabaseClient {
  from(table: string): any;
}

export class DmcaService implements IDmcaService {
  constructor(
    private readonly db: SupabaseClient,
    private readonly logger: { info: Function; error: Function; warn: Function }
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

    return {
      title: 'DMCA Takedown Report',
      generated_at: new Date().toISOString(),
      claimant: {
        pubkey: creatorId,
        nip05: '', // Would be resolved from user profile
        display_name: '', // Would be resolved from user profile
      },
      original_content: {
        content_id: alert.original_content_id,
        published_at: provenance.created_at,
        provenance_signature: provenance.signature,
        nostr_event_id: provenance.nostr_event_id,
        content_hash: provenance.content_hash,
        relay_confirmations: provenance.relay_confirmations || [],
      },
      infringing_content: {
        url: alert.detected_copy_url,
        author_pubkey: alert.detected_author_pubkey,
        detected_at: alert.detected_at,
        similarity_score: parseFloat(alert.similarity_score),
        match_level: alert.match_level,
      },
      verification_url: `https://sovren.dev/verify/${alert.original_content_id}`,
    };
  }
}
