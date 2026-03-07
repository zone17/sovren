/**
 * K6 Spike Testing Script
 *
 * Tests system behavior under sudden traffic surges:
 * - Normal load (100 users) → spike (1,000 users) → normal
 * - Rapid scaling response
 * - Auto-recovery mechanisms
 * - Rate limiting effectiveness
 * - Circuit breaker activation
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const API_VERSION = '/api/v1';

// Custom Metrics
const errorRate = new Rate('errors');
const apiResponseTime = new Trend('api_response_time');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');
const rateLimitHits = new Counter('rate_limit_hits');
const circuitBreakerTrips = new Counter('circuit_breaker_trips');
const recoveryTime = new Gauge('recovery_time_seconds');

// Test Options - Spike Testing
export const options = {
  stages: [
    // Baseline load
    { duration: '2m', target: 100 }, // Normal operation

    // First spike
    { duration: '30s', target: 1000 }, // Rapid spike to 1000
    { duration: '1m', target: 1000 }, // Hold spike
    { duration: '30s', target: 100 }, // Drop back to normal

    // Recovery period
    { duration: '2m', target: 100 }, // Monitor recovery

    // Second spike (larger)
    { duration: '30s', target: 1500 }, // Even larger spike
    { duration: '1m', target: 1500 }, // Hold spike
    { duration: '30s', target: 100 }, // Drop back to normal

    // Final recovery
    { duration: '2m', target: 100 }, // Monitor recovery
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    // Spike-specific thresholds
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    errors: ['rate<0.02'], // Allow 2% error rate during spikes
    http_req_failed: ['rate<0.02'],
    api_response_time: ['p(95)<1000'],

    // Rate limiting should activate
    rate_limit_hits: ['count>0'],

    // Most requests should still succeed
    successful_requests: ['count>0'],
  },
  noConnectionReuse: false,
  userAgent: 'K6SpikeTest/1.0',
};

// Test Data
const testUsers = [
  { email: 'spiketest1@example.com', password: 'TestPass123!' },
  { email: 'spiketest2@example.com', password: 'TestPass123!' },
  { email: 'spiketest3@example.com', password: 'TestPass123!' },
];

let spikeStartTime = null;
let normalResponseTime = 0;

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
    'auth: not rate limited': (r) => r.status !== 429,
  });

  // Track rate limiting
  if (response.status === 429) {
    rateLimitHits.add(1);
  }

  // Track circuit breaker
  if (response.status === 503) {
    circuitBreakerTrips.add(1);
  }

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

export default function () {
  const token = authenticate();

  if (!token) {
    sleep(randomIntBetween(0.5, 1));
    return;
  }

  // Run various API operations
  spikeWorkload(token);

  // Minimal think time during spikes
  sleep(randomIntBetween(0.1, 0.5));
}

function spikeWorkload(token) {
  // Critical path operations that must work during spikes
  group('Spike Critical Path', () => {
    // Health check (should always work)
    const healthResponse = http.get(`${BASE_URL}/health`);

    check(healthResponse, {
      'health: accessible during spike': (r) => r.status === 200,
      'health: fast response': (r) => r.timings.duration < 200,
    });

    apiResponseTime.add(healthResponse.timings.duration);

    // User profile (cached, should be fast)
    const profileResponse = http.get(`${BASE_URL}${API_VERSION}/users/me`, {
      headers: getHeaders(token),
    });

    const profileSuccess = check(profileResponse, {
      'profile: status is 200 or 429': (r) => r.status === 200 || r.status === 429,
      'profile: responds within limit': (r) => r.timings.duration < 1000,
    });

    if (profileResponse.status === 429) {
      rateLimitHits.add(1);
    }

    if (profileResponse.status === 503) {
      circuitBreakerTrips.add(1);
    }

    apiResponseTime.add(profileResponse.timings.duration);
    profileSuccess ? successfulRequests.add(1) : failedRequests.add(1);

    // Content list (should handle load gracefully)
    const contentResponse = http.get(`${BASE_URL}${API_VERSION}/content?limit=10`, {
      headers: getHeaders(token),
    });

    const contentSuccess = check(contentResponse, {
      'content: status is 200, 429, or 503': (r) =>
        r.status === 200 || r.status === 429 || r.status === 503,
      'content: responds': (r) => r.timings.duration < 2000,
    });

    if (contentResponse.status === 429) {
      rateLimitHits.add(1);
    }

    if (contentResponse.status === 503) {
      circuitBreakerTrips.add(1);
    }

    apiResponseTime.add(contentResponse.timings.duration);
    contentSuccess ? successfulRequests.add(1) : failedRequests.add(1);
  });

  // Non-critical operations (acceptable to fail during spike)
  group('Spike Non-Critical Operations', () => {
    const scenario = randomIntBetween(1, 3);

    if (scenario === 1) {
      // Analytics (can be slow/cached)
      const analyticsResponse = http.get(`${BASE_URL}${API_VERSION}/analytics/summary`, {
        headers: getHeaders(token),
      });

      check(analyticsResponse, {
        'analytics: completed or rate limited': (r) =>
          r.status === 200 || r.status === 429 || r.status === 503,
      });

      if (analyticsResponse.status === 429) {
        rateLimitHits.add(1);
      }

      apiResponseTime.add(analyticsResponse.timings.duration);
    } else if (scenario === 2) {
      // Search (can be throttled)
      const searchResponse = http.get(`${BASE_URL}${API_VERSION}/content/search?q=test`, {
        headers: getHeaders(token),
      });

      check(searchResponse, {
        'search: completed or rate limited': (r) =>
          r.status === 200 || r.status === 429 || r.status === 503,
      });

      if (searchResponse.status === 429) {
        rateLimitHits.add(1);
      }

      apiResponseTime.add(searchResponse.timings.duration);
    } else {
      // Payment history (can be slow)
      const paymentsResponse = http.get(
        `${BASE_URL}${API_VERSION}/payments/transactions?limit=10`,
        { headers: getHeaders(token) }
      );

      check(paymentsResponse, {
        'payments: completed or rate limited': (r) =>
          r.status === 200 || r.status === 429 || r.status === 503,
      });

      if (paymentsResponse.status === 429) {
        rateLimitHits.add(1);
      }

      apiResponseTime.add(paymentsResponse.timings.duration);
    }
  });
}

export function setup() {
  console.log('Starting Spike Test');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('Testing: Normal (100) → Spike (1000) → Normal → Spike (1500) → Normal');

  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`Server not accessible: ${healthCheck.status}`);
  }

  // Measure baseline performance
  const baselineRequests = [];
  for (let i = 0; i < 10; i++) {
    const response = http.get(`${BASE_URL}/health`);
    baselineRequests.push(response.timings.duration);
  }

  normalResponseTime = baselineRequests.reduce((a, b) => a + b, 0) / baselineRequests.length;

  return {
    startTime: new Date().toISOString(),
    baselineResponseTime: normalResponseTime,
  };
}

export function teardown(data) {
  console.log('Spike Test Complete');
  console.log(`Started at: ${data.startTime}`);
  console.log(`Baseline response time: ${data.baselineResponseTime.toFixed(2)}ms`);
  console.log(`Ended at: ${new Date().toISOString()}`);
}

export function handleSummary(data) {
  const summary = generateSpikeSummary(data);

  return {
    stdout: summary.text,
    '/Users/fp/Desktop/Sovren/packages/backend/performance/reports/spike-test-results.json':
      JSON.stringify(data, null, 2),
    '/Users/fp/Desktop/Sovren/packages/backend/performance/reports/spike-test-analysis.json':
      JSON.stringify(summary.analysis, null, 2),
  };
}

function generateSpikeSummary(data) {
  const duration = data.metrics.http_req_duration;
  const errors = data.metrics.errors;
  const httpReqs = data.metrics.http_reqs;
  const rateLimits = data.metrics.rate_limit_hits;
  const circuitBreakers = data.metrics.circuit_breaker_trips;
  const successful = data.metrics.successful_requests;
  const failed = data.metrics.failed_requests;

  const analysis = {
    totalRequests: httpReqs.values.count,
    successfulRequests: successful.values.count,
    failedRequests: failed.values.count,
    successRate: (successful.values.count / httpReqs.values.count) * 100,
    errorRate: errors.values.rate * 100,

    responseTime: {
      average: duration.values.avg,
      median: duration.values.med,
      p95: duration.values['p(95)'],
      p99: duration.values['p(99)'],
      max: duration.values.max,
    },

    protectionMechanisms: {
      rateLimitActivations: rateLimits?.values.count || 0,
      circuitBreakerTrips: circuitBreakers?.values.count || 0,
      rateLimitEffective: (rateLimits?.values.count || 0) > 0,
      circuitBreakerEffective: (circuitBreakers?.values.count || 0) > 0,
    },

    spikeHandling: {
      systemRemainedResponsive: duration.values['p(95)'] < 2000,
      errorRateAcceptable: errors.values.rate < 0.05,
      protectionActivated:
        (rateLimits?.values.count || 0) > 0 || (circuitBreakers?.values.count || 0) > 0,
    },
  };

  const text = `
Spike Test Summary
${'='.repeat(50)}

Request Statistics:
  Total Requests: ${analysis.totalRequests}
  Successful: ${analysis.successfulRequests} (${analysis.successRate.toFixed(2)}%)
  Failed: ${analysis.failedRequests}
  Error Rate: ${analysis.errorRate.toFixed(3)}%

Response Times During Spikes:
  Average: ${analysis.responseTime.average.toFixed(2)}ms
  Median: ${analysis.responseTime.median.toFixed(2)}ms
  p95: ${analysis.responseTime.p95.toFixed(2)}ms
  p99: ${analysis.responseTime.p99.toFixed(2)}ms
  Max: ${analysis.responseTime.max.toFixed(2)}ms

Protection Mechanisms:
  Rate Limit Activations: ${analysis.protectionMechanisms.rateLimitActivations}
  Circuit Breaker Trips: ${analysis.protectionMechanisms.circuitBreakerTrips}
  Rate Limiting Active: ${analysis.protectionMechanisms.rateLimitEffective ? 'YES ✓' : 'NO ⚠️'}
  Circuit Breaker Active: ${analysis.protectionMechanisms.circuitBreakerEffective ? 'YES ✓' : 'NO ⚠️'}

Spike Handling Assessment:
  System Remained Responsive: ${analysis.spikeHandling.systemRemainedResponsive ? 'YES ✓' : 'NO ✗'}
  Error Rate Acceptable: ${analysis.spikeHandling.errorRateAcceptable ? 'YES ✓' : 'NO ✗'}
  Protection Activated: ${analysis.spikeHandling.protectionActivated ? 'YES ✓' : 'NO ⚠️'}

Overall Status: ${assessSpikePerformance(analysis)}

Recommendations:
${generateSpikeRecommendations(analysis)}
`;

  return { text, analysis };
}

function assessSpikePerformance(analysis) {
  const checks = [
    analysis.spikeHandling.systemRemainedResponsive,
    analysis.spikeHandling.errorRateAcceptable,
    analysis.successRate > 95,
  ];

  const passedChecks = checks.filter((c) => c).length;

  if (passedChecks === checks.length) {
    return '✓ EXCELLENT - System handled spikes well';
  } else if (passedChecks >= checks.length - 1) {
    return '⚠️ GOOD - Minor issues during spikes';
  } else {
    return '✗ NEEDS IMPROVEMENT - System struggled with spikes';
  }
}

function generateSpikeRecommendations(analysis) {
  const recommendations = [];

  if (!analysis.spikeHandling.systemRemainedResponsive) {
    recommendations.push('  • Implement request queuing to handle burst traffic');
    recommendations.push('  • Add more application instances for horizontal scaling');
    recommendations.push('  • Optimize critical paths for faster response times');
  }

  if (!analysis.spikeHandling.errorRateAcceptable) {
    recommendations.push('  • Investigate root causes of errors during spikes');
    recommendations.push('  • Improve error handling and retry mechanisms');
    recommendations.push('  • Consider implementing backpressure mechanisms');
  }

  if (!analysis.protectionMechanisms.rateLimitEffective) {
    recommendations.push('  • Configure rate limiting to protect against traffic spikes');
    recommendations.push('  • Implement adaptive rate limiting based on system load');
  }

  if (!analysis.protectionMechanisms.circuitBreakerEffective && analysis.errorRate > 1) {
    recommendations.push('  • Implement circuit breakers for failing dependencies');
    recommendations.push('  • Add health checks and automatic service degradation');
  }

  if (analysis.successRate < 95) {
    recommendations.push('  • Current success rate is below target (95%)');
    recommendations.push('  • Investigate failed requests and implement fixes');
  }

  return recommendations.length > 0
    ? recommendations.join('\n')
    : '  • System handled spikes excellently! ✓';
}
