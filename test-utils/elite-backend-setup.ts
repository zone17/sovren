/**
 * 🧪 **ELITE BACKEND TEST SETUP - NODE.JS & API TESTING**
 *
 * @description Backend-specific test setup for Node.js services and API testing
 * @version 2.0.0 - Production-Ready Backend Test Setup
 * @author Elite Engineering Team
 * @lastModified 2024-12-28
 *
 * **FEATURES:**
 * - Node.js environment setup
 * - Database mocking
 * - API testing utilities
 * - Service layer mocks
 * - Security testing setup
 *
 * **USAGE:**
 * Automatically loaded for backend tests through Jest setupFilesAfterEnv
 */



// 🧹 **CLEANUP AFTER EACH TEST**
afterEach(() => {
  // Clear all mocks
  vi.clearAllMocks();

  // Reset environment variables
  if (process.env.NODE_ENV !== 'test') {
    process.env.NODE_ENV = 'test';
  }
});

// 🎯 **BACKEND-SPECIFIC SETUP**
beforeEach(() => {
  // Ensure test environment
  process.env.NODE_ENV = 'test';

  // Reset console mocks for each test
  vi.clearAllMocks();
});

// 🗄️ **DATABASE MOCKING**
export const mockDatabase = {
  users: new Map(),
  posts: new Map(),
  payments: new Map(),

  reset: () => {
    mockDatabase.users.clear();
    mockDatabase.posts.clear();
    mockDatabase.payments.clear();
  },

  seed: () => {
    mockDatabase.users.set('user-1', {
      id: 'user-1',
      email: 'test@example.com',
      username: 'testuser',
    });
  },
};

// 🌐 **API TESTING UTILITIES**
export const apiTestUtils = {
  mockRequest: (data: any = {}) => ({
    body: data,
    params: {},
    query: {},
    headers: {},
    user: { id: 'user-1' },
    ...data,
  }),

  mockResponse: () => {
    const res: any = {};
    res.status = vi.fn<any>().mockReturnValue(res);
    res.json = vi.fn<any>().mockReturnValue(res);
    res.send = vi.fn<any>().mockReturnValue(res);
    res.end = vi.fn<any>().mockReturnValue(res);
    res.cookie = vi.fn<any>().mockReturnValue(res);
    res.header = vi.fn<any>().mockReturnValue(res);
    return res;
  },

  mockNext: () => vi.fn<any>(),
};

// 🔐 **SECURITY TESTING SETUP**
export const securityMocks = {
  mockAuth: () => ({
    verify: vi.fn<any>().mockResolvedValue({ id: 'user-1' }),
    sign: vi.fn<any>().mockReturnValue('mock-token'),
  }),

  mockEncryption: () => ({
    encrypt: vi.fn<any>().mockReturnValue('encrypted-data'),
    decrypt: vi.fn<any>().mockReturnValue('decrypted-data'),
  }),
};

// 🎯 **SETUP COMPLETE**
console.log('🔙 Elite backend test setup completed!');
console.log('🗄️  Database mocks and API utilities configured');
