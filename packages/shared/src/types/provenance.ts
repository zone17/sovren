/**
 * Content Shield / Provenance Domain Types
 * Shared types for EPIC-008: Content Shield (AI Protection)
 *
 * Used by both backend services and frontend API clients.
 */

// ============================================================================
// Provenance Types
// ============================================================================

export type VerificationStatus = 'verified' | 'unverified' | 'disputed';

export interface RelayConfirmation {
  relay: string;
  confirmed_at: string;
}

export interface ProvenanceRecord {
  content_id: string;
  author_pubkey: string;
  created_at: string;
  signature: string;
  nostr_event_id: string;
  content_hash: string;
  relay_confirmations: RelayConfirmation[];
  verification_status: VerificationStatus;
  nip05_verified: boolean;
}

export interface ProvenanceCertificate {
  title: string;
  content_id: string;
  author: {
    pubkey: string;
    nip05: string;
    display_name: string;
  };
  provenance: {
    created_at: string;
    signature: string;
    nostr_event_id: string;
    content_hash: string;
    relay_confirmations: RelayConfirmation[];
  };
  generated_at: string;
  verification_url: string;
}

// ============================================================================
// Fingerprint Types
// ============================================================================

export type HashType = 'simhash' | 'phash';
export type ContentType = 'text' | 'image';

export interface Fingerprint {
  content_id: string;
  content_title?: string;
  hash_type: HashType;
  hash_value: string;
  created_at: string;
}

export interface FingerprintRegistry {
  total_fingerprinted: number;
  total_content: number;
  coverage_percentage: number;
  fingerprints: Fingerprint[];
}

export type MatchLevel = 'exact_copy' | 'derivative' | 'coincidental';

export interface FingerprintMatch {
  content_id: string;
  content_title: string;
  similarity: number;
  match_level: MatchLevel;
  hash_type: HashType;
}

export interface CompareResult {
  matches: FingerprintMatch[];
  total_compared: number;
}

// ============================================================================
// Alert Types
// ============================================================================

export type AlertStatus = 'new' | 'reviewed' | 'resolved' | 'false_positive' | 'reported';

export interface ContentAlert {
  id: string;
  original_content_id: string;
  original_title: string;
  detected_copy_url: string;
  detected_author_pubkey: string | null;
  similarity_score: number;
  match_level: MatchLevel;
  hash_type: HashType;
  status: AlertStatus;
  detected_at: string;
  relay: string | null;
}

export interface AlertDetail {
  id: string;
  original: {
    content_id: string;
    title: string;
    excerpt: string;
    published_at: string;
    provenance: {
      signature: string;
      nostr_event_id: string;
    };
  };
  detected: {
    url: string;
    author_pubkey: string | null;
    excerpt: string;
    published_at: string;
  };
  comparison: {
    similarity_score: number;
    match_level: MatchLevel;
    hash_type: HashType;
    highlighted_sections: string[];
  };
  status: AlertStatus;
  detected_at: string;
}

// Valid alert status transitions
export const ALERT_STATUS_TRANSITIONS: Record<AlertStatus, AlertStatus[]> = {
  new: ['reviewed', 'false_positive'],
  reviewed: ['resolved', 'false_positive', 'reported'],
  reported: ['resolved'],
  resolved: [],
  false_positive: [],
};

// ============================================================================
// DMCA Report Types
// ============================================================================

export interface DmcaReport {
  title: string;
  generated_at: string;
  claimant: {
    pubkey: string;
    nip05: string;
    display_name: string;
  };
  original_content: {
    content_id: string;
    published_at: string;
    provenance_signature: string;
    nostr_event_id: string;
    content_hash: string;
    relay_confirmations: RelayConfirmation[];
  };
  infringing_content: {
    url: string;
    author_pubkey: string | null;
    detected_at: string;
    similarity_score: number;
    match_level: MatchLevel;
  };
  verification_url: string;
}

// ============================================================================
// Pagination Types
// ============================================================================

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
