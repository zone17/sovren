// Content Shield Feature Types — re-exported from @sovren/shared with frontend aliases
// See packages/shared/src/types/provenance.ts for canonical definitions.

// Re-export shared types directly (names match)
export type {
  VerificationStatus,
  AlertStatus,
  MatchLevel,
  HashType,
  RelayConfirmation,
  ContentAlert,
  AlertDetail,
  Pagination,
} from '@sovren/shared/types/provenance';

// Re-export shared types with frontend aliases (names differ between packages)
export type { ProvenanceRecord as ProvenanceData } from '@sovren/shared/types/provenance';
export type { Fingerprint as FingerprintEntry } from '@sovren/shared/types/provenance';
export type { FingerprintRegistry as FingerprintCoverageData } from '@sovren/shared/types/provenance';
export type { DmcaReport as DMCAReport } from '@sovren/shared/types/provenance';

// Top-level imports for types used in sub-interfaces below
import type {
  MatchLevel,
  HashType,
  RelayConfirmation,
  Pagination,
} from '@sovren/shared/types/provenance';

// --- Frontend-only types (UI state, component props) ---

/** Report format for DMCA report generation */
export type ReportFormat = 'json' | 'pdf';

// Sub-interfaces extracted from AlertDetail for component convenience
export interface AlertOriginal {
  content_id: string;
  title: string;
  excerpt: string;
  published_at: string;
  provenance: {
    signature: string;
    nostr_event_id: string;
  };
}

export interface AlertDetected {
  url: string;
  author_pubkey: string;
  excerpt: string;
  published_at: string;
}

export interface AlertComparison {
  similarity_score: number;
  match_level: MatchLevel;
  hash_type: HashType;
  highlighted_sections: string[];
}

// Sub-interfaces extracted from DMCAReport for component convenience
export interface DMCAClaimant {
  pubkey: string;
  nip05: string;
  display_name: string;
}

export interface DMCAOriginalContent {
  content_id: string;
  published_at: string;
  provenance_signature: string;
  nostr_event_id: string;
  content_hash: string;
  relay_confirmations: RelayConfirmation[];
}

export interface DMCAInfringingContent {
  url: string;
  author_pubkey: string;
  detected_at: string;
  similarity_score: number;
  match_level: MatchLevel;
}

// --- API wrappers (frontend-only) ---

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedApiResponse<T> {
  success: boolean;
  data: T;
  pagination: Pagination;
}
