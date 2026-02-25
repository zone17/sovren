import type { Locator, Page } from '@playwright/test';

export class ProfilePage {
  readonly page: Page;
  readonly userName: Locator;
  readonly logoutButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.userName = page.getByRole('heading', { level: 1 });
    this.logoutButton = page.getByRole('button', { name: 'Logout' }).first();
  }

  async goto() {
    await this.page.goto('/profile');
  }

  async logout() {
    await this.logoutButton.click();
  }
}
