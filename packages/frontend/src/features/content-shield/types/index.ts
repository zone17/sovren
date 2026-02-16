// Content Shield Feature Types — matching Phase 7 API spec

export type VerificationStatus = 'verified' | 'unverified' | 'disputed';
export type AlertStatus = 'new' | 'reviewed' | 'resolved' | 'false_positive' | 'reported';
export type MatchLevel = 'exact_copy' | 'derivative' | 'coincidental';
export type HashType = 'simhash' | 'phash';
export type ReportFormat = 'json' | 'pdf';

// --- Provenance Types ---

export interface RelayConfirmation {
  relay: string;
  confirmed_at: string;
}

export interface ProvenanceData {
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

// --- Fingerprint Types ---

export interface FingerprintEntry {
  content_id: string;
  content_title: string;
  hash_type: HashType;
  hash_value: string;
  created_at: string;
}

export interface FingerprintCoverageData {
  total_fingerprinted: number;
  total_content: number;
  coverage_percentage: number;
  fingerprints: FingerprintEntry[];
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// --- Alert Types ---

export interface ContentAlert {
  id: string;
  original_content_id: string;
  original_title: string;
  detected_copy_url: string;
  detected_author_pubkey: string;
  similarity_score: number;
  match_level: MatchLevel;
  hash_type: HashType;
  status: AlertStatus;
  detected_at: string;
  relay: string;
}

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

export interface AlertDetail {
  id: string;
  original: AlertOriginal;
  detected: AlertDetected;
  comparison: AlertComparison;
  status: AlertStatus;
  detected_at: string;
}

// --- DMCA Report Types ---

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

export interface DMCAReport {
  title: string;
  generated_at: string;
  claimant: DMCAClaimant;
  original_content: DMCAOriginalContent;
  infringing_content: DMCAInfringingContent;
  verification_url: string;
}

// --- API Wrapper ---

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
