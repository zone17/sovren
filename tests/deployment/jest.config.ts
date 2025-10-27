/**
 * Jest Configuration for Deployment Tests
 *
 * Specialized configuration for deployment pipeline integration tests
 */

import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  displayName: 'deployment-tests',
  testMatch: [
    '<rootDir>/**/*.test.ts',
    '<rootDir>/**/*.spec.ts'
  ],
  collectCoverageFrom: [
    '<rootDir>/**/*.ts',
    '!<rootDir>/**/*.test.ts',
    '!<rootDir>/**/*.spec.ts',
    '!<rootDir>/mocks/**',
  ],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  coverageDirectory: '<rootDir>/../../coverage/deployment',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        resolveJsonModule: true,
        isolatedModules: true,
      }
    }]
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testTimeout: 30000,
  verbose: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};

export default config;
