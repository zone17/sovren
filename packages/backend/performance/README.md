# Performance Testing Suite

Comprehensive performance testing for Epic 005 Backend Service Refactoring.

## Overview

This performance testing suite ensures the backend meets strict performance targets across all critical paths:

- **Load Testing**: System behavior under expected load (100-1000 concurrent users)
- **Stress Testing**: Finding system breaking points and bottlenecks
- **Spike Testing**: Response to sudden traffic surges
- **Endurance Testing**: Stability under sustained load (1 hour+)
- **API Performance**: Individual endpoint performance validation
- **Database Performance**: Query and transaction optimization
- **Cache Performance**: Caching layer effectiveness
- **Payment Performance**: Critical payment path testing (100% coverage)

## Performance Targets

### API Response Times

- **Content API**: p95 < 300ms, p99 < 500ms
- **User API**: p95 < 200ms, p99 < 400ms
- **Payment API**: p95 < 500ms, p99 < 1000ms

### Payment System (Critical Path)

- Invoice creation: p95 < 100ms
- Payment processing: p95 < 200ms
- Subscription operations: p95 < 300ms
- Refund processing: p95 < 200ms
- Currency conversion: p95 < 50ms
- Webhook delivery: p95 < 500ms

### Throughput

- API requests: 1,000+ req/sec
- Payment processing: 100+ tx/sec
- Event processing: 10,000+ events/sec
- Cache operations: 50,000+ ops/sec

### Resource Limits

- CPU: <70% average, <90% peak
- Memory: <80% heap, no memory leaks
- Database: <80% connection pool
- Network: <50% bandwidth

## Directory Structure

```
performance/
├── k6/                      # k6 load testing scripts
│   ├── load-test.js        # Load testing (100-1000 users)
│   ├── stress-test.js      # Stress testing (find limits)
│   ├── spike-test.js       # Spike testing (traffic surges)
│   └── endurance-test.js   # Endurance testing (1 hour)
├── benchmarks/             # Benchmark utilities
│   ├── performance-utils.ts  # Shared utilities
│   └── baseline-metrics.json # Baseline performance data
├── reports/                # Generated test reports
└── run-performance-tests.sh # Test runner script
```

## Prerequisites

### Install k6

```bash
# macOS
brew install k6

# Linux
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
choco install k6

# Or download from: https://k6.io/docs/getting-started/installation/
```

### Install Dependencies

```bash
cd packages/backend
npm install
```

## Running Performance Tests

### Quick Test (15 minutes)

Run load test and Jest performance tests:

```bash
cd packages/backend
./performance/run-performance-tests.sh quick
```

### Full Test Suite (45 minutes)

Run all k6 tests and Jest tests:

```bash
./performance/run-performance-tests.sh full
```

### Endurance Test (1 hour)

Run sustained load test:

```bash
./performance/run-performance-tests.sh endurance
```

### Jest Tests Only (5 minutes)

Run only Jest performance tests:

```bash
./performance/run-performance-tests.sh jest
```

### Individual k6 Tests

```bash
# Load test
k6 run --env BASE_URL=http://localhost:3001 performance/k6/load-test.js

# Stress test
k6 run --env BASE_URL=http://localhost:3001 performance/k6/stress-test.js

# Spike test
k6 run --env BASE_URL=http://localhost:3001 performance/k6/spike-test.js

# Endurance test
k6 run --env BASE_URL=http://localhost:3001 performance/k6/endurance-test.js
```

### Individual Jest Tests

```bash
# All performance tests
npm test -- src/__tests__/performance/

# API performance
npm test -- src/__tests__/performance/api-performance.test.ts

# Database performance
npm test -- src/__tests__/performance/database-performance.test.ts

# Cache performance
npm test -- src/__tests__/performance/cache-performance.test.ts

# Payment performance
npm test -- src/__tests__/performance/payment-performance.test.ts
```

## Interpreting Results

### k6 Test Results

k6 tests generate two output files per test:

1. **JSON Results**: `reports/k6-{test}-{timestamp}.json` - Raw timing data
2. **Summary**: `reports/k6-{test}-summary-{timestamp}.json` - Aggregated metrics

Key metrics to watch:

- `http_req_duration`: Response time percentiles
- `http_reqs`: Total requests and throughput
- `checks`: Success rate
- `errors`: Error rate

### Jest Test Results

Jest tests output to console and `reports/jest-performance-{timestamp}.json`.

Each test displays:

- Average, median, p95, p99 response times
- Throughput (operations per second)
- Pass/fail status against targets

### Success Criteria

Tests pass when:

- ✓ p95 response times meet targets
- ✓ p99 response times meet targets
- ✓ Error rate < 0.1%
- ✓ Throughput meets minimums
- ✓ No memory leaks detected
- ✓ No performance regressions vs baseline

## Baseline Metrics

Baseline performance metrics are stored in `benchmarks/baseline-metrics.json`.

To update baseline after improvements:

```bash
# Run full suite
./performance/run-performance-tests.sh full

# Copy results to baseline
cp reports/k6-load-summary-latest.json benchmarks/baseline-metrics.json
```

## CI/CD Integration

Performance tests run automatically in CI/CD pipeline:

### GitHub Actions

```yaml
- name: Run Performance Tests
  run: |
    cd packages/backend
    npm run test:performance
```

### Performance Regression Detection

CI fails if:

- p95/p99 response times exceed targets by >10%
- Throughput drops by >10%
- Error rate exceeds 0.1%

## Troubleshooting

### Server Not Accessible

Ensure backend is running:

```bash
cd packages/backend
npm run dev
```

Default URL: `http://localhost:3001`

### High Error Rates

- Check server logs for errors
- Verify database is running
- Check connection pool limits
- Ensure test data is seeded

### Slow Response Times

- Check database query performance
- Verify cache is working
- Check for N+1 queries
- Profile with `node --inspect`

### Memory Leaks

Run endurance test and monitor:

```bash
# In separate terminal
node --inspect src/server.ts

# Run endurance test
./performance/run-performance-tests.sh endurance

# Monitor with Chrome DevTools
# chrome://inspect
```

## Best Practices

1. **Run on Isolated Environment**: Avoid running on development machine with other processes
2. **Use Consistent Hardware**: Compare results from same environment
3. **Warm Up System**: Run warmup iterations before measurement
4. **Test at Different Times**: Performance can vary by time of day
5. **Monitor System Resources**: Watch CPU, memory, disk I/O during tests
6. **Version Control Results**: Track performance over time
7. **Set Alerts**: Detect regressions early in CI/CD

## Advanced Usage

### Custom Test Duration

```bash
# 30-minute endurance test
k6 run --env DURATION=30m --env BASE_URL=http://localhost:3001 performance/k6/endurance-test.js
```

### Custom Load Levels

Edit k6 test files to adjust:

- Number of virtual users (VUs)
- Ramp-up/ramp-down times
- Test duration
- Think time between requests

### Custom Thresholds

Modify `options.thresholds` in k6 scripts to adjust pass/fail criteria.

## Monitoring During Tests

### Real-Time Metrics

```bash
# Terminal 1: Run backend with metrics
NODE_ENV=production npm start

# Terminal 2: Watch system resources
watch -n 1 'ps aux | grep node | head -5'

# Terminal 3: Run performance test
./performance/run-performance-tests.sh quick
```

### Database Monitoring

```bash
# PostgreSQL
watch -n 1 'psql -c "SELECT count(*) FROM pg_stat_activity;"'

# Redis
redis-cli --stat
```

## Performance Optimization Tips

If tests fail targets:

1. **Database**
   - Add indexes for slow queries
   - Optimize query plans
   - Use connection pooling
   - Enable query result caching

2. **API**
   - Implement response caching
   - Optimize middleware chain
   - Use compression
   - Implement pagination

3. **Application**
   - Profile with `clinic.js`
   - Optimize hot code paths
   - Use worker threads for CPU-intensive tasks
   - Implement request queuing

4. **Infrastructure**
   - Scale horizontally (more instances)
   - Use CDN for static assets
   - Implement load balancing
   - Optimize network configuration

## Resources

- [k6 Documentation](https://k6.io/docs/)
- [Performance Testing Best Practices](https://k6.io/docs/testing-guides/performance-testing-best-practices/)
- [Node.js Performance Guide](https://nodejs.org/en/docs/guides/simple-profiling/)
- [Epic 005 Documentation](../../docs/epic-005/)

## Support

For issues or questions:

1. Check `reports/` directory for detailed error logs
2. Review backend server logs
3. Consult [TROUBLESHOOTING.md](../../docs/TROUBLESHOOTING.md)
4. Open GitHub issue with test results attached
