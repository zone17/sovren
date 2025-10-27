/**
 * Integration Test Setup
 * Comprehensive setup for integration testing with database, services, and external APIs
 */

const { execSync } = require('child_process');
const path = require('path');

// Global test configuration
global.TEST_CONFIG = {
  database: {
    url:
      process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/sovren_test',
    pool: {
      min: 2,
      max: 10,
    },
  },
  redis: {
    url: process.env.TEST_REDIS_URL || 'redis://localhost:6379/1',
  },
  services: {
    timeout: 30000,
    retries: 3,
  },
};

// Database setup utilities
global.setupTestDatabase = async () => {
  try {
    // Run database migrations
    execSync('npm run db:migrate', {
      cwd: path.join(__dirname, '../packages/backend'),
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: global.TEST_CONFIG.database.url,
      },
    });

    // Seed test data
    execSync('npm run db:seed:test', {
      cwd: path.join(__dirname, '../packages/backend'),
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: global.TEST_CONFIG.database.url,
      },
    });

    console.log('✅ Test database setup completed');
  } catch (error) {
    console.error('❌ Test database setup failed:', error);
    throw error;
  }
};

global.teardownTestDatabase = async () => {
  try {
    // Clean up test data
    execSync('npm run db:reset', {
      cwd: path.join(__dirname, '../packages/backend'),
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: global.TEST_CONFIG.database.url,
      },
    });

    console.log('✅ Test database teardown completed');
  } catch (error) {
    console.error('❌ Test database teardown failed:', error);
    // Don't throw to avoid masking test failures
  }
};

// Service mocking utilities
global.mockExternalServices = () => {
  // Mock NOSTR relay
  jest.mock('@nostr-dev-kit/ndk', () => ({
    NDK: jest.fn().mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(true),
      publish: jest.fn().mockResolvedValue({ id: 'mock-event-id' }),
      fetchEvents: jest.fn().mockResolvedValue([]),
      pool: {
        on: jest.fn(),
        off: jest.fn(),
      },
    })),
  }));

  // Mock Lightning Network
  jest.mock('lnd-grpc', () => ({
    createInvoice: jest.fn().mockResolvedValue({
      paymentRequest: 'lnbc1000n1...',
      rHash: Buffer.from('mock-hash', 'hex'),
    }),
    lookupInvoice: jest.fn().mockResolvedValue({
      settled: true,
      value: '1000',
    }),
  }));

  // Mock Supabase client
  jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      auth: {
        signUp: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
        signIn: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    }),
  }));

  console.log('✅ External services mocked');
};

// Test data factories
global.createTestUser = async (overrides = {}) => {
  const defaultUser = {
    id: `test-user-${Date.now()}`,
    email: `test-${Date.now()}@example.com`,
    username: `testuser${Date.now()}`,
    displayName: 'Test User',
    hashedPassword: '$2b$10$test.hash.for.testing',
    nostrPublicKey: 'npub1test...',
    lightningAddress: `test${Date.now()}@sovren.app`,
    verified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };

  return defaultUser;
};

global.createTestContent = async (userId, overrides = {}) => {
  const defaultContent = {
    id: `test-content-${Date.now()}`,
    userId,
    title: 'Test Content',
    body: 'This is test content for integration testing.',
    type: 'free',
    status: 'published',
    tags: ['test', 'integration'],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };

  return defaultContent;
};

global.createTestPayment = async (userId, overrides = {}) => {
  const defaultPayment = {
    id: `test-payment-${Date.now()}`,
    userId,
    amount: 1000, // satoshis
    status: 'pending',
    paymentRequest: 'lnbc1000n1...',
    paymentHash: 'test-hash',
    memo: 'Test payment',
    createdAt: new Date(),
    ...overrides,
  };

  return defaultPayment;
};

// API testing utilities
global.createTestAPIClient = () => {
  const request = require('supertest');
  const { app } = require('../packages/backend/src/app');

  return {
    app,
    request: request(app),

    // Helper methods for authenticated requests
    async authenticateUser(user) {
      const { generateJWT } = require('../packages/backend/src/utils/jwt');
      return generateJWT({ userId: user.id, email: user.email });
    },

    async makeAuthenticatedRequest(method, url, token, data = {}) {
      const req = this.request[method.toLowerCase()](url)
        .set('Authorization', `Bearer ${token}`)
        .set('Content-Type', 'application/json');

      if (['post', 'put', 'patch'].includes(method.toLowerCase())) {
        req.send(data);
      }

      return req;
    },
  };
};

// Performance testing utilities
global.measurePerformance = (name, fn) => {
  return async (...args) => {
    const start = process.hrtime.bigint();
    try {
      const result = await fn(...args);
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000; // Convert to milliseconds

      console.log(`⏱️  Performance: ${name} took ${duration.toFixed(2)}ms`);

      // Fail test if performance is below threshold
      if (duration > 5000) {
        // 5 seconds threshold
        throw new Error(
          `Performance test failed: ${name} took ${duration.toFixed(2)}ms (threshold: 5000ms)`
        );
      }

      return result;
    } catch (error) {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000;
      console.error(
        `❌ Performance test failed: ${name} took ${duration.toFixed(2)}ms and threw error:`,
        error
      );
      throw error;
    }
  };
};

// Memory leak detection
global.detectMemoryLeaks = () => {
  const initialMemory = process.memoryUsage();

  return {
    check: () => {
      const currentMemory = process.memoryUsage();
      const heapIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
      const heapIncreasePercent = (heapIncrease / initialMemory.heapUsed) * 100;

      if (heapIncreasePercent > 50) {
        // 50% increase threshold
        console.warn(
          `⚠️  Potential memory leak detected: heap increased by ${heapIncreasePercent.toFixed(2)}%`
        );
      }

      return {
        initial: initialMemory,
        current: currentMemory,
        increase: heapIncrease,
        increasePercent: heapIncreasePercent,
      };
    },
  };
};

// Test environment validation
global.validateTestEnvironment = () => {
  const requiredEnvVars = ['NODE_ENV', 'TEST_DATABASE_URL', 'TEST_REDIS_URL'];

  const missing = requiredEnvVars.filter((envVar) => !process.env[envVar]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables for testing: ${missing.join(', ')}`);
  }

  if (process.env.NODE_ENV !== 'test') {
    throw new Error('NODE_ENV must be set to "test" for integration tests');
  }

  console.log('✅ Test environment validated');
};

// Setup and teardown hooks
beforeAll(async () => {
  global.validateTestEnvironment();
  global.mockExternalServices();
  await global.setupTestDatabase();
});

afterAll(async () => {
  await global.teardownTestDatabase();
});

// Per-test setup
beforeEach(() => {
  // Reset all mocks
  jest.clearAllMocks();

  // Start memory leak detection
  global.memoryLeakDetector = global.detectMemoryLeaks();
});

afterEach(() => {
  // Check for memory leaks
  if (global.memoryLeakDetector) {
    global.memoryLeakDetector.check();
  }
});

console.log('🧪 Integration test setup completed');
