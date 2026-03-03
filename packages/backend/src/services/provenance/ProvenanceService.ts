/**
 * ProvenanceService
 * Content signing with NOSTR keys, provenance chain retrieval, certificate export
 * EPIC-008: Content Shield (US-E8-002, US-E8-007)
 */

import { createHash } from 'crypto';
import { verifyEvent, getEventHash } from 'nostr-tools/pure';
import type {
  ProvenanceRecord,
  ProvenanceCertificate,
  VerificationStatus,
} from '@shared/types/provenance';
import type {
  IProvenanceService,
  SignContentInput,
} from '../../interfaces/provenance/IProvenanceService';
import type { ISupabaseClient } from '../../interfaces/shared/ISupabaseClient';
import type { ILogger } from '../../interfaces/shared/ILogger';
import { NotFoundError, AuthorizationError } from '../../utils/errors';

/** DB row shape for provenance_records table */
interface ProvenanceRow {
  content_id: string;
  creator_id: string;
  created_at: string;
  signature: string;
  nostr_event_id: string;
  content_hash: string;
  relay_confirmations: Array<{ relay: string; confirmed_at: string }>;
  verification_status: VerificationStatus;
  status: string;
}

export class ProvenanceService implements IProvenanceService {
  constructor(
    private readonly db: ISupabaseClient,
    private readonly logger: ILogger
  ) {}

  async getProvenanceChain(contentId: string): Promise<ProvenanceRecord | null> {
    const { data, error } = await this.db
      .from<ProvenanceRow>('provenance_records')
      .select('*')
      .eq('content_id', contentId)
      .single();

    if (error && error.code === 'PGRST116') {
      return null;
    }

    if (error) {
      this.logger.error('Failed to get provenance chain', { contentId, error });
      throw error;
    }

    if (!data) {
      return null;
    }

    return {
      content_id: data.content_id,
      author_pubkey: data.creator_id,
      created_at: data.created_at,
      signature: data.signature,
      nostr_event_id: data.nostr_event_id,
      content_hash: data.content_hash,
      relay_confirmations: data.relay_confirmations || [],
      verification_status: data.verification_status,
      nip05_verified: false,
    };
  }

  async getCertificate(contentId: string, creatorId: string): Promise<ProvenanceCertificate> {
    const provenance = await this.getProvenanceChain(contentId);

    if (!provenance) {
      throw new NotFoundError(`Provenance record for content ${contentId}`);
    }

    // #612: Ownership checks use AuthorizationError (403), not NotFoundError (404)
    if (provenance.author_pubkey !== creatorId) {
      throw new AuthorizationError('Not authorized to access this provenance record');
    }

    return {
      title: 'Content Provenance Certificate',
      content_id: contentId,
      author: {
        pubkey: provenance.author_pubkey,
        nip05: '', // Would be resolved from user profile
        display_name: '', // Would be resolved from user profile
      },
      provenance: {
        created_at: provenance.created_at,
        signature: provenance.signature,
        nostr_event_id: provenance.nostr_event_id,
        content_hash: provenance.content_hash,
        relay_confirmations: provenance.relay_confirmations,
      },
      generated_at: new Date().toISOString(),
      verification_url: `https://sovren.dev/verify/${contentId}`,
    };
  }

  /**
   * Sign content at publish time.
   * Creates a SHA-256 hash of the content body, stores the provenance record
   * with the creator's NOSTR signature, event ID, and relay confirmations.
   * Called by the content publish pipeline (US-E8-007).
   *
   * Security: verifies NOSTR signature before storing (critical-patterns.md #9)
   * Security: checks content ownership before signing (critical-patterns.md #2)
   * Security: rejects invalid signatures (#613) — never stores 'unverified'
   * Security: uses insert not upsert (#615) — prevents silent overwrite
   */
  async signContent(input: SignContentInput, callerId: string): Promise<ProvenanceRecord> {
    // Ownership check: only the content creator can sign provenance
    // Pattern: AuthorizationError (403) for ownership checks, not ValidationError (400)
    if (input.creatorId !== callerId) {
      throw new AuthorizationError('Cannot sign provenance for content you do not own');
    }

    const contentHash = createHash('sha256').update(input.contentBody).digest('hex');

    // #609: Reconstruct the exact event the frontend signed.
    // Uses raw content body (not hash), matching tags, and client's timestamp.
    const eventData = {
      kind: 1,
      pubkey: input.creatorId,
      created_at: input.eventCreatedAt,
      tags: [['t', 'sovren-content']],
      content: input.contentBody,
    };
    const event = {
      ...eventData,
      id: getEventHash(eventData),
      sig: input.signature,
    };

    const isValid = verifyEvent(event);

    // #613: Reject invalid signatures — never store unverified records
    if (!isValid) {
      throw new AuthorizationError('Invalid NOSTR signature');
    }

    const verificationStatus: VerificationStatus = 'verified';

    const relayConfirmations = input.relays.map((relay) => ({
      relay,
      confirmed_at: new Date().toISOString(),
    }));

    // #615: Use insert instead of upsert to prevent silent provenance overwrite
    const { data, error } = await this.db
      .from<ProvenanceRow>('provenance_records')
      .insert({
        content_id: input.contentId,
        creator_id: input.creatorId,
        signature: input.signature,
        nostr_event_id: input.nostrEventId,
        content_hash: contentHash,
        relay_confirmations: relayConfirmations,
        verification_status: verificationStatus,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      // Handle unique constraint violation (content already has provenance)
      if (error.code === '23505') {
        throw new AuthorizationError('Provenance record already exists for this content');
      }
      this.logger.error('Failed to sign content', { contentId: input.contentId, error });
      throw error;
    }

    if (!data) {
      throw new Error('Failed to create provenance record: no data returned');
    }

    this.logger.info('Content signed with provenance', {
      contentId: input.contentId,
      creatorId: input.creatorId,
      eventId: input.nostrEventId,
      verificationStatus,
    });

    return {
      content_id: data.content_id,
      author_pubkey: data.creator_id,
      created_at: data.created_at,
      signature: data.signature,
      nostr_event_id: data.nostr_event_id,
      content_hash: data.content_hash,
      relay_confirmations: data.relay_confirmations || [],
      verification_status: data.verification_status,
      nip05_verified: false,
    };
  }

  /**
   * Soft-revoke a provenance record by updating only the status column.
   * The DB trigger (enforce_provenance_immutability) allows UPDATE on status only.
   * Full DELETE is blocked at the database level for all roles.
   */
  async revokeProvenance(
    contentId: string,
    creatorId: string
  ): Promise<{ content_id: string; status: string; revoked_at: string }> {
    const provenance = await this.getProvenanceChain(contentId);

    if (!provenance) {
      throw new NotFoundError(`Provenance record for content ${contentId}`);
    }

    // #612: Ownership checks use AuthorizationError (403), not NotFoundError (404)
    if (provenance.author_pubkey !== creatorId) {
      throw new AuthorizationError('Not authorized to revoke this provenance record');
    }

    const { error } = await this.db
      .from<ProvenanceRow>('provenance_records')
      .update({ status: 'revoked' })
      .eq('content_id', contentId)
      .eq('creator_id', creatorId);

    if (error) {
      this.logger.error('Failed to revoke provenance record', { contentId, error });
      throw error;
    }

    this.logger.info('Provenance record revoked', { contentId, creatorId });
    return { content_id: contentId, status: 'revoked', revoked_at: new Date().toISOString() };
  }
}
