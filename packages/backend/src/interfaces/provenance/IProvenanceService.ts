/**
 * IProvenanceService Interface
 * Content signing with NOSTR keys, chain retrieval
 * EPIC-008: Content Shield
 */

import type { ProvenanceRecord, ProvenanceCertificate } from '@sovren/shared/types/provenance';

export interface IProvenanceService {
  getProvenanceChain(contentId: string): Promise<ProvenanceRecord | null>;
  getCertificate(contentId: string, creatorId: string): Promise<ProvenanceCertificate>;
}
