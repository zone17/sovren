export const CREATOR_CREDENTIALS = {
  email: process.env.E2E_CREATOR_EMAIL || 'e2e-creator@sovren.app',
  password: process.env.E2E_CREATOR_PASSWORD || 'testpassword123',
} as const;

export const TEST_USER = {
  email: process.env.E2E_TEST_EMAIL || 'test@sovren.app',
  password: process.env.E2E_TEST_PASSWORD || 'password123',
} as const;

export const SIGNUP_USER = {
  name: process.env.E2E_SIGNUP_NAME || 'Test Creator',
  email: process.env.E2E_SIGNUP_EMAIL || 'newuser@sovren.app',
  password: process.env.E2E_SIGNUP_PASSWORD || 'password123',
} as const;
