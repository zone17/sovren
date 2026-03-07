# Phase 3: Content Services Implementation Guide

## Overview

7 Content Services to be implemented in parallel by specialized agents.

## Service Specifications

### 1. ContentCreationService (US-E5-011)

**File**: `ContentCreationService.ts`

- Draft management with auto-save
- Media upload and optimization
- Content validation
- Metadata extraction
- Integration: AuditLog, Cache, EventBus

### 2. ContentPublishingService (US-E5-012)

**File**: `ContentPublishingService.ts`

- Immediate and scheduled publishing
- NOSTR event distribution
- Cross-posting to social media
- Version finalization
- Integration: NostrService, EventBus, Notification

### 3. ContentModerationService (US-E5-013)

**File**: `ContentModerationService.ts`

- AI-powered content analysis
- Rule-based filtering
- Manual review queue
- Appeal workflow
- Integration: AI service, AuditLog, Notification

### 4. ContentSearchService (US-E5-014)

**File**: `ContentSearchService.ts`

- Elasticsearch integration
- Full-text search with highlighting
- Faceted search
- Auto-suggestions
- Integration: Elasticsearch, Cache

### 5. ContentRecommendationService (US-E5-015)

**File**: `ContentRecommendationService.ts`

- Collaborative filtering
- Content-based recommendations
- Trending algorithms
- Personalization engine
- Integration: ML pipeline, Cache

### 6. ContentAnalyticsService (US-E5-016)

**File**: `ContentAnalyticsService.ts`

- View tracking (unique/total)
- Engagement metrics
- Real-time analytics
- Custom reports
- Integration: Redis, EventBus

### 7. ContentVersioningService (US-E5-017)

**File**: `ContentVersioningService.ts`

- Version history with deltas
- Rollback capability
- Diff visualization
- Merge conflict resolution
- Integration: Database, AuditLog

## Implementation Pattern

Each service MUST follow this structure:

```typescript
import { injectable, inject } from 'inversify';
import { TYPES } from '../../container/types';
import { IServiceInterface } from '../../interfaces';

@injectable()
export class ServiceName implements IServiceInterface {
  constructor(
    @inject(TYPES.EventBus) private eventBus: IEventBusService,
    @inject(TYPES.AuditLog) private auditLog: IAuditLogService,
    @inject(TYPES.Cache) private cache: ICacheService
    // ... other dependencies
  ) {}

  public async methodName(params: ParamType): Promise<ReturnType> {
    try {
      // Pre-validation
      this.validateParams(params);

      // Check cache if applicable
      const cacheKey = this.getCacheKey(params);
      const cached = await this.cache.get(cacheKey);
      if (cached) return cached;

      // Core logic
      const result = await this.performOperation(params);

      // Audit logging
      await this.auditLog.log({
        action: 'service.method',
        details: { params, result },
        userId: params.userId,
      });

      // Event emission
      await this.eventBus.emit('service.event', {
        timestamp: Date.now(),
        data: result,
      });

      // Cache result if applicable
      await this.cache.set(cacheKey, result, 300);

      return result;
    } catch (error) {
      // Error handling with context
      throw new ServiceError('Operation failed', {
        cause: error,
        context: { params },
      });
    }
  }
}
```

## Test Pattern

Each service MUST have comprehensive tests:

```typescript
describe('ServiceName', () => {
  let service: ServiceName;
  let mockEventBus: jest.Mocked<IEventBusService>;
  let mockAuditLog: jest.Mocked<IAuditLogService>;

  beforeEach(() => {
    // Setup mocks and service
  });

  describe('methodName', () => {
    it('should perform expected operation', async () => {
      // Test implementation
    });

    it('should emit events', async () => {
      // Verify event emission
    });

    it('should log to audit trail', async () => {
      // Verify audit logging
    });

    it('should handle errors gracefully', async () => {
      // Error scenario testing
    });
  });
});
```

## Database Schema Requirements

Each content service needs these tables/collections:

```sql
-- Content table
CREATE TABLE content (
  id UUID PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(200) UNIQUE NOT NULL,
  content TEXT NOT NULL,
  status ENUM('draft', 'published', 'archived'),
  author_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP,
  metadata JSONB
);

-- Content versions
CREATE TABLE content_versions (
  id UUID PRIMARY KEY,
  content_id UUID REFERENCES content(id),
  version_number INTEGER NOT NULL,
  delta JSONB NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Content analytics
CREATE TABLE content_analytics (
  content_id UUID REFERENCES content(id),
  date DATE NOT NULL,
  views INTEGER DEFAULT 0,
  unique_views INTEGER DEFAULT 0,
  engagement_score DECIMAL(5,2),
  PRIMARY KEY (content_id, date)
);
```

## Quality Checklist

Each service MUST meet these criteria:

- [ ] 95%+ test coverage
- [ ] TypeScript strict mode compliance
- [ ] No `any` types
- [ ] All methods have JSDoc
- [ ] Error handling with context
- [ ] Event emission for monitoring
- [ ] Audit logging for compliance
- [ ] Performance benchmarked
- [ ] Integration tests passing
- [ ] DI container registration
- [ ] README documentation

## Parallel Execution Instructions

### For Agent Assignment:

1. Each agent takes 1-2 services
2. Create service file in `/packages/backend/src/services/content/`
3. Create test file in `/packages/backend/src/services/content/__tests__/`
4. Register in ServiceContainer
5. Update EPIC_005_STATUS.md
6. Commit with conventional format

### Coordination Points:

- Shared interfaces in `/packages/backend/src/interfaces/content/`
- Common types in `/packages/shared/src/types/content.ts`
- Event definitions in `EventBusService.ts`
- Database migrations in `/packages/backend/src/database/migrations/`

## Expected Output

Each completed service should have:

1. `ServiceName.ts` - Implementation (500-800 lines)
2. `ServiceName.test.ts` - Tests (600-1000 lines)
3. `IServiceName.ts` - Interface definition
4. Migration file if new tables needed
5. Updated container registration
6. 95%+ coverage report

## Success Metrics

- All 7 services implemented
- Average 95%+ test coverage
- All integration tests passing
- Event bus integration verified
- Audit logging operational
- Performance benchmarks met
- Documentation complete

---

**Start Time**: ${new Date().toISOString()}
**Target Completion**: 3-4 hours
**Quality Standard**: Sovren Elite (99/100)
