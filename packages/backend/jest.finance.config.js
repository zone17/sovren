/**
 * Jest configuration for EPIC-011 finance service unit tests.
 *
 * Uses a minimal setup file (jest.setup.finance.js) that does NOT eagerly
 * require nostr-auth or user-repository, avoiding the ESM import error from
 * nostr-tools that breaks the global jest.setup.js in CJS mode.
 */

/* eslint-disable no-undef */
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/services/finance/__tests__'],
  testMatch: ['**/__tests__/**/*.test.ts'],
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
  // Use the minimal finance setup — avoids the nostr-auth ESM crash
  setupFilesAfterFramework: [],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.finance.js'],
  testTimeout: 30000,
  forceExit: true,
  verbose: true,
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: ['node_modules/(?!(.*\\.mjs$))'],
  globals: {
    'ts-jest': {
      isolatedModules: true,
      tsconfig: 'tsconfig.test.json',
    },
  },
};
