/**
 * Centralized E2E test credentials.
 * All auth-related tests import from here — no hardcoded credentials in spec files.
 * Override via environment variables for different environments (staging, CI).
 */

export const CREATOR_CREDENTIALS = {
  email: process.env.E2E_CREATOR_EMAIL || 'e2e-creator@sovren.app',
  password: process.env.E2E_CREATOR_PASSWORD || 'testpassword123',
};

export const TEST_USER = {
  email: process.env.E2E_TEST_EMAIL || 'test@sovren.app',
  password: process.env.E2E_TEST_PASSWORD || 'password123',
};

export const SIGNUP_USER = {
  name: 'Test Creator',
  email: 'newuser@sovren.app',
  password: 'password123',
};
