# Service Development Guide

**Epic 005 Backend Service Refactoring - Creating Production-Grade Services**

---

## Table of Contents

1. [Service Architecture Overview](#service-architecture-overview)
2. [Service Template](#service-template)
3. [Interface Definition](#interface-definition)
4. [Implementation](#implementation)
5. [Repository Pattern](#repository-pattern)
6. [Event Emissions](#event-emissions)
7. [Caching Strategy](#caching-strategy)
8. [Error Handling](#error-handling)
9. [Logging](#logging)
10. [Testing](#testing)
11. [DI Registration](#di-registration)
12. [Best Practices](#best-practices)

---

## Service Architecture Overview

Sovren uses a **service-oriented architecture** with strict separation of concerns:

```
┌─────────────────────────────────────────────┐
│             Controllers (HTTP)               │
│  Validation, Request/Response Transformation │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│              Service Layer                   │
│  Business Logic, Orchestration, Events       │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│           Repository Layer                   │
│  Data Access, Query Building, Persistence    │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│              Database                        │
│  PostgreSQL, Redis, External APIs            │
└─────────────────────────────────────────────┘
```

### Key Principles

1. **Single Responsibility**: Each service handles one domain
2. **Dependency Injection**: All dependencies injected via constructor
3. **Interface-First**: Define interfaces before implementation
4. **Event-Driven**: Emit domain events for cross-service communication
5. **Testability**: Design for easy mocking and testing

---

## Service Template

### Directory Structure

```
packages/backend/src/
├── interfaces/
│   └── [domain]/
│       └── IMyService.ts           # Service interface
├── services/
│   └── [domain]/
│       ├── MyService.ts            # Service implementation
│       └── __tests__/
│           └── MyService.test.ts   # Unit tests
├── repositories/
│   └── MyRepository.ts             # Data access layer
└── types/
    └── [domain].ts                 # Domain types
```

### Boilerplate Service

```typescript
// packages/backend/src/services/[domain]/MyService.ts
import { injectable, inject } from 'inversify';
import { IMyService } from '@/interfaces/[domain]/IMyService';
import { ILogger } from '@/interfaces/ILogger';
import { IEventBus } from '@/interfaces/IEventBus';
import { ICacheService } from '@/interfaces/ICacheService';
import { MyRepository } from '@/repositories/MyRepository';
import { ServiceError } from '@/types/errors';

@injectable()
export class MyService implements IMyService {
  constructor(
    @inject('MyRepository') private readonly repository: MyRepository,
    @inject('ILogger') private readonly logger: ILogger,
    @inject('IEventBus') private readonly eventBus: IEventBus,
    @inject('ICacheService') private readonly cache: ICacheService
  ) {}

  async myMethod(params: MyParams): Promise<MyResult> {
    this.logger.info('MyService.myMethod called', { params });

    try {
      // 1. Validate input
      this.validateParams(params);

      // 2. Check cache
      const cached = await this.cache.get<MyResult>(`my:${params.id}`);
      if (cached) {
        this.logger.debug('Cache hit', { key: `my:${params.id}` });
        return cached;
      }

      // 3. Business logic
      const result = await this.performBusinessLogic(params);

      // 4. Persist data
      await this.repository.save(result);

      // 5. Cache result
      await this.cache.set(`my:${params.id}`, result, 3600);

      // 6. Emit event
      await this.eventBus.emit('my.created', {
        id: result.id,
        timestamp: new Date()
      });

      this.logger.info('MyService.myMethod completed', { resultId: result.id });
      return result;

    } catch (error) {
      this.logger.error('MyService.myMethod failed', { error, params });
      throw new ServiceError('Failed to execute myMethod', error);
    }
  }

  private validateParams(params: MyParams): void {
    if (!params.id) {
      throw new ServiceError('Invalid parameters: id is required');
    }
  }

  private async performBusinessLogic(params: MyParams): Promise<MyResult> {
    // Implement business logic here
    return { id: params.id, data: 'processed' };
  }
}
```

---

## Interface Definition

### Creating Service Interface

```typescript
// packages/backend/src/interfaces/[domain]/IMyService.ts
import { MyParams, MyResult } from '@/types/[domain]';

/**
 * Service interface for [domain] operations
 *
 * @interface IMyService
 * @description Handles business logic for [domain]
 */
export interface IMyService {
  /**
   * Performs the main operation
   *
   * @param params - Input parameters
   * @returns Promise resolving to operation result
   * @throws {ServiceError} If operation fails
   */
  myMethod(params: MyParams): Promise<MyResult>;

  /**
   * Retrieves entity by ID
   *
   * @param id - Entity identifier
   * @returns Promise resolving to entity or null
   */
  getById(id: string): Promise<MyResult | null>;

  /**
   * Updates existing entity
   *
   * @param id - Entity identifier
   * @param updates - Partial entity updates
   * @returns Promise resolving to updated entity
   */
  update(id: string, updates: Partial<MyResult>): Promise<MyResult>;

  /**
   * Deletes entity by ID
   *
   * @param id - Entity identifier
   * @returns Promise resolving to deletion success
   */
  delete(id: string): Promise<boolean>;
}
```

### Interface Best Practices

1. **Documentation**: JSDoc comments for all methods
2. **Promise Return Types**: All async operations return Promises
3. **Error Documentation**: Document thrown errors
4. **Parameter Validation**: Specify required/optional parameters
5. **Return Types**: Precise return types (avoid `any`)

---

## Implementation

### Service Class Structure

```typescript
@injectable()
export class ContentService implements IContentService {
  // 1. DEPENDENCIES (injected via constructor)
  constructor(
    @inject('ContentRepository') private readonly contentRepo: ContentRepository,
    @inject('NostrService') private readonly nostrService: NostrService,
    @inject('ILogger') private readonly logger: ILogger,
    @inject('IEventBus') private readonly eventBus: IEventBus,
    @inject('ICacheService') private readonly cache: ICacheService
  ) {}

  // 2. PUBLIC METHODS (interface implementation)
  async createContent(data: CreateContentDTO): Promise<Content> {
    // Implementation
  }

  async getContent(id: string): Promise<Content | null> {
    // Implementation
  }

  // 3. PRIVATE HELPER METHODS
  private validateContentData(data: CreateContentDTO): void {
    // Validation logic
  }

  private async publishToNostr(content: Content): Promise<void> {
    // NOSTR integration
  }

  // 4. UTILITY METHODS
  private getCacheKey(id: string): string {
    return `content:${id}`;
  }
}
```

### Dependency Injection Pattern

```typescript
// Use InversifyJS for DI
import { injectable, inject } from 'inversify';

@injectable()
export class PaymentService implements IPaymentService {
  constructor(
    // Required dependencies
    @inject('PaymentRepository')
    private readonly paymentRepo: PaymentRepository,

    // Optional dependencies with default
    @inject('ILogger')
    private readonly logger: ILogger = new ConsoleLogger(),

    // Service dependencies
    @inject('LightningService')
    private readonly lightning: ILightningService,

    @inject('CurrencyService')
    private readonly currency: ICurrencyService
  ) {}
}
```

---

## Repository Pattern

### Repository Interface

```typescript
// packages/backend/src/repositories/IContentRepository.ts
export interface IContentRepository {
  create(data: CreateContentData): Promise<Content>;
  findById(id: string): Promise<Content | null>;
  findByUserId(userId: string): Promise<Content[]>;
  update(id: string, data: Partial<Content>): Promise<Content>;
  delete(id: string): Promise<boolean>;
}
```

### Repository Implementation

```typescript
// packages/backend/src/repositories/ContentRepository.ts
@injectable()
export class ContentRepository implements IContentRepository {
  constructor(
    @inject('DatabaseConnection') private readonly db: DatabaseConnection
  ) {}

  async create(data: CreateContentData): Promise<Content> {
    const result = await this.db.query(
      `INSERT INTO content (title, body, user_id, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [data.title, data.body, data.userId]
    );
    return this.mapToContent(result.rows[0]);
  }

  async findById(id: string): Promise<Content | null> {
    const result = await this.db.query(
      `SELECT * FROM content WHERE id = $1`,
      [id]
    );
    return result.rows[0] ? this.mapToContent(result.rows[0]) : null;
  }

  private mapToContent(row: any): Content {
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      userId: row.user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
```

### Repository Best Practices

1. **SQL Parameterization**: Always use parameterized queries
2. **Mapping Layer**: Separate DB schema from domain models
3. **Transaction Support**: Wrap related operations in transactions
4. **Error Handling**: Catch and transform database errors
5. **Performance**: Use indexes, limit queries, avoid N+1

---

## Event Emissions

### Event Bus Integration

```typescript
// Emit domain events for cross-service communication
export class SubscriptionService implements ISubscriptionService {
  async createSubscription(data: CreateSubscriptionData): Promise<Subscription> {
    const subscription = await this.repository.create(data);

    // Emit event
    await this.eventBus.emit('subscription.created', {
      subscriptionId: subscription.id,
      userId: subscription.userId,
      creatorId: subscription.creatorId,
      amount: subscription.amount,
      timestamp: new Date()
    });

    return subscription;
  }

  async cancelSubscription(id: string): Promise<void> {
    await this.repository.update(id, { status: 'canceled' });

    await this.eventBus.emit('subscription.canceled', {
      subscriptionId: id,
      timestamp: new Date()
    });
  }
}
```

### Event Subscription

```typescript
// Subscribe to events from other services
export class NotificationService implements INotificationService {
  async initialize(): Promise<void> {
    // Subscribe to subscription events
    this.eventBus.on('subscription.created', this.handleSubscriptionCreated.bind(this));
    this.eventBus.on('subscription.canceled', this.handleSubscriptionCanceled.bind(this));

    // Subscribe to payment events
    this.eventBus.on('payment.completed', this.handlePaymentCompleted.bind(this));
  }

  private async handleSubscriptionCreated(event: SubscriptionCreatedEvent): Promise<void> {
    await this.sendNotification({
      userId: event.userId,
      type: 'subscription_created',
      data: event
    });
  }
}
```

### Event Types

```typescript
// packages/backend/src/types/events.ts
export interface DomainEvent {
  type: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface SubscriptionCreatedEvent extends DomainEvent {
  type: 'subscription.created';
  subscriptionId: string;
  userId: string;
  creatorId: string;
  amount: number;
}

export interface PaymentCompletedEvent extends DomainEvent {
  type: 'payment.completed';
  paymentId: string;
  amount: number;
  currency: string;
}
```

---

## Caching Strategy

### Multi-Layer Caching

```typescript
export class ContentService implements IContentService {
  private readonly CACHE_TTL = {
    CONTENT: 3600,      // 1 hour
    CONTENT_LIST: 300,  // 5 minutes
    USER_CONTENT: 600   // 10 minutes
  };

  async getContent(id: string): Promise<Content | null> {
    // Layer 1: Memory cache (if available)
    const memCached = this.memCache.get(`content:${id}`);
    if (memCached) return memCached;

    // Layer 2: Redis cache
    const cached = await this.cache.get<Content>(`content:${id}`);
    if (cached) {
      this.memCache.set(`content:${id}`, cached);
      return cached;
    }

    // Layer 3: Database
    const content = await this.repository.findById(id);
    if (content) {
      await this.cache.set(`content:${id}`, content, this.CACHE_TTL.CONTENT);
      this.memCache.set(`content:${id}`, content);
    }

    return content;
  }
}
```

### Cache Invalidation

```typescript
export class ContentService implements IContentService {
  async updateContent(id: string, updates: Partial<Content>): Promise<Content> {
    const updated = await this.repository.update(id, updates);

    // Invalidate caches
    await this.invalidateContentCaches(id, updated.userId);

    return updated;
  }

  private async invalidateContentCaches(contentId: string, userId: string): Promise<void> {
    // Invalidate specific content
    await this.cache.delete(`content:${contentId}`);
    this.memCache.delete(`content:${contentId}`);

    // Invalidate user's content list
    await this.cache.deletePattern(`user:${userId}:content:*`);

    // Invalidate aggregates
    await this.cache.delete(`content:trending`);
  }
}
```

---

## Error Handling

### Service Error Class

```typescript
// packages/backend/src/types/errors.ts
export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'SERVICE_ERROR',
    public readonly statusCode: number = 500,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ServiceError';
    Object.setPrototypeOf(this, ServiceError.prototype);
  }
}

export class ValidationError extends ServiceError {
  constructor(message: string, cause?: Error) {
    super(message, 'VALIDATION_ERROR', 400, cause);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ServiceError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends ServiceError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}
```

### Error Handling Pattern

```typescript
export class PaymentService implements IPaymentService {
  async processPayment(paymentId: string): Promise<Payment> {
    try {
      // Validate payment exists
      const payment = await this.repository.findById(paymentId);
      if (!payment) {
        throw new NotFoundError('Payment', paymentId);
      }

      // Validate payment state
      if (payment.status !== 'pending') {
        throw new ValidationError(`Payment already processed: ${payment.status}`);
      }

      // Process payment
      const result = await this.lightning.sendPayment(payment.invoice);

      // Update payment
      return await this.repository.update(paymentId, {
        status: 'completed',
        preimage: result.preimage
      });

    } catch (error) {
      this.logger.error('Payment processing failed', {
        paymentId,
        error: error.message,
        stack: error.stack
      });

      if (error instanceof ServiceError) {
        throw error;  // Re-throw known errors
      }

      // Wrap unknown errors
      throw new ServiceError(
        'Payment processing failed',
        'PAYMENT_ERROR',
        500,
        error
      );
    }
  }
}
```

---

## Logging

### Structured Logging

```typescript
export class SubscriptionService implements ISubscriptionService {
  async renewSubscription(id: string): Promise<Subscription> {
    const startTime = Date.now();

    this.logger.info('Subscription renewal started', {
      subscriptionId: id,
      operation: 'renew'
    });

    try {
      const subscription = await this.repository.findById(id);

      this.logger.debug('Subscription loaded', {
        subscriptionId: id,
        status: subscription.status,
        expiresAt: subscription.expiresAt
      });

      // Renewal logic...

      const duration = Date.now() - startTime;
      this.logger.info('Subscription renewed successfully', {
        subscriptionId: id,
        duration,
        newExpiresAt: subscription.expiresAt
      });

      return subscription;

    } catch (error) {
      this.logger.error('Subscription renewal failed', {
        subscriptionId: id,
        error: error.message,
        stack: error.stack,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }
}
```

### Log Levels

| Level | Usage | Example |
|-------|-------|---------|
| **error** | Unrecoverable errors | Payment processing failed |
| **warn** | Recoverable issues | Cache miss, retry attempt |
| **info** | Important events | User created, subscription renewed |
| **debug** | Detailed flow | Cache hit, validation passed |
| **trace** | Extremely detailed | Function entry/exit, variable values |

---

## Testing

### Unit Test Template

```typescript
// packages/backend/src/services/__tests__/MyService.test.ts
import { MyService } from '../MyService';
import { MyRepository } from '@/repositories/MyRepository';
import { MockLogger } from '@/test-utils/mocks';

describe('MyService', () => {
  let service: MyService;
  let mockRepository: jest.Mocked<MyRepository>;
  let mockLogger: MockLogger;
  let mockEventBus: jest.Mocked<IEventBus>;
  let mockCache: jest.Mocked<ICacheService>;

  beforeEach(() => {
    // Create mocks
    mockRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    } as any;

    mockLogger = new MockLogger();
    mockEventBus = { emit: jest.fn(), on: jest.fn() } as any;
    mockCache = { get: jest.fn(), set: jest.fn(), delete: jest.fn() } as any;

    // Create service instance
    service = new MyService(
      mockRepository,
      mockLogger,
      mockEventBus,
      mockCache
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('myMethod', () => {
    it('should create entity successfully', async () => {
      // Arrange
      const input = { id: '123', data: 'test' };
      const expected = { id: '123', data: 'processed' };
      mockRepository.create.mockResolvedValue(expected);

      // Act
      const result = await service.myMethod(input);

      // Assert
      expect(result).toEqual(expected);
      expect(mockRepository.create).toHaveBeenCalledWith(input);
      expect(mockEventBus.emit).toHaveBeenCalledWith('my.created', expect.any(Object));
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should throw error for invalid input', async () => {
      // Arrange
      const input = { id: '', data: 'test' };

      // Act & Assert
      await expect(service.myMethod(input)).rejects.toThrow(ServiceError);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should use cache when available', async () => {
      // Arrange
      const cached = { id: '123', data: 'cached' };
      mockCache.get.mockResolvedValue(cached);

      // Act
      const result = await service.myMethod({ id: '123', data: 'test' });

      // Assert
      expect(result).toEqual(cached);
      expect(mockRepository.create).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('Cache hit', expect.any(Object));
    });
  });
});
```

### Test Coverage Requirements

- **Services**: 95%+ coverage required
- **Critical Paths**: 100% coverage required (payments, auth)
- **Edge Cases**: All error scenarios tested
- **Integration**: Cross-service interactions tested

---

## DI Registration

### Container Configuration

```typescript
// packages/backend/src/container/services.ts
import { Container } from 'inversify';
import { MyService } from '@/services/MyService';
import { MyRepository } from '@/repositories/MyRepository';

export function registerServices(container: Container): void {
  // Repositories
  container.bind('MyRepository').to(MyRepository).inSingletonScope();

  // Services
  container.bind<IMyService>('IMyService').to(MyService).inSingletonScope();

  // Bind interface to implementation
  container.bind('MyService').to(MyService).inSingletonScope();
}
```

### Service Resolution

```typescript
// Resolve service from container
const container = new Container();
registerServices(container);

const myService = container.get<IMyService>('IMyService');
const result = await myService.myMethod({ id: '123', data: 'test' });
```

---

## Best Practices

### 1. Keep Services Focused

```typescript
// ✅ GOOD: Single responsibility
class UserAuthenticationService {
  async login(credentials: Credentials): Promise<AuthToken> { }
  async logout(token: string): Promise<void> { }
  async refreshToken(token: string): Promise<AuthToken> { }
}

// ❌ BAD: Multiple responsibilities
class UserService {
  async login() { }
  async createUser() { }
  async sendEmail() { }
  async processPayment() { }
}
```

### 2. Use Domain Events

```typescript
// ✅ GOOD: Loose coupling via events
async createSubscription(data: CreateSubscriptionData): Promise<Subscription> {
  const subscription = await this.repository.create(data);
  await this.eventBus.emit('subscription.created', subscription);
  return subscription;
}

// ❌ BAD: Tight coupling
async createSubscription(data: CreateSubscriptionData): Promise<Subscription> {
  const subscription = await this.repository.create(data);
  await this.emailService.sendConfirmation(subscription);
  await this.analyticsService.track(subscription);
  await this.notificationService.notify(subscription);
  return subscription;
}
```

### 3. Validate Early

```typescript
// ✅ GOOD: Validate at service boundary
async createPayment(data: CreatePaymentData): Promise<Payment> {
  this.validatePaymentData(data);  // Fail fast

  const payment = await this.repository.create(data);
  return payment;
}

// ❌ BAD: Late validation
async createPayment(data: CreatePaymentData): Promise<Payment> {
  const payment = await this.repository.create(data);

  if (!data.amount || data.amount <= 0) {  // Too late
    throw new Error('Invalid amount');
  }

  return payment;
}
```

### 4. Design for Testability

```typescript
// ✅ GOOD: Dependencies injected
class PaymentService {
  constructor(
    private readonly repository: PaymentRepository,
    private readonly lightning: LightningService
  ) {}
}

// ❌ BAD: Hard-coded dependencies
class PaymentService {
  private repository = new PaymentRepository();
  private lightning = new LightningService();
}
```

---

**Next**: [API Development Guide](/docs/development/api-development.md)

---

**Last Updated**: 2025-10-27
**Epic**: Epic 005 - Backend Service Refactoring
**Story**: US-E5-039 - Developer Documentation
