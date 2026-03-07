import type { Locator, Page } from '@playwright/test';

export class NotificationsPage {
  readonly page: Page;
  readonly bellButton: Locator;
  readonly panel: Locator;
  readonly closeButton: Locator;
  readonly emptyState: Locator;
  readonly filterAll: Locator;
  readonly filterMentions: Locator;
  readonly filterReplies: Locator;
  readonly filterReactions: Locator;
  readonly filterMessages: Locator;
  readonly filterZaps: Locator;

  constructor(page: Page) {
    this.page = page;
    this.bellButton = page.getByRole('button', { name: /notifications/i }).first();
    this.panel = page.getByRole('dialog', { name: /notification center/i });
    this.closeButton = this.panel.getByRole('button', { name: /close/i });
    this.emptyState = this.panel.getByText(/no notifications yet/i);
    this.filterAll = this.panel.getByRole('button', { name: /^all$/i });
    this.filterMentions = this.panel.getByRole('button', { name: /mentions/i });
    this.filterReplies = this.panel.getByRole('button', { name: /replies/i });
    this.filterReactions = this.panel.getByRole('button', { name: /reactions/i });
    this.filterMessages = this.panel.getByRole('button', { name: /messages/i });
    this.filterZaps = this.panel.getByRole('button', { name: /zaps/i });
  }

  async goto() {
    await this.page.goto('/dashboard');
  }

  async openPanel() {
    await this.bellButton.click();
    await this.panel.waitFor({ state: 'visible' });
  }

  async closePanel() {
    await this.closeButton.click();
  }
}
