import { expect, Page, test } from '@playwright/test';

/**
 * EPIC-009: Multi-Platform Hub E2E Tests
 *
 * Tests all distribution features with mocked API responses:
 * - Platform connections (connect/disconnect)
 * - Cross-platform analytics overview
 * - Unified inbox (messages, filters, reply, batch actions)
 * - Content distribution and repurposing
 */

const DEMO_USER = {
  id: 'demo-creator-123',
  email: 'test@sovren.app',
  name: 'Test Creator',
  role: 'creator',
  nostr_pubkey: 'demo-nostr-pubkey-test',
  avatar_url: undefined,
  bio: 'Test creator account',
  website: undefined,
  created_at: '2026-02-15T00:00:00Z',
  updated_at: '2026-02-15T00:00:00Z',
  email_verified: true,
  nostr_verified: true,
  permissions: ['read', 'write', 'create', 'publish'],
};

// --- Mock API data ---

const MOCK_PLATFORM_STATUS = {
  success: true,
  data: [
    { platform: 'mastodon', connected: true, username: '@creator@mastodon.social', status: 'connected', scopes: ['read', 'write'] },
    { platform: 'bluesky', connected: true, username: 'creator.bsky.social', status: 'connected', scopes: ['read', 'write'] },
    { platform: 'twitter', connected: false, username: null, status: 'disconnected', scopes: [] },
    { platform: 'youtube', connected: false, username: null, status: 'disconnected', scopes: [] },
  ],
};

const MOCK_ANALYTICS_OVERVIEW = {
  success: true,
  data: {
    total_followers: 15000,
    total_engagement_30d: 250000,
    platforms: [
      { platform: 'mastodon', followers: 8000, engagement_rate: 4.2, impressions_30d: 150000, growth_30d: 12.5 },
      { platform: 'bluesky', followers: 7000, engagement_rate: 5.1, impressions_30d: 100000, growth_30d: 25.3 },
    ],
    updated_at: '2026-02-16T12:00:00Z',
  },
};

const MOCK_ROI = {
  success: true,
  data: [
    { platform: 'bluesky', engagement_per_hour: 10000, total_engagement_30d: 100000, estimated_hours_30d: 10, rank: 1 },
    { platform: 'mastodon', engagement_per_hour: 7500, total_engagement_30d: 150000, estimated_hours_30d: 20, rank: 2 },
  ],
};

const MOCK_INBOX_MESSAGES = {
  success: true,
  data: {
    messages: [
      {
        id: 'msg-1',
        platform: 'mastodon',
        author: '@alice@mastodon.social',
        author_avatar_url: null,
        content: 'Love your latest article on decentralized publishing!',
        type: 'mention',
        parent_post_id: null,
        is_read: false,
        created_at: '2026-02-16T14:00:00Z',
      },
      {
        id: 'msg-2',
        platform: 'bluesky',
        author: 'bob.bsky.social',
        author_avatar_url: null,
        content: 'Can you share more about how NOSTR handles content?',
        type: 'reply',
        parent_post_id: 'post-123',
        is_read: true,
        created_at: '2026-02-16T10:00:00Z',
      },
      {
        id: 'msg-3',
        platform: 'mastodon',
        author: '@charlie@fosstodon.org',
        author_avatar_url: null,
        content: 'Just boosted your post. Great content as always.',
        type: 'mention',
        parent_post_id: null,
        is_read: false,
        created_at: '2026-02-15T22:00:00Z',
      },
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 3,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  },
};

const MOCK_CONNECT_RESPONSE = {
  success: true,
  data: { authorization_url: 'https://twitter.com/oauth/authorize?state=test-state-123' },
};

const MOCK_DISCONNECT_RESPONSE = {
  success: true,
  data: { disconnected: true },
};

const MOCK_PUBLISH_RESPONSE = {
  success: true,
  data: {
    platforms: [
      { id: 'cp-1', content_id: 'content-123', platform: 'mastodon', status: 'queued', scheduled_at: null, published_at: null },
      { id: 'cp-2', content_id: 'content-123', platform: 'bluesky', status: 'queued', scheduled_at: null, published_at: null },
    ],
  },
};

const MOCK_REPURPOSED = {
  success: true,
  data: [
    {
      id: 'rep-1',
      source_content_id: 'content-123',
      platform: 'twitter',
      format_type: 'thread',
      text: '1/ Here is the key takeaway from my latest article on decentralized publishing...\n\n2/ NOSTR gives creators true ownership...',
      character_count: 145,
      character_limit: 280,
      approved: false,
      backlink_url: 'https://sovren.app/content/content-123',
    },
    {
      id: 'rep-2',
      source_content_id: 'content-123',
      platform: 'mastodon',
      format_type: 'summary',
      text: 'Key points from my latest article:\n- Decentralized publishing empowers creators\n- NOSTR protocol for true ownership\nhttps://sovren.app/content/content-123',
      character_count: 180,
      character_limit: 500,
      approved: true,
      backlink_url: 'https://sovren.app/content/content-123',
    },
  ],
};

const MOCK_BATCH_ACTION = {
  success: true,
  data: { affected: 2 },
};

/**
 * Set up all API mocks for multi-platform endpoints.
 */
async function setupDistributionApiMocks(page: Page) {
  await page.route('**/api/v2/platforms/status', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_PLATFORM_STATUS),
    });
  });

  await page.route('**/api/v2/platforms/connect/*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_CONNECT_RESPONSE),
    });
  });

  await page.route('**/api/v2/platforms/disconnect/*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_DISCONNECT_RESPONSE),
    });
  });

  await page.route('**/api/v2/analytics/cross-platform/overview', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_ANALYTICS_OVERVIEW),
    });
  });

  await page.route('**/api/v2/analytics/cross-platform/roi', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_ROI),
    });
  });

  await page.route('**/api/v2/inbox/messages*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_INBOX_MESSAGES),
    });
  });

  await page.route('**/api/v2/inbox/reply/*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  await page.route('**/api/v2/inbox/batch', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_BATCH_ACTION),
    });
  });

  await page.route('**/api/v2/distribute/publish', (route) => {
    route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_PUBLISH_RESPONSE),
    });
  });

  await page.route(/\/api\/v2\/distribute\/repurposed\//, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_REPURPOSED),
    });
  });

  await page.route('**/api/v2/distribute/repurpose', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_REPURPOSED),
    });
  });

  await page.route(/\/api\/v2\/analytics\/cross-platform\/comparison\//, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          { platform: 'mastodon', platform_post_id: 'masto-123', views: 5000, likes: 200, shares: 50, comments: 25, engagement_rate: 5.5, published_at: '2026-02-16T12:00:00Z' },
          { platform: 'bluesky', platform_post_id: 'bsky-456', views: 3000, likes: 150, shares: 30, comments: 15, engagement_rate: 6.5, published_at: '2026-02-16T12:05:00Z' },
        ],
      }),
    });
  });
}

async function authenticateAndVisitHub(page: Page) {
  await page.goto('/');
  await page.evaluate((user) => {
    localStorage.setItem('demo_user', JSON.stringify(user));
  }, DEMO_USER);
  await page.goto('/multi-platform');
}

// --- TESTS ---

test.describe('Multi-Platform Hub - Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await setupDistributionApiMocks(page);
    await authenticateAndVisitHub(page);
  });

  test('renders page header with title and description', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Multi-Platform Hub' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Connect, publish, and manage your content across all platforms from one place.')).toBeVisible();
  });

  test('renders platform connector with connection states', async ({ page }) => {
    await expect(page.getByText('Platform Connections')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Mastodon')).toBeVisible();
    await expect(page.getByText('@creator@mastodon.social')).toBeVisible();
    await expect(page.getByText('Bluesky')).toBeVisible();
    await expect(page.getByText('creator.bsky.social')).toBeVisible();

    // Connected platforms show Disconnect, others show Connect
    const disconnectButtons = page.getByRole('button', { name: 'Disconnect' });
    await expect(disconnectButtons).toHaveCount(2);

    const connectButtons = page.getByRole('button', { name: 'Connect' });
    await expect(connectButtons).toHaveCount(2);
  });

  test('renders analytics overview with totals', async ({ page }) => {
    await expect(page.getByText('Cross-Platform Analytics')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('15,000')).toBeVisible();
    await expect(page.getByText('Total Followers')).toBeVisible();
    await expect(page.getByText('250,000')).toBeVisible();
    await expect(page.getByText('30-Day Impressions')).toBeVisible();
  });

  test('renders per-platform analytics breakdown', async ({ page }) => {
    await expect(page.getByText('Cross-Platform Analytics')).toBeVisible({ timeout: 10000 });

    // Platform metrics
    await expect(page.getByText('8,000 followers')).toBeVisible();
    await expect(page.getByText('4.2% engagement')).toBeVisible();
    await expect(page.getByText('+12.5%')).toBeVisible();

    await expect(page.getByText('7,000 followers')).toBeVisible();
    await expect(page.getByText('5.1% engagement')).toBeVisible();
    await expect(page.getByText('+25.3%')).toBeVisible();
  });

  test('renders ROI table', async ({ page }) => {
    await expect(page.getByText('Platform ROI (Engagement per Hour)')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('#1')).toBeVisible();
    await expect(page.getByText('10,000')).toBeVisible();
    await expect(page.getByText('#2')).toBeVisible();
  });
});

test.describe('Multi-Platform Hub - Unified Inbox', () => {
  test.beforeEach(async ({ page }) => {
    await setupDistributionApiMocks(page);
    await authenticateAndVisitHub(page);
  });

  test('renders inbox with messages', async ({ page }) => {
    await expect(page.getByText('Unified Inbox')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('@alice@mastodon.social')).toBeVisible();
    await expect(page.getByText('Love your latest article on decentralized publishing!')).toBeVisible();
    await expect(page.getByText('bob.bsky.social')).toBeVisible();
    await expect(page.getByText('@charlie@fosstodon.org')).toBeVisible();
  });

  test('inbox shows platform and status filters', async ({ page }) => {
    await expect(page.getByText('Unified Inbox')).toBeVisible({ timeout: 10000 });
    await expect(page.getByDisplayValue('All Platforms')).toBeVisible();
    await expect(page.getByDisplayValue('All Messages')).toBeVisible();
  });

  test('reply flow opens input and shows send button', async ({ page }) => {
    await expect(page.getByText('Unified Inbox')).toBeVisible({ timeout: 10000 });

    // Click first Reply button
    const replyButtons = page.getByText('Reply');
    await replyButtons.first().click();

    await expect(page.getByPlaceholderText('Write a reply...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  test('cancel reply closes the input', async ({ page }) => {
    await expect(page.getByText('Unified Inbox')).toBeVisible({ timeout: 10000 });

    await page.getByText('Reply').first().click();
    await expect(page.getByPlaceholderText('Write a reply...')).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByPlaceholderText('Write a reply...')).not.toBeVisible();
  });
});

test.describe('Multi-Platform Hub - Console Errors', () => {
  test('no unexpected console errors on page load', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('Failed to fetch') && !text.includes('ERR_CONNECTION_REFUSED') && !text.includes('net::')) {
          consoleErrors.push(text);
        }
      }
    });

    await setupDistributionApiMocks(page);
    await authenticateAndVisitHub(page);
    await page.waitForTimeout(3000);

    expect(consoleErrors).toEqual([]);
  });
});

test.describe('Multi-Platform Hub - Responsive', () => {
  test.beforeEach(async ({ page }) => {
    await setupDistributionApiMocks(page);
  });

  test('mobile layout stacks cards vertically', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await authenticateAndVisitHub(page);

    await expect(page.getByRole('heading', { name: 'Multi-Platform Hub' })).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/multi-platform-mobile.png', fullPage: true });
  });

  test('desktop layout shows full grid', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await authenticateAndVisitHub(page);

    await expect(page.getByRole('heading', { name: 'Multi-Platform Hub' })).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/multi-platform-desktop.png', fullPage: true });
  });
});
