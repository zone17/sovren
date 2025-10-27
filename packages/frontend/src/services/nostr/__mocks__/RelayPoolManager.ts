/**
 * Mock for RelayPoolManager
 */

export const RelayPoolManager = jest.fn().mockImplementation(() => ({
  publishEvent: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  isInitialized: jest.fn().mockReturnValue(true),
}));

const mockInstance = new RelayPoolManager();

RelayPoolManager.getInstance = jest.fn().mockReturnValue(mockInstance);

export const relayPoolManager = mockInstance;
