import type { Locator, Page } from '@playwright/test';

export class ShieldPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly alertsHeading: Locator;
  readonly fingerprintHeading: Locator;
  readonly errorBoundary: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /content shield/i }).first();
    this.alertsHeading = page.getByRole('heading', { name: /copy detection alerts/i }).first();
    this.fingerprintHeading = page.getByRole('heading', { name: /fingerprint coverage/i }).first();
    this.errorBoundary = page.getByText(/something went wrong/i).first();
  }

  async goto() {
    await this.page.goto('/shield');
  }
}
