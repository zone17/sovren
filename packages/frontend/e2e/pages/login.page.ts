import type { Locator, Page } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly extensionButton: Locator;
  readonly signupLink: Locator;
  readonly noExtensionMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Sign in to Sovren' }).first();
    this.extensionButton = page.getByRole('button', { name: /Sign in with NOSTR extension/ });
    this.signupLink = page.getByRole('link', { name: 'Create account' });
    this.noExtensionMessage = page.getByText('No NOSTR extension detected');
  }

  async goto() {
    await this.page.goto('/login');
  }
}
