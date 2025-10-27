/**
 * ⚡ E2E Tests: Performance and Visual Regression
 * Tests page load performance, interaction timing, and visual consistency
 */
import { test, expect, Page } from '@playwright/test';
import { NostrRelayMock } from './fixtures/relay-mock';
import { ALICE, BOB } from './fixtures/test-users';
import { createBatchTextNotes } from './fixtures/test-events';

test.describe('Performance and Visual Regression E2E Tests', () => {
  let page: Page;
  let mockRelay: NostrRelayMock;

  test.beforeAll(async () => {
    mockRelay = new NostrRelayMock({ port: 7050 });
    await mockRelay.start();
  });

  test.afterAll(async () => {
    await mockRelay.stop();
  });

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    mockRelay.clearEvents();

    await page.evaluate((alice) => {
      localStorage.setItem('nostr_keypair_encrypted', JSON.stringify({
        privateKey: alice.privateKeyHex,
        publicKey: alice.publicKey,
        created: Date.now(),
      }));
    }, ALICE);

    await page.click('text=Relays');
    await page.fill('input[placeholder*="relay"]', 'ws://localhost:7050');
    await page.click('button:has-text("Connect")');
    await page.waitForTimeout(2000);
  });

  test.describe('Page Load Performance', () => {
    test('should load home page within 3 seconds', async () => {
      const startTime = Date.now();

      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(3000);
      console.log(`Home page loaded in ${loadTime}ms`);
    });

    test('should have good Core Web Vitals - LCP', async () => {
      await page.goto('/');

      const lcp = await page.evaluate(() => {
        return new Promise<number>((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1] as PerformanceEntry & { renderTime?: number; loadTime?: number };
            resolve(lastEntry.renderTime || lastEntry.loadTime || 0);
          }).observe({ type: 'largest-contentful-paint', buffered: true });

          setTimeout(() => resolve(0), 5000);
        });
      });

      // LCP should be under 2.5 seconds (good threshold)
      expect(lcp).toBeLessThan(2500);
      console.log(`LCP: ${lcp}ms`);
    });

    test('should have good Core Web Vitals - FID', async () => {
      await page.goto('/');

      // Simulate user interaction
      await page.click('button:visible');

      const fid = await page.evaluate(() => {
        return new Promise<number>((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            if (entries.length > 0) {
              const entry = entries[0] as PerformanceEntry & { processingStart?: number; startTime?: number };
              const delay = (entry.processingStart || 0) - (entry.startTime || 0);
              resolve(delay);
            }
          }).observe({ type: 'first-input', buffered: true });

          setTimeout(() => resolve(0), 3000);
        });
      });

      // FID should be under 100ms (good threshold)
      expect(fid).toBeLessThan(100);
      console.log(`FID: ${fid}ms`);
    });

    test('should have good Core Web Vitals - CLS', async () => {
      await page.goto('/');
      await page.waitForTimeout(3000); // Wait for layout shifts to settle

      const cls = await page.evaluate(() => {
        return new Promise<number>((resolve) => {
          let clsValue = 0;

          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const layoutShift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
              if (!layoutShift.hadRecentInput) {
                clsValue += layoutShift.value || 0;
              }
            }
          }).observe({ type: 'layout-shift', buffered: true });

          setTimeout(() => resolve(clsValue), 3000);
        });
      });

      // CLS should be under 0.1 (good threshold)
      expect(cls).toBeLessThan(0.1);
      console.log(`CLS: ${cls}`);
    });

    test('should have fast Time to Interactive', async () => {
      const startTime = Date.now();

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const tti = Date.now() - startTime;

      expect(tti).toBeLessThan(5000); // Should be interactive within 5 seconds
      console.log(`TTI: ${tti}ms`);
    });

    test('should load resources efficiently', async () => {
      const resourceMetrics = await page.evaluate(() => {
        const resources = performance.getEntriesByType('resource');
        const sizes = resources.map(r => (r as PerformanceResourceTiming).transferSize);
        const total = sizes.reduce((sum, size) => sum + size, 0);

        return {
          count: resources.length,
          totalSize: total,
          avgSize: total / resources.length,
        };
      });

      console.log(`Resources: ${resourceMetrics.count}, Total: ${resourceMetrics.totalSize} bytes`);

      // Should not load excessive resources
      expect(resourceMetrics.count).toBeLessThan(100);

      // Total page size should be reasonable (under 5MB for initial load)
      expect(resourceMetrics.totalSize).toBeLessThan(5 * 1024 * 1024);
    });
  });

  test.describe('Interaction Performance', () => {
    test('should publish event within 1 second', async () => {
      await page.click('text=Publish');

      await page.fill('textarea[name="content"]', 'Performance test');

      const startTime = Date.now();
      await page.click('button:has-text("Send")');

      await expect(page.getByText(/published|sent/i)).toBeVisible({ timeout: 10000 });

      const publishTime = Date.now() - startTime;

      expect(publishTime).toBeLessThan(1000);
      console.log(`Publish time: ${publishTime}ms`);
    });

    test('should render feed quickly', async () => {
      // Add many events
      const events = createBatchTextNotes(ALICE, 100, 'Feed performance test');

      for (const event of events) {
        await page.evaluate((evt) => {
          window.dispatchEvent(new CustomEvent('nostr:event', { detail: evt }));
        }, event);
      }

      await page.click('text=Feed');

      const startTime = Date.now();
      await expect(page.locator('[data-event-item]').first()).toBeVisible({ timeout: 5000 });
      const renderTime = Date.now() - startTime;

      expect(renderTime).toBeLessThan(2000);
      console.log(`Feed render time: ${renderTime}ms`);
    });

    test('should scroll feed smoothly', async () => {
      // Add many events
      const events = createBatchTextNotes(ALICE, 200, 'Scroll test');

      for (const event of events.slice(0, 100)) {
        await page.evaluate((evt) => {
          window.dispatchEvent(new CustomEvent('nostr:event', { detail: evt }));
        }, event);
      }

      await page.click('text=Feed');
      await page.waitForTimeout(2000);

      const scrollContainer = page.locator('[data-feed-container], [role="feed"]');

      const startTime = Date.now();

      // Scroll to bottom
      await scrollContainer.evaluate(el => {
        el.scrollTop = el.scrollHeight;
      });

      await page.waitForTimeout(1000);
      const scrollTime = Date.now() - startTime;

      // Should scroll without lag
      expect(scrollTime).toBeLessThan(2000);

      // Verify scrolled
      const scrollTop = await scrollContainer.evaluate(el => el.scrollTop);
      expect(scrollTop).toBeGreaterThan(0);
    });

    test('should open DM conversation quickly', async () => {
      await page.click('text=Messages');

      const startTime = Date.now();
      await page.click('button:has-text("New Message")');

      await expect(page.locator('input[name="recipient"]')).toBeVisible({ timeout: 3000 });

      const openTime = Date.now() - startTime;

      expect(openTime).toBeLessThan(500);
      console.log(`DM open time: ${openTime}ms`);
    });

    test('should switch between tabs efficiently', async () => {
      const tabs = ['Feed', 'Messages', 'Profile', 'Settings'];

      for (const tab of tabs) {
        const startTime = Date.now();

        await page.click(`text=${tab}`);
        await page.waitForLoadState('domcontentloaded');

        const switchTime = Date.now() - startTime;

        expect(switchTime).toBeLessThan(500);
        console.log(`${tab} switch time: ${switchTime}ms`);
      }
    });
  });

  test.describe('Memory Performance', () => {
    test('should not have memory leaks', async () => {
      const initialMemory = await page.evaluate(() => {
        if (performance.memory) {
          return (performance as any).memory.usedJSHeapSize;
        }
        return 0;
      });

      // Perform operations that could cause leaks
      for (let i = 0; i < 10; i++) {
        await page.click('text=Feed');
        await page.waitForTimeout(500);

        await page.click('text=Messages');
        await page.waitForTimeout(500);

        const events = createBatchTextNotes(BOB, 10, `Leak test ${i}`);
        for (const event of events) {
          await page.evaluate((evt) => {
            window.dispatchEvent(new CustomEvent('nostr:event', { detail: evt }));
          }, event);
        }
      }

      const finalMemory = await page.evaluate(() => {
        if (performance.memory) {
          return (performance as any).memory.usedJSHeapSize;
        }
        return 0;
      });

      if (initialMemory > 0 && finalMemory > 0) {
        const memoryIncrease = finalMemory - initialMemory;
        const increasePercentage = (memoryIncrease / initialMemory) * 100;

        // Memory should not increase more than 50% after repeated operations
        expect(increasePercentage).toBeLessThan(50);
        console.log(`Memory increase: ${increasePercentage.toFixed(2)}%`);
      }
    });

    test('should clean up subscriptions', async () => {
      await page.click('text=Feed');
      await page.waitForTimeout(1000);

      const initialSubCount = mockRelay.getStats().subscriptions;

      // Navigate away and back
      await page.click('text=Profile');
      await page.waitForTimeout(1000);

      await page.click('text=Feed');
      await page.waitForTimeout(1000);

      const finalSubCount = mockRelay.getStats().subscriptions;

      // Should not accumulate subscriptions
      expect(finalSubCount).toBeLessThanOrEqual(initialSubCount + 1);
    });
  });

  test.describe('Mobile Performance', () => {
    test('should perform well on mobile viewport', async () => {
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

      const startTime = Date.now();
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(4000); // Slightly higher threshold for mobile
      console.log(`Mobile load time: ${loadTime}ms`);
    });

    test('should have touch-friendly tap targets', async () => {
      await page.setViewportSize({ width: 375, height: 667 });

      const buttons = await page.locator('button, a').all();

      for (const button of buttons.slice(0, 10)) {
        const box = await button.boundingBox();

        if (box) {
          // Minimum tap target size is 44x44px (iOS guidelines)
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }
    });

    test('should render responsively', async () => {
      const viewports = [
        { width: 375, height: 667, name: 'iPhone SE' },
        { width: 414, height: 896, name: 'iPhone 11 Pro Max' },
        { width: 768, height: 1024, name: 'iPad' },
      ];

      for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.waitForTimeout(500);

        // Verify no horizontal scrollbars
        const hasHorizontalScroll = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });

        expect(hasHorizontalScroll).toBeFalsy();
        console.log(`${viewport.name}: No horizontal scroll`);
      }
    });
  });

  test.describe('Visual Regression', () => {
    test('should match homepage screenshot', async () => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Take screenshot
      await expect(page).toHaveScreenshot('homepage.png', {
        fullPage: true,
        threshold: 0.2, // 20% threshold for changes
      });
    });

    test('should match feed screenshot', async () => {
      // Add some consistent events
      const events = createBatchTextNotes(ALICE, 5, 'Visual regression test');

      for (const event of events) {
        await page.evaluate((evt) => {
          window.dispatchEvent(new CustomEvent('nostr:event', { detail: evt }));
        }, event);
      }

      await page.click('text=Feed');
      await page.waitForTimeout(2000);

      await expect(page).toHaveScreenshot('feed.png', {
        fullPage: true,
        threshold: 0.2,
      });
    });

    test('should match messages screenshot', async () => {
      await page.click('text=Messages');
      await page.waitForTimeout(1000);

      await expect(page).toHaveScreenshot('messages.png', {
        fullPage: true,
        threshold: 0.2,
      });
    });

    test('should match dark mode', async () => {
      // Enable dark mode
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('homepage-dark.png', {
        fullPage: true,
        threshold: 0.2,
      });
    });

    test('should match mobile layout', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('homepage-mobile.png', {
        fullPage: true,
        threshold: 0.2,
      });
    });

    test('should match tablet layout', async () => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot('homepage-tablet.png', {
        fullPage: true,
        threshold: 0.2,
      });
    });
  });

  test.describe('Network Performance', () => {
    test('should handle slow 3G gracefully', async () => {
      // Simulate slow 3G
      await page.context().route('**/*', route => {
        setTimeout(() => route.continue(), 500); // Add 500ms delay
      });

      const startTime = Date.now();
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const loadTime = Date.now() - startTime;

      // Should still load, just slower
      expect(loadTime).toBeLessThan(10000);
      console.log(`Slow 3G load time: ${loadTime}ms`);
    });

    test('should cache resources', async () => {
      // First load
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const firstLoadResources = await page.evaluate(() => {
        return performance.getEntriesByType('resource').length;
      });

      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');

      const secondLoadResources = await page.evaluate(() => {
        return performance.getEntriesByType('resource').filter(r => {
          const entry = r as PerformanceResourceTiming;
          return entry.transferSize === 0; // Cached resources have 0 transfer size
        }).length;
      });

      // Should have cached resources
      expect(secondLoadResources).toBeGreaterThan(0);
      console.log(`Cached resources: ${secondLoadResources}/${firstLoadResources}`);
    });
  });

  test.describe('Accessibility Performance', () => {
    test('should have fast keyboard navigation', async () => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const startTime = Date.now();

      // Tab through elements
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
      }

      const tabTime = Date.now() - startTime;

      // Each tab should be fast
      expect(tabTime / 10).toBeLessThan(100); // Average < 100ms per tab
      console.log(`Average tab time: ${(tabTime / 10).toFixed(2)}ms`);
    });

    test('should render focus indicators instantly', async () => {
      await page.goto('/');

      const button = page.locator('button').first();

      const startTime = Date.now();
      await button.focus();

      // Check for focus ring
      const hasFocusRing = await button.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return styles.outline !== 'none' || styles.boxShadow !== 'none';
      });

      const focusTime = Date.now() - startTime;

      expect(hasFocusRing).toBeTruthy();
      expect(focusTime).toBeLessThan(50); // Should be instant
    });
  });
});
