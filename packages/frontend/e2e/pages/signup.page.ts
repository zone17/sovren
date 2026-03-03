import type { Locator, Page } from '@playwright/test';

export class SignupPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly loginLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Join Sovren' }).first();
    this.loginLink = page.getByRole('link', { name: 'Sign in' });
  }

  async goto() {
    await this.page.goto('/signup');
  }
}
