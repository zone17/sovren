import type { Locator, Page } from '@playwright/test';

export class ProfileDashboardPage {
  readonly page: Page;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /your sovereign profile/i }).first();
  }

  async goto() {
    await this.page.goto('/profile-dashboard');
  }
}
