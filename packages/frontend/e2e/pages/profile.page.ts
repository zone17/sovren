import type { Locator, Page } from '@playwright/test';

export class ProfilePage {
  readonly page: Page;
  readonly userName: Locator;
  readonly logoutButton: Locator;
  readonly authSection: Locator;
  readonly nostrIdentityHeading: Locator;
  readonly pubkeyLabel: Locator;
  readonly featuresSection: Locator;
  readonly settingsSection: Locator;
  readonly loadingHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.userName = page.getByRole('heading', { level: 1 }).first();
    this.logoutButton = page.getByRole('button', { name: 'Logout' }).first();
    this.authSection = page.getByRole('heading', { name: 'Authentication' });
    this.nostrIdentityHeading = page.getByRole('heading', { name: 'NOSTR Identity' });
    this.pubkeyLabel = page.getByText('Public Key (npub)');
    this.featuresSection = page.getByRole('heading', { name: 'Features & Capabilities' });
    this.settingsSection = page.getByRole('heading', { name: 'Account Settings' });
    this.loadingHeading = page.getByRole('heading', { name: 'Loading Profile...' });
  }

  async goto() {
    await this.page.goto('/profile');
  }

  async logout() {
    await this.logoutButton.click();
  }
}
