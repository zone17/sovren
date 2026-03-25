/**
 * K6 Stress Testing Script
 *
 * Finds system breaking points by gradually increasing load:
 * - Identify bottlenecks (CPU, memory, database, network)
 * - Measure degradation curve
 * - Determine max sustainable load
 * - Recovery time after stress
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
const degradationMetric = new Trend('degradation_indicator');

// Test Options - Stress Testing
export const options = {
  stages: [
    // Gradual ramp-up to find breaking point
    { duration: '2m', target: 100 }, // Baseline
    { duration: '3m', target: 500 }, // Normal
    { duration: '3m', target: 1000 }, // Peak
    { duration: '3m', target: 1500 }, // High stress
    { duration: '3m', target: 2000 }, // Very high stress
    { duration: '3m', target: 2500 }, // Extreme stress
    { duration: '3m', target: 3000 }, // Breaking point search

    // Recovery test
    { duration: '2m', target: 500 }, // Drop to normal
    { duration: '3m', target: 100 }, // Drop to baseline
    { duration: '1m', target: 0 }, // Complete ramp-down
  ],
  thresholds: {
    // More lenient thresholds for stress testing
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    errors: ['rate<0.05'], // Allow up to 5% error rate under stress
    http_req_failed: ['rate<0.05'],
  },
  noConnectionReuse: false,
  userAgent: 'K6StressTest/1.0',
};

// Test Data
const testUsers = [
  { email: 'stresstest1@example.com', password: 'TestPass123!' },
  { email: 'stresstest2@example.com', password: 'TestPass123!' },
  { email: 'stresstest3@example.com', password: 'TestPass123!' },
];

function getHeaders(token = null) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
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

  errorRate.add(!success);
  apiResponseTime.add(response.timings.duration);

  // Track degradation
  degradationMetric.add(response.timings.duration);

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
    sleep(0.5);
    return;
  }

  // Mixed workload to stress different components
  const scenario = randomIntBetween(1, 5);

  switch (scenario) {
    case 1:
      // Database-heavy: Complex queries
      databaseHeavyWorkload(token);
      break;
    case 2:
      // CPU-heavy: Data processing
      cpuHeavyWorkload(token);
      break;
    case 3:
      // Memory-heavy: Large payloads
      memoryHeavyWorkload(token);
      break;
    case 4:
      // Network-heavy: Multiple requests
      networkHeavyWorkload(token);
      break;
    case 5:
      // Mixed workload
      mixedWorkload(token);
      break;
  }

  sleep(randomIntBetween(0.5, 2));
}

function databaseHeavyWorkload(token) {
  group('Database Heavy Workload', () => {
    // Complex queries with joins
    const analyticsResponse = http.get(
      `${BASE_URL}${API_VERSION}/analytics/dashboard?detailed=true`,
      { headers: getHeaders(token) }
    );

    check(analyticsResponse, {
      'analytics query: completed': (r) => r.status === 200 || r.status === 503,
    });

    apiResponseTime.add(analyticsResponse.timings.duration);
    degradationMetric.add(analyticsResponse.timings.duration);

    // Transaction history with filters
    const transactionsResponse = http.get(
      `${BASE_URL}${API_VERSION}/payments/transactions?limit=100&sortBy=date`,
      { headers: getHeaders(token) }
    );

    check(transactionsResponse, {
      'transactions query: completed': (r) => r.status === 200 || r.status === 503,
    });

    apiResponseTime.add(transactionsResponse.timings.duration);
    degradationMetric.add(transactionsResponse.timings.duration);
  });
}

function cpuHeavyWorkload(token) {
  group('CPU Heavy Workload', () => {
    // AI recommendations (compute-intensive)
    const recommendationsResponse = http.get(
      `${BASE_URL}${API_VERSION}/ai/recommendations?limit=50`,
      { headers: getHeaders(token) }
    );

    check(recommendationsResponse, {
      'recommendations: completed': (r) => r.status === 200 || r.status === 503,
    });

    apiResponseTime.add(recommendationsResponse.timings.duration);
    degradationMetric.add(recommendationsResponse.timings.duration);

    // Content search (indexing)
    const searchResponse = http.get(`${BASE_URL}${API_VERSION}/content/search?q=test&limit=50`, {
      headers: getHeaders(token),
    });

    check(searchResponse, {
      'search: completed': (r) => r.status === 200 || r.status === 503,
    });

    apiResponseTime.add(searchResponse.timings.duration);
    degradationMetric.add(searchResponse.timings.duration);
  });
}

function memoryHeavyWorkload(token) {
  group('Memory Heavy Workload', () => {
    // Large content list
    const contentResponse = http.get(
      `${BASE_URL}${API_VERSION}/content?limit=200&includeDetails=true`,
      { headers: getHeaders(token) }
    );

    check(contentResponse, {
      'large content list: completed': (r) => r.status === 200 || r.status === 503,
    });

    apiResponseTime.add(contentResponse.timings.duration);
    degradationMetric.add(contentResponse.timings.duration);

    // Large user list
    const usersResponse = http.get(
      `${BASE_URL}${API_VERSION}/users?limit=200&includeDetails=true`,
      { headers: getHeaders(token) }
    );

    check(usersResponse, {
      'large user list: completed': (r) => r.status === 200 || r.status === 503,
    });

    apiResponseTime.add(usersResponse.timings.duration);
    degradationMetric.add(usersResponse.timings.duration);
  });
}

function networkHeavyWorkload(token) {
  group('Network Heavy Workload', () => {
    // Multiple parallel requests
    const requests = http.batch([
      ['GET', `${BASE_URL}${API_VERSION}/content`, null, { headers: getHeaders(token) }],
      ['GET', `${BASE_URL}${API_VERSION}/users/me`, null, { headers: getHeaders(token) }],
      ['GET', `${BASE_URL}${API_VERSION}/payments/invoices`, null, { headers: getHeaders(token) }],
      ['GET', `${BASE_URL}${API_VERSION}/analytics/summary`, null, { headers: getHeaders(token) }],
      ['GET', `${BASE_URL}/health`, null, { headers: getHeaders() }],
    ]);

    requests.forEach((response, index) => {
      check(response, {
        [`parallel request ${index}: completed`]: (r) => r.status === 200 || r.status === 503,
      });

      apiResponseTime.add(response.timings.duration);
      degradationMetric.add(response.timings.duration);
    });
  });
}

function mixedWorkload(token) {
  group('Mixed Workload', () => {
    // Combine different types of operations
    const operations = [
      http.get(`${BASE_URL}${API_VERSION}/content?limit=20`, { headers: getHeaders(token) }),
      http.get(`${BASE_URL}${API_VERSION}/users/me`, { headers: getHeaders(token) }),
      http.get(`${BASE_URL}${API_VERSION}/analytics/summary`, { headers: getHeaders(token) }),
    ];

    operations.forEach((response, index) => {
      check(response, {
        [`mixed op ${index}: completed`]: (r) => r.status === 200 || r.status === 503,
      });

      apiResponseTime.add(response.timings.duration);
      degradationMetric.add(response.timings.duration);
    });
  });
}

export function setup() {
  console.log('Starting Stress Test');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('Gradually increasing load to find breaking point...');

  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`Server not accessible: ${healthCheck.status}`);
  }

  return {
    startTime: new Date().toISOString(),
    baselineResponseTime: healthCheck.timings.duration,
  };
}

export function teardown(data) {
  console.log('Stress Test Complete');
  console.log(`Started at: ${data.startTime}`);
  console.log(`Baseline response time: ${data.baselineResponseTime}ms`);
  console.log(`Ended at: ${new Date().toISOString()}`);
}

export function handleSummary(data) {
  const summary = generateStressSummary(data);

  return {
    stdout: summary.text,
    '/Users/fp/Desktop/Sovren/packages/backend/performance/reports/stress-test-results.json':
      JSON.stringify(data, null, 2),
    '/Users/fp/Desktop/Sovren/packages/backend/performance/reports/stress-test-summary.json':
      JSON.stringify(summary.analysis, null, 2),
  };
}

function generateStressSummary(data) {
  const duration = data.metrics.http_req_duration;
  const degradation = data.metrics.degradation_indicator;
  const errors = data.metrics.errors;
  const httpReqs = data.metrics.http_reqs;

  // Analyze breaking point
  const breakingPointAnalysis = {
    maxConcurrentUsers: Math.max(...Object.values(data.metrics.vus?.values || {})),
    totalRequests: httpReqs.values.count,
    averageRequestRate: httpReqs.values.rate,
    peakResponseTime: duration.values.max,
    degradationFactor: degradation.values.max / degradation.values.min,
    errorRateAtPeak: errors.values.rate,
    bottleneckIndicators: {
      highResponseTime: duration.values['p(99)'] > 5000,
      highErrorRate: errors.values.rate > 0.05,
      slowAverageResponse: duration.values.avg > 1000,
    },
  };

  const text = `
Stress Test Summary
${'='.repeat(50)}

Breaking Point Analysis:
  Max Concurrent Users: ${breakingPointAnalysis.maxConcurrentUsers}
  Total Requests: ${breakingPointAnalysis.totalRequests}
  Request Rate: ${breakingPointAnalysis.averageRequestRate.toFixed(2)} req/s

Response Time Under Stress:
  Average: ${duration.values.avg.toFixed(2)}ms
  p95: ${duration.values['p(95)'].toFixed(2)}ms
  p99: ${duration.values['p(99)'].toFixed(2)}ms
  Peak: ${duration.values.max.toFixed(2)}ms

Degradation Analysis:
  Degradation Factor: ${breakingPointAnalysis.degradationFactor.toFixed(2)}x
  Error Rate at Peak: ${(breakingPointAnalysis.errorRateAtPeak * 100).toFixed(3)}%

Bottleneck Indicators:
  High Response Time: ${breakingPointAnalysis.bottleneckIndicators.highResponseTime ? 'YES ⚠️' : 'NO ✓'}
  High Error Rate: ${breakingPointAnalysis.bottleneckIndicators.highErrorRate ? 'YES ⚠️' : 'NO ✓'}
  Slow Average Response: ${breakingPointAnalysis.bottleneckIndicators.slowAverageResponse ? 'YES ⚠️' : 'NO ✓'}

Recommendations:
${generateRecommendations(breakingPointAnalysis)}
`;

  return {
    text,
    analysis: breakingPointAnalysis,
  };
}

function generateRecommendations(analysis) {
  const recommendations = [];

  if (analysis.bottleneckIndicators.highResponseTime) {
    recommendations.push('  • Scale horizontally: Add more application instances');
    recommendations.push('  • Optimize database queries: Add indexes, use caching');
  }

  if (analysis.bottleneckIndicators.highErrorRate) {
    recommendations.push('  • Implement circuit breakers for failing services');
    recommendations.push('  • Add request queuing to handle burst traffic');
    recommendations.push('  • Increase connection pool sizes');
  }

  if (analysis.bottleneckIndicators.slowAverageResponse) {
    recommendations.push('  • Profile application for performance bottlenecks');
    recommendations.push('  • Implement caching for frequently accessed data');
    recommendations.push('  • Optimize middleware and request processing');
  }

  if (analysis.degradationFactor > 10) {
    recommendations.push('  • System shows severe degradation under load');
    recommendations.push('  • Consider architectural changes (microservices, load balancing)');
  }

  return recommendations.length > 0
    ? recommendations.join('\n')
    : '  • System handled stress well! Consider increasing load to find limits.';
}
