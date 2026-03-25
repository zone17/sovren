# Epic 005: Backend Service Refactoring - Quick Reference Guide

## Quick Story Lookup

### By Phase

#### Phase 1: Design & Interface Definition (Stories 1-6)

- **#1**: Analyze service dependencies
- **#2**: Define bounded contexts and interfaces
- **#3**: Setup DI container
- **#4**: Create service factories
- **#5**: Setup event bus
- **#6**: Create migration strategy

#### Phase 2: Shared Services (Stories 7-10)

- **#7**: EmailService
- **#8**: NotificationService
- **#9**: AuditLogService
- **#10**: CacheService

#### Phase 3: Content Services (Stories 11-17)

- **#11**: ContentCreationService
- **#12**: ContentPublishingService
- **#13**: ContentModerationService
- **#14**: ContentSearchService
- **#15**: ContentRecommendationService
- **#16**: ContentAnalyticsService
- **#17**: ContentVersioningService

#### Phase 4: User Services (Stories 18-23)

- **#18**: UserAuthenticationService
- **#19**: UserProfileService
- **#20**: UserPreferencesService
- **#21**: UserActivityService
- **#22**: UserRelationshipService
- **#23**: UserAnalyticsService

#### Phase 5: Payment Services (Stories 24-31) - CRITICAL

- **#24**: InvoiceService
- **#25**: PaymentProcessingService
- **#26**: SubscriptionService
- **#27**: RefundService
- **#28**: PaymentAnalyticsService
- **#29**: WebhookService
- **#30**: CurrencyService
- **#31**: Payment Integration Tests

#### Phase 6: Integration & Testing (Stories 32-36)

- **#32**: Wire all services through DI
- **#33**: Update API routes
- **#34**: Run integration tests
- **#35**: Performance testing
- **#36**: Fix issues

#### Phase 7: Documentation (Stories 37-42)

- **#37**: Architecture diagrams
- **#38**: API documentation
- **#39**: Developer guide
- **#40**: ADRs
- **#41**: Cleanup old code
- **#42**: Final sign-off

---

## Service Interface Patterns

### Standard Service Interface Template

```typescript
// interfaces/[domain]/I[Service]Service.ts
export interface I[Service]Service {
  // Core methods
  method(param: ParamType): Promise<ReturnType>;

  // Include JSDoc
  /**
   * Method description
   * @param param - Parameter description
   * @returns Return value description
   * @throws {ErrorType} Error description
   */
}
```

### Standard Service Implementation Template

```typescript
// services/[domain]/[Service]Service.ts
import { injectable, inject } from 'inversify';
import { TYPES } from '../types';
import { I[Service]Service } from '../../interfaces/[domain]/I[Service]Service';

@injectable()
export class [Service]Service implements I[Service]Service {
  constructor(
    @inject(TYPES.Dependency1) private dep1: IDependency1,
    @inject(TYPES.Dependency2) private dep2: IDependency2
  ) {}

  async method(param: ParamType): Promise<ReturnType> {
    // Implementation
    try {
      // Business logic
      const result = await this.dep1.operation(param);

      // Audit logging if needed
      await this.auditLog.log({
        action: 'ACTION_NAME',
        entityId: result.id,
        userId: param.userId
      });

      return result;
    } catch (error) {
      // Error handling
      throw new ServiceError('Error message', error);
    }
  }
}
```

### Service Test Template

```typescript
// services/[domain]/__tests__/[Service]Service.test.ts
import { Container } from 'inversify';
import { [Service]Service } from '../[Service]Service';
import { I[Service]Service } from '../../../interfaces/[domain]/I[Service]Service';
import { TYPES } from '../../types';

describe('[Service]Service', () => {
  let container: Container;
  let service: I[Service]Service;
  let mockDep1: jest.Mocked<IDependency1>;

  beforeEach(() => {
    // Setup container
    container = new Container();

    // Create mocks
    mockDep1 = {
      operation: jest.fn()
    };

    // Bind mocks
    container.bind<IDependency1>(TYPES.Dependency1).toConstantValue(mockDep1);

    // Bind service
    container.bind<I[Service]Service>(TYPES.[Service]Service).to([Service]Service);

    // Get service
    service = container.get<I[Service]Service>(TYPES.[Service]Service);
  });

  describe('method', () => {
    it('should successfully perform operation', async () => {
      // Arrange
      const input = { /* test data */ };
      const expected = { /* expected result */ };
      mockDep1.operation.mockResolvedValue(expected);

      // Act
      const result = await service.method(input);

      // Assert
      expect(result).toEqual(expected);
      expect(mockDep1.operation).toHaveBeenCalledWith(input);
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      const input = { /* test data */ };
      mockDep1.operation.mockRejectedValue(new Error('Test error'));

      // Act & Assert
      await expect(service.method(input)).rejects.toThrow('Test error');
    });
  });
});
```

---

## DI Container Setup Patterns

### Service Types Registry

```typescript
// services/types.ts
export const TYPES = {
  // Shared Services
  EmailService: Symbol.for('EmailService'),
  NotificationService: Symbol.for('NotificationService'),
  AuditLogService: Symbol.for('AuditLogService'),
  CacheService: Symbol.for('CacheService'),

  // Content Services
  ContentCreationService: Symbol.for('ContentCreationService'),
  ContentPublishingService: Symbol.for('ContentPublishingService'),
  ContentModerationService: Symbol.for('ContentModerationService'),
  ContentSearchService: Symbol.for('ContentSearchService'),
  ContentRecommendationService: Symbol.for('ContentRecommendationService'),
  ContentAnalyticsService: Symbol.for('ContentAnalyticsService'),
  ContentVersioningService: Symbol.for('ContentVersioningService'),

  // User Services
  UserAuthenticationService: Symbol.for('UserAuthenticationService'),
  UserProfileService: Symbol.for('UserProfileService'),
  UserPreferencesService: Symbol.for('UserPreferencesService'),
  UserActivityService: Symbol.for('UserActivityService'),
  UserRelationshipService: Symbol.for('UserRelationshipService'),
  UserAnalyticsService: Symbol.for('UserAnalyticsService'),

  // Payment Services
  InvoiceService: Symbol.for('InvoiceService'),
  PaymentProcessingService: Symbol.for('PaymentProcessingService'),
  SubscriptionService: Symbol.for('SubscriptionService'),
  RefundService: Symbol.for('RefundService'),
  PaymentAnalyticsService: Symbol.for('PaymentAnalyticsService'),
  WebhookService: Symbol.for('WebhookService'),
  CurrencyService: Symbol.for('CurrencyService'),

  // Repositories
  ContentRepository: Symbol.for('ContentRepository'),
  UserRepository: Symbol.for('UserRepository'),
  PaymentRepository: Symbol.for('PaymentRepository'),

  // Infrastructure
  EventBus: Symbol.for('EventBus'),
  Database: Symbol.for('Database'),
  Cache: Symbol.for('Cache'),
};
```

### Container Configuration

```typescript
// services/container.ts
import { Container } from 'inversify';
import 'reflect-metadata';
import { TYPES } from './types';

// Import all services
import { EmailService } from './shared/EmailService';
import { NotificationService } from './shared/NotificationService';
// ... more imports

const container = new Container();

// Shared Services (Singleton)
container.bind<IEmailService>(TYPES.EmailService).to(EmailService).inSingletonScope();
container
  .bind<INotificationService>(TYPES.NotificationService)
  .to(NotificationService)
  .inSingletonScope();
container.bind<IAuditLogService>(TYPES.AuditLogService).to(AuditLogService).inSingletonScope();
container.bind<ICacheService>(TYPES.CacheService).to(CacheService).inSingletonScope();

// Content Services (Request scope)
container.bind<IContentCreationService>(TYPES.ContentCreationService).to(ContentCreationService);
container
  .bind<IContentPublishingService>(TYPES.ContentPublishingService)
  .to(ContentPublishingService);
container
  .bind<IContentModerationService>(TYPES.ContentModerationService)
  .to(ContentModerationService);
container.bind<IContentSearchService>(TYPES.ContentSearchService).to(ContentSearchService);
container
  .bind<IContentRecommendationService>(TYPES.ContentRecommendationService)
  .to(ContentRecommendationService);
container.bind<IContentAnalyticsService>(TYPES.ContentAnalyticsService).to(ContentAnalyticsService);
container
  .bind<IContentVersioningService>(TYPES.ContentVersioningService)
  .to(ContentVersioningService);

// User Services (Request scope)
container
  .bind<IUserAuthenticationService>(TYPES.UserAuthenticationService)
  .to(UserAuthenticationService);
container.bind<IUserProfileService>(TYPES.UserProfileService).to(UserProfileService);
container.bind<IUserPreferencesService>(TYPES.UserPreferencesService).to(UserPreferencesService);
container.bind<IUserActivityService>(TYPES.UserActivityService).to(UserActivityService);
container.bind<IUserRelationshipService>(TYPES.UserRelationshipService).to(UserRelationshipService);
container.bind<IUserAnalyticsService>(TYPES.UserAnalyticsService).to(UserAnalyticsService);

// Payment Services (Request scope)
container.bind<IInvoiceService>(TYPES.InvoiceService).to(InvoiceService);
container
  .bind<IPaymentProcessingService>(TYPES.PaymentProcessingService)
  .to(PaymentProcessingService);
container.bind<ISubscriptionService>(TYPES.SubscriptionService).to(SubscriptionService);
container.bind<IRefundService>(TYPES.RefundService).to(RefundService);
container.bind<IPaymentAnalyticsService>(TYPES.PaymentAnalyticsService).to(PaymentAnalyticsService);
container.bind<IWebhookService>(TYPES.WebhookService).to(WebhookService);
container.bind<ICurrencyService>(TYPES.CurrencyService).to(CurrencyService);

export { container };
```

### Using Services in Routes

```typescript
// routes/content.ts
import { container } from '../services/container';
import { TYPES } from '../services/types';
import { IContentCreationService } from '../interfaces/content/IContentCreationService';
import { IContentPublishingService } from '../interfaces/content/IContentPublishingService';

export class ContentRoutes {
  private creationService: IContentCreationService;
  private publishingService: IContentPublishingService;

  constructor() {
    this.creationService = container.get<IContentCreationService>(TYPES.ContentCreationService);
    this.publishingService = container.get<IContentPublishingService>(
      TYPES.ContentPublishingService
    );
  }

  async createContent(req: Request, res: Response) {
    try {
      const content = await this.creationService.createDraft(req.body);
      res.json(content);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async publishContent(req: Request, res: Response) {
    try {
      const result = await this.publishingService.publish(req.params.id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}
```

---

## Testing Patterns

### Unit Test Pattern

```typescript
describe('ServiceName', () => {
  // Setup
  beforeEach(() => {
    // Create container and mocks
  });

  // Happy path tests
  it('should perform operation successfully', async () => {
    // Arrange
    // Act
    // Assert
  });

  // Edge case tests
  it('should handle edge case correctly', async () => {
    // Test edge cases
  });

  // Error handling tests
  it('should throw appropriate error when operation fails', async () => {
    // Test error scenarios
  });

  // Validation tests
  it('should validate input parameters', async () => {
    // Test input validation
  });
});
```

### Integration Test Pattern

```typescript
describe('Service Integration', () => {
  beforeAll(async () => {
    // Setup test database
    // Setup real DI container
  });

  afterAll(async () => {
    // Cleanup
  });

  it('should complete workflow end-to-end', async () => {
    // Test real service interactions
    const content = await contentCreation.createDraft(data);
    const published = await contentPublishing.publish(content.id);
    const analytics = await contentAnalytics.getMetrics(content.id);

    expect(analytics.views).toBeDefined();
  });
});
```

### Payment Service Test Pattern (CRITICAL)

```typescript
describe('PaymentProcessingService', () => {
  // 100% coverage required

  it('should process payment successfully', async () => {
    // Happy path
  });

  it('should handle payment provider failure', async () => {
    // Test provider failure
  });

  it('should be idempotent', async () => {
    // Test idempotency
    const result1 = await service.processPayment(invoice, method);
    const result2 = await service.processPayment(invoice, method);
    expect(result1.transactionId).toEqual(result2.transactionId);
  });

  it('should never double-charge', async () => {
    // Test double charge prevention
  });

  it('should handle concurrent payment attempts', async () => {
    // Test race conditions
  });

  it('should maintain audit trail', async () => {
    // Test audit logging
  });

  it('should validate PCI compliance', async () => {
    // Test security requirements
  });
});
```

---

## Common Service Responsibilities

### EmailService

- Send transactional emails
- Send bulk emails
- Template management
- Retry logic
- Email tracking

### NotificationService

- Multi-channel notifications (email, push, in-app)
- User preference management
- Notification batching
- Delivery tracking

### AuditLogService

- Log all critical operations
- Immutable storage
- Query capabilities
- Compliance support

### CacheService

- Redis-based caching
- TTL management
- Cache invalidation
- Cache-aside pattern

### ContentCreationService

- Create drafts
- Validate content
- Save drafts
- Auto-save support

### ContentPublishingService

- Publish content
- Schedule publishing
- Unpublish content
- Distribution to Nostr

### PaymentProcessingService

- Process payments
- Verify payments
- Retry failed payments
- Handle webhooks
- Idempotency

---

## Error Handling Patterns

### Service-Level Errors

```typescript
export class ServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

// Usage
throw new ServiceError('Payment processing failed', 'PAYMENT_PROCESSING_ERROR', 402, {
  transactionId,
  reason: 'Insufficient funds',
});
```

### Error Handling in Services

```typescript
async method(param: ParamType): Promise<ReturnType> {
  try {
    // Operation
    return result;
  } catch (error) {
    // Log error
    logger.error('Operation failed', { error, param });

    // Wrap and rethrow
    if (error instanceof ValidationError) {
      throw new ServiceError('Validation failed', 'VALIDATION_ERROR', 400, error);
    }

    throw new ServiceError('Operation failed', 'OPERATION_ERROR', 500, error);
  }
}
```

---

## Performance Optimization Patterns

### Caching Pattern

```typescript
async getData(id: string): Promise<Data> {
  // Check cache
  const cacheKey = `data:${id}`;
  const cached = await this.cache.get<Data>(cacheKey);
  if (cached) return cached;

  // Fetch from database
  const data = await this.repository.findById(id);

  // Store in cache
  await this.cache.set(cacheKey, data, 300); // 5 min TTL

  return data;
}
```

### Batch Processing Pattern

```typescript
async processBatch(items: Item[]): Promise<BatchResult> {
  // Process in chunks
  const CHUNK_SIZE = 100;
  const chunks = _.chunk(items, CHUNK_SIZE);

  const results = [];
  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(item => this.processItem(item))
    );
    results.push(...chunkResults);
  }

  return { processed: results.length, results };
}
```

### Database Transaction Pattern

```typescript
async updateWithTransaction(data: UpdateData): Promise<Result> {
  const transaction = await this.db.beginTransaction();

  try {
    // Multiple operations
    await this.repository.update(data, { transaction });
    await this.auditLog.log(auditEntry, { transaction });

    // Commit
    await transaction.commit();

    return { success: true };
  } catch (error) {
    // Rollback
    await transaction.rollback();
    throw error;
  }
}
```

---

## Migration Checklist

### Before Starting a Service Story

- [ ] Read the story completely
- [ ] Understand dependencies
- [ ] Review interface definition
- [ ] Setup test file
- [ ] Create service file from template

### During Implementation

- [ ] Implement interface methods
- [ ] Add error handling
- [ ] Add logging
- [ ] Write unit tests (aim for 95%+)
- [ ] Test locally
- [ ] Review test coverage

### Before Marking Complete

- [ ] All acceptance criteria met
- [ ] Tests passing
- [ ] Coverage >= 95% (100% for payment)
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] DI container updated
- [ ] No console.log statements
- [ ] No commented code

### Payment Service Additional Checklist

- [ ] 100% test coverage
- [ ] Idempotency verified
- [ ] Race condition testing
- [ ] Security review completed
- [ ] Audit trail verified
- [ ] Performance benchmarked
- [ ] Error scenarios tested
- [ ] Rollback tested

---

## Code Review Checklist

### General

- [ ] Follows TypeScript best practices
- [ ] Proper error handling
- [ ] No hardcoded values
- [ ] Logging added
- [ ] Comments for complex logic

### Service-Specific

- [ ] Implements interface correctly
- [ ] Dependencies injected properly
- [ ] Single responsibility maintained
- [ ] Service < 300 lines
- [ ] No business logic in constructors

### Testing

- [ ] Tests cover happy path
- [ ] Tests cover edge cases
- [ ] Tests cover error scenarios
- [ ] Mocks used correctly
- [ ] No flaky tests

### Performance

- [ ] No N+1 queries
- [ ] Appropriate caching
- [ ] Batch operations where applicable
- [ ] No memory leaks

### Security

- [ ] Input validation
- [ ] Output sanitization
- [ ] No SQL injection risk
- [ ] Proper authentication/authorization
- [ ] Secrets not hardcoded

---

## Troubleshooting Guide

### DI Container Issues

**Problem**: Service not found in container

```
Error: No matching bindings found for serviceIdentifier: Symbol(ServiceName)
```

**Solution**:

1. Check service is bound in `container.ts`
2. Verify TYPES constant matches
3. Ensure `reflect-metadata` is imported
4. Check `@injectable()` decorator is applied

### Circular Dependency

**Problem**: Circular dependency detected

```
Error: Circular dependency found: ServiceA -> ServiceB -> ServiceA
```

**Solution**:

1. Extract shared logic to new service
2. Use event bus for async communication
3. Inject factory instead of service
4. Refactor service boundaries

### Test Coverage Issues

**Problem**: Coverage below 95%

```
Uncovered Lines: 15-20, 45-50
```

**Solution**:

1. Add tests for uncovered lines
2. Test error paths
3. Test edge cases
4. Remove dead code

### Performance Degradation

**Problem**: Service slower than expected

```
Response time: 500ms (expected < 100ms)
```

**Solution**:

1. Add caching
2. Optimize database queries
3. Use batch operations
4. Profile with performance tools
5. Check for N+1 queries

---

## Quick Commands

### Run Tests

```bash
# All tests
npm test

# Specific service
npm test -- ContentCreationService

# With coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### Build

```bash
# Development
npm run build:dev

# Production
npm run build:prod
```

### Lint

```bash
# Check
npm run lint

# Fix
npm run lint:fix
```

### Type Check

```bash
npm run type-check
```

---

## Feature Flag Configuration

### Payment Service Rollout

```typescript
// config/featureFlags.ts
export const FEATURE_FLAGS = {
  NEW_PAYMENT_SERVICES: {
    enabled: process.env.ENABLE_NEW_PAYMENT_SERVICES === 'true',
    rolloutPercentage: parseInt(process.env.PAYMENT_ROLLOUT_PERCENTAGE || '0'),
  },
};

// Usage in route
if (FEATURE_FLAGS.NEW_PAYMENT_SERVICES.enabled) {
  // Use new PaymentProcessingService
  await paymentProcessingService.processPayment(invoice);
} else {
  // Use old PaymentService
  await oldPaymentService.processPayment(invoice);
}
```

### Gradual Rollout Strategy

```
Day 1: 1% traffic → Monitor closely
Day 2: 5% traffic → Check metrics
Day 3: 10% traffic → Verify no issues
Day 5: 25% traffic → Continued monitoring
Day 7: 50% traffic → Performance check
Day 10: 100% traffic → Full rollout
```

---

## Emergency Rollback Procedure

### If Critical Issue Found

1. **Immediately**: Set feature flag to 0%

   ```bash
   kubectl set env deployment/backend ENABLE_NEW_PAYMENT_SERVICES=false
   ```

2. **Verify**: Check rollback successful

   ```bash
   kubectl logs -f deployment/backend | grep "Using old payment service"
   ```

3. **Investigate**: Check logs and metrics

   ```bash
   kubectl logs deployment/backend --tail=1000 | grep ERROR
   ```

4. **Fix**: Address the issue in development

5. **Re-deploy**: Test thoroughly before re-enabling

---

## Contacts & Resources

### Team Contacts

- **Technical Lead**: [Name] - For architecture decisions
- **Payment Expert**: [Name] - For payment service questions
- **DevOps**: [Name] - For deployment issues
- **QA Lead**: [Name] - For testing questions

### Documentation

- [Architecture Decision Records](./ADRs/)
- [API Documentation](./api-docs/)
- [Developer Guide](./developer-guide.md)
- [Testing Guide](./testing-guide.md)

### Tools

- **DI Framework**: [InversifyJS Docs](https://inversify.io/)
- **Testing**: [Jest Docs](https://jestjs.io/)
- **TypeScript**: [TS Handbook](https://www.typescriptlang.org/docs/)

---

## Glossary

- **DI**: Dependency Injection
- **IoC**: Inversion of Control
- **SRP**: Single Responsibility Principle
- **ADR**: Architecture Decision Record
- **TTL**: Time To Live (cache)
- **PCI**: Payment Card Industry
- **MRR**: Monthly Recurring Revenue
- **LTV**: Lifetime Value
