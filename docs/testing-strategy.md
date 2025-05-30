# Testing Strategy & Standards

## 🧪 Overview

This document outlines the comprehensive testing strategy for Sovren, covering all testing levels from unit tests to end-to-end scenarios.

## 📋 Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Testing Pyramid](#testing-pyramid)
3. [Unit Testing](#unit-testing)
4. [Integration Testing](#integration-testing)
5. [End-to-End Testing](#end-to-end-testing)
6. [Performance Testing](#performance-testing)
7. [Security Testing](#security-testing)
8. [Accessibility Testing](#accessibility-testing)
9. [Visual Regression Testing](#visual-regression-testing)
10. [Testing Infrastructure](#testing-infrastructure)

---

## Testing Philosophy

### Core Principles

**Test-Driven Development (TDD)**

```typescript
// TDD Cycle: Red → Green → Refactor
describe('UserService', () => {
  // 1. Red: Write failing test
  it('should create user with valid data', async () => {
    const userData = { email: 'test@example.com', username: 'testuser' };
    const user = await userService.create(userData);
    expect(user.id).toBeDefined();
    expect(user.email).toBe(userData.email);
  });

  // 2. Green: Make test pass with minimal code
  // 3. Refactor: Improve code quality
});
```

**Behavior-Driven Development (BDD)**

```typescript
// Given-When-Then structure
describe('User Authentication', () => {
  describe('when user provides valid credentials', () => {
    it('should authenticate successfully', async () => {
      // Given: valid user credentials
      const credentials = { email: 'user@example.com', password: 'ValidPass123!' };

      // When: user attempts to login
      const result = await authService.login(credentials);

      // Then: authentication should succeed
      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
    });
  });
});
```

### Testing Standards

**Coverage Requirements:**

- Unit tests: **90%** minimum
- Integration tests: **80%** minimum
- Critical path E2E: **100%** coverage
- Mutation testing score: **85%** minimum

**Quality Gates:**

- All tests must pass before deployment
- No test should take longer than 10 seconds
- Flaky tests are immediately fixed or disabled
- Test code follows same quality standards as production code

---

## Testing Pyramid

### Test Distribution Strategy

```
    /\
   /  \    E2E Tests (10%)
  /____\   - Critical user journeys
 /      \  - Cross-browser compatibility
/________\

   /\      Integration Tests (20%)
  /  \     - API endpoints
 /____\    - Database interactions
/      \   - Service integrations
\______/

    /\     Unit Tests (70%)
   /  \    - Individual components
  /____\   - Pure functions
 /      \  - Business logic
/________\ - Utility functions
```

---

## Unit Testing

### React Component Testing

**Component Test Structure:**

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { UserProfile } from './UserProfile';
import { createMockStore } from '../__mocks__/store';

describe('UserProfile Component', () => {
  let mockStore: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    mockStore = createMockStore({
      user: {
        id: '1',
        username: 'testuser',
        email: 'test@example.com'
      }
    });
  });

  const renderComponent = (props = {}) => {
    return render(
      <Provider store={mockStore}>
        <BrowserRouter>
          <UserProfile {...props} />
        </BrowserRouter>
      </Provider>
    );
  };

  describe('when component mounts', () => {
    it('should display user information', () => {
      renderComponent();

      expect(screen.getByText('testuser')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });
  });

  describe('when edit button is clicked', () => {
    it('should enable edit mode', async () => {
      renderComponent();

      const editButton = screen.getByRole('button', { name: /edit/i });
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByDisplayValue('testuser')).toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('should be keyboard navigable', () => {
      renderComponent();

      const editButton = screen.getByRole('button', { name: /edit/i });
      editButton.focus();
      expect(editButton).toHaveFocus();
    });

    it('should have proper ARIA labels', () => {
      renderComponent();

      expect(screen.getByLabelText('User profile information')).toBeInTheDocument();
    });
  });
});
```

### Hook Testing

**Custom Hook Testing:**

```typescript
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from './useLocalStorage';

describe('useLocalStorage Hook', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should return initial value when key does not exist', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));

    expect(result.current[0]).toBe('default');
  });

  it('should update localStorage when value changes', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    act(() => {
      result.current[1]('updated');
    });

    expect(result.current[0]).toBe('updated');
    expect(localStorage.getItem('test-key')).toBe('"updated"');
  });
});
```

### Service/Utility Testing

**Business Logic Testing:**

```typescript
import { PaymentProcessor } from './PaymentProcessor';
import { mockLightningClient } from '../__mocks__/lightning';

describe('PaymentProcessor', () => {
  let paymentProcessor: PaymentProcessor;

  beforeEach(() => {
    paymentProcessor = new PaymentProcessor(mockLightningClient);
  });

  describe('processPayment', () => {
    it('should process valid payment successfully', async () => {
      const payment = {
        amount: 1000, // satoshis
        recipient: 'user123',
        memo: 'Test payment',
      };

      const result = await paymentProcessor.processPayment(payment);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
    });

    it('should reject payment with insufficient balance', async () => {
      const payment = {
        amount: 1000000000, // Way too much
        recipient: 'user123',
        memo: 'Test payment',
      };

      await expect(paymentProcessor.processPayment(payment)).rejects.toThrow(
        'Insufficient balance'
      );
    });

    it('should validate payment amount', async () => {
      const invalidPayment = {
        amount: -100,
        recipient: 'user123',
        memo: 'Invalid payment',
      };

      await expect(paymentProcessor.processPayment(invalidPayment)).rejects.toThrow(
        'Invalid payment amount'
      );
    });
  });
});
```

---

## Integration Testing

### API Integration Testing

**API Endpoint Testing:**

```typescript
import request from 'supertest';
import { app } from '../app';
import { setupTestDatabase, teardownTestDatabase } from '../__tests__/setup';

describe('User API Integration', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  describe('POST /api/users', () => {
    it('should create user with valid data', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'ValidPassword123!',
      };

      const response = await request(app).post('/api/users').send(userData).expect(201);

      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.password).toBeUndefined(); // Should not return password
    });

    it('should return 400 for invalid email', async () => {
      const invalidData = {
        email: 'not-an-email',
        username: 'testuser',
        password: 'ValidPassword123!',
      };

      const response = await request(app).post('/api/users').send(invalidData).expect(400);

      expect(response.body.error).toContain('Invalid email');
    });
  });

  describe('Authentication Flow', () => {
    it('should complete full registration and login flow', async () => {
      // 1. Register user
      const userData = {
        email: 'flow@example.com',
        username: 'flowuser',
        password: 'ValidPassword123!',
      };

      await request(app).post('/api/users/register').send(userData).expect(201);

      // 2. Login with credentials
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password,
        })
        .expect(200);

      expect(loginResponse.body.token).toBeDefined();

      // 3. Access protected resource
      await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${loginResponse.body.token}`)
        .expect(200);
    });
  });
});
```

### Database Integration Testing

**Database Operation Testing:**

```typescript
import { UserRepository } from './UserRepository';
import { setupTestDatabase, teardownTestDatabase } from '../__tests__/setup';

describe('UserRepository Integration', () => {
  let userRepository: UserRepository;

  beforeAll(async () => {
    await setupTestDatabase();
    userRepository = new UserRepository();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  afterEach(async () => {
    await userRepository.deleteAll(); // Clean up after each test
  });

  describe('create', () => {
    it('should persist user to database', async () => {
      const userData = {
        email: 'db@example.com',
        username: 'dbuser',
        hashedPassword: 'hashed123',
      };

      const user = await userRepository.create(userData);

      expect(user.id).toBeDefined();
      expect(user.createdAt).toBeDefined();

      // Verify persistence
      const foundUser = await userRepository.findById(user.id);
      expect(foundUser?.email).toBe(userData.email);
    });

    it('should enforce unique email constraint', async () => {
      const userData = {
        email: 'unique@example.com',
        username: 'user1',
        hashedPassword: 'hashed123',
      };

      await userRepository.create(userData);

      // Attempt to create another user with same email
      await expect(
        userRepository.create({
          ...userData,
          username: 'user2',
        })
      ).rejects.toThrow('Email already exists');
    });
  });
});
```

---

## End-to-End Testing

### Playwright E2E Testing

**User Journey Testing:**

```typescript
import { test, expect, Page } from '@playwright/test';

test.describe('User Registration Flow', () => {
  test('should complete full registration journey', async ({ page }) => {
    // Navigate to registration page
    await page.goto('/register');

    // Fill registration form
    await page.fill('[data-testid="email-input"]', 'e2e@example.com');
    await page.fill('[data-testid="username-input"]', 'e2euser');
    await page.fill('[data-testid="password-input"]', 'ValidPassword123!');
    await page.fill('[data-testid="confirm-password-input"]', 'ValidPassword123!');

    // Submit form
    await page.click('[data-testid="register-button"]');

    // Should redirect to verification page
    await expect(page).toHaveURL('/verify-email');
    await expect(page.locator('h1')).toContainText('Verify Your Email');

    // Check email was sent (mock email service)
    const emailSent = await page.evaluate(() => {
      return window.localStorage.getItem('lastEmailSent');
    });
    expect(emailSent).toContain('e2e@example.com');
  });

  test('should handle validation errors gracefully', async ({ page }) => {
    await page.goto('/register');

    // Submit empty form
    await page.click('[data-testid="register-button"]');

    // Should show validation errors
    await expect(page.locator('[data-testid="email-error"]')).toContainText('Email is required');
    await expect(page.locator('[data-testid="username-error"]')).toContainText(
      'Username is required'
    );
  });
});

test.describe('Payment Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as existing user
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should process lightning payment successfully', async ({ page }) => {
    // Navigate to payment page
    await page.click('[data-testid="make-payment-button"]');
    await expect(page).toHaveURL('/payment');

    // Fill payment form
    await page.fill('[data-testid="amount-input"]', '1000');
    await page.fill('[data-testid="recipient-input"]', 'creator123');
    await page.fill('[data-testid="memo-input"]', 'Great content!');

    // Submit payment
    await page.click('[data-testid="send-payment-button"]');

    // Should show confirmation dialog
    await expect(page.locator('[data-testid="payment-confirmation"]')).toBeVisible();

    // Confirm payment
    await page.click('[data-testid="confirm-payment-button"]');

    // Should show success message
    await expect(page.locator('[data-testid="payment-success"]')).toContainText(
      'Payment sent successfully'
    );
  });
});
```

### Cross-Browser Testing

**Browser Compatibility Testing:**

```typescript
import { test, devices } from '@playwright/test';

const browsers = ['chromium', 'firefox', 'webkit'];
const devices_list = [
  devices['Desktop Chrome'],
  devices['Desktop Firefox'],
  devices['Desktop Safari'],
  devices['iPhone 12'],
  devices['iPad Pro'],
  devices['Pixel 5'],
];

for (const device of devices_list) {
  test.describe(`Tests on ${device.name}`, () => {
    test.use({ ...device });

    test('should render correctly', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('h1')).toBeVisible();
    });

    test('should be responsive', async ({ page }) => {
      await page.goto('/');

      // Check mobile navigation
      if (device.isMobile) {
        await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
      } else {
        await expect(page.locator('[data-testid="desktop-navigation"]')).toBeVisible();
      }
    });
  });
}
```

---

## Performance Testing

### Load Testing

**Artillery.js Configuration:**

```yaml
# artillery-config.yml
config:
  target: 'https://your-app.vercel.app'
  phases:
    - duration: 60
      arrivalRate: 10
    - duration: 120
      arrivalRate: 50
    - duration: 60
      arrivalRate: 100
  defaults:
    headers:
      Content-Type: 'application/json'

scenarios:
  - name: 'User Journey'
    weight: 70
    flow:
      - post:
          url: '/api/auth/login'
          json:
            email: 'load-test@example.com'
            password: 'password123'
          capture:
            - json: '$.token'
              as: 'authToken'
      - get:
          url: '/api/users/profile'
          headers:
            Authorization: 'Bearer {{ authToken }}'
      - post:
          url: '/api/posts'
          headers:
            Authorization: 'Bearer {{ authToken }}'
          json:
            title: 'Load test post'
            content: 'This is a load test'
```

### Lighthouse Performance Testing

**Performance CI Integration:**

```typescript
// lighthouse-ci.js
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3000'],
      startServerCommand: 'npm start',
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
```

---

## Security Testing

### Security Test Suite

**Security Test Examples:**

```typescript
describe('Security Tests', () => {
  describe('Input Validation', () => {
    it('should prevent XSS attacks', async () => {
      const maliciousInput = '<script>alert("XSS")</script>';

      const response = await request(app)
        .post('/api/posts')
        .send({ title: maliciousInput, content: 'test' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toContain('Invalid input');
    });

    it('should prevent SQL injection', async () => {
      const maliciousInput = "'; DROP TABLE users; --";

      const response = await request(app)
        .get(`/api/users/search?q=${encodeURIComponent(maliciousInput)}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toContain('Invalid search query');
    });
  });

  describe('Authentication', () => {
    it('should require authentication for protected routes', async () => {
      await request(app).get('/api/users/profile').expect(401);
    });

    it('should reject invalid tokens', async () => {
      await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should implement rate limiting on login endpoint', async () => {
      const requests = Array(6)
        .fill(null)
        .map(() =>
          request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'wrong' })
        );

      const responses = await Promise.allSettled(requests);
      const lastResponse = responses[responses.length - 1];

      expect(lastResponse.status).toBe('rejected');
    });
  });
});
```

---

## Accessibility Testing

### Automated Accessibility Testing

**axe-core Integration:**

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';
import { render } from '@testing-library/react';

expect.extend(toHaveNoViolations);

describe('Accessibility Tests', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<UserProfile />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should be keyboard navigable', async () => {
    const { getByRole } = render(<Navigation />);

    const firstLink = getByRole('link', { name: /home/i });
    firstLink.focus();
    expect(firstLink).toHaveFocus();

    // Simulate tab navigation
    fireEvent.keyDown(firstLink, { key: 'Tab' });
    const secondLink = getByRole('link', { name: /about/i });
    expect(secondLink).toHaveFocus();
  });
});
```

### Manual Accessibility Testing Checklist

**Testing Procedures:**

- [ ] Keyboard navigation (Tab, Shift+Tab, Enter, Space, Arrow keys)
- [ ] Screen reader testing (NVDA, JAWS, VoiceOver)
- [ ] Color contrast verification (4.5:1 for normal text, 3:1 for large text)
- [ ] Focus management and visible focus indicators
- [ ] Semantic HTML and proper heading hierarchy
- [ ] ARIA labels and descriptions
- [ ] Alternative text for images
- [ ] Form labels and error messages

---

## Visual Regression Testing

### Chromatic Integration

**Visual Testing Setup:**

```typescript
// .storybook/main.js
module.exports = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
  framework: '@storybook/react'
};

// Component stories
export default {
  title: 'Components/UserProfile',
  component: UserProfile,
  parameters: {
    chromatic: { delay: 300 }
  }
};

export const Default = () => (
  <UserProfile user={mockUser} />
);

export const Loading = () => (
  <UserProfile user={null} loading={true} />
);

export const WithError = () => (
  <UserProfile user={null} error="Failed to load user" />
);
```

---

## Testing Infrastructure

### Test Environment Setup

**Jest Configuration:**

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{ts,tsx}',
  ],
};
```

### CI/CD Testing Pipeline

**GitHub Actions Test Workflow:**

```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linting
        run: npm run lint

      - name: Run unit tests
        run: npm run test:ci

      - name: Run integration tests
        run: npm run test:integration

      - name: Upload coverage
        uses: codecov/codecov-action@v3

      - name: Run E2E tests
        run: npx playwright test

      - name: Run accessibility tests
        run: npm run test:a11y

      - name: Run security tests
        run: npm audit --audit-level high
```

### Test Data Management

**Test Data Factory:**

```typescript
// __tests__/factories/user.factory.ts
export const createMockUser = (overrides = {}) => ({
  id: '123',
  email: 'test@example.com',
  username: 'testuser',
  displayName: 'Test User',
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createMockPost = (overrides = {}) => ({
  id: '456',
  title: 'Test Post',
  content: 'This is a test post',
  authorId: '123',
  createdAt: new Date().toISOString(),
  ...overrides,
});
```

---

## 📊 Testing Metrics & Reporting

### Key Metrics

**Coverage Metrics:**

- Line coverage: 90%+
- Branch coverage: 90%+
- Function coverage: 90%+
- Statement coverage: 90%+

**Performance Metrics:**

- Test execution time: <5 minutes total
- Individual test time: <10 seconds
- Flaky test rate: <1%

**Quality Metrics:**

- Bug detection rate: 95%+
- Regression prevention: 99%+
- Security vulnerability detection: 100%

### Reporting

**Test Reports Generated:**

- Unit test coverage (Istanbul/nyc)
- Integration test results
- E2E test screenshots/videos
- Performance test results (Lighthouse)
- Accessibility audit results (axe-core)
- Security scan results (Snyk/npm audit)

---

**Last Updated:** December 2024
**Next Review:** March 2025
**Owner:** Engineering Team
