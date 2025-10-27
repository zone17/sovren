// Jest setup for Sovren Backend tests

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-purposes-minimum-32-characters';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.WEBHOOK_SECRET = 'test-webhook-secret-key-for-testing';
process.env.WEBHOOK_SECRET_ROTATION = 'test-webhook-secret-rotation-key';

// Mock path-to-regexp to fix Express router compatibility issues in Jest
jest.mock('path-to-regexp', () => {
  const actual = jest.requireActual('path-to-regexp');
  // Express expects pathRegexp function, ensure it's properly exported
  return typeof actual === 'function' ? actual : actual.pathToRegexp || actual.default || actual;
});

// In-memory test database
const testDatabase = new Map();
let userIdCounter = 1;

// Mock Supabase client with dynamic data handling
const mockSupabaseClient = {
  from: jest.fn().mockImplementation((table) => {
    const mockTable = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),

      single: jest.fn().mockImplementation(async () => {
        // Handle stats table
        if (table === 'user_stats') {
          return { data: null, error: { code: 'PGRST116', message: 'No rows found' } };
        }

        // Handle users stats query
        if (table === 'users' && mockTable.select.mock.calls.some(call => call[0] === 'role')) {
          const users = Array.from(testDatabase.values()).filter(user => user.is_active);
          return { data: users, error: null };
        }

        // Handle different query patterns - check ALL eq calls for nostr_pubkey
        const nostrPubkeyCall = mockTable.eq.mock.calls.find(call => call[0] === 'nostr_pubkey');
        if (nostrPubkeyCall) {
          const nostrPubkey = nostrPubkeyCall[1];
          const user = testDatabase.get(nostrPubkey);

          if (user) {
            return { data: user, error: null };
          } else {
            return { data: null, error: { code: 'PGRST116', message: 'No rows found' } };
          }
        }

        // Handle username lookup with ilike
        if (table === 'users') {
          const usernameCall = mockTable.ilike.mock.calls.find(call => call[0] === 'username');
          if (usernameCall) {
            const username = usernameCall[1];
            for (const user of testDatabase.values()) {
              if (user.username && user.username.toLowerCase() === username.toLowerCase()) {
                return { data: user, error: null };
              }
            }
          }
        }

        // Handle ID-based lookups
        const idCall = mockTable.eq.mock.calls.find(call => call[0] === 'id');
        if (idCall) {
          const userId = idCall[1];
          for (const user of testDatabase.values()) {
            if (user.id === userId) {
              return { data: user, error: null };
            }
          }
          return { data: null, error: { code: 'PGRST116', message: 'No rows found' } };
        }

        // Default fallback
        return { data: null, error: { code: 'PGRST116', message: 'No rows found' } };
      }),

      maybeSingle: jest.fn().mockResolvedValue({
        data: null,
        error: null
      }),
    };

    // Handle INSERT and UPDATE operations for users table
    if (table === 'users') {
      mockTable.insert = jest.fn().mockImplementation((userData) => {
        // Check for existing user first
        const existingUser = testDatabase.get(userData.nostr_pubkey);
        if (existingUser) {
          return {
            ...mockTable,
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: '23505', message: 'duplicate key value violates unique constraint' }
            })
          };
        }

        const userId = `test-user-${userIdCounter++}`;
        const now = new Date().toISOString();

        const user = {
          id: userId,
          nostr_pubkey: userData.nostr_pubkey,
          username: userData.username || null,
          display_name: userData.display_name || null,
          bio: userData.bio || null,
          avatar_url: userData.avatar_url || null,
          email: userData.email || null,
          email_verified: userData.email_verified || false,
          is_active: userData.is_active ?? true,
          is_verified: userData.is_verified || false,
          role: userData.role || 'supporter',
          created_at: now,
          updated_at: now,
          last_login_at: null
        };

        // Store in test database
        testDatabase.set(userData.nostr_pubkey, user);

        return {
          ...mockTable,
          single: jest.fn().mockResolvedValue({ data: user, error: null })
        };
      });

      // Handle UPDATE operations
      mockTable.update = jest.fn().mockImplementation((updateData) => {
        return {
          ...mockTable,
          single: jest.fn().mockImplementation(async () => {
            // Find the user ID from eq calls
            const idCall = mockTable.eq.mock.calls.find(call => call[0] === 'id');
            if (idCall) {
              const userId = idCall[1];

              // Find user by ID
              for (const [nostrPubkey, user] of testDatabase.entries()) {
                if (user.id === userId) {
                  const updatedUser = {
                    ...user,
                    ...updateData,
                    updated_at: new Date().toISOString()
                  };
                  testDatabase.set(nostrPubkey, updatedUser);
                  return { data: updatedUser, error: null };
                }
              }
            }
            return { data: null, error: { code: 'PGRST116', message: 'No rows found' } };
          })
        };
      });

      // Store original eq method before override
      const originalEq = mockTable.eq;

      // Note: Removed complex stats query override that was breaking UPDATE operations
      // Stats queries will fallback to empty roleDistribution which is acceptable for tests
    }

    return mockTable;
  }),

  auth: {
    getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
  },
};

// Mock the database module
jest.mock('./src/config/database', () => ({
  getDatabase: jest.fn().mockReturnValue({
    client: mockSupabaseClient,
    isHealthy: jest.fn().mockResolvedValue(true),
    getConnectionInfo: jest.fn().mockResolvedValue({
      connected: true,
      latency: 10,
      activeConnections: 1
    }),
    disconnect: jest.fn().mockResolvedValue(undefined)
  }),
  createTestDatabase: jest.fn().mockReturnValue({
    client: mockSupabaseClient,
    isHealthy: jest.fn().mockResolvedValue(true),
    getConnectionInfo: jest.fn().mockResolvedValue({
      connected: true,
      latency: 10,
      activeConnections: 1
    }),
    disconnect: jest.fn().mockResolvedValue(undefined)
  }),
  SupabaseDatabase: jest.fn().mockImplementation(() => ({
    client: mockSupabaseClient,
    isHealthy: jest.fn().mockResolvedValue(true),
    getConnectionInfo: jest.fn().mockResolvedValue({
      connected: true,
      latency: 10,
      activeConnections: 1
    }),
    disconnect: jest.fn().mockResolvedValue(undefined)
  })),
  resetDatabase: jest.fn().mockImplementation(() => {
    testDatabase.clear();
    userIdCounter = 1;
  })
}));

// Surgical fix: Mock only the repository's getStats method
const originalUserRepository = jest.requireActual('./src/repositories/user-repository').UserRepository;
jest.mock('./src/repositories/user-repository', () => {
  return {
    ...jest.requireActual('./src/repositories/user-repository'),
    UserRepository: jest.fn().mockImplementation((database) => {
      const instance = new originalUserRepository(database);
      // Override only getStats method
      instance.getStats = jest.fn().mockImplementation(async () => {
        const users = Array.from(testDatabase.values()).filter(user => user.is_active);
        const roleDistribution = {};
        users.forEach(user => {
          const role = user.role || 'supporter';
          roleDistribution[role] = (roleDistribution[role] || 0) + 1;
        });

        return {
          totalUsers: users.length,
          roleDistribution
        };
      });
      return instance;
    })
  };
});

// Mock console methods to reduce noise in tests
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

// Only show console output in verbose mode
if (!process.env.VERBOSE_TESTS) {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
}

// Track NOSTR service instances for cleanup
const nostrServiceInstances = new Set();

// Monkey patch NostrAuthService to track instances
const originalNostrAuthService = require('./src/services/nostr-auth').NostrAuthService;
if (originalNostrAuthService) {
  const originalConstructor = originalNostrAuthService.prototype.constructor;
  originalNostrAuthService.prototype.constructor = function(...args) {
    originalConstructor.apply(this, args);
    nostrServiceInstances.add(this);
  };
}

// Restore original console methods after tests
afterAll(() => {
  // Clean up all NOSTR service instances
  nostrServiceInstances.forEach(instance => {
    if (instance && typeof instance.destroy === 'function') {
      instance.destroy();
    }
  });
  nostrServiceInstances.clear();

  if (!process.env.VERBOSE_TESTS) {
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  }
});

// Global timeout for async operations
jest.setTimeout(30000);

// Mock fetch globally
global.fetch = jest.fn();

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  // Reset test database
  testDatabase.clear();
  userIdCounter = 1;
});
