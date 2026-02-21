/**
 * Web Vitals Mock
 *
 * Vitest mock for web-vitals package
 */

module.exports = {
  getCLS: vi.fn().mockImplementation((callback) => {
    callback({ name: 'CLS', value: 0.05, rating: 'good' });
  }),

  getFID: vi.fn().mockImplementation((callback) => {
    callback({ name: 'FID', value: 50, rating: 'good' });
  }),

  getFCP: vi.fn().mockImplementation((callback) => {
    callback({ name: 'FCP', value: 1200, rating: 'good' });
  }),

  getLCP: vi.fn().mockImplementation((callback) => {
    callback({ name: 'LCP', value: 1800, rating: 'good' });
  }),

  getTTFB: vi.fn().mockImplementation((callback) => {
    callback({ name: 'TTFB', value: 300, rating: 'good' });
  }),

  __esModule: true,
};
