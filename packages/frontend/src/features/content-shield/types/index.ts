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
  SignProvenanceBody,
  ContentType,
} from '@sovren/shared/types/provenance';

// Re-export shared types with frontend aliases (names differ between packages)
export type { ProvenanceRecord as ProvenanceData } from '@sovren/shared/types/provenance';
export type { FingerprintRegistry as FingerprintCoverageData } from '@sovren/shared/types/provenance';
export type { DmcaReport as DMCAReport } from '@sovren/shared/types/provenance';

// --- Frontend-only types (UI state, component props) ---

import type { Pagination } from '@sovren/shared/types/provenance';

/** Report format for DMCA report generation */
export type ReportFormat = 'json' | 'pdf';

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
