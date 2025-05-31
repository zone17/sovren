module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run preview',
      startServerReadyPattern: 'Local:',
      url: ['http://localhost:4173'],
      numberOfRuns: 3,
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        // Performance budget
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],

        // Core Web Vitals
        'first-contentful-paint': ['error', { maxNumericValue: 1800 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 200 }],
        'speed-index': ['error', { maxNumericValue: 2000 }],
        'interactive': ['error', { maxNumericValue: 3000 }],

        // Resource optimizations
        'unused-javascript': ['warn', { maxNumericValue: 30000 }],
        'unused-css-rules': ['warn', { maxNumericValue: 15000 }],
        'render-blocking-resources': ['warn', { maxNumericValue: 400 }],
        'unminified-css': 'error',
        'unminified-javascript': 'error',

        // Image optimizations
        'uses-webp-images': 'warn',
        'uses-optimized-images': 'warn',
        'modern-image-formats': 'warn',
        'offscreen-images': 'warn',
        'uses-responsive-images': 'warn',

        // Network optimizations
        'uses-long-cache-ttl': 'warn',
        'uses-rel-preconnect': 'warn',
        'uses-rel-preload': 'warn',
        'efficient-animated-content': 'warn',

        // Bundle size limits
        'total-byte-weight': ['error', { maxNumericValue: 1600000 }], // 1.6MB
        'mainthread-work-breakdown': ['warn', { maxNumericValue: 2000 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
    server: {},
  },
};
