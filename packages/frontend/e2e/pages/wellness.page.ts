import type { Locator, Page } from '@playwright/test';

export class WellnessPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly subheading: Locator;
  readonly pulseCheckInButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Creator Wellness' });
    this.subheading = page.getByText('Monitor your work patterns');
    this.pulseCheckInButton = page.getByRole('button', { name: 'Pulse Check-In' });
  }

  async goto() {
    await this.page.goto('/wellness');
  }
}
