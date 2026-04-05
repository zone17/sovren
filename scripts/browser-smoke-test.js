/**
 * Browser Smoke Test — Playwright-based validation of all critical pages.
 *
 * Checks every page for:
 *   - Console errors (pageerror / console.error)
 *   - Infinite loading states (text containing "loading" still present after wait)
 *   - Empty pages (body with < 50 chars of visible text)
 *   - Mobile viewport overflow (scrollWidth > viewport)
 *
 * Outputs:
 *   - test-results/smoke-report.json   (machine-readable)
 *   - test-results/smoke-screenshots/  (desktop + mobile PNGs per page)
 *
 * Exit codes: 0 = all passed, 1 = at least one failure.
 *
 * Environment variables:
 *   SMOKE_BASE_URL — override the base URL (default: http://localhost:3000)
 *   SMOKE_TIMEOUT  — ms to wait for page to settle (default: 10000)
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const TIMEOUT = Number(process.env.SMOKE_TIMEOUT) || 10_000;
const SCREENSHOT_DIR = path.join(PROJECT_ROOT, 'test-results', 'smoke-screenshots');
const REPORT_PATH = path.join(PROJECT_ROOT, 'test-results', 'smoke-report.json');

/** Pages to smoke-test. auth=true pages get demo-mode localStorage injected. */
const PAGES = [
  { url: '/', name: 'homepage', auth: false },
  { url: '/login', name: 'login', auth: false },
  { url: '/signup', name: 'signup', auth: false },
  { url: '/discover', name: 'discover', auth: false },
  { url: '/dashboard', name: 'dashboard', auth: true },
  { url: '/profile', name: 'profile', auth: true },
  { url: '/create', name: 'create', auth: true },
  { url: '/dashboard/analytics', name: 'analytics', auth: true },
];

// Patterns to ignore in console errors (framework noise, missing favicons, etc.)
const CONSOLE_ERROR_IGNORE = [
  /tsqd/i,
  /DevTools/i,
  /favicon/i,
  /downloadable font/i,
  /Failed to load resource.*favicon/i,
  /net::ERR_/i, // Network errors from external resources in dev
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPortReachable(url, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const controller = new AbortController();
    const timer = setTimeout(() => { controller.abort(); resolve(false); }, timeoutMs);
    fetch(url, { signal: controller.signal })
      .then(() => { clearTimeout(timer); resolve(true); })
      .catch(() => { clearTimeout(timer); resolve(false); });
  });
}

async function ensureDevServer() {
  if (await isPortReachable(BASE_URL)) {
    console.log(`Dev server already running at ${BASE_URL}`);
    return null;
  }

  console.log(`Starting dev server (npm run dev)...`);
  const child = exec('npm run dev', { cwd: PROJECT_ROOT, env: { ...process.env } });

  // Wait for it to come up (max 30s)
  const start = Date.now();
  while (Date.now() - start < 30_000) {
    if (await isPortReachable(BASE_URL)) {
      console.log(`Dev server ready at ${BASE_URL}`);
      return child;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  throw new Error(`Dev server did not start within 30 seconds at ${BASE_URL}`);
}

// ---------------------------------------------------------------------------
// Per-page test
// ---------------------------------------------------------------------------

async function testPage(browser, pageConfig) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  const issues = [];
  const consoleErrors = [];

  page.on('pageerror', (err) => consoleErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    // Inject demo auth if required
    if (pageConfig.auth) {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        localStorage.setItem('sovren_demo_mode', 'true');
        localStorage.setItem(
          'sovren_auth',
          JSON.stringify({
            isAuthenticated: true,
            user: { name: 'Smoke Test', email: 'smoke@test.local', role: 'creator' },
          }),
        );
      });
    }

    // Navigate
    await page.goto(`${BASE_URL}${pageConfig.url}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(TIMEOUT);

    // Desktop screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `${pageConfig.name}-desktop.png`),
      fullPage: true,
    });

    // Check: infinite loading states
    const loadingCount = await page.$$eval('*', (els) =>
      els.filter(
        (el) =>
          el.children.length === 0 &&
          /^\s*(loading|spinner)\s*\.{0,3}\s*$/i.test(el.textContent || ''),
      ).length,
    );
    if (loadingCount > 0) issues.push('infinite-loading-detected');

    // Check: console errors (filter noise)
    const realErrors = consoleErrors.filter(
      (e) => !CONSOLE_ERROR_IGNORE.some((pat) => pat.test(e)),
    );
    if (realErrors.length > 0) issues.push(`${realErrors.length}-console-errors`);

    // Check: empty page
    const bodyText = await page.evaluate(() => document.body.innerText.trim());
    if (bodyText.length < 50) issues.push('page-appears-empty');

    // Check: mobile viewport overflow
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(2000);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    if (overflow) issues.push('mobile-overflow');

    // Mobile screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `${pageConfig.name}-mobile.png`),
      fullPage: true,
    });
  } catch (err) {
    issues.push(`navigation-error: ${err.message}`);
  }

  await context.close();

  return {
    name: pageConfig.name,
    url: pageConfig.url,
    passed: issues.length === 0,
    issues,
    consoleErrors: consoleErrors.slice(0, 5),
    screenshots: {
      desktop: `smoke-screenshots/${pageConfig.name}-desktop.png`,
      mobile: `smoke-screenshots/${pageConfig.name}-mobile.png`,
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  // Ensure dev server is running
  let devServerProcess = null;
  try {
    devServerProcess = await ensureDevServer();
  } catch (err) {
    console.error(`Failed to start dev server: ${err.message}`);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    for (const pageConfig of PAGES) {
      console.log(`  Testing ${pageConfig.name} (${pageConfig.url})...`);
      const result = await testPage(browser, pageConfig);
      results.push(result);
    }
  } finally {
    await browser.close();

    // Kill dev server if we started it
    if (devServerProcess) {
      devServerProcess.kill('SIGTERM');
    }
  }

  // Write report
  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    results,
  };

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  // Print summary
  console.log('\n=== Browser Smoke Test Results ===');
  for (const r of results) {
    const status = r.passed ? 'PASS' : 'FAIL';
    const detail = r.issues.length ? ' -- ' + r.issues.join(', ') : '';
    console.log(`  [${status}] ${r.name} (${r.url})${detail}`);
  }
  console.log(`\n  ${report.passed}/${report.total} passed`);

  if (report.failed > 0) {
    console.log('\n  Screenshots saved to: test-results/smoke-screenshots/');
    console.log('  Report saved to: test-results/smoke-report.json');
  }

  process.exit(report.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
