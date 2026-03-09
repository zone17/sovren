import type { Locator, Page } from '@playwright/test';

export class ProfileDashboardPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly noProfileHeading: Locator;
  readonly startOnboardingButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /your sovereign profile/i }).first();
    this.noProfileHeading = page.getByRole('heading', { name: /no profile found/i }).first();
    this.startOnboardingButton = page.getByRole('button', { name: /start onboarding/i }).first();
  }

  async goto() {
    await this.page.goto('/profile-dashboard');
  }
}
