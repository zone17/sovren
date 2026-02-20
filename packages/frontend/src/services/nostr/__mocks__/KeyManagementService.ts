/**
 * Mock for KeyManagementService
 */

export const KeyManagementService = vi.fn().mockImplementation(() => ({
  getPrivateKey: vi.fn(),
  getPublicKey: vi.fn(),
  isInitialized: vi.fn().mockReturnValue(true),
}));

const mockInstance = new KeyManagementService();

KeyManagementService.getInstance = vi.fn().mockReturnValue(mockInstance);

export const keyManagementService = mockInstance;
