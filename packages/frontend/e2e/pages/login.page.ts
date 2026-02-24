import type { Locator, Page } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly emailTab: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly signupLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Sign in to Sovren' });
    this.emailTab = page.getByRole('button', { name: /Email/ });
    this.emailInput = page.getByLabel('Email address');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: /Sign In with Email/ });
    this.signupLink = page.getByRole('link', { name: 'Create account' });
  }

  async goto() {
    await this.page.goto('/login');
  }

  async loginWithEmail(email: string, password: string) {
    await this.emailTab.click();
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
