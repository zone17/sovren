import type { Locator, Page } from '@playwright/test';

export class LayoutPage {
  readonly page: Page;
  readonly sovrenLogo: Locator;
  readonly profileLink: Locator;
  readonly createLink: Locator;
  readonly dashboardLink: Locator;
  readonly wellnessLink: Locator;
  readonly shieldLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sovrenLogo = page.getByRole('link', { name: /Sovren/ });
    this.profileLink = page.getByRole('link', { name: 'Profile' });
    this.createLink = page.getByRole('link', { name: 'Create' });
    this.dashboardLink = page.getByRole('link', { name: 'Dashboard' });
    this.wellnessLink = page.getByRole('link', { name: 'Wellness' });
    this.shieldLink = page.getByRole('link', { name: 'Shield' });
  }

  async goto(path = '/profile') {
    await this.page.goto(path);
  }
}
