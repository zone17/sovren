/**
 * Mock for RelayPoolManager
 */

export const RelayPoolManager = vi.fn().mockImplementation(() => ({
  publishEvent: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  isInitialized: vi.fn().mockReturnValue(true),
}));

const mockInstance = new RelayPoolManager();

RelayPoolManager.getInstance = vi.fn().mockReturnValue(mockInstance);

export const relayPoolManager = mockInstance;
