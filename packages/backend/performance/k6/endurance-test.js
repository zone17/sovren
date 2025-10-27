/**
 * K6 Endurance Testing Script (Soak Test)
 *
 * Tests system stability under sustained load:
 * - 500 concurrent users for 1 hour
 * - Memory leak detection
 * - Connection pool exhaustion
 * - Cache effectiveness over time
 * - Database connection stability
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const API_VERSION = '/api/v1';
const TEST_DURATION = __ENV.DURATION || '60m'; // Default 1 hour

// Custom Metrics
const errorRate = new Rate('errors');
const apiResponseTime = new Trend('api_response_time');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');
const memoryLeakIndicator = new Trend('memory_leak_indicator');
const connectionErrors = new Counter('connection_errors');
const cacheHitRate = new Gauge('cache_hit_rate');
const responseTimeDrift = new Trend('response_time_drift');

// Test Options - Endurance Testing
export const options = {
  stages: [
    { duration: '5m', target: 500 },    // Ramp-up to sustained load
    { duration: TEST_DURATION, target: 500 }, // Hold sustained load (1 hour default)
    { duration: '5m', target: 0 },      // Graceful ramp-down
  ],
  thresholds: {
    // Stability thresholds
    'http_req_duration': ['p(95)<800', 'p(99)<1500'],
    'api_response_time': ['p(95)<800'],
    'errors': ['rate<0.001'], // Very low error rate for stable system
    'http_req_failed': ['rate<0.001'],

    // Memory leak detection
    'memory_leak_indicator': ['p(99)<2000'], // Response time shouldn't degrade

    // Connection stability
    'connection_errors': ['count<100'], // Should be minimal

    // Success rate
    'checks': ['rate>0.999'], // 99.9% success
  },
  noConnectionReuse: false,
  userAgent: 'K6EnduranceTest/1.0',
};

// Test Data
const testUsers = [
  { email: 'endurance1@example.com', password: 'TestPass123!' },
  { email: 'endurance2@example.com', password: 'TestPass123!' },
  { email: 'endurance3@example.com', password: 'TestPass123!' },
  { email: 'endurance4@example.com', password: 'TestPass123!' },
  { email: 'endurance5@example.com', password: 'TestPass123!' },
];

// Track response time trends
let baselineResponseTime = 0;
let currentResponseTimes = [];
const responseTimeWindow = 100; // Track last 100 requests

function getHeaders(token = null) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

function trackResponseTime(duration) {
  currentResponseTimes.push(duration);

  if (currentResponseTimes.length > responseTimeWindow) {
    currentResponseTimes.shift();
  }

  // Calculate drift from baseline
  if (baselineResponseTime > 0) {
    const averageCurrent =
      currentResponseTimes.reduce((a, b) => a + b, 0) / currentResponseTimes.length;
    const drift = (averageCurrent / baselineResponseTime) * 100;
    responseTimeDrift.add(drift);
  }

  // Track as memory leak indicator
  memoryLeakIndicator.add(duration);
}

function authenticate() {
  const user = testUsers[randomIntBetween(0, testUsers.length - 1)];

  const response = http.post(
    `${BASE_URL}${API_VERSION}/auth/login`,
    JSON.stringify({
      email: user.email,
      password: user.password,
    }),
    { headers: getHeaders() }
  );

  const success = check(response, {
    'auth: status is 200': (r) => r.status === 200,
  });

  // Track connection errors
  if (response.error) {
    connectionErrors.add(1);
  }

  errorRate.add(!success);
  apiResponseTime.add(response.timings.duration);
  trackResponseTime(response.timings.duration);

  if (success) {
    successfulRequests.add(1);
    const body = JSON.parse(response.body);
    return body.token;
  } else {
    failedRequests.add(1);
    return null;
  }
}

export default function () {
  const token = authenticate();

  if (!token) {
    sleep(randomIntBetween(1, 2));
    return;
  }

  // Realistic user session over time
  realisticUserFlow(token);

  // Simulate reading time / think time
  sleep(randomIntBetween(2, 5));
}

function realisticUserFlow(token) {
  // Scenario 1: Browse content (most common)
  if (randomIntBetween(1, 10) <= 7) {
    browseContent(token);
  }
  // Scenario 2: Check profile and analytics
  else if (randomIntBetween(1, 10) <= 5) {
    checkProfileAndAnalytics(token);
  }
  // Scenario 3: Payment operations
  else {
    paymentOperations(token);
  }
}

function browseContent(token) {
  group('Browse Content Flow', () => {
    // List content (should be cached)
    const listResponse = http.get(
      `${BASE_URL}${API_VERSION}/content?limit=20`,
      { headers: getHeaders(token) }
    );

    const listSuccess = check(listResponse, {
      'content list: status is 200': (r) => r.status === 200,
      'content list: fast response': (r) => r.timings.duration < 500,
    });

    if (listResponse.error) {
      connectionErrors.add(1);
    }

    // Check cache headers
    if (listResponse.headers['X-Cache-Hit'] === 'true') {
      cacheHitRate.add(1);
    } else {
      cacheHitRate.add(0);
    }

    apiResponseTime.add(listResponse.timings.duration);
    trackResponseTime(listResponse.timings.duration);
    listSuccess ? successfulRequests.add(1) : failedRequests.add(1);

    sleep(1); // Simulate reading list

    // Get specific content item
    if (listSuccess) {
      const contentId = 'content-' + randomIntBetween(1, 1000);
      const getResponse = http.get(
        `${BASE_URL}${API_VERSION}/content/${contentId}`,
        { headers: getHeaders(token) }
      );

      const getSuccess = check(getResponse, {
        'content get: status is 200 or 404': (r) =>
          r.status === 200 || r.status === 404,
      });

      if (getResponse.error) {
        connectionErrors.add(1);
      }

      apiResponseTime.add(getResponse.timings.duration);
      trackResponseTime(getResponse.timings.duration);
      getSuccess ? successfulRequests.add(1) : failedRequests.add(1);
    }
  });
}

function checkProfileAndAnalytics(token) {
  group('Profile and Analytics Flow', () => {
    // Get user profile (should be heavily cached)
    const profileResponse = http.get(
      `${BASE_URL}${API_VERSION}/users/me`,
      { headers: getHeaders(token) }
    );

    const profileSuccess = check(profileResponse, {
      'profile: status is 200': (r) => r.status === 200,
      'profile: fast response': (r) => r.timings.duration < 300,
    });

    if (profileResponse.error) {
      connectionErrors.add(1);
    }

    if (profileResponse.headers['X-Cache-Hit'] === 'true') {
      cacheHitRate.add(1);
    } else {
      cacheHitRate.add(0);
    }

    apiResponseTime.add(profileResponse.timings.duration);
    trackResponseTime(profileResponse.timings.duration);
    profileSuccess ? successfulRequests.add(1) : failedRequests.add(1);

    sleep(0.5);

    // Get analytics summary
    const analyticsResponse = http.get(
      `${BASE_URL}${API_VERSION}/analytics/summary`,
      { headers: getHeaders(token) }
    );

    const analyticsSuccess = check(analyticsResponse, {
      'analytics: status is 200': (r) => r.status === 200,
    });

    if (analyticsResponse.error) {
      connectionErrors.add(1);
    }

    apiResponseTime.add(analyticsResponse.timings.duration);
    trackResponseTime(analyticsResponse.timings.duration);
    analyticsSuccess ? successfulRequests.add(1) : failedRequests.add(1);
  });
}

function paymentOperations(token) {
  group('Payment Operations Flow', () => {
    // List invoices
    const invoicesResponse = http.get(
      `${BASE_URL}${API_VERSION}/payments/invoices?limit=10`,
      { headers: getHeaders(token) }
    );

    const invoicesSuccess = check(invoicesResponse, {
      'invoices: status is 200': (r) => r.status === 200,
    });

    if (invoicesResponse.error) {
      connectionErrors.add(1);
    }

    apiResponseTime.add(invoicesResponse.timings.duration);
    trackResponseTime(invoicesResponse.timings.duration);
    invoicesSuccess ? successfulRequests.add(1) : failedRequests.add(1);

    sleep(1);

    // Get transaction history
    const transactionsResponse = http.get(
      `${BASE_URL}${API_VERSION}/payments/transactions?limit=20`,
      { headers: getHeaders(token) }
    );

    const transactionsSuccess = check(transactionsResponse, {
      'transactions: status is 200': (r) => r.status === 200,
    });

    if (transactionsResponse.error) {
      connectionErrors.add(1);
    }

    apiResponseTime.add(transactionsResponse.timings.duration);
    trackResponseTime(transactionsResponse.timings.duration);
    transactionsSuccess ? successfulRequests.add(1) : failedRequests.add(1);

    sleep(0.5);

    // Check subscription
    const subscriptionResponse = http.get(
      `${BASE_URL}${API_VERSION}/payments/subscriptions/me`,
      { headers: getHeaders(token) }
    );

    const subscriptionSuccess = check(subscriptionResponse, {
      'subscription: status is 200 or 404': (r) =>
        r.status === 200 || r.status === 404,
    });

    if (subscriptionResponse.error) {
      connectionErrors.add(1);
    }

    apiResponseTime.add(subscriptionResponse.timings.duration);
    trackResponseTime(subscriptionResponse.timings.duration);
    subscriptionSuccess ? successfulRequests.add(1) : failedRequests.add(1);
  });
}

export function setup() {
  console.log('Starting Endurance Test (Soak Test)');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Duration: ${TEST_DURATION}`);
  console.log('Sustained Load: 500 concurrent users');

  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`Server not accessible: ${healthCheck.status}`);
  }

  // Establish baseline response time
  const baselineRequests = [];
  for (let i = 0; i < 20; i++) {
    const response = http.get(`${BASE_URL}/health`);
    baselineRequests.push(response.timings.duration);
  }

  baselineResponseTime =
    baselineRequests.reduce((a, b) => a + b, 0) / baselineRequests.length;

  return {
    startTime: new Date().toISOString(),
    baselineResponseTime: baselineResponseTime,
  };
}

export function teardown(data) {
  console.log('Endurance Test Complete');
  console.log(`Started at: ${data.startTime}`);
  console.log(`Baseline response time: ${data.baselineResponseTime.toFixed(2)}ms`);
  console.log(`Ended at: ${new Date().toISOString()}`);
}

export function handleSummary(data) {
  const summary = generateEnduranceSummary(data);

  return {
    'stdout': summary.text,
    '/Users/fp/Desktop/Sovren/packages/backend/performance/reports/endurance-test-results.json': JSON.stringify(data, null, 2),
    '/Users/fp/Desktop/Sovren/packages/backend/performance/reports/endurance-analysis.json': JSON.stringify(summary.analysis, null, 2),
  };
}

function generateEnduranceSummary(data) {
  const duration = data.metrics.http_req_duration;
  const errors = data.metrics.errors;
  const httpReqs = data.metrics.http_reqs;
  const memoryLeak = data.metrics.memory_leak_indicator;
  const connectionErrs = data.metrics.connection_errors;
  const drift = data.metrics.response_time_drift;

  const analysis = {
    totalRequests: httpReqs.values.count,
    requestRate: httpReqs.values.rate,
    testDuration: httpReqs.values.count / httpReqs.values.rate / 60, // minutes

    responseTime: {
      average: duration.values.avg,
      median: duration.values.med,
      p95: duration.values['p(95)'],
      p99: duration.values['p(99)'],
      max: duration.values.max,
    },

    stability: {
      errorRate: errors.values.rate * 100,
      connectionErrors: connectionErrs?.values.count || 0,
      responseTimeDriftPercent: drift?.values.avg || 100,
      memoryLeakDetected: memoryLeak.values.max > memoryLeak.values.min * 3,
    },

    performance: {
      stable: duration.values['p(95)'] < 800,
      errorRateAcceptable: errors.values.rate < 0.001,
      noConnectionIssues: (connectionErrs?.values.count || 0) < 100,
      noMemoryLeaks: memoryLeak.values.max < memoryLeak.values.min * 2,
    },
  };

  const text = `
Endurance Test Summary
${'='.repeat(50)}

Test Duration: ${analysis.testDuration.toFixed(2)} minutes
Total Requests: ${analysis.totalRequests}
Request Rate: ${analysis.requestRate.toFixed(2)} req/s

Response Time Stability:
  Average: ${analysis.responseTime.average.toFixed(2)}ms
  Median: ${analysis.responseTime.median.toFixed(2)}ms
  p95: ${analysis.responseTime.p95.toFixed(2)}ms
  p99: ${analysis.responseTime.p99.toFixed(2)}ms
  Max: ${analysis.responseTime.max.toFixed(2)}ms

Stability Metrics:
  Error Rate: ${analysis.stability.errorRate.toFixed(4)}%
  Connection Errors: ${analysis.stability.connectionErrors}
  Response Time Drift: ${analysis.stability.responseTimeDriftPercent.toFixed(2)}%
  Memory Leak Detected: ${analysis.stability.memoryLeakDetected ? 'YES ⚠️' : 'NO ✓'}

Performance Assessment:
  Response Time Stable: ${analysis.performance.stable ? 'YES ✓' : 'NO ✗'}
  Error Rate Acceptable: ${analysis.performance.errorRateAcceptable ? 'YES ✓' : 'NO ✗'}
  No Connection Issues: ${analysis.performance.noConnectionIssues ? 'YES ✓' : 'NO ✗'}
  No Memory Leaks: ${analysis.performance.noMemoryLeaks ? 'YES ✓' : 'NO ✗'}

Overall Status: ${assessEndurancePerformance(analysis)}

Recommendations:
${generateEnduranceRecommendations(analysis)}
`;

  return { text, analysis };
}

function assessEndurancePerformance(analysis) {
  const checks = [
    analysis.performance.stable,
    analysis.performance.errorRateAcceptable,
    analysis.performance.noConnectionIssues,
    analysis.performance.noMemoryLeaks,
  ];

  const passedChecks = checks.filter((c) => c).length;

  if (passedChecks === checks.length) {
    return '✓ EXCELLENT - System is stable under sustained load';
  } else if (passedChecks >= checks.length - 1) {
    return '⚠️ GOOD - Minor stability issues detected';
  } else {
    return '✗ NEEDS IMPROVEMENT - Stability issues under sustained load';
  }
}

function generateEnduranceRecommendations(analysis) {
  const recommendations = [];

  if (!analysis.performance.stable) {
    recommendations.push('  • Response times are degrading over time');
    recommendations.push('  • Investigate performance bottlenecks');
    recommendations.push('  • Consider implementing performance optimizations');
  }

  if (!analysis.performance.errorRateAcceptable) {
    recommendations.push('  • Error rate is higher than acceptable threshold');
    recommendations.push('  • Investigate root causes of errors');
    recommendations.push('  • Improve error handling and retry mechanisms');
  }

  if (!analysis.performance.noConnectionIssues) {
    recommendations.push('  • Connection pool may be exhausted');
    recommendations.push('  • Increase connection pool size');
    recommendations.push('  • Implement connection pooling best practices');
  }

  if (!analysis.performance.noMemoryLeaks) {
    recommendations.push('  • CRITICAL: Potential memory leak detected');
    recommendations.push('  • Profile application for memory leaks');
    recommendations.push('  • Review resource cleanup and disposal');
    recommendations.push('  • Monitor heap usage over time');
  }

  if (analysis.stability.responseTimeDriftPercent > 150) {
    recommendations.push('  • Response times are significantly slower over time');
    recommendations.push('  • Cache may not be working effectively');
    recommendations.push('  • Database performance may be degrading');
  }

  return recommendations.length > 0
    ? recommendations.join('\n')
    : '  • System is stable and performing well! ✓';
}
