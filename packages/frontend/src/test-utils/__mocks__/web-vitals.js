/**
 * 🎭 **Web Vitals Mock**
 *
 * Jest-compatible mock for web-vitals package
 * Following TDD/BDD best practices with realistic performance metrics
 */

module.exports = {
  getCLS: jest.fn().mockImplementation((callback) => {
    callback({ name: 'CLS', value: 0.05, rating: 'good' });
  }),

  getFID: jest.fn().mockImplementation((callback) => {
    callback({ name: 'FID', value: 50, rating: 'good' });
  }),

  getFCP: jest.fn().mockImplementation((callback) => {
    callback({ name: 'FCP', value: 1200, rating: 'good' });
  }),

  getLCP: jest.fn().mockImplementation((callback) => {
    callback({ name: 'LCP', value: 1800, rating: 'good' });
  }),

  getTTFB: jest.fn().mockImplementation((callback) => {
    callback({ name: 'TTFB', value: 300, rating: 'good' });
  }),

  __esModule: true,
};
