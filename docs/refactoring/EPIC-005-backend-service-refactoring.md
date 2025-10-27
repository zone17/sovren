# Epic 005: Backend Service Refactoring

## Epic Summary

Refactor large, monolithic backend service classes (600+ lines) into smaller, focused services following Single Responsibility Principle and SOLID design patterns.

## Business Value

- **Maintainability**: 40% reduction in time to understand and modify services
- **Testing**: Easier unit testing with focused, isolated services
- **Reusability**: Smaller services can be composed and reused
- **Team Scalability**: Multiple developers can work on different services in parallel
- **Bug Reduction**: Smaller surface area reduces bug probability by ~25%

## Current State

### Problematic Service Classes

1. **ContentService.ts** (~680 lines)
   - Content creation, validation, publishing
   - Content moderation and filtering
   - Content search and recommendation
   - Content analytics and metrics
   - Content versioning and history
   - **Violates**: Single Responsibility Principle

2. **UserService.ts** (~650 lines)
   - User authentication and authorization
   - User profile management
   - User preferences and settings
   - User activity tracking
   - User relationship management (followers/following)
   - User analytics and segmentation
   - **Violates**: Single Responsibility Principle, Interface Segregation

3. **PaymentService.ts** (~720 lines)
   - Invoice generation
   - Payment processing
   - Subscription management
   - Refund handling
   - Payment analytics
   - Webhook processing
   - Currency conversion
   - **Violates**: Single Responsibility Principle

4. **NostrService.ts** (~550 lines)
   - Event publishing
   - Event validation
   - Relay management
   - Subscription handling
   - Profile sync
   - **Note**: Will be addressed in Epic 003

### Architectural Issues

- **High Coupling**: Services directly depend on each other
- **Low Cohesion**: Unrelated functionality in same class
- **Difficult Testing**: Mocking large services requires extensive setup
- **Code Duplication**: Similar patterns repeated across services
- **No Clear Contracts**: Interfaces not well-defined

## Desired End State

### Service-Oriented Architecture

```typescript
services/
├── content/
│   ├── ContentCreationService.ts      // Create, validate, draft
│   ├── ContentPublishingService.ts    // Publish, schedule, distribute
│   ├── ContentModerationService.ts    // Moderation, filtering, flagging
│   ├── ContentSearchService.ts        // Search, filter, indexing
│   ├── ContentRecommendationService.ts // Recommendations, personalization
│   ├── ContentAnalyticsService.ts     // Metrics, tracking, insights
│   └── ContentVersioningService.ts    // History, versions, rollback
├── user/
│   ├── UserAuthenticationService.ts   // Login, logout, sessions
│   ├── UserProfileService.ts          // Profile CRUD, validation
│   ├── UserPreferencesService.ts      // Settings, preferences
│   ├── UserActivityService.ts         // Activity tracking, logging
│   ├── UserRelationshipService.ts     // Follow, block, mute
│   └── UserAnalyticsService.ts        // User metrics, segmentation
├── payment/
│   ├── InvoiceService.ts              // Invoice generation, management
│   ├── PaymentProcessingService.ts    // Payment execution, verification
│   ├── SubscriptionService.ts         // Subscription lifecycle
│   ├── RefundService.ts               // Refund processing, approval
│   ├── PaymentAnalyticsService.ts     // Payment metrics, reporting
│   ├── WebhookService.ts              // Webhook handling, validation
│   └── CurrencyService.ts             // Conversion, pricing
└── shared/
    ├── EmailService.ts                 // Email notifications
    ├── NotificationService.ts          // Multi-channel notifications
    ├── AuditLogService.ts             // Audit trail, compliance
    └── CacheService.ts                 // Shared caching logic
```

### Design Patterns to Apply

1. **Repository Pattern**: Data access abstraction
2. **Service Layer Pattern**: Business logic encapsulation
3. **Dependency Injection**: Loose coupling, testability
4. **Strategy Pattern**: Interchangeable algorithms (e.g., payment methods)
5. **Observer Pattern**: Event-driven notifications
6. **Factory Pattern**: Service instantiation

## Success Criteria

- [ ] All services < 300 lines of code
- [ ] Each service has single, clear responsibility
- [ ] All services have interface definitions
- [ ] 95%+ test coverage maintained or improved
- [ ] All services use dependency injection
- [ ] Service contracts well-documented
- [ ] Integration tests updated
- [ ] No functionality regressions
- [ ] Performance maintained or improved

## Technical Scope

### Service Decomposition Strategy

#### ContentService → 7 Services
```typescript
// Before: 680 lines in ContentService.ts
class ContentService {
  create() { }
  publish() { }
  moderate() { }
  search() { }
  recommend() { }
  analytics() { }
  version() { }
}

// After: 7 focused services (~100 lines each)
interface IContentCreationService {
  createDraft(data: ContentDraft): Promise<Content>;
  validateContent(content: Content): ValidationResult;
  saveDraft(draft: ContentDraft): Promise<void>;
}

interface IContentPublishingService {
  publish(contentId: string): Promise<PublishResult>;
  schedule(contentId: string, publishAt: Date): Promise<void>;
  unpublish(contentId: string): Promise<void>;
}

// ... similar interfaces for other services
```

#### PaymentService → 7 Services
```typescript
interface IInvoiceService {
  generateInvoice(subscription: Subscription): Promise<Invoice>;
  sendInvoice(invoiceId: string): Promise<void>;
  getInvoice(invoiceId: string): Promise<Invoice>;
}

interface IPaymentProcessingService {
  processPayment(invoice: Invoice): Promise<PaymentResult>;
  verifyPayment(paymentId: string): Promise<boolean>;
  retryFailedPayment(paymentId: string): Promise<PaymentResult>;
}

interface ISubscriptionService {
  createSubscription(data: SubscriptionData): Promise<Subscription>;
  updateSubscription(id: string, data: Partial<SubscriptionData>): Promise<Subscription>;
  cancelSubscription(id: string): Promise<void>;
  renewSubscription(id: string): Promise<Subscription>;
}

// ... similar interfaces for other payment services
```

## Technical Approach

### Phase 1: Design & Interface Definition (2-3 days)
1. Analyze existing service responsibilities
2. Define bounded contexts for each service
3. Create interface definitions (contracts)
4. Design dependency injection structure
5. Create service interaction diagrams

### Phase 2: Extract Shared Utilities (1-2 days)
1. Identify common code across services
2. Extract to shared utility services
3. Create EmailService, NotificationService, etc.
4. Test shared services in isolation

### Phase 3: Refactor Content Services (2-3 days)
1. Create new service classes with interfaces
2. Migrate functionality from ContentService
3. Update tests for each new service
4. Wire up dependency injection
5. Update API routes to use new services

### Phase 4: Refactor User Services (2-3 days)
1. Follow same pattern as content services
2. Extract user-related services
3. Update authentication middleware
4. Update tests and integration points

### Phase 5: Refactor Payment Services (3-4 days)
1. **CRITICAL**: Extra care needed for payment logic
2. Extract payment services with comprehensive testing
3. Ensure no regression in payment flows
4. Update webhook handlers
5. Extensive integration testing

### Phase 6: Integration & Testing (2-3 days)
1. Wire all new services together
2. Run comprehensive integration test suite
3. Performance testing and optimization
4. Fix any regressions or issues

### Phase 7: Documentation & Cleanup (1-2 days)
1. Generate service architecture diagrams
2. Document service contracts and dependencies
3. Remove old monolithic services
4. Update API documentation

## Dependencies

### Blockers
- Type Safety Improvements (Epic 001) should be done first
- Payment TODO Resolution (Epic 002) should be integrated

### Related Work
- State Management Boundaries (Epic 004) affects frontend service consumption
- NOSTR Consolidation (Epic 003) eliminates NostrService refactoring

## Risks & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Breaking payment flows | Critical | Medium | Extensive testing, feature flags, canary deployment |
| Performance degradation | Medium | Low | Benchmark before/after, optimize DI container |
| Increased complexity | Medium | Medium | Clear documentation, proper DI setup |
| Testing gaps | High | Medium | Maintain 95%+ coverage, add integration tests |
| Database transaction issues | High | Low | Careful transaction boundary design |

## Estimated Effort

- **Total Story Points**: 34-55 points
- **Estimated Calendar Time**: 3-4 weeks
- **Team Size**: 2-3 backend developers

## Implementation Order

### Week 1
1. Design & interface definition
2. Extract shared utilities
3. Begin content service refactoring

### Week 2
4. Complete content services
5. Begin user service refactoring
6. Complete user services

### Week 3
7. Begin payment service refactoring (critical path)
8. Extensive payment testing

### Week 4
9. Complete payment services
10. Integration testing
11. Documentation and cleanup

## Testing Strategy

### Unit Tests
- Each service tested in isolation
- Mock all dependencies
- 95%+ coverage per service
- Test all error paths

### Integration Tests
- Test service interactions
- Test database transactions
- Test external API calls
- Test event publishing

### E2E Tests
- Critical user flows (signup, payment, content publishing)
- Cross-service workflows
- Error scenarios and recovery

### Performance Tests
- Benchmark service response times
- Load testing for payment services
- Database query optimization
- Memory leak detection

## Dependency Injection Setup

```typescript
// services/container.ts
import { Container } from 'inversify';
import { TYPES } from './types';

const container = new Container();

// Bind shared services
container.bind<IEmailService>(TYPES.EmailService).to(EmailService).inSingletonScope();
container.bind<ICacheService>(TYPES.CacheService).to(CacheService).inSingletonScope();

// Bind content services
container.bind<IContentCreationService>(TYPES.ContentCreationService).to(ContentCreationService);
container.bind<IContentPublishingService>(TYPES.ContentPublishingService).to(ContentPublishingService);

// Bind payment services
container.bind<IInvoiceService>(TYPES.InvoiceService).to(InvoiceService);
container.bind<IPaymentProcessingService>(TYPES.PaymentProcessingService).to(PaymentProcessingService);

export { container };
```

## Architecture Diagrams Required

1. **Service Architecture Overview**: All services and their relationships
2. **Content Service Decomposition**: Before/after ContentService breakdown
3. **Payment Service Flow**: Payment processing across multiple services
4. **Dependency Injection Structure**: DI container and service wiring
5. **Service Interaction Diagram**: Sequence diagram for critical flows

## Example Refactoring

### Before (Monolithic)
```typescript
// 680 lines in one file
class ContentService {
  async create(data: ContentData): Promise<Content> { /* 80 lines */ }
  async publish(id: string): Promise<void> { /* 120 lines */ }
  async moderate(id: string): Promise<void> { /* 90 lines */ }
  async search(query: string): Promise<Content[]> { /* 150 lines */ }
  async recommend(userId: string): Promise<Content[]> { /* 140 lines */ }
  async getAnalytics(id: string): Promise<Analytics> { /* 100 lines */ }
  // ... many private helper methods
}
```

### After (Service-Oriented)
```typescript
// ContentCreationService.ts (~100 lines)
@injectable()
class ContentCreationService implements IContentCreationService {
  constructor(
    @inject(TYPES.ContentRepository) private contentRepo: IContentRepository,
    @inject(TYPES.ValidationService) private validator: IValidationService
  ) {}

  async createDraft(data: ContentDraft): Promise<Content> {
    const validationResult = await this.validator.validateContent(data);
    if (!validationResult.isValid) {
      throw new ValidationError(validationResult.errors);
    }
    return this.contentRepo.save(data);
  }

  async saveDraft(draft: ContentDraft): Promise<void> {
    await this.contentRepo.saveDraft(draft);
  }
}

// ContentPublishingService.ts (~100 lines)
@injectable()
class ContentPublishingService implements IContentPublishingService {
  constructor(
    @inject(TYPES.ContentRepository) private contentRepo: IContentRepository,
    @inject(TYPES.NostrService) private nostr: INostrService,
    @inject(TYPES.EventBus) private eventBus: IEventBus
  ) {}

  async publish(contentId: string): Promise<PublishResult> {
    const content = await this.contentRepo.findById(contentId);
    await this.nostr.publishEvent(content);
    await this.eventBus.emit('content.published', { contentId });
    return { success: true, publishedAt: new Date() };
  }
}

// Similar focused services for other responsibilities...
```

## Performance Targets

- Service instantiation: < 5ms
- API endpoint response time: No regression
- Database query performance: Maintain or improve
- Memory footprint: < 10% increase (due to DI container)
- Test execution time: < 20% increase

## Documentation Requirements

- Service contract documentation (JSDoc/TSDoc)
- Dependency injection guide
- Service interaction diagrams
- Migration guide from old to new services
- ADR documenting the refactoring decision

## Notes

- **Strategic Refactoring** - Foundation for future scalability
- Consider extracting services to microservices in future
- Good opportunity to add observability/metrics per service
- May reveal opportunities for caching improvements
- Critical to maintain payment flow integrity
