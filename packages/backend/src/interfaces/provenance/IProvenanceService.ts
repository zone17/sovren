// @ts-nocheck
/**
 * IProvenanceService Interface
 * Content signing with NOSTR keys, chain retrieval
 * EPIC-008: Content Shield
 */

import type { ProvenanceRecord, ProvenanceCertificate } from '@shared/types/provenance';

export interface SignContentInput {
  contentId: string;
  creatorId: string;
  contentBody: string;
  nostrEventId: string;
  signature: string;
  relays: string[];
}

export interface IProvenanceService {
  getProvenanceChain(contentId: string): Promise<ProvenanceRecord | null>;
  getCertificate(contentId: string, creatorId: string): Promise<ProvenanceCertificate>;
  signContent(input: SignContentInput): Promise<ProvenanceRecord>;
  revokeProvenance(contentId: string, creatorId: string): Promise<{ content_id: string; status: string; revoked_at: string }>;
}
