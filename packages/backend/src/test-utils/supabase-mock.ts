/**
 * Shared Supabase mock chain builder for backend tests.
 *
 * Per common-solutions.md #7 — chainable mock builder pattern.
 * Extracted from CrossPostService.test.ts (todo #455) to prevent
 * duplication across service test files.
 */
import { vi } from 'vitest';

/**
 * Creates a chainable mock for a specific Supabase table query.
 *
 * Usage:
 * ```ts
 * const chain = createMockChain(mockData);
 * const mockDb = { from: vi.fn().mockReturnValue(chain) };
 * ```
 *
 * @param terminalData - Data returned by terminal methods (`.single()`, `.range()`).
 */
export function createMockChain(terminalData: unknown = []) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  [
    // Core query builder
    'from',
    'select',
    'insert',
    'update',
    'delete',
    'upsert',
    // Equality filters
    'eq',
    'neq',
    'in',
    // Comparison filters
    'gt',
    'gte',
    'lt',
    'lte',
    // Pattern filters
    'like',
    'ilike',
    'match',
    'textSearch',
    // Null / boolean filters
    'is',
    // Array / range filters
    'contains',
    'containedBy',
    'overlaps',
    // Logical operators
    'not',
    'or',
    'filter',
    // Sorting / pagination
    'order',
    'limit',
  ].forEach((method) => {
    chain[method] = vi.fn().mockReturnValue(chain);
  });
  // Terminal methods — each resolves with { data, error } matching Supabase's response shape
  chain.single = vi.fn().mockResolvedValue({ data: terminalData, error: null });
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: terminalData, error: null });
  chain.range = vi.fn().mockResolvedValue({ data: terminalData, error: null, count: 0 });
  // For insert().select() chains, the final await resolves via the chain itself
  chain.then = undefined; // Prevent premature Promise detection
  return chain;
}
