/**
 * Canonical pagination types for the Sovren platform.
 *
 * All new code should import PaginatedResult and PaginationParams from this file.
 * Legacy types (PaginatedData in finance.ts, PaginatedResponse in api-responses.ts)
 * are deprecated in favor of these canonical definitions.
 */

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
}
