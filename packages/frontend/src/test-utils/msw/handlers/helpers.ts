import { HttpResponse } from 'msw';

/** Fixed timestamp for deterministic test assertions */
export const TEST_TIMESTAMP = '2026-01-15T12:00:00.000Z';

/** Wrap data in the ApiResponse<T> envelope the real backend returns */
export function jsonOk<T>(data: T) {
  return HttpResponse.json({
    success: true,
    data,
    timestamp: TEST_TIMESTAMP,
  });
}

/** Wrap paginated data in the PaginatedResponse<T> envelope */
export function jsonPaginated<T>(
  data: T[],
  pagination: { page: number; limit: number; total: number }
) {
  const totalPages = Math.ceil(pagination.total / pagination.limit);
  return HttpResponse.json({
    success: true,
    data,
    pagination: {
      ...pagination,
      totalPages,
      hasNext: pagination.page < totalPages,
      hasPrev: pagination.page > 1,
    },
    timestamp: TEST_TIMESTAMP,
  });
}

/** Shared test user fixture (NOSTR-based, matches backend contract) */
export const TEST_USER = {
  id: 'user-1',
  npub: 'npub1testuser000000000000000000000000000000000000000000000000',
  pubkey: 'abc123def456789',
  displayName: 'Test Creator',
  role: 'creator',
} as const;
