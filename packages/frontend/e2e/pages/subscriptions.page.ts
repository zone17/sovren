import type { Locator, Page } from '@playwright/test';

export class SubscriptionsPage {
  readonly page: Page;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /subscription management/i }).first();
  }

  async goto() {
    await this.page.goto('/dashboard/subscriptions');
  }
}
