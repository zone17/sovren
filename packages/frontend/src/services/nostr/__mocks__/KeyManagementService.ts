/**
 * Mock for KeyManagementService
 */

export const KeyManagementService = vi.fn().mockImplementation(() => ({
  getPrivateKey: vi.fn(),
  getPublicKey: vi.fn().mockResolvedValue('pubkey123'),
  isInitialized: vi.fn().mockReturnValue(true),
  initialize: vi.fn().mockResolvedValue(undefined),
  destroy: vi.fn().mockResolvedValue(undefined),
  listKeys: vi.fn().mockResolvedValue([]),
  getActiveKey: vi.fn().mockReturnValue(null),
  getKey: vi.fn().mockResolvedValue(null),
  importKey: vi.fn().mockResolvedValue({ success: true }),
  signEvent: vi.fn().mockResolvedValue({ success: true, sig: 'signature' }),
  verifyEventSignature: vi.fn().mockReturnValue(true),
  generateKeyPair: vi.fn().mockResolvedValue({ publicKey: 'pubkey', privateKey: 'privkey' }),
  rotateKey: vi.fn().mockResolvedValue({ success: true }),
  exportKey: vi.fn().mockResolvedValue({ success: true, data: 'exported' }),
}));

const mockInstance = new KeyManagementService();

KeyManagementService.getInstance = vi.fn().mockReturnValue(mockInstance);

export const keyManagementService = mockInstance;
