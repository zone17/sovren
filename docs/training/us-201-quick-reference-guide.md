# 🚀 US-201 Test Infrastructure - Quick Reference Guide

**Quick Reference**: Daily Development Cheat Sheet
**Version**: 1.0.0
**Date**: January 20, 2025

## 🎯 **QUICK START**

### **Essential Imports**

```typescript
// Test Data Generation
import {
  SimpleFaker,
  UserFactory,
  ContentFactory,
  AnalyticsFactory,
  PaymentFactory,
} from '../test-utils/test-data-factories';

// Advanced Testing
import { SnapshotTestingManager } from '../test-utils/snapshot-testing';
import { PerformanceMeasurer } from '../test-utils/performance-testing';
import { TestReportingEngine } from '../test-utils/test-reporting';
```

## 🏭 **TEST DATA FACTORIES**

### **Quick Factory Usage**

```typescript
// Basic usage
const user = UserFactory.create();
const content = ContentFactory.create();
const analytics = AnalyticsFactory.create();
const payment = PaymentFactory.create();

// With overrides
const adminUser = UserFactory.create({ role: 'admin', isActive: true });
const premiumContent = ContentFactory.create({ type: 'premium', price: 29.99 });

// Batches
const users = UserFactory.createBatch(5);
const contents = ContentFactory.createBatch(3, { type: 'public' });
```

### **SimpleFaker Quick Examples**

```typescript
const faker = new SimpleFaker();

// Common data types
faker.internet.userName(); // 'testuser_123'
faker.internet.email(); // 'test.user@example.com'
faker.person.firstName(); // 'John'
faker.person.lastName(); // 'Doe'
faker.company.name(); // 'Test Company Inc'
faker.lorem.sentence(); // 'Lorem ipsum dolor sit amet.'
faker.datatype.number(); // 123
faker.datatype.boolean(); // true/false
faker.date.recent(); // Recent date
```

## 📸 **SNAPSHOT TESTING**

### **Basic Snapshots**

```typescript
describe('Component Snapshots', () => {
  let snapshotManager: SnapshotTestingManager;

  beforeEach(() => {
    snapshotManager = new SnapshotTestingManager();
  });

  it('should match basic snapshot', () => {
    snapshotManager.expectToMatchSnapshot(<Component />, 'component-basic');
  });

  it('should match responsive snapshots', () => {
    snapshotManager.expectResponsiveSnapshots(<Component />, 'component-responsive');
  });

  it('should match accessibility snapshot', () => {
    snapshotManager.expectAccessibilitySnapshot(<Component />, 'component-a11y');
  });

  it('should match theme snapshots', () => {
    snapshotManager.expectThemeSnapshots(<Component />, 'component-themes');
  });
});
```

## ⚡ **PERFORMANCE TESTING**

### **Quick Performance Tests**

```typescript
describe('Performance Tests', () => {
  let performanceMeasurer: PerformanceMeasurer;

  beforeEach(() => {
    performanceMeasurer = new PerformanceMeasurer();
  });

  it('should render within budget', async () => {
    const metrics = await performanceMeasurer.measureRenderPerformance(<Component />, 'test');
    expect(metrics.renderTime).toBeLessThan(16); // 60fps
  });

  it('should not leak memory', async () => {
    const result = await performanceMeasurer.detectMemoryLeaks(<Component />, 'test');
    expect(result.hasLeak).toBe(false);
  });

  it('should meet thresholds', async () => {
    const result = await performanceMeasurer.validateThresholds(<Component />, 'test', {
      renderTime: 16,
      memoryUsage: 1000000
    });
    expect(result.passed).toBe(true);
  });
});
```

## 📈 **TEST REPORTING**

### **Basic Reporting Setup**

```typescript
describe('Component Tests', () => {
  let reportingEngine: TestReportingEngine;

  beforeEach(() => {
    reportingEngine = new TestReportingEngine('component-tests');
  });

  afterAll(async () => {
    await reportingEngine.generateAllReports();
  });

  it('should record test results', () => {
    expect(true).toBe(true);
    reportingEngine.recordTestResult('test-name', 'passed', 150);
  });
});
```

## 🛠️ **COMMON PATTERNS**

### **Complete Test Template**

```typescript
import { render, screen } from '@testing-library/react';
import { UserFactory } from '../test-utils/test-data-factories';
import { SnapshotTestingManager } from '../test-utils/snapshot-testing';
import { PerformanceMeasurer } from '../test-utils/performance-testing';
import { TestReportingEngine } from '../test-utils/test-reporting';
import { Component } from './Component';

describe('Component', () => {
  let snapshotManager: SnapshotTestingManager;
  let performanceMeasurer: PerformanceMeasurer;
  let reportingEngine: TestReportingEngine;

  beforeEach(() => {
    snapshotManager = new SnapshotTestingManager();
    performanceMeasurer = new PerformanceMeasurer();
    reportingEngine = new TestReportingEngine('component-tests');
  });

  describe('Functionality', () => {
    it('should render correctly', () => {
      const user = UserFactory.create();
      render(<Component user={user} />);
      expect(screen.getByText(user.displayName)).toBeInTheDocument();
    });
  });

  describe('Snapshots', () => {
    it('should match snapshots', () => {
      const user = UserFactory.create();
      snapshotManager.expectToMatchSnapshot(<Component user={user} />, 'component');
    });
  });

  describe('Performance', () => {
    it('should meet performance requirements', async () => {
      const user = UserFactory.create();
      const metrics = await performanceMeasurer.measureRenderPerformance(
        <Component user={user} />,
        'component-perf'
      );
      expect(metrics.renderTime).toBeLessThan(16);
    });
  });
});
```

### **Test Environment Setup**

```typescript
// Create reusable test environment
export const createTestEnvironment = () => {
  const user = UserFactory.create();
  const content = ContentFactory.createBatch(5);
  const analytics = AnalyticsFactory.create();

  return {
    user,
    content,
    analytics,
    cleanup: () => {
      // Cleanup logic if needed
    },
  };
};

// Usage in tests
beforeEach(() => {
  const env = createTestEnvironment();
  // Use env.user, env.content, etc.
});
```

## 🔧 **DEBUGGING HELPERS**

### **Performance Debugging**

```typescript
// Debug render performance
const debug = await performanceMeasurer.debugRenderPerformance(<Component />, 'debug');
console.log('Render details:', debug);

// Memory usage analysis
const memoryDebug = await performanceMeasurer.analyzeMemoryUsage(<Component />, 'memory');
console.log('Memory analysis:', memoryDebug);
```

### **Snapshot Debugging**

```typescript
// Debug snapshot differences
snapshotManager.debugSnapshot(<Component />, 'debug', {
  verbose: true,
  showDiff: true
});
```

## 📊 **CI/CD INTEGRATION**

### **Package.json Scripts**

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:snapshots": "jest --updateSnapshot",
    "test:performance": "jest --testNamePattern=performance",
    "test:reports": "jest --reporters=./test-utils/test-reporting.js"
  }
}
```

### **Jest Configuration**

```javascript
// jest.config.js
module.exports = {
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  testEnvironment: 'jsdom',
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
};
```

## 🎯 **PERFORMANCE THRESHOLDS**

### **Standard Thresholds**

```typescript
const PERFORMANCE_THRESHOLDS = {
  renderTime: 16, // 60fps budget
  memoryUsage: 1000000, // 1MB budget
  domNodes: 100, // DOM complexity
  reRenders: 5, // Re-render limit
};
```

### **Mobile Thresholds**

```typescript
const MOBILE_THRESHOLDS = {
  renderTime: 10, // Mobile budget
  memoryUsage: 500000, // 500KB for mobile
  domNodes: 50, // Simpler DOM
  reRenders: 3, // Fewer re-renders
};
```

## 🚨 **TROUBLESHOOTING**

### **Common Issues & Solutions**

**Snapshot tests failing:**

```bash
npm run test:snapshots  # Update snapshots
```

**Performance tests timing out:**

```typescript
// Increase timeout for performance tests
jest.setTimeout(30000);
```

**Memory leak detection false positives:**

```typescript
// Adjust memory growth tolerance
const result = await performanceMeasurer.detectMemoryLeaks(component, 'test', {
  memoryGrowthTolerance: 20000, // Increase tolerance
});
```

**Factory data inconsistency:**

```typescript
// Use seeded faker for reproducible tests
const faker = new SimpleFaker(12345);
```

## 📚 **QUICK LINKS**

- 🎓 [Full Training Guide](./us-201-test-infrastructure-training-guide.md)
- 📋 [Validation Report](../validation-reports/us-201-test-infrastructure-repair-validation.md)
- 🔧 [Test Data Factories](../../packages/frontend/src/test-utils/test-data-factories.ts)
- 📸 [Snapshot Testing](../../packages/frontend/src/test-utils/snapshot-testing.tsx)
- ⚡ [Performance Testing](../../packages/frontend/src/test-utils/performance-testing.tsx)
- 📈 [Test Reporting](../../packages/frontend/src/test-utils/test-reporting.ts)

---

**💡 Pro Tip**: Bookmark this page for quick access during development. For detailed explanations, refer to the full training guide.
