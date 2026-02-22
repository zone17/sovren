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
export function createMockChain(terminalData: any = []) {
  const chain: any = {};
  ['from', 'select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'order', 'limit'].forEach(
    (method) => {
      chain[method] = vi.fn().mockReturnValue(chain);
    }
  );
  // Terminal methods
  chain.single = vi.fn().mockResolvedValue({ data: terminalData, error: null });
  // For insert().select() chains, the final await resolves via the chain itself
  chain.then = undefined; // Prevent premature Promise detection
  return chain;
}
