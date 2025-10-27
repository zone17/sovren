/**
 * 🧪 **ELITE JEST CONFIGURATION - STANDARDIZED TESTING FRAMEWORK**
 *
 * @description Comprehensive Jest configuration implementing elite testing standards
 * @version 2.0.0 - Production-Ready Test Infrastructure
 * @author Elite Engineering Team
 * @lastModified 2024-12-28
 *
 * **FEATURES:**
 * - 95%+ coverage thresholds for critical code
 * - Differentiated coverage by module type
 * - Comprehensive environment setup
 * - Advanced mocking capabilities
 * - Security testing integration
 * - Performance benchmarking
 * - Accessibility testing
 * - TDD/BDD support
 *
 * **COMPLIANCE:**
 * - Follows Google/Netflix/Stripe elite standards
 * - Implements Test-Driven Development (TDD)
 * - Supports Behavior-Driven Development (BDD)
 * - Zero-tolerance for test failures
 * - Comprehensive error handling
 */

import type { Config } from 'jest';

const config: Config = {
  // Core Jest configuration
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  verbose: true,
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: [
    'packages/*/src/**/*.{ts,tsx}',
    '!packages/*/src/**/*.d.ts',
    '!packages/*/src/**/*.test.{ts,tsx}',
    '!packages/*/src/**/*.spec.{ts,tsx}',
    '!packages/*/src/**/__tests__/**',
    '!packages/*/src/**/__mocks__/**',
    '!packages/*/src/stories/**',
  ],

  // **ELITE COVERAGE THRESHOLDS**
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    // Critical business logic - 95% coverage
    'packages/backend/src/services/**/*.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    'packages/backend/src/repositories/**/*.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    'packages/frontend/src/store/**/*.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },

  // **SETUP FILES** - Critical for proper test environment
  setupFilesAfterEnv: [
    '<rootDir>/test-utils/elite-env-setup.ts',
    '<rootDir>/test-utils/elite-frontend-setup.ts',
    '<rootDir>/test-utils/elite-backend-setup.ts',
    '<rootDir>/test-utils/elite-custom-matchers.ts',
    '@testing-library/jest-dom',
  ],

  // **MODULE RESOLUTION**
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/packages/frontend/src/$1',
    '^@backend/(.*)$': '<rootDir>/packages/backend/src/$1',
    '^@shared/(.*)$': '<rootDir>/packages/shared/src/$1',
    '^@testing/(.*)$': '<rootDir>/packages/testing/src/$1',
    '^@test-utils/(.*)$': '<rootDir>/test-utils/$1',
  },

  // **TEST TIMEOUT** - Increase for integration tests
  testTimeout: 30000,

  // **TRANSFORM CONFIGURATION**
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          jsx: 'react-jsx',
        },
      },
    ],
  },

  // **FILE PATTERNS**
  testMatch: [
    '<rootDir>/packages/*/src/**/__tests__/**/*.(test|spec).{ts,tsx}',
    '<rootDir>/packages/*/src/**/*.(test|spec).{ts,tsx}',
  ],

  // **REPORTERS**
  reporters: [
    'default',
    [
      'jest-html-reporter',
      {
        pageTitle: 'Sovren Elite Test Report',
        outputPath: 'test-results/elite-test-report.html',
        includeFailureMsg: true,
        includeSuiteFailure: true,
      },
    ],
    [
      'jest-junit',
      {
        outputDirectory: 'test-results',
        outputName: 'elite-junit.xml',
      },
    ],
  ],

  // **PROJECTS** - Multi-project configuration for specialized testing
  projects: [
    // Frontend React Testing
    {
      displayName: '🎨 Frontend',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/packages/frontend/src/**/*.(test|spec).{ts,tsx}'],
      setupFilesAfterEnv: [
        '<rootDir>/test-utils/elite-env-setup.ts',
        '<rootDir>/test-utils/elite-frontend-setup.ts',
        '<rootDir>/test-utils/elite-custom-matchers.ts',
        '@testing-library/jest-dom',
      ],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/packages/frontend/src/$1',
        '^@shared/(.*)$': '<rootDir>/packages/shared/src/$1',
        '^@test-utils/(.*)$': '<rootDir>/test-utils/$1',
      },
    },

    // Backend Node.js Testing
    {
      displayName: '🔧 Backend',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/packages/backend/src/**/*.(test|spec).{ts,tsx}'],
      setupFilesAfterEnv: [
        '<rootDir>/test-utils/elite-backend-setup.ts',
        '<rootDir>/test-utils/elite-custom-matchers.ts',
      ],
      moduleNameMapper: {
        '^@backend/(.*)$': '<rootDir>/packages/backend/src/$1',
        '^@shared/(.*)$': '<rootDir>/packages/shared/src/$1',
        '^@test-utils/(.*)$': '<rootDir>/test-utils/$1',
      },
      transform: {
        '^.+\\.ts$': [
          'ts-jest',
          {
            tsconfig: '<rootDir>/packages/backend/tsconfig.test.json',
          },
        ],
      },
    },

    // Shared Package Testing
    {
      displayName: '🔗 Shared',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/packages/shared/src/**/*.(test|spec).{ts,tsx}'],
      setupFilesAfterEnv: ['<rootDir>/test-utils/elite-custom-matchers.ts'],
      moduleNameMapper: {
        '^@shared/(.*)$': '<rootDir>/packages/shared/src/$1',
        '^@test-utils/(.*)$': '<rootDir>/test-utils/$1',
      },
    },
  ],

  // **IGNORE PATTERNS**
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/', '/coverage/'],

  // **PERFORMANCE OPTIMIZATION**
  maxWorkers: '50%',
  cache: true,
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',
};

export default config;
