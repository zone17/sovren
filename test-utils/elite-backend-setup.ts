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

import { afterEach, beforeEach, jest } from '@jest/globals';

// 🧹 **CLEANUP AFTER EACH TEST**
afterEach(() => {
  // Clear all mocks
  jest.clearAllMocks();

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
  jest.clearAllMocks();
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
    res.status = jest.fn<any>().mockReturnValue(res);
    res.json = jest.fn<any>().mockReturnValue(res);
    res.send = jest.fn<any>().mockReturnValue(res);
    res.end = jest.fn<any>().mockReturnValue(res);
    res.cookie = jest.fn<any>().mockReturnValue(res);
    res.header = jest.fn<any>().mockReturnValue(res);
    return res;
  },

  mockNext: () => jest.fn<any>(),
};

// 🔐 **SECURITY TESTING SETUP**
export const securityMocks = {
  mockAuth: () => ({
    verify: jest.fn<any>().mockResolvedValue({ id: 'user-1' }),
    sign: jest.fn<any>().mockReturnValue('mock-token'),
  }),

  mockEncryption: () => ({
    encrypt: jest.fn<any>().mockReturnValue('encrypted-data'),
    decrypt: jest.fn<any>().mockReturnValue('decrypted-data'),
  }),
};

// 🎯 **SETUP COMPLETE**
console.log('🔙 Elite backend test setup completed!');
console.log('🗄️  Database mocks and API utilities configured');
