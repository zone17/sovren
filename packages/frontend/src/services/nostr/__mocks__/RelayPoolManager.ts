// @ts-nocheck
/**
 * Mock for RelayPoolManager
 */
import { vi } from 'vitest';

export const RelayPoolManager = vi.fn().mockImplementation(() => ({
  publishEvent: vi.fn().mockResolvedValue([]),
  publishEventToFastest: vi.fn().mockResolvedValue([]),
  subscribe: vi.fn().mockReturnValue('sub-mock'),
  unsubscribe: vi.fn(),
  isInitialized: vi.fn().mockReturnValue(true),
  initialize: vi.fn().mockResolvedValue(undefined),
  connectAll: vi.fn().mockResolvedValue(undefined),
  connectRelay: vi.fn().mockResolvedValue(undefined),
  disconnectRelay: vi.fn().mockResolvedValue(undefined),
  disconnectAll: vi.fn().mockResolvedValue(undefined),
  getRelayStatus: vi.fn().mockReturnValue('connected'),
  getRelayHealth: vi.fn().mockReturnValue(null),
  getConfiguredRelays: vi.fn().mockReturnValue([]),
  getConnectedRelays: vi.fn().mockReturnValue([]),
  getReconnectAttempts: vi.fn().mockReturnValue(0),
  on: vi.fn().mockReturnThis(),
  off: vi.fn().mockReturnThis(),
  emit: vi.fn(),
  destroy: vi.fn().mockResolvedValue(undefined),
}));

const mockInstance = new RelayPoolManager();

RelayPoolManager.getInstance = vi.fn().mockReturnValue(mockInstance);

export const relayPoolManager = mockInstance;
