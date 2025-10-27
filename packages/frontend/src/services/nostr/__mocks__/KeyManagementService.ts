/**
 * Mock for KeyManagementService
 */

export const KeyManagementService = jest.fn().mockImplementation(() => ({
  getPrivateKey: jest.fn(),
  getPublicKey: jest.fn(),
  isInitialized: jest.fn().mockReturnValue(true),
}));

const mockInstance = new KeyManagementService();

KeyManagementService.getInstance = jest.fn().mockReturnValue(mockInstance);

export const keyManagementService = mockInstance;
