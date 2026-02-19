/**
 * Jest config for backend utility unit tests (case-transform, etc.).
 *
 * Uses no setup file — utility tests are pure functions with zero
 * dependency on nostr-tools or user-repository.
 */

/* eslint-disable no-undef */
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/utils/__tests__/**/*.test.ts'],
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
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@sovren/shared/(.*)$': '<rootDir>/../shared/src/$1',
  },
  testTimeout: 10000,
  forceExit: true,
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
};
