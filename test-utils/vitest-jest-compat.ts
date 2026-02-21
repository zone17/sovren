/**
 * Vitest-Jest Compatibility Layer
 *
 * Makes `jest` global available as an alias for `vi` so existing test files
 * using `jest.fn()`, `jest.mock()`, `jest.spyOn()`, etc. work without changes.
 */
import { vi } from 'vitest';

// Make `jest` available globally as an alias for `vi`
// This allows existing test files to use jest.fn(), jest.mock(), etc.
const jestCompat = {
  fn: vi.fn.bind(vi),
  mock: vi.mock.bind(vi),
  unmock: vi.unmock.bind(vi),
  spyOn: vi.spyOn.bind(vi),
  clearAllMocks: vi.clearAllMocks.bind(vi),
  resetAllMocks: vi.resetAllMocks.bind(vi),
  restoreAllMocks: vi.restoreAllMocks.bind(vi),
  clearAllTimers: vi.clearAllTimers.bind(vi),
  useFakeTimers: vi.useFakeTimers.bind(vi),
  useRealTimers: vi.useRealTimers.bind(vi),
  advanceTimersByTime: vi.advanceTimersByTime.bind(vi),
  runAllTimers: vi.runAllTimers.bind(vi),
  runOnlyPendingTimers: vi.runOnlyPendingTimers.bind(vi),
  setTimeout: (timeout: number) => vi.setConfig({ testTimeout: timeout }),
  requireActual: async (modulePath: string) => {
    return vi.importActual(modulePath);
  },
  requireMock: async (modulePath: string) => {
    return vi.importMock(modulePath);
  },
};

// Assign to global
(globalThis as any).jest = jestCompat;

// Set NODE_ENV
process.env.NODE_ENV = 'test';
