import type { Locator, Page } from '@playwright/test';

export class ProfilePage {
  readonly page: Page;
  readonly userName: Locator;
  readonly logoutButton: Locator;
  readonly authHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.userName = page.locator('h1').first();
    this.logoutButton = page.getByRole('button', { name: 'Logout' }).first();
    this.authHeading = page.getByRole('heading', { name: 'Authentication' });
  }

  async goto() {
    await this.page.goto('/profile');
  }

  async logout() {
    await this.logoutButton.click();
  }
}
