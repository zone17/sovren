import type { Locator, Page } from '@playwright/test';

export class LightningOnboardingPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly getStartedButton: Locator;
  readonly walletOfSatoshi: Locator;
  readonly strike: Locator;
  readonly phoenix: Locator;
  readonly alby: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /welcome to lightning network/i }).first();
    this.getStartedButton = page.getByRole('button', { name: /get started with lightning/i });
    this.walletOfSatoshi = page.getByText(/wallet of satoshi/i).first();
    this.strike = page.getByText(/strike/i).first();
    this.phoenix = page.getByText(/phoenix/i).first();
    this.alby = page.getByText(/alby/i).first();
  }

  async goto() {
    await this.page.goto('/onboarding/lightning');
    await this.heading.waitFor({ state: 'visible' });
  }
}
