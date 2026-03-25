import type { Locator, Page } from '@playwright/test';

export class MonitoringPage {
  readonly page: Page;
  readonly toggleButton: Locator;
  readonly panelHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.toggleButton = page.getByRole('button', { name: /performance/i }).first();
    this.panelHeading = page.getByRole('heading', { name: /performance/i }).first();
  }

  async goto() {
    await this.page.goto('/monitoring');
  }
}
