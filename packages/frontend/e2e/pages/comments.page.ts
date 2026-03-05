/**
 * Comments Page Object Model — T18/T19
 * Slice 6: Comments CRUD with Threading and Moderation
 *
 * Covers the CommentList + CommentItem + CommentForm UI.
 * Page is embedded in content pages — use goto() to navigate to a content page.
 */

import type { Locator, Page } from '@playwright/test';

export class CommentsPage {
  readonly page: Page;

  // Section landmarks
  readonly commentsSection: Locator;
  readonly commentsHeading: Locator;

  // Form locators
  readonly commentTextarea: Locator;
  readonly postCommentButton: Locator;
  readonly charCounter: Locator;
  readonly signInLink: Locator;

  // List
  readonly commentList: Locator;

  // Empty / loading / error states
  readonly loadingSpinner: Locator;
  readonly errorAlert: Locator;
  readonly emptyState: Locator;

  // Load more pagination
  readonly loadMoreButton: Locator;

  // Delete dialog
  readonly deleteDialog: Locator;
  readonly confirmDeleteButton: Locator;
  readonly cancelDeleteButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.commentsSection = page.getByRole('region', { name: /comments/i }).first();
    this.commentsHeading = page.getByRole('heading', { name: /comments/i }).first();

    this.commentTextarea = page.getByRole('textbox', { name: /add a comment/i }).first();
    this.postCommentButton = page.getByRole('button', { name: /post comment/i }).first();
    this.charCounter = page.locator('#comment-char-counter').first();
    this.signInLink = page.getByRole('link', { name: /sign in to comment/i }).first();

    this.commentList = page.getByRole('list', { name: /comments/i }).first();

    this.loadingSpinner = page.getByRole('status', { name: /loading comments/i }).first();
    this.errorAlert = page.getByRole('alert').first();
    this.emptyState = page.getByText(/no comments yet/i).first();

    this.loadMoreButton = page.getByRole('button', { name: /load more comments/i }).first();

    this.deleteDialog = page.getByRole('dialog').first();
    this.confirmDeleteButton = page.getByRole('button', { name: /confirm delete/i }).first();
    this.cancelDeleteButton = this.deleteDialog.getByRole('button', { name: /cancel/i }).first();
  }

  /**
   * Navigate to a content page that embeds the comments section.
   * Pass a real contentId from the test environment.
   */
  async goto(contentId: string) {
    await this.page.goto(`/content/${contentId}`);
    await this.commentsSection.waitFor({ state: 'visible' });
  }

  /**
   * Type a comment and submit it.
   */
  async postComment(text: string) {
    await this.commentTextarea.fill(text);
    await this.postCommentButton.click();
    // Wait for the form to clear (indicates success)
    await this.commentTextarea.waitFor({ state: 'visible' });
    // Textarea should be empty after successful post
    await this.page.waitForFunction(
      (sel: string) => (document.querySelector(sel) as HTMLTextAreaElement)?.value === '',
      '#comment-input'
    );
  }

  /**
   * Get all visible comment articles.
   */
  async getCommentItems(): Promise<Locator[]> {
    const items = this.commentList.locator('li > article');
    const count = await items.count();
    return Array.from({ length: count }, (_, i) => items.nth(i));
  }

  /**
   * Click the Reply button for a specific comment (by visible author name).
   */
  async clickReply(authorName: string) {
    await this.page
      .getByRole('button', { name: new RegExp(`reply to ${authorName}`, 'i') })
      .first()
      .click();
  }

  /**
   * Post a reply in the inline reply form for a given parent author.
   */
  async postReply(parentAuthorName: string, replyText: string) {
    await this.clickReply(parentAuthorName);
    const replyTextarea = this.page
      .getByRole('textbox', { name: new RegExp(`reply to ${parentAuthorName}`, 'i') })
      .first();
    await replyTextarea.fill(replyText);
    await this.page
      .getByRole('button', { name: new RegExp(`post reply`, 'i') })
      .first()
      .click();
  }

  /**
   * Click delete on a comment by author name, then confirm in dialog.
   */
  async deleteCommentByAuthor(authorName: string) {
    await this.page
      .getByRole('button', { name: new RegExp(`delete comment by ${authorName}`, 'i') })
      .first()
      .click();
    await this.deleteDialog.waitFor({ state: 'visible' });
    await this.confirmDeleteButton.click();
    await this.deleteDialog.waitFor({ state: 'hidden' });
  }

  /**
   * Show replies for a specific comment (by reply count text).
   */
  async showRepliesFor(replyCount: number) {
    await this.page
      .getByRole('button', { name: new RegExp(`show ${replyCount} repl`, 'i') })
      .first()
      .click();
  }

  /**
   * Get the total count shown in the comments heading badge.
   */
  async getTotalCount(): Promise<number> {
    const headingText = await this.commentsHeading.textContent();
    const match = headingText?.match(/\((\d+)\)/);
    return match ? parseInt(match[1], 10) : 0;
  }
}
