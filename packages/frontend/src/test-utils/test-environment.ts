import { vi } from 'vitest';

/**
 * 🧪 **ELITE TEST ENVIRONMENT CONFIGURATION**
 *
 * **Purpose**: Comprehensive test environment setup following TDD/BDD best practices
 * **Architecture**: Centralized configuration with intelligent mocking strategies
 * **Security**: Safe test environment with isolated credentials
 * **Performance**: Optimized for sub-2 second test execution
 *
 * **Engineering Standards**:
 * - Test-Driven Development (TDD): Environment setup before implementation
 * - Behavior-Driven Development (BDD): User-centric test scenarios
 * - Security by Design: Isolated test credentials and environment
 * - Scalability: Configurable for different test scenarios
 *
 * @author Elite Engineering Team
 * @version 1.0.0
 * @lastModified 2024-12-28
 */

// Test interfaces use snake_case to match Supabase/database row shapes.
// Canonical app-layer types are in packages/shared/src/types/ (camelCase).
// See: BaseUser (user.ts), Post, Payment (index.ts).
export interface TestUser {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  email: string;
  nostr_pubkey: string;
  created_at: string;
  updated_at: string;
  role?: string;
}

export interface TestContent {
  id: string;
  title: string;
  content: string;
  status: string;
  author_id: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
}

export interface TestPayment {
  id: string;
  amount: number;
  status: string;
  invoice: string;
  user_id: string;
  created_at: string;
}

interface TestAIAnalysis {
  quality_score: number;
  readability_score: number;
  seo_score: number;
  engagement_prediction: number;
  confidence_score: number;
  suggestions: string[];
}

interface TestAIContent {
  content: string;
  model: string;
  confidence_score: number;
  generation_time: number;
}

interface TestAction {
  action: string;
  payload: Record<string, unknown>;
}

interface TestResult {
  id?: string;
  status?: string;
  quality_score?: number;
  [key: string]: unknown;
}

// 🔧 Test Environment Variables Configuration
export const TEST_ENVIRONMENT = {
  // 🗄️ Database Configuration (Mocked)
  // Use obviously-fake values that won't trigger secret scanners (GitHub, Snyk, GitGuardian).
  // Avoid JWT-like prefixes (eyJ...) and known API key prefixes (sk-).
  SUPABASE_URL: 'https://test-project.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key-not-real-000000000000000000000000',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-not-real-000000000000',

  // 🎯 Feature Flags (Test Configuration)
  ENABLE_CMS: 'true',
  ENABLE_AI_ASSISTANT: 'true',
  ENABLE_COLLABORATION: 'true',
  ENABLE_DECENTRALIZED_STORAGE: 'true',
  ENABLE_NOSTR_INTEGRATION: 'true',
  ENABLE_LIGHTNING_PAYMENTS: 'true',

  // 🤖 AI Services (Mocked)
  OPENAI_API_KEY: 'test-openai-key-not-real-00000000000000000000',
  ANTHROPIC_API_KEY: 'test-anthropic-key-not-real-00000000000000',

  // 🌐 IPFS/Arweave Configuration (Mocked)
  IPFS_GATEWAY: 'https://test-ipfs-gateway.com',
  ARWEAVE_HOST: 'test-arweave.net',

  // 🔒 Security Configuration (Test-safe)
  JWT_SECRET: 'test-jwt-secret-not-real-00000000000000000000',

  // ⚡ Lightning Network (Mocked)
  LNBITS_URL: 'https://test-lnbits.com',
  LNBITS_API_KEY: 'test-lnbits-key-not-real-00000000000000',

  // 🔄 Environment Meta
  NODE_ENV: 'test',
  MODE: 'test',
  DEV: 'false',
  PROD: 'false',
  TEST: 'true',
} as const;

/**
 * 🔧 **Environment Setup Function**
 *
 * Sets up comprehensive test environment with all required variables
 *
 * **Why this approach?**
 * - Centralized configuration management
 * - Type-safe environment setup
 * - Consistent across all test files
 * - Easy to modify for different test scenarios
 */
export function setupTestEnvironment(): void {
  // Set process.env variables for Node.js compatibility
  Object.entries(TEST_ENVIRONMENT).forEach(([key, value]) => {
    process.env[key] = String(value);
    process.env[`VITE_${key}`] = String(value); // Vite-prefixed for frontend
  });

  // Additional Node.js specific environment setup
  process.env.NODE_ENV = 'test';

  // Mock import.meta.env for Vite compatibility
  if (typeof globalThis !== 'undefined') {
    Object.defineProperty(globalThis, 'import', {
      value: {
        meta: {
          env: {
            ...TEST_ENVIRONMENT,
            // Vite-specific environment variables
            VITE_SUPABASE_URL: TEST_ENVIRONMENT.SUPABASE_URL,
            VITE_SUPABASE_ANON_KEY: TEST_ENVIRONMENT.SUPABASE_ANON_KEY,
            VITE_ENABLE_CMS: TEST_ENVIRONMENT.ENABLE_CMS,
            VITE_ENABLE_AI_ASSISTANT: TEST_ENVIRONMENT.ENABLE_AI_ASSISTANT,
            VITE_ENABLE_NOSTR_INTEGRATION: TEST_ENVIRONMENT.ENABLE_NOSTR_INTEGRATION,
            VITE_ENABLE_LIGHTNING_PAYMENTS: TEST_ENVIRONMENT.ENABLE_LIGHTNING_PAYMENTS,
          },
        },
      },
      writable: true,
      configurable: true,
    });
  }
}

/**
 * 🧪 **Test Data Factory**
 *
 * Provides consistent test data for different scenarios
 *
 * **BDD Approach**: Given-When-Then test data
 */
export const TEST_DATA = {
  // 👤 User Test Data
  users: {
    validUser: {
      id: 'test-user-id-1',
      username: 'testuser',
      display_name: 'Test User',
      bio: 'A test user for BDD scenarios',
      avatar_url: 'https://test.example.com/avatar.jpg',
      email: 'test@example.com',
      nostr_pubkey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    } as TestUser,
    adminUser: {
      id: 'test-admin-id-1',
      username: 'testadmin',
      display_name: 'Test Admin',
      bio: 'Admin user for testing',
      avatar_url: 'https://test.example.com/admin-avatar.jpg',
      email: 'admin@example.com',
      nostr_pubkey: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      role: 'admin',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    } as TestUser,
  },

  // 📝 Content Test Data
  content: {
    draftPost: {
      id: 'test-post-id-1',
      title: 'Test Post Title',
      content: 'Test post content for BDD scenarios',
      status: 'draft',
      author_id: 'test-user-id-1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    } as TestContent,
    publishedPost: {
      id: 'test-post-id-2',
      title: 'Published Test Post',
      content: 'Published post content',
      status: 'published',
      author_id: 'test-user-id-1',
      published_at: '2024-01-01T00:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    } as TestContent,
  },

  // 💰 Payment Test Data
  payments: {
    successfulPayment: {
      id: 'test-payment-id-1',
      amount: 1000, // sats
      status: 'completed',
      invoice: 'lnbc10u1p3xnhl2pp5...',
      user_id: 'test-user-id-1',
      created_at: '2024-01-01T00:00:00Z',
    } as TestPayment,
    pendingPayment: {
      id: 'test-payment-id-2',
      amount: 500,
      status: 'pending',
      invoice: 'lnbc5u1p3xnhl2pp5...',
      user_id: 'test-user-id-1',
      created_at: '2024-01-01T00:00:00Z',
    } as TestPayment,
  },

  // 🤖 AI Test Data
  ai: {
    contentAnalysis: {
      quality_score: 85,
      readability_score: 78,
      seo_score: 92,
      engagement_prediction: 87,
      confidence_score: 94,
      suggestions: [
        'Consider adding more specific examples',
        'The conclusion could be strengthened',
      ],
    } as TestAIAnalysis,
    generatedContent: {
      content: 'This is AI-generated test content',
      model: 'gpt-4',
      confidence_score: 89,
      generation_time: 1234,
    } as TestAIContent,
  },
} as const;

/**
 * 🔄 **Reset Test Environment**
 *
 * Cleans up test environment between tests
 */
export function resetTestEnvironment(): void {
  // Clear any test-specific overrides
  vi.clearAllMocks();

  // Reset environment to defaults
  setupTestEnvironment();
}

/**
 * 🎭 **BDD Test Helpers**
 *
 * Helper functions for Behavior-Driven Development testing
 */
export const BDD = {
  /**
   * GIVEN: Setup test preconditions
   */
  given: {
    userIsLoggedIn: (): TestUser => TEST_DATA.users.validUser,
    userIsAdmin: (): TestUser => TEST_DATA.users.adminUser,
    contentExists: (): TestContent => TEST_DATA.content.publishedPost,
    paymentIsSuccessful: (): TestPayment => TEST_DATA.payments.successfulPayment,
  },

  /**
   * WHEN: Test actions/events
   */
  when: {
    userCreatesContent: (title: string, content: string): TestAction => ({
      action: 'create_content',
      payload: { title, content },
    }),
    userMakesPayment: (amount: number): TestAction => ({
      action: 'make_payment',
      payload: { amount },
    }),
    aiAnalyzesContent: (content: string): TestAction => ({
      action: 'analyze_content',
      payload: { content },
    }),
  },

  /**
   * THEN: Test assertions/expectations
   */
  then: {
    contentShouldBeCreated: (result: TestResult): void => {
      expect(result).toBeDefined();
      expect(result.id).toBeTruthy();
      expect(result.status).toBe('draft');
    },
    paymentShouldBeProcessed: (result: TestResult): void => {
      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
    },
    aiShouldProvideAnalysis: (result: TestResult): void => {
      expect(result).toBeDefined();
      expect(result.quality_score).toBeGreaterThan(0);
      expect(result.quality_score).toBeLessThanOrEqual(100);
    },
  },
};

/**
 * 🔒 **Security Test Helpers**
 *
 * Helpers for testing security scenarios
 */
export const SECURITY = {
  // Invalid/malicious inputs for security testing
  invalidInputs: {
    sqlInjection: "'; DROP TABLE users; --",
    xssScript: '<script>alert("xss")</script>',
    oversizedString: 'a'.repeat(10000),
    nullBytes: '\x00\x00\x00',
    unicodeExploits: '\u202e\u202d',
  },

  // Test authentication states — use obviously-fake values without JWT-like prefixes
  authStates: {
    unauthenticated: null,
    validToken: 'test-valid-token-not-real-000000000000000000',
    expiredToken: 'test-expired-token-not-real-000000000000000',
    malformedToken: 'invalid-token-format',
  },
};

// 🚀 Initialize test environment immediately
setupTestEnvironment();
