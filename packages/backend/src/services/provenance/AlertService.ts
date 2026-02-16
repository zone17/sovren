/**
 * AlertService
 * Copy detection alert CRUD and status transitions
 * EPIC-008: Content Shield (US-E8-004b)
 */

import type {
  ContentAlert,
  AlertDetail,
  AlertStatus,
  Pagination,
} from '@sovren/shared/types/provenance';
import { ALERT_STATUS_TRANSITIONS } from '@sovren/shared/types/provenance';
import type { IAlertService } from '../../interfaces/provenance/IAlertService';
import { NotFoundError, ConflictError } from '../../utils/errors';

interface SupabaseClient {
  from(table: string): any;
}

export class AlertService implements IAlertService {
  constructor(
    private readonly db: SupabaseClient,
    private readonly logger: { info: Function; error: Function; warn: Function }
  ) {}

  async getAlerts(
    creatorId: string,
    status: AlertStatus,
    page: number,
    limit: number
  ): Promise<{ data: ContentAlert[]; pagination: Pagination }> {
    const offset = (page - 1) * limit;

    // Get total count
    const { count: total } = await this.db
      .from('content_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('creator_id', creatorId)
      .eq('status', status);

    // Get paginated alerts
    const { data, error } = await this.db
      .from('content_alerts')
      .select('*')
      .eq('creator_id', creatorId)
      .eq('status', status)
      .order('detected_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      this.logger.error('Failed to get alerts', { creatorId, error });
      throw error;
    }

    const totalCount = total || 0;
    const totalPages = Math.ceil(totalCount / limit);

    const alerts: ContentAlert[] = (data || []).map((row: any) => ({
      id: row.id,
      original_content_id: row.original_content_id,
      original_title: row.original_title || 'Untitled',
      detected_copy_url: row.detected_copy_url,
      detected_author_pubkey: row.detected_author_pubkey,
      similarity_score: parseFloat(row.similarity_score),
      match_level: row.match_level,
      hash_type: row.hash_type,
      status: row.status,
      detected_at: row.detected_at,
      relay: row.relay,
    }));

    return {
      data: alerts,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async getAlertDetail(creatorId: string, alertId: string): Promise<AlertDetail> {
    const { data: alert, error } = await this.db
      .from('content_alerts')
      .select('*')
      .eq('id', alertId)
      .eq('creator_id', creatorId)
      .single();

    if (error || !alert) {
      throw new NotFoundError(`Alert ${alertId}`);
    }

    // Get provenance for the original content
    const { data: provenance } = await this.db
      .from('provenance_records')
      .select('signature, nostr_event_id')
      .eq('content_id', alert.original_content_id)
      .single();

    return {
      id: alert.id,
      original: {
        content_id: alert.original_content_id,
        title: alert.original_title || 'Untitled',
        excerpt: '', // Would be fetched from content service
        published_at: alert.detected_at, // Approximation
        provenance: {
          signature: provenance?.signature || '',
          nostr_event_id: provenance?.nostr_event_id || '',
        },
      },
      detected: {
        url: alert.detected_copy_url,
        author_pubkey: alert.detected_author_pubkey,
        excerpt: '', // Would be fetched from detected content
        published_at: alert.detected_at,
      },
      comparison: {
        similarity_score: parseFloat(alert.similarity_score),
        match_level: alert.match_level,
        hash_type: alert.hash_type,
        highlighted_sections: [],
      },
      status: alert.status,
      detected_at: alert.detected_at,
    };
  }

  async updateAlertStatus(
    creatorId: string,
    alertId: string,
    newStatus: AlertStatus
  ): Promise<{ id: string; status: AlertStatus; updated_at: string }> {
    // Compute which statuses can transition to the requested newStatus (reverse lookup).
    // This avoids a separate read query — the database enforces atomicity.
    const validFromStatuses: AlertStatus[] = [];
    for (const [fromStatus, allowed] of Object.entries(ALERT_STATUS_TRANSITIONS)) {
      if (allowed.includes(newStatus)) {
        validFromStatuses.push(fromStatus as AlertStatus);
      }
    }

    // If no status can transition to newStatus, it's always invalid
    if (validFromStatuses.length === 0) {
      throw new ConflictError(
        `Cannot transition alert to '${newStatus}'. No valid source status exists.`
      );
    }

    const now = new Date().toISOString();

    // Atomic conditional update — only succeeds if the alert exists, belongs to
    // the creator, AND is currently in one of the valid source statuses.
    // This eliminates the TOCTOU race: the database handles concurrency.
    const { data, error: updateError } = await this.db
      .from('content_alerts')
      .update({ status: newStatus, updated_at: now })
      .eq('id', alertId)
      .eq('creator_id', creatorId)
      .in('status', validFromStatuses)
      .select()
      .single();

    if (updateError || !data) {
      // The atomic update matched 0 rows. Determine why:
      // 1) Alert doesn't exist / wrong creator → NotFoundError
      // 2) Alert exists but status doesn't allow this transition → ConflictError
      const { data: existing } = await this.db
        .from('content_alerts')
        .select('status')
        .eq('id', alertId)
        .eq('creator_id', creatorId)
        .single();

      if (!existing) {
        throw new NotFoundError(`Alert ${alertId}`);
      }

      const currentStatus = existing.status as AlertStatus;
      const allowedFromCurrent = ALERT_STATUS_TRANSITIONS[currentStatus] || [];
      throw new ConflictError(
        `Cannot transition alert from '${currentStatus}' to '${newStatus}'. ` +
          `Allowed: ${allowedFromCurrent.join(', ') || 'none'}`
      );
    }

    this.logger.info('Alert status updated', {
      alertId,
      from: '(atomic)',
      to: newStatus,
    });

    return { id: alertId, status: newStatus, updated_at: now };
  }
}
