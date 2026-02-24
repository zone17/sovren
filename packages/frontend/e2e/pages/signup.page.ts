import type { Locator, Page } from '@playwright/test';

export class SignupPage {
  readonly page: Page;
  readonly emailTab: Locator;
  readonly creatorRoleButton: Locator;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly loginLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailTab = page.getByRole('button', { name: /Email/ });
    this.creatorRoleButton = page.getByRole('button', { name: /Creator/ });
    this.nameInput = page.getByLabel('Full Name');
    this.emailInput = page.getByLabel('Email address');
    this.passwordInput = page.getByLabel('Password', { exact: true });
    this.confirmPasswordInput = page.getByLabel('Confirm Password');
    this.submitButton = page.getByRole('button', { name: /Create Account/ });
    this.loginLink = page.getByRole('link', { name: 'Sign in' });
  }

  async goto() {
    await this.page.goto('/signup');
  }

  async signupWithEmail(name: string, email: string, password: string) {
    await this.emailTab.click();
    await this.creatorRoleButton.click();
    await this.nameInput.fill(name);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(password);
    await this.submitButton.click();
  }
}
