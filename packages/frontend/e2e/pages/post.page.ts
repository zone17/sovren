import type { Locator, Page } from '@playwright/test';

export class PostPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly supportCreatorButton: Locator;
  readonly commentsHeading: Locator;
  readonly postNotFound: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1 }).first();
    this.supportCreatorButton = page.getByRole('button', { name: /support creator/i });
    this.commentsHeading = page.getByRole('heading', { name: /comments/i });
    this.postNotFound = page.getByRole('heading', { name: /post not found/i });
  }

  async goto(id: string) {
    await this.page.goto(`/post/${id}`);
  }
}
