import type { Locator, Page } from '@playwright/test';

export class PostPage {
  readonly page: Page;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1 }).first();
  }

  async goto(id: string) {
    await this.page.goto(`/post/${id}`);
  }
}
