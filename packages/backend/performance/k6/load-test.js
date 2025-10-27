/**
 * K6 Load Testing Script
 *
 * Tests system behavior under expected load:
 * - 100 concurrent users (baseline)
 * - 500 concurrent users (normal load)
 * - 1,000 concurrent users (peak load)
 *
 * Performance Targets:
 * - Response time: p95 < 500ms, p99 < 1000ms
 * - Throughput: 1,000+ req/sec
 * - Error rate: < 0.1%
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const API_VERSION = '/api/v1';

// Custom Metrics
const errorRate = new Rate('errors');
const apiResponseTime = new Trend('api_response_time');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');

// Test Options - Load Testing
export const options = {
  stages: [
    // Baseline: 100 concurrent users
    { duration: '2m', target: 100 },  // Ramp-up to baseline
    { duration: '5m', target: 100 },  // Hold baseline

    // Normal Load: 500 concurrent users
    { duration: '2m', target: 500 },  // Ramp-up to normal
    { duration: '10m', target: 500 }, // Hold normal load

    // Peak Load: 1,000 concurrent users
    { duration: '2m', target: 1000 }, // Ramp-up to peak
    { duration: '5m', target: 1000 }, // Hold peak load

    // Ramp-down
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    // Response Time Targets
    'http_req_duration': [
      'p(95)<500',   // 95% of requests < 500ms
      'p(99)<1000'   // 99% of requests < 1000ms
    ],
    'api_response_time': [
      'p(95)<500',
      'p(99)<1000'
    ],

    // Error Rate Target
    'errors': ['rate<0.001'],  // < 0.1% error rate
    'http_req_failed': ['rate<0.001'],

    // Success Rate
    'checks': ['rate>0.999'],  // > 99.9% success rate

    // Throughput (requests per second)
    'http_reqs': ['rate>1000'], // 1000+ req/sec
  },
  noConnectionReuse: false,
  userAgent: 'K6LoadTest/1.0',
};

// Test Data
const testUsers = [
  { email: 'loadtest1@example.com', password: 'TestPass123!' },
  { email: 'loadtest2@example.com', password: 'TestPass123!' },
  { email: 'loadtest3@example.com', password: 'TestPass123!' },
];

// Shared Headers
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

// Authentication
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
    'auth: has token': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.token !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  errorRate.add(!success);
  apiResponseTime.add(response.timings.duration);

  if (success) {
    successfulRequests.add(1);
    const body = JSON.parse(response.body);
    return body.token;
  } else {
    failedRequests.add(1);
    return null;
  }
}

// Test Scenarios
export default function () {
  // Get auth token
  const token = authenticate();

  if (!token) {
    console.error('Authentication failed, skipping user flow');
    sleep(1);
    return;
  }

  // Content API Tests
  group('Content API', () => {
    // List content
    const listResponse = http.get(
      `${BASE_URL}${API_VERSION}/content?limit=20`,
      { headers: getHeaders(token) }
    );

    const listSuccess = check(listResponse, {
      'content list: status is 200': (r) => r.status === 200,
      'content list: has items': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.data) || Array.isArray(body.items);
        } catch (e) {
          return false;
        }
      },
      'content list: response time OK': (r) => r.timings.duration < 500,
    });

    errorRate.add(!listSuccess);
    apiResponseTime.add(listResponse.timings.duration);
    listSuccess ? successfulRequests.add(1) : failedRequests.add(1);

    // Get single content item (if list succeeded)
    if (listSuccess) {
      const contentId = 'test-content-id-' + randomIntBetween(1, 1000);
      const getResponse = http.get(
        `${BASE_URL}${API_VERSION}/content/${contentId}`,
        { headers: getHeaders(token) }
      );

      const getSuccess = check(getResponse, {
        'content get: status is 200 or 404': (r) =>
          r.status === 200 || r.status === 404,
        'content get: response time OK': (r) => r.timings.duration < 300,
      });

      errorRate.add(!getSuccess);
      apiResponseTime.add(getResponse.timings.duration);
      getSuccess ? successfulRequests.add(1) : failedRequests.add(1);
    }
  });

  // User API Tests
  group('User API', () => {
    // Get user profile
    const profileResponse = http.get(
      `${BASE_URL}${API_VERSION}/users/me`,
      { headers: getHeaders(token) }
    );

    const profileSuccess = check(profileResponse, {
      'user profile: status is 200': (r) => r.status === 200,
      'user profile: has user data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.id !== undefined || body.user?.id !== undefined;
        } catch (e) {
          return false;
        }
      },
      'user profile: response time OK': (r) => r.timings.duration < 200,
    });

    errorRate.add(!profileSuccess);
    apiResponseTime.add(profileResponse.timings.duration);
    profileSuccess ? successfulRequests.add(1) : failedRequests.add(1);

    // Search users
    const searchResponse = http.get(
      `${BASE_URL}${API_VERSION}/users/search?q=test&limit=10`,
      { headers: getHeaders(token) }
    );

    const searchSuccess = check(searchResponse, {
      'user search: status is 200': (r) => r.status === 200,
      'user search: response time OK': (r) => r.timings.duration < 400,
    });

    errorRate.add(!searchSuccess);
    apiResponseTime.add(searchResponse.timings.duration);
    searchSuccess ? successfulRequests.add(1) : failedRequests.add(1);
  });

  // Payment API Tests (Read Operations)
  group('Payment API - Read Operations', () => {
    // List invoices
    const invoicesResponse = http.get(
      `${BASE_URL}${API_VERSION}/payments/invoices?limit=10`,
      { headers: getHeaders(token) }
    );

    const invoicesSuccess = check(invoicesResponse, {
      'invoices list: status is 200': (r) => r.status === 200,
      'invoices list: response time OK': (r) => r.timings.duration < 500,
    });

    errorRate.add(!invoicesSuccess);
    apiResponseTime.add(invoicesResponse.timings.duration);
    invoicesSuccess ? successfulRequests.add(1) : failedRequests.add(1);

    // Get transaction history
    const transactionsResponse = http.get(
      `${BASE_URL}${API_VERSION}/payments/transactions?limit=20`,
      { headers: getHeaders(token) }
    );

    const transactionsSuccess = check(transactionsResponse, {
      'transactions: status is 200': (r) => r.status === 200,
      'transactions: response time OK': (r) => r.timings.duration < 500,
    });

    errorRate.add(!transactionsSuccess);
    apiResponseTime.add(transactionsResponse.timings.duration);
    transactionsSuccess ? successfulRequests.add(1) : failedRequests.add(1);

    // Get subscription status
    const subscriptionResponse = http.get(
      `${BASE_URL}${API_VERSION}/payments/subscriptions/me`,
      { headers: getHeaders(token) }
    );

    const subscriptionSuccess = check(subscriptionResponse, {
      'subscription: status is 200 or 404': (r) =>
        r.status === 200 || r.status === 404,
      'subscription: response time OK': (r) => r.timings.duration < 300,
    });

    errorRate.add(!subscriptionSuccess);
    apiResponseTime.add(subscriptionResponse.timings.duration);
    subscriptionSuccess ? successfulRequests.add(1) : failedRequests.add(1);
  });

  // Analytics API Tests
  group('Analytics API', () => {
    // Get analytics dashboard
    const analyticsResponse = http.get(
      `${BASE_URL}${API_VERSION}/analytics/dashboard`,
      { headers: getHeaders(token) }
    );

    const analyticsSuccess = check(analyticsResponse, {
      'analytics: status is 200': (r) => r.status === 200,
      'analytics: response time OK': (r) => r.timings.duration < 800,
    });

    errorRate.add(!analyticsSuccess);
    apiResponseTime.add(analyticsResponse.timings.duration);
    analyticsSuccess ? successfulRequests.add(1) : failedRequests.add(1);
  });

  // Health Check
  group('Health Check', () => {
    const healthResponse = http.get(`${BASE_URL}/health`);

    const healthSuccess = check(healthResponse, {
      'health: status is 200': (r) => r.status === 200,
      'health: response time OK': (r) => r.timings.duration < 100,
    });

    errorRate.add(!healthSuccess);
    apiResponseTime.add(healthResponse.timings.duration);
    healthSuccess ? successfulRequests.add(1) : failedRequests.add(1);
  });

  // Think time between requests (simulate real user behavior)
  sleep(randomIntBetween(1, 3));
}

// Setup function (runs once at start)
export function setup() {
  console.log('Starting Load Test');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('Test Stages: Baseline (100) → Normal (500) → Peak (1000)');

  // Verify server is accessible
  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`Server not accessible: ${healthCheck.status}`);
  }

  return { startTime: new Date().toISOString() };
}

// Teardown function (runs once at end)
export function teardown(data) {
  console.log('Load Test Complete');
  console.log(`Started at: ${data.startTime}`);
  console.log(`Ended at: ${new Date().toISOString()}`);
}

// Handle Summary (custom reporting)
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    '/Users/fp/Desktop/Sovren/packages/backend/performance/reports/load-test-results.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data, options = {}) {
  const indent = options.indent || '';
  const lines = [];

  lines.push(`${indent}Load Test Summary`);
  lines.push(`${indent}${'='.repeat(50)}`);
  lines.push('');

  // Request metrics
  const httpReqs = data.metrics.http_reqs;
  lines.push(`${indent}Total Requests: ${httpReqs.values.count}`);
  lines.push(`${indent}Request Rate: ${httpReqs.values.rate.toFixed(2)} req/s`);
  lines.push('');

  // Response time metrics
  const duration = data.metrics.http_req_duration;
  lines.push(`${indent}Response Times:`);
  lines.push(`${indent}  Average: ${duration.values.avg.toFixed(2)}ms`);
  lines.push(`${indent}  Median:  ${duration.values.med.toFixed(2)}ms`);
  lines.push(`${indent}  p95:     ${duration.values['p(95)'].toFixed(2)}ms`);
  lines.push(`${indent}  p99:     ${duration.values['p(99)'].toFixed(2)}ms`);
  lines.push(`${indent}  Max:     ${duration.values.max.toFixed(2)}ms`);
  lines.push('');

  // Success/Error metrics
  const checks = data.metrics.checks;
  const errors = data.metrics.errors;
  lines.push(`${indent}Success Rate: ${(checks.values.rate * 100).toFixed(2)}%`);
  lines.push(`${indent}Error Rate: ${(errors.values.rate * 100).toFixed(3)}%`);
  lines.push('');

  // Pass/Fail status
  const passed = Object.entries(data.metrics).every(([name, metric]) => {
    if (!metric.thresholds) return true;
    return Object.values(metric.thresholds).every(t => t.ok);
  });

  lines.push(`${indent}Overall Status: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
  lines.push('');

  return lines.join('\n');
}
