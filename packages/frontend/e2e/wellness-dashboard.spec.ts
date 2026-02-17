import { expect, Page, test } from '@playwright/test';

/**
 * Phase 7 - EPIC-007: Creator Wellness Dashboard E2E Tests
 *
 * Tests all wellness features with mocked API responses:
 * - Burnout Risk Gauge (with baseline ready and not ready states)
 * - Work Pattern Heatmap (7d/30d toggle)
 * - Rest Day Tracker
 * - Sustainable Scheduler
 * - Wellness Trend chart
 * - Boundary Settings (focus hours, DND, engagement budget, status)
 * - Wellness Pulse Check-In modal
 * - Wellness Resources (static, with category filters)
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

const MOCK_RISK_SCORE = {
  success: true,
  data: {
    score: 42,
    level: 'moderate',
    factors: {
      work_hours_trend: { value: 0.35, weight: 0.25, detail: 'Working 115% of baseline' },
      posting_frequency: { value: 0.50, weight: 0.20, detail: 'Posting 140% of 4-week avg' },
      engagement_drop: { value: 0.20, weight: 0.20, detail: 'Engagement at 85% of avg' },
      hour_regularity: { value: 0.60, weight: 0.15, detail: 'High schedule variance' },
      rest_day_deficit: { value: 0.45, weight: 0.20, detail: '1 rest day this week (target: 2)' },
    },
    baseline_ready: true,
    baseline_days_remaining: 0,
    history: [
      { week: '2026-W06', score: 38, level: 'moderate' },
      { week: '2026-W05', score: 25, level: 'low' },
    ],
    recommendations: [
      'Consider taking tomorrow off - you have worked 6 consecutive days',
      'Your posting frequency is above sustainable pace',
    ],
    updated_at: '2026-02-15T00:00:00Z',
  },
};

const MOCK_RISK_SCORE_NO_BASELINE = {
  success: true,
  data: {
    score: null,
    level: 'low',
    factors: {},
    baseline_ready: false,
    baseline_days_remaining: 10,
    history: [],
    recommendations: [],
    updated_at: '2026-02-15T00:00:00Z',
  },
};

const MOCK_PATTERNS = {
  success: true,
  data: {
    period: '7d',
    total_hours: 38.5,
    daily_average_hours: 5.5,
    breakdown: {
      content_creation: { hours: 18.0, percentage: 46.8 },
      engagement: { hours: 12.5, percentage: 32.5 },
      management: { hours: 8.0, percentage: 20.7 },
    },
    daily: [
      { date: '2026-02-09', total_hours: 6.2, content_creation_mins: 180, engagement_mins: 120, management_mins: 72 },
    ],
    rest_days: 1,
    baseline_established: true,
  },
};

const MOCK_HEATMAP = {
  success: true,
  data: {
    period: '7d',
    heatmap: [
      { day: 0, hour: 9, intensity: 0.85, total_mins: 180 },
      { day: 0, hour: 10, intensity: 0.70, total_mins: 150 },
      { day: 0, hour: 14, intensity: 0.60, total_mins: 120 },
      { day: 1, hour: 9, intensity: 0.50, total_mins: 100 },
      { day: 1, hour: 15, intensity: 0.40, total_mins: 80 },
      { day: 2, hour: 10, intensity: 0.30, total_mins: 60 },
      { day: 3, hour: 9, intensity: 0.90, total_mins: 200 },
      { day: 4, hour: 11, intensity: 0.25, total_mins: 50 },
    ],
    peak_hours: [9, 10, 14, 15],
    quiet_hours: [0, 1, 2, 3, 4, 5, 6],
  },
};

const MOCK_SCHEDULE = {
  success: true,
  data: {
    recommended_posts_per_week: 4,
    current_posts_per_week: 7,
    optimal_days: ['monday', 'wednesday', 'friday', 'sunday'],
    optimal_hours: [10, 14],
    productive_windows: [
      { day: 'monday', start: '09:00', end: '12:00', energy_score: 0.9 },
      { day: 'wednesday', start: '10:00', end: '13:00', energy_score: 0.85 },
    ],
    content_buffer_days: 3,
    buffer_threshold: 5,
    buffer_status: 'below_threshold',
  },
};

const MOCK_BOUNDARIES = {
  success: true,
  data: {
    focus_hours: {
      enabled: true,
      start: '22:00',
      end: '08:00',
      timezone: 'America/New_York',
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    },
    weekly_engagement_budget_mins: 120,
    engagement_used_mins: 85,
    dnd_mode: {
      active: false,
      auto_response_enabled: true,
      auto_response_template: "I'm currently in focus mode. I'll respond when I'm back!",
    },
    availability_status: 'hidden',
    availability_public: false,
    notification_batching: true,
  },
};

const MOCK_PULSE_HISTORY = {
  success: true,
  data: {
    entries: [
      { id: 'p1', energy: 4, motivation: 3, stress: 2, composite_score: 3.67, created_at: '2026-02-10T10:00:00Z' },
      { id: 'p2', energy: 3, motivation: 4, stress: 3, composite_score: 3.0, created_at: '2026-02-11T10:00:00Z' },
      { id: 'p3', energy: 5, motivation: 4, stress: 1, composite_score: 4.67, created_at: '2026-02-12T10:00:00Z' },
      { id: 'p4', energy: 4, motivation: 5, stress: 2, composite_score: 4.33, created_at: '2026-02-13T10:00:00Z' },
      { id: 'p5', energy: 3, motivation: 3, stress: 4, composite_score: 2.33, created_at: '2026-02-14T10:00:00Z' },
    ],
    trend: {
      direction: 'improving',
      average_composite: 3.60,
      change_from_previous_period: 0.22,
    },
  },
};

const MOCK_PULSE_SUBMIT = {
  success: true,
  data: {
    id: 'new-pulse-id',
    energy: 4,
    motivation: 3,
    stress: 2,
    composite_score: 3.67,
    created_at: '2026-02-15T10:00:00Z',
  },
};

/**
 * Set up all API mocks for wellness endpoints.
 */
async function setupWellnessApiMocks(page: Page, overrides?: Record<string, unknown>) {
  await page.route('**/api/v2/wellness/risk-score', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(overrides?.riskScore ?? MOCK_RISK_SCORE),
      });
    } else {
      route.continue();
    }
  });

  await page.route('**/api/v2/wellness/risk-score/sensitivity', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { sensitivity: 'normal', updated_at: '2026-02-15T10:00:00Z' } }),
    });
  });

  await page.route(/\/api\/v2\/wellness\/patterns\/heatmap/, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_HEATMAP),
    });
  });

  await page.route(/\/api\/v2\/wellness\/patterns(\?|$)/, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_PATTERNS),
    });
  });

  await page.route('**/api/v2/wellness/schedule/recommendations', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_SCHEDULE),
    });
  });

  await page.route('**/api/v2/wellness/boundaries', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_BOUNDARIES),
      });
    } else if (route.request().method() === 'PUT') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_BOUNDARIES),
      });
    }
  });

  await page.route('**/api/v2/wellness/pulse/history*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(overrides?.pulseHistory ?? MOCK_PULSE_HISTORY),
    });
  });

  await page.route('**/api/v2/wellness/pulse', (route) => {
    if (route.request().method() === 'POST') {
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PULSE_SUBMIT),
      });
    } else {
      route.continue();
    }
  });
}

async function authenticateAndVisitWellness(page: Page) {
  await page.goto('/');
  await page.evaluate((user) => {
    localStorage.setItem('demo_user', JSON.stringify(user));
  }, DEMO_USER);
  await page.goto('/wellness');
}

// --- TESTS ---

test.describe('Wellness Dashboard - Full Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupWellnessApiMocks(page);
    await authenticateAndVisitWellness(page);
  });

  test('renders page header with title and Pulse Check-In button', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Creator Wellness' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Monitor your work patterns and maintain sustainable habits.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pulse Check-In' })).toBeVisible();
  });

  test('renders burnout risk gauge with score and level', async ({ page }) => {
    await expect(page.getByText('Burnout Risk')).toBeVisible({ timeout: 10000 });
    // Should show score 42
    await expect(page.getByRole('status')).toContainText('42');
    // Should show Moderate badge
    await expect(page.getByText('Moderate')).toBeVisible();
    // Should show top recommendation
    await expect(page.getByText(/Consider taking tomorrow off/)).toBeVisible();
  });

  test('burnout gauge expands to show risk factors on click', async ({ page }) => {
    await expect(page.getByText('Burnout Risk')).toBeVisible({ timeout: 10000 });

    // Click the gauge button to expand
    const gaugeButton = page.locator('button[aria-expanded]');
    await gaugeButton.click();

    // Should show risk factors
    await expect(page.getByText('Risk Factors')).toBeVisible();
    await expect(page.getByText('Work Hours')).toBeVisible();
    await expect(page.getByText('Posting Frequency')).toBeVisible();
    await expect(page.getByText('Engagement Drop')).toBeVisible();
    await expect(page.getByText('Schedule Regularity')).toBeVisible();
    await expect(page.getByText('Rest Day Deficit')).toBeVisible();

    // Detail texts
    await expect(page.getByText('Working 115% of baseline')).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'test-results/wellness-burnout-expanded.png', fullPage: true });

    // Click again to collapse
    await gaugeButton.click();
    await expect(page.getByText('Risk Factors')).not.toBeVisible();
  });

  test('renders rest day tracker with data', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Rest Days' })).toBeVisible({ timeout: 10000 });
    // Should show 1 rest day (from mock)
    await expect(page.getByText('/ 2 target this week')).toBeVisible();
    // Should show warning since below target
    await expect(page.getByText('Consider scheduling a rest day this week.')).toBeVisible();
  });

  test('renders sustainable scheduler with posting pace', async ({ page }) => {
    await expect(page.getByText('Sustainable Schedule')).toBeVisible({ timeout: 10000 });
    // Posting pace
    await expect(page.getByText('Posting Pace')).toBeVisible();
    await expect(page.getByText('7/week (recommended: 4/week)')).toBeVisible();
    await expect(page.getByText('Over pace')).toBeVisible();
    // Best days
    await expect(page.getByText('Best Days to Post')).toBeVisible();
    // Best times
    await expect(page.getByText('Best Times')).toBeVisible();
    await expect(page.getByText('10 AM, 2 PM')).toBeVisible();
    // Content buffer
    await expect(page.getByText('Content Buffer')).toBeVisible();
    await expect(page.getByText('3 days')).toBeVisible();
    // Productive windows
    await expect(page.getByText('Productive Windows')).toBeVisible();
  });

  test('renders work activity heatmap with period toggle', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Work Activity' })).toBeVisible({ timeout: 10000 });
    // The heatmap 7d/30d buttons are right after the heading in the same card header
    const heatmapBtn7d = page.getByRole('button', { name: '7d' }).first();
    await expect(heatmapBtn7d).toBeVisible();
    // Day labels
    await expect(page.getByText('Mon').first()).toBeVisible();
    await expect(page.getByText('Sun').first()).toBeVisible();
    // Legend
    await expect(page.getByText('Less')).toBeVisible();
    await expect(page.getByText('More')).toBeVisible();
    // Peak hours
    await expect(page.getByText(/Peak hours:/)).toBeVisible();

    // Toggle to 30d — use first 30d button (belongs to heatmap)
    await page.getByRole('button', { name: '30d' }).first().click();
    await page.waitForTimeout(500);
  });

  test('renders wellness trend chart', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Wellness Trend' })).toBeVisible({ timeout: 10000 });
    // Should show trend badge
    await expect(page.getByText('Improving')).toBeVisible();
    // Period toggle for trend: 90d button is unique to trend section
    await expect(page.getByRole('button', { name: '90d' })).toBeVisible();
    // Avg and change
    await expect(page.getByText('Avg: 3.60')).toBeVisible();
    await expect(page.getByText('Change: +0.22')).toBeVisible();
  });

  test('renders boundary settings with all controls', async ({ page }) => {
    const saveButton = page.getByRole('button', { name: 'Save Boundaries' });
    await expect(saveButton).toBeVisible({ timeout: 10000 });

    // Focus Hours toggle
    await expect(page.getByText('Focus Hours')).toBeVisible();
    await expect(page.getByLabel('Toggle focus hours')).toBeVisible();

    // Engagement budget
    await expect(page.getByText('Weekly Engagement Budget')).toBeVisible();
    await expect(page.getByText(/85 \/ 120 min used/)).toBeVisible();

    // DND mode
    await expect(page.getByText('Do Not Disturb')).toBeVisible();
    await expect(page.getByLabel('Toggle do not disturb')).toBeVisible();

    // Auto-response
    await expect(page.getByLabel('Toggle auto-response')).toBeVisible();

    // Batch Notifications
    await expect(page.getByText('Batch Notifications')).toBeVisible();
  });

  test('boundary settings save button works', async ({ page }) => {
    const saveButton = page.getByRole('button', { name: 'Save Boundaries' });
    await expect(saveButton).toBeVisible({ timeout: 10000 });
    await saveButton.click();

    // Should show success message
    await expect(page.getByText('Boundaries saved.')).toBeVisible({ timeout: 5000 });
  });

  test('renders wellness resources with all categories', async ({ page }) => {
    await expect(page.getByText('Wellness Resources')).toBeVisible({ timeout: 10000 });

    // Filter tabs
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Community' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Article' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tool' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crisis Support' })).toBeVisible();

    // All resources visible initially
    await expect(page.getByText('Creator Burnout Recovery Group')).toBeVisible();
    await expect(page.getByText('The Sustainable Creator')).toBeVisible();
    await expect(page.getByText('Focus Timer for Creators')).toBeVisible();
    await expect(page.getByText('Creator Mental Health Hotline')).toBeVisible();
  });

  test('resource category filter works', async ({ page }) => {
    await expect(page.getByText('Wellness Resources')).toBeVisible({ timeout: 10000 });

    // Filter to Crisis Support only
    await page.getByRole('button', { name: 'Crisis Support' }).click();
    await page.waitForTimeout(300);

    // Should show only crisis resources
    await expect(page.getByText('Creator Mental Health Hotline')).toBeVisible();
    await expect(page.getByText('Crisis Text Line')).toBeVisible();
    // Should NOT show tools
    await expect(page.getByText('Focus Timer for Creators')).not.toBeVisible();

    // Filter to tools
    await page.getByRole('button', { name: 'Tool' }).click();
    await page.waitForTimeout(300);

    await expect(page.getByText('Focus Timer for Creators')).toBeVisible();
    await expect(page.getByText('Batch Content Planner')).toBeVisible();
    // Crisis resources hidden
    await expect(page.getByText('Creator Mental Health Hotline')).not.toBeVisible();

    // Back to all
    await page.getByRole('button', { name: 'All' }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText('Creator Mental Health Hotline')).toBeVisible();
    await expect(page.getByText('Focus Timer for Creators')).toBeVisible();
  });
});

test.describe('Wellness Dashboard - Pulse Check-In Modal', () => {
  test.beforeEach(async ({ page }) => {
    await setupWellnessApiMocks(page);
    await authenticateAndVisitWellness(page);
  });

  test('opens pulse modal and shows all fields', async ({ page }) => {
    const pulseButton = page.getByRole('button', { name: 'Pulse Check-In' });
    await expect(pulseButton).toBeVisible({ timeout: 10000 });
    await pulseButton.click();

    // Modal content
    await expect(page.getByText('Wellness Check-In')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Quick pulse check. How are you feeling right now?')).toBeVisible();

    // Slider labels
    await expect(page.getByText('Energy', { exact: true })).toBeVisible();
    await expect(page.getByText('Motivation', { exact: true })).toBeVisible();
    await expect(page.getByText('Stress', { exact: true })).toBeVisible();

    // Scale labels
    await expect(page.getByText('Exhausted')).toBeVisible();
    await expect(page.getByText('Energized')).toBeVisible();
    await expect(page.getByText('Unmotivated')).toBeVisible();
    await expect(page.getByText('Driven')).toBeVisible();
    await expect(page.getByText('Relaxed')).toBeVisible();
    await expect(page.getByText('Overwhelmed')).toBeVisible();

    // Buttons
    await expect(page.getByRole('button', { name: 'Skip' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible();

    await page.screenshot({ path: 'test-results/wellness-pulse-modal-open.png', fullPage: true });
  });

  test('skip button closes modal without submitting', async ({ page }) => {
    await page.getByRole('button', { name: 'Pulse Check-In' }).click();
    await expect(page.getByText('Wellness Check-In')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(page.getByText('Wellness Check-In')).not.toBeVisible();
  });

  test('submit button sends pulse data and closes modal', async ({ page }) => {
    await page.getByRole('button', { name: 'Pulse Check-In' }).click();
    await expect(page.getByText('Wellness Check-In')).toBeVisible({ timeout: 5000 });

    // Submit with default values
    await page.getByRole('button', { name: 'Submit' }).click();

    // Modal should close after successful submission
    await expect(page.getByText('Wellness Check-In')).not.toBeVisible({ timeout: 5000 });
  });
});

test.describe('Wellness Dashboard - Burnout Baseline Not Ready', () => {
  test('shows baseline building message when baseline not ready', async ({ page }) => {
    await setupWellnessApiMocks(page, { riskScore: MOCK_RISK_SCORE_NO_BASELINE });
    await authenticateAndVisitWellness(page);

    await expect(page.getByText('Burnout Risk')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('--')).toBeVisible();
    await expect(page.getByText(/Building your baseline/)).toBeVisible();
    await expect(page.getByText(/10 days remaining/)).toBeVisible();
  });
});

test.describe('Wellness Dashboard - Empty Pulse History', () => {
  test('shows empty state when no check-ins exist', async ({ page }) => {
    const emptyPulseHistory = {
      success: true,
      data: {
        entries: [],
        trend: { direction: 'stable', average_composite: 0, change_from_previous_period: 0 },
      },
    };
    await setupWellnessApiMocks(page, { pulseHistory: emptyPulseHistory });
    await authenticateAndVisitWellness(page);

    await expect(page.getByText('Wellness Trend')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('No check-ins yet.')).toBeVisible();
    await expect(page.getByText(/Complete a wellness pulse check-in/)).toBeVisible();
  });
});

test.describe('Wellness Dashboard - Responsive', () => {
  test.beforeEach(async ({ page }) => {
    await setupWellnessApiMocks(page);
  });

  test('mobile layout stacks cards vertically', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await authenticateAndVisitWellness(page);

    await expect(page.getByRole('heading', { name: 'Creator Wellness' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Pulse Check-In' })).toBeVisible();

    await page.screenshot({ path: 'test-results/wellness-mobile-mocked.png', fullPage: true });
  });

  test('tablet layout shows grid correctly', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await authenticateAndVisitWellness(page);

    await expect(page.getByRole('heading', { name: 'Creator Wellness' })).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: 'test-results/wellness-tablet-mocked.png', fullPage: true });
  });

  test('desktop layout shows full grid', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await authenticateAndVisitWellness(page);

    await expect(page.getByRole('heading', { name: 'Creator Wellness' })).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: 'test-results/wellness-desktop-mocked.png', fullPage: true });
  });
});

test.describe('Wellness Dashboard - Navigation', () => {
  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/wellness');
    await page.waitForTimeout(2000);
    // Should redirect to /login since no auth
    await expect(page).toHaveURL(/\/login/);
  });

  test('navigation bar shows wellness link', async ({ page }) => {
    await setupWellnessApiMocks(page);
    await authenticateAndVisitWellness(page);

    // Nav should have Wellness link
    await expect(page.getByRole('link', { name: 'Wellness' })).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Wellness Dashboard - Error States', () => {
  test('shows error cards when API returns errors', async ({ page }) => {
    // Set up routes to return errors
    await page.route('**/api/v2/wellness/**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'INTERNAL_ERROR', message: 'Server error' }),
      });
    });

    await authenticateAndVisitWellness(page);
    await page.waitForTimeout(3000);

    // Error messages should be displayed
    await expect(page.getByText('Failed to load burnout risk score.')).toBeVisible();
    await expect(page.getByText('Failed to load rest day data.')).toBeVisible();
    await expect(page.getByText('Failed to load schedule recommendations.')).toBeVisible();
    await expect(page.getByText('Failed to load activity heatmap.')).toBeVisible();
    await expect(page.getByText('Failed to load wellness trend.')).toBeVisible();
    await expect(page.getByText('Failed to load boundary settings.')).toBeVisible();

    // Resources should still render (static data)
    await expect(page.getByText('Wellness Resources')).toBeVisible();

    await page.screenshot({ path: 'test-results/wellness-error-states.png', fullPage: true });
  });
});

test.describe('Wellness Dashboard - Console Errors', () => {
  test('no unexpected console errors on page load', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignore expected fetch errors (API calls to non-existent backend in mocked mode)
        if (!text.includes('Failed to fetch') && !text.includes('ERR_CONNECTION_REFUSED') && !text.includes('net::')) {
          consoleErrors.push(text);
        }
      }
    });

    await setupWellnessApiMocks(page);
    await authenticateAndVisitWellness(page);
    await page.waitForTimeout(3000);

    // No unexpected console errors
    expect(consoleErrors).toEqual([]);
  });
});
