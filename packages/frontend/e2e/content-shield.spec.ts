import { expect, Page, test } from '@playwright/test';

/**
 * Phase 7 - EPIC-008: Content Shield Dashboard E2E Tests
 *
 * Tests all content shield features with mocked API responses:
 * - Fingerprint Coverage (donut chart + stats)
 * - Alerts Feed (status tabs, pagination, alert cards)
 * - Alert Detail panel (side-by-side comparison, status transitions, DMCA)
 * - Error states and empty states
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

const MOCK_FINGERPRINT_COVERAGE = {
  success: true,
  data: {
    total_fingerprinted: 142,
    total_content: 200,
    coverage_percentage: 71.0,
    fingerprints: [
      {
        content_id: 'content-1',
        content_title: 'My First Article',
        hash_type: 'simhash',
        hash_value: 'abc123',
        created_at: '2026-02-10T10:00:00Z',
      },
    ],
  },
  pagination: {
    page: 1,
    limit: 20,
    total: 142,
    totalPages: 8,
    hasNext: true,
    hasPrev: false,
  },
};

const MOCK_ALERTS_NEW: Record<string, unknown>[] = [
  {
    id: 'alert-1',
    original_content_id: 'content-1',
    original_title: 'My Original Article on Web3',
    detected_copy_url: 'nostr:nevent1abc',
    detected_author_pubkey: 'hex-pubkey-1',
    similarity_score: 0.92,
    match_level: 'derivative',
    hash_type: 'simhash',
    status: 'new',
    detected_at: '2026-02-15T10:00:00Z',
    relay: 'wss://relay.damus.io',
  },
  {
    id: 'alert-2',
    original_content_id: 'content-2',
    original_title: 'Understanding Bitcoin Lightning',
    detected_copy_url: 'nostr:nevent1def',
    detected_author_pubkey: 'hex-pubkey-2',
    similarity_score: 0.97,
    match_level: 'exact_copy',
    hash_type: 'simhash',
    status: 'new',
    detected_at: '2026-02-14T08:00:00Z',
    relay: 'wss://relay.snort.social',
  },
];

const MOCK_ALERTS_REVIEWED: Record<string, unknown>[] = [
  {
    id: 'alert-3',
    original_content_id: 'content-3',
    original_title: 'NOSTR for Beginners',
    detected_copy_url: 'nostr:nevent1ghi',
    detected_author_pubkey: 'hex-pubkey-3',
    similarity_score: 0.85,
    match_level: 'derivative',
    hash_type: 'simhash',
    status: 'reviewed',
    detected_at: '2026-02-12T14:00:00Z',
    relay: 'wss://relay.damus.io',
  },
];

const MOCK_ALERT_DETAIL = {
  success: true,
  data: {
    id: 'alert-1',
    original: {
      content_id: 'content-1',
      title: 'My Original Article on Web3',
      excerpt: 'Web3 represents a fundamental shift in how we think about digital ownership and creator rights. This article explores the intersection of decentralized protocols and creative work...',
      published_at: '2026-02-10T10:00:00Z',
      provenance: { signature: 'sig-hex-123', nostr_event_id: 'event-id-123' },
    },
    detected: {
      url: 'nostr:nevent1abc',
      author_pubkey: 'hex-pubkey-1',
      excerpt: 'Web3 represents a fundamental shift in how we think about digital ownership and creator rights. This post explores the intersection of decentralized protocols and creative work...',
      published_at: '2026-02-14T15:00:00Z',
    },
    comparison: {
      similarity_score: 0.92,
      match_level: 'derivative',
      hash_type: 'simhash',
      highlighted_sections: [],
    },
    status: 'new',
    detected_at: '2026-02-15T10:00:00Z',
  },
};

const MOCK_ALERT_DETAIL_REVIEWED = {
  success: true,
  data: {
    ...MOCK_ALERT_DETAIL.data,
    id: 'alert-3',
    status: 'reviewed',
    original: {
      ...MOCK_ALERT_DETAIL.data.original,
      title: 'NOSTR for Beginners',
      excerpt: 'Learn the basics of the NOSTR protocol and how it enables censorship-resistant communication...',
    },
    detected: {
      ...MOCK_ALERT_DETAIL.data.detected,
      excerpt: 'Learn the basics of the NOSTR protocol and how it enables censorship-resistant communication. This guide...',
    },
    comparison: {
      similarity_score: 0.85,
      match_level: 'derivative',
      hash_type: 'simhash',
      highlighted_sections: [],
    },
  },
};

const MOCK_DMCA_REPORT = {
  success: true,
  data: {
    report: {
      title: 'DMCA Takedown Report',
      generated_at: '2026-02-15T12:00:00Z',
      claimant: {
        pubkey: 'demo-nostr-pubkey-test',
        nip05: 'test@sovren.dev',
        display_name: 'Test Creator',
      },
      original_content: {
        content_id: 'content-3',
        published_at: '2026-02-10T10:00:00Z',
        provenance_signature: 'sig-hex-123',
        nostr_event_id: 'event-id-123',
        content_hash: 'sha256-hex',
        relay_confirmations: [],
      },
      infringing_content: {
        url: 'nostr:nevent1ghi',
        author_pubkey: 'hex-pubkey-3',
        detected_at: '2026-02-12T14:00:00Z',
        similarity_score: 0.85,
        match_level: 'derivative',
      },
      verification_url: 'https://sovren.dev/verify/content-3',
    },
  },
};

async function setupShieldApiMocks(page: Page) {
  // Fingerprint coverage
  await page.route('**/api/v2/shield/fingerprints/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_FINGERPRINT_COVERAGE),
    });
  });

  // Alerts listing
  await page.route('**/api/v2/shield/alerts?*', (route) => {
    const url = new URL(route.request().url());
    const status = url.searchParams.get('status') || 'new';

    let alerts: Record<string, unknown>[] = [];
    if (status === 'new') alerts = MOCK_ALERTS_NEW;
    if (status === 'reviewed') alerts = MOCK_ALERTS_REVIEWED;

    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: alerts,
        pagination: {
          page: 1,
          limit: 20,
          total: alerts.length,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      }),
    });
  });

  // Alert detail
  await page.route(/\/api\/v2\/shield\/alerts\/alert-[0-9]+$/, (route) => {
    const url = route.request().url();
    const alertId = url.split('/').pop();

    if (alertId === 'alert-3') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ALERT_DETAIL_REVIEWED),
      });
    } else {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ALERT_DETAIL),
      });
    }
  });

  // Alert status update
  await page.route(/\/api\/v2\/shield\/alerts\/alert-[0-9]+$/, (route) => {
    if (route.request().method() === 'PUT') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 'alert-1', status: 'reviewed', updated_at: '2026-02-15T12:00:00Z' },
        }),
      });
    } else {
      route.fallback();
    }
  });

  // DMCA report
  await page.route('**/api/v2/shield/alerts/*/dmca-report*', (route) => {
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_DMCA_REPORT),
    });
  });

  // Also mock wellness APIs to avoid errors from shared layout
  await page.route('**/api/v2/wellness/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    });
  });
}

async function authenticateAndVisitShield(page: Page) {
  await page.goto('/');
  await page.evaluate((user) => {
    localStorage.setItem('demo_user', JSON.stringify(user));
  }, DEMO_USER);
  await page.goto('/shield');
}

// --- TESTS ---

test.describe('Content Shield Dashboard - Full Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupShieldApiMocks(page);
    await authenticateAndVisitShield(page);
  });

  test('renders page header with title and description', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Content Shield' })).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText('Protect your content with cryptographic provenance and copy detection.')
    ).toBeVisible();
  });

  test('renders fingerprint coverage with donut chart and stats', async ({ page }) => {
    await expect(page.getByText('Fingerprint Coverage')).toBeVisible({ timeout: 10000 });

    // Coverage percentage
    await expect(page.getByText('71%')).toBeVisible();

    // Stats
    await expect(page.getByText('142')).toBeVisible(); // fingerprinted
    await expect(page.getByText('Fingerprinted', { exact: true })).toBeVisible();
    await expect(page.getByText('200')).toBeVisible(); // total
    await expect(page.getByText('Total Content')).toBeVisible();
    await expect(page.getByText('58', { exact: true })).toBeVisible(); // unprotected
    await expect(page.getByText('Unprotected')).toBeVisible();

    // Warning about unprotected content
    await expect(page.getByText(/58 pieces of content are not yet fingerprinted/)).toBeVisible();
  });

  test('renders alerts feed with status tabs', async ({ page }) => {
    await expect(page.getByText('Copy Detection Alerts')).toBeVisible({ timeout: 10000 });

    // Status tabs
    await expect(page.locator('button[aria-pressed="true"]', { hasText: 'new' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'reviewed' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'resolved' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'false positive' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'reported' })).toBeVisible();
  });

  test('shows alert cards with title, similarity, and status', async ({ page }) => {
    await expect(page.getByText('Copy Detection Alerts')).toBeVisible({ timeout: 10000 });

    // Alert 1
    await expect(page.getByText('My Original Article on Web3')).toBeVisible();
    await expect(page.getByText('92%')).toBeVisible();

    // Alert 2
    await expect(page.getByText('Understanding Bitcoin Lightning')).toBeVisible();
    await expect(page.getByText('97%')).toBeVisible();

    await page.screenshot({ path: 'test-results/shield-dashboard-mocked.png', fullPage: true });
  });

  test('switching status tabs loads different alerts', async ({ page }) => {
    await expect(page.getByText('Copy Detection Alerts')).toBeVisible({ timeout: 10000 });

    // Default tab shows 'new' alerts
    await expect(page.getByText('My Original Article on Web3')).toBeVisible();

    // Switch to 'reviewed' tab
    await page.locator('button', { hasText: 'reviewed' }).click();
    await page.waitForTimeout(1000);

    // Should show reviewed alerts
    await expect(page.getByText('NOSTR for Beginners')).toBeVisible();
    // New alerts should not be visible
    await expect(page.getByText('My Original Article on Web3')).not.toBeVisible();

    // Switch to 'resolved' tab — should show empty
    await page.locator('button', { hasText: 'resolved' }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText('No resolved alerts.')).toBeVisible();
  });

  test('clicking an alert card opens detail panel', async ({ page }) => {
    await expect(page.getByText('Copy Detection Alerts')).toBeVisible({ timeout: 10000 });

    // Click the first alert
    await page.getByText('My Original Article on Web3').click();
    await page.waitForTimeout(1000);

    // Should open detail panel
    await expect(page.getByText('Alert Detail')).toBeVisible();

    // Side-by-side comparison
    await expect(page.getByRole('heading', { name: 'Original', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Detected Copy' })).toBeVisible();

    // Excerpts — both original and detected have similar text, just check first
    await expect(page.getByText(/Web3 represents a fundamental shift/).first()).toBeVisible();

    // Similarity score
    await expect(page.getByText(/92% — derivative/)).toBeVisible();

    // Action buttons for 'new' status: reviewed, false_positive
    await expect(page.getByRole('button', { name: 'Mark as reviewed' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mark as false positive' })).toBeVisible();

    // Close button
    await expect(page.getByRole('button', { name: 'Close' })).toBeVisible();

    await page.screenshot({ path: 'test-results/shield-alert-detail.png', fullPage: true });
  });

  test('close button in alert detail panel works', async ({ page }) => {
    await expect(page.getByText('Copy Detection Alerts')).toBeVisible({ timeout: 10000 });

    await page.getByText('My Original Article on Web3').click();
    await expect(page.getByText('Alert Detail')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByText('Alert Detail')).not.toBeVisible();
  });

  test('DMCA report button appears for reviewed alerts', async ({ page }) => {
    await expect(page.getByText('Copy Detection Alerts')).toBeVisible({ timeout: 10000 });

    // Switch to reviewed tab
    await page.locator('button', { hasText: 'reviewed' }).click();
    await page.waitForTimeout(1000);

    // Click the reviewed alert
    await page.getByText('NOSTR for Beginners').click();
    await page.waitForTimeout(1000);

    // Should show DMCA report button
    await expect(page.getByRole('button', { name: 'Generate DMCA Report' })).toBeVisible();

    // Should also show status transition buttons for reviewed: resolved, false_positive, reported
    await expect(page.getByRole('button', { name: 'Mark as resolved' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mark as false positive' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mark as reported' })).toBeVisible();
  });
});

test.describe('Content Shield Dashboard - Responsive', () => {
  test.beforeEach(async ({ page }) => {
    await setupShieldApiMocks(page);
  });

  test('mobile layout', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await authenticateAndVisitShield(page);

    await expect(page.getByRole('heading', { name: 'Content Shield' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Fingerprint Coverage')).toBeVisible();
    await expect(page.getByText('Copy Detection Alerts')).toBeVisible();

    await page.screenshot({ path: 'test-results/shield-mobile-mocked.png', fullPage: true });
  });

  test('desktop layout', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await authenticateAndVisitShield(page);

    await expect(page.getByRole('heading', { name: 'Content Shield' })).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: 'test-results/shield-desktop-mocked.png', fullPage: true });
  });
});

test.describe('Content Shield Dashboard - Navigation', () => {
  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/shield');
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/login/);
  });

  test('navigation bar shows shield link', async ({ page }) => {
    await setupShieldApiMocks(page);
    await authenticateAndVisitShield(page);

    await expect(page.getByRole('link', { name: 'Shield' })).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Content Shield Dashboard - Error States', () => {
  test('shows error messages when API fails', async ({ page }) => {
    await page.route('**/api/v2/shield/**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'INTERNAL_ERROR', message: 'Server error' }),
      });
    });

    await authenticateAndVisitShield(page);
    await page.waitForTimeout(3000);

    await expect(page.getByText('Failed to load fingerprint coverage.')).toBeVisible();
    await expect(page.getByText('Failed to load alerts.')).toBeVisible();

    await page.screenshot({ path: 'test-results/shield-error-states.png', fullPage: true });
  });
});

test.describe('Content Shield Dashboard - Console Errors', () => {
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

    await setupShieldApiMocks(page);
    await authenticateAndVisitShield(page);
    await page.waitForTimeout(3000);

    expect(consoleErrors).toEqual([]);
  });
});
