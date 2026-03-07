import type { Locator, Page } from '@playwright/test';

export class LightningOnboardingPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly getStartedButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /welcome to lightning network/i }).first();
    this.getStartedButton = page.getByRole('button', { name: /get started with lightning/i });
  }

  async goto() {
    await this.page.goto('/onboarding/lightning');
    await this.heading.waitFor({ state: 'visible' });
  }
}
