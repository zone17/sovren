/**
 * Jest config for EPIC-010 Community service tests.
 *
 * WHY A SEPARATE CONFIG:
 * The global jest.setup.js performs jest.requireActual('./src/repositories/user-repository')
 * which transitively imports nostr-tools ESM-only code and crashes the test runner.
 * Community services (CreatorCircle, Mentorship, CollaborativeContent, Marketplace) have
 * zero dependency on user-repository or nostr-tools, so they can run cleanly without
 * the global setup file.
 *
 * This config is identical to the root jest.config.js except:
 * - setupFilesAfterEnv is empty (no global jest.setup.js)
 * - testMatch is scoped to the community __tests__ directory only
 */

/* eslint-disable no-undef */
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/services/community/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: false,
        tsconfig: 'tsconfig.test.json',
        isolatedModules: true,
      },
    ],
  },
  collectCoverageFrom: [
    'src/services/community/**/*.ts',
    '!src/services/community/**/*.d.ts',
    '!src/services/community/__tests__/**',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@sovren/shared/(.*)$': '<rootDir>/../shared/src/$1',
  },
  // No setupFilesAfterEnv: avoids the nostr-tools ESM crash in jest.setup.js
  setupFilesAfterEnv: [],
  testTimeout: 30000,
  forceExit: true,
  detectOpenHandles: true,
  verbose: true,
  extensionsToTreatAsEsm: [],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: ['node_modules/(?!(.*\\.mjs$))'],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage-community',
  clearMocks: true,
  restoreMocks: true,
  globals: {
    'ts-jest': {
      isolatedModules: true,
      tsconfig: 'tsconfig.test.json',
    },
  },
};
