# Testing Guide

**Epic 005 Backend Service Refactoring - Comprehensive Testing Strategy**

---

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Test Types](#test-types)
3. [Unit Testing](#unit-testing)
4. [Integration Testing](#integration-testing)
5. [E2E Testing](#e2e-testing)
6. [Performance Testing](#performance-testing)
7. [Test Data Factories](#test-data-factories)
8. [Running Tests](#running-tests)
9. [Debugging Tests](#debugging-tests)
10. [CI/CD Integration](#cicd-integration)

---

## Testing Philosophy

### Test Pyramid

```
        /\
       /E2E\      5% - End-to-end (slow, high confidence)
      /------\
     / Integ  \   15% - Integration (medium speed)
    /----------\
   /   Unit     \ 80% - Unit tests (fast, focused)
  /--------------\
```

### Core Principles

1. **Test First (TDD)**: Write tests before implementation
2. **Fast Feedback**: Tests should run quickly
3. **Isolated**: Tests don't depend on each other
4. **Repeatable**: Same input = same output
5. **Comprehensive**: Cover happy path, edge cases, errors

### Coverage Requirements

| Component            | Minimum Coverage | Target Coverage       |
| -------------------- | ---------------- | --------------------- |
| **Payment Services** | 100%             | 100% (non-negotiable) |
| **Auth Services**    | 95%              | 100%                  |
| **Content Services** | 85%              | 95%                   |
| **Utilities**        | 80%              | 90%                   |
| **Global Target**    | 85%              | 95%                   |

---

## Test Types

### Unit Tests

**Purpose**: Test individual functions/methods in isolation

**Characteristics**:

- Extremely fast (< 1ms each)
- No external dependencies
- Use mocks for all dependencies
- Test one thing at a time

```typescript
// Example: Unit test for utility function
describe('calculateFee', () => {
  it('should calculate 1% fee correctly', () => {
    expect(calculateFee(1000, 0.01)).toBe(10);
  });

  it('should round to nearest satoshi', () => {
    expect(calculateFee(1005, 0.01)).toBe(10);
  });
});
```

### Integration Tests

**Purpose**: Test component interactions

**Characteristics**:

- Medium speed (< 1s each)
- Real database (test database)
- Real Redis (test instance)
- Test service + repository + database

```typescript
// Example: Integration test
describe('PaymentService Integration', () => {
  let service: PaymentService;
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await TestDatabase.create();
    service = new PaymentService(testDb.getConnection());
  });

  it('should persist payment to database', async () => {
    const payment = await service.createPayment({
      amount: 1000,
      userId: 'test-user',
    });

    const retrieved = await testDb.query('SELECT * FROM payments WHERE id = $1', [payment.id]);

    expect(retrieved.rows[0]).toMatchObject({
      amount: 1000,
      user_id: 'test-user',
    });
  });
});
```

### End-to-End Tests

**Purpose**: Test complete user flows

**Characteristics**:

- Slow (seconds to minutes)
- Full application stack
- Real HTTP requests
- Playwright or Cypress

```typescript
// Example: E2E test
test('user can create and pay for subscription', async ({ page }) => {
  await page.goto('/creators/alice');
  await page.click('text=Subscribe');
  await page.fill('[name=amount]', '10000');
  await page.click('text=Pay with Lightning');

  // Wait for payment confirmation
  await page.waitForSelector('text=Payment Successful');

  expect(await page.textContent('.subscription-status')).toBe('Active');
});
```

---

## Unit Testing

### Vitest Configuration

```typescript
// vitest.config.ts (multi-project configuration at project root)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'backend',
          include: ['packages/backend/src/**/*.test.ts'],
          environment: 'node',
          coverage: {
            thresholds: {
              branches: 85,
              functions: 85,
              lines: 85,
              statements: 85,
            },
          },
        },
      },
    ],
  },
});
```

### Test Structure (AAA Pattern)

```typescript
describe('RefundService', () => {
  describe('createRefund', () => {
    it('should create full refund for valid transaction', async () => {
      // ARRANGE: Set up test data and mocks
      const mockTransaction = {
        id: 'tx_123',
        amount: 10000,
        status: 'completed',
      };
      mockPaymentService.getTransaction.mockResolvedValue(mockTransaction);

      // ACT: Execute the function under test
      const refund = await refundService.createRefund({
        transactionId: 'tx_123',
        reason: RefundReason.CUSTOMER_REQUEST,
      });

      // ASSERT: Verify results
      expect(refund).toMatchObject({
        transactionId: 'tx_123',
        amount: 10000,
        status: 'pending',
      });
      expect(mockEventBus.emit).toHaveBeenCalledWith('refund.created', expect.any(Object));
    });

    it('should throw error for already refunded transaction', async () => {
      mockPaymentService.getTransaction.mockResolvedValue({
        id: 'tx_123',
        status: 'refunded',
      });

      await expect(refundService.createRefund({ transactionId: 'tx_123' })).rejects.toThrow(
        'Transaction already refunded'
      );
    });
  });
});
```

### Mocking Dependencies

```typescript
// Create mock implementations
const mockLogger: Mocked<ILogger> = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

const mockEventBus: Mocked<IEventBus> = {
  emit: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
};

const mockCache: Mocked<ICacheService> = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  deletePattern: vi.fn(),
};

// Use in tests
beforeEach(() => {
  service = new MyService(mockLogger, mockEventBus, mockCache);
});

afterEach(() => {
  vi.clearAllMocks();
});
```

### Testing Async Code

```typescript
// ✅ GOOD: Use async/await
it('should resolve promise', async () => {
  const result = await service.asyncMethod();
  expect(result).toBe('expected');
});

// ✅ GOOD: Test rejection
it('should reject promise', async () => {
  await expect(service.failingMethod()).rejects.toThrow('Error message');
});

// ❌ BAD: Forgetting await
it('should resolve promise', () => {
  service.asyncMethod(); // Promise not awaited!
  expect(result).toBe('expected'); // result is undefined
});
```

---

## Integration Testing

### Test Database Setup

```typescript
// packages/backend/src/test-utils/TestDatabase.ts
import { Pool } from 'pg';

export class TestDatabase {
  private pool: Pool;

  static async create(): Promise<TestDatabase> {
    const pool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'sovren_test',
      user: 'test',
      password: 'test',
    });

    await pool.query('BEGIN');
    return new TestDatabase(pool);
  }

  async cleanup(): Promise<void> {
    await this.pool.query('ROLLBACK');
    await this.pool.end();
  }

  getConnection(): Pool {
    return this.pool;
  }
}

// Usage in tests
describe('PaymentRepository Integration', () => {
  let db: TestDatabase;
  let repository: PaymentRepository;

  beforeAll(async () => {
    db = await TestDatabase.create();
    repository = new PaymentRepository(db.getConnection());
  });

  afterAll(async () => {
    await db.cleanup();
  });

  it('should persist payment', async () => {
    const payment = await repository.create({
      amount: 1000,
      userId: 'user123',
    });

    expect(payment.id).toBeDefined();
  });
});
```

### Testcontainers (Docker-based Testing)

```typescript
import { PostgreSqlContainer } from 'testcontainers';

describe('Database Integration', () => {
  let container: StartedPostgreSqlContainer;

  beforeAll(async () => {
    container = await new PostgreSqlContainer().start();
    process.env.DATABASE_URL = container.getConnectionUri();
  }, 60000);

  afterAll(async () => {
    await container.stop();
  });

  // Tests run against real PostgreSQL in Docker
});
```

---

## E2E Testing

### Playwright Configuration

```typescript
// packages/frontend/playwright.config.ts
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13'] },
    },
  ],
});
```

### E2E Test Example

```typescript
// packages/frontend/e2e/subscription-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Subscription Flow', () => {
  test('creator can create subscription tier', async ({ page }) => {
    // Login as creator
    await page.goto('/login');
    await page.fill('[name=npub]', process.env.TEST_CREATOR_NPUB!);
    await page.click('text=Connect');

    // Navigate to subscription settings
    await page.goto('/dashboard/subscriptions');
    await page.click('text=Add Tier');

    // Fill subscription form
    await page.fill('[name=name]', 'Premium Content');
    await page.fill('[name=price]', '10000');
    await page.fill('[name=description]', 'Exclusive premium content');
    await page.click('text=Create Tier');

    // Verify tier created
    await expect(page.locator('text=Premium Content')).toBeVisible();
    await expect(page.locator('text=10,000 sats')).toBeVisible();
  });

  test('supporter can subscribe to creator', async ({ page }) => {
    // Login as supporter
    await page.goto('/login');
    await page.fill('[name=npub]', process.env.TEST_SUPPORTER_NPUB!);
    await page.click('text=Connect');

    // Find creator
    await page.goto('/creators/alice');
    await page.click('text=Subscribe - Premium Content');

    // Generate Lightning invoice
    await expect(page.locator('.lightning-invoice')).toBeVisible();

    // Mock payment (in test environment)
    await page.evaluate(() => {
      window.__TEST_COMPLETE_PAYMENT__();
    });

    // Verify subscription active
    await expect(page.locator('text=Subscription Active')).toBeVisible();
  });
});
```

---

## Performance Testing

### Load Testing with k6

```javascript
// packages/backend/k6/payment-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 }, // Ramp up
    { duration: '3m', target: 100 }, // Sustained load
    { duration: '1m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% under 500ms
    http_req_failed: ['rate<0.01'], // < 1% errors
  },
};

export default function () {
  const payload = JSON.stringify({
    amount: 10000,
    currency: 'BTC',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${__ENV.AUTH_TOKEN}`,
    },
  };

  const res = http.post('http://localhost:3001/api/v1/payments', payload, params);

  check(res, {
    'status is 201': (r) => r.status === 201,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

Run: `k6 run packages/backend/k6/payment-load-test.js`

---

## Test Data Factories

### Factory Pattern for Test Data

```typescript
// packages/backend/src/test-utils/factories/PaymentFactory.ts
export class PaymentFactory {
  static create(overrides: Partial<Payment> = {}): Payment {
    return {
      id: faker.string.uuid(),
      amount: faker.number.int({ min: 1000, max: 100000 }),
      currency: 'BTC',
      status: 'pending',
      userId: faker.string.uuid(),
      invoice: faker.string.alphanumeric(64),
      expiresAt: faker.date.future(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createMany(count: number, overrides: Partial<Payment> = {}): Payment[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  static createCompleted(overrides: Partial<Payment> = {}): Payment {
    return this.create({
      status: 'completed',
      preimage: faker.string.hexadecimal({ length: 64 }),
      ...overrides,
    });
  }
}

// Usage
const payment = PaymentFactory.create({ amount: 5000 });
const payments = PaymentFactory.createMany(10, { userId: 'user123' });
```

---

## Running Tests

### CLI Commands

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- PaymentService

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run integration tests only
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run E2E with UI
npm run test:e2e:ui

# Run performance tests
npm run test:load
```

### Test Filtering

```bash
# Run tests matching pattern
npx vitest run -t "create payment"

# Run specific file
npx vitest run PaymentService.test.ts

# Update snapshots
npx vitest run --update
```

---

## Debugging Tests

### VSCode Debugging

```json
// .vscode/launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Vitest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/vitest",
  "args": ["run", "--no-file-parallelism", "${file}"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Debug Commands

```bash
# Run with Node debugger
node --inspect-brk node_modules/.bin/vitest run --no-file-parallelism

# Debug specific test
npx vitest run --no-file-parallelism -t "specific test name"

# Verbose output
npx vitest run --reporter=verbose

# Show all console.log (Vitest shows console output by default)
npx vitest run
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/tests.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_DB: sovren_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432

      redis:
        image: redis:6
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit -- --coverage

      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/sovren_test
          REDIS_URL: redis://localhost:6379

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

---

**Best Practices Summary**:

1. ✅ Write tests before implementation (TDD)
2. ✅ Use descriptive test names
3. ✅ Test one thing per test
4. ✅ Use AAA pattern (Arrange-Act-Assert)
5. ✅ Mock external dependencies
6. ✅ Achieve 85%+ coverage globally, 95%+ for critical paths
7. ✅ Run tests in CI/CD pipeline
8. ✅ Keep tests fast (< 1s for unit, < 10s for integration)

---

**Next**: [Database Guide](/docs/development/database-guide.md)

---

**Last Updated**: 2025-10-27
**Epic**: Epic 005 - Backend Service Refactoring
**Story**: US-E5-039 - Developer Documentation
