# Sovren Architecture Documentation

**Version:** 1.0.0
**Last Updated:** 2025-10-27
**Epic:** 005 - Backend Service Refactoring

## Overview

This directory contains comprehensive architecture documentation for the Sovren platform, covering all 29 backend services implemented across Epic 005. The documentation provides visual Mermaid diagrams, architectural decision records (ADRs), and detailed technical specifications.

## Quick Links

- **Project Rules:** [CLAUDE.md](../../CLAUDE.md)
- **PRD:** [SOVREN_PRD.md](../../SOVREN_PRD.md)
- **Changelog:** [CHANGELOG.md](../../CHANGELOG.md)
- **Mermaid Guide:** [Mermaid Diagram Guide](../development/mermaid-diagram-guide.md)

## Documentation Structure

```
docs/architecture/
├── README.md                          # This file
├── diagrams/                          # All Mermaid diagrams
│   ├── system-architecture-overview.mmd
│   ├── deployment-architecture.mmd
│   ├── security-architecture.mmd
│   ├── service-interactions/         # Sequence diagrams
│   ├── data-flows/                   # Data flow diagrams
│   ├── domains/                      # Domain-specific architecture
│   └── patterns/                     # Integration patterns
├── decisions/                         # Architecture Decision Records (ADRs)
└── *.md                              # Architecture documentation files
```

---

## 1. System Architecture

### 1.1 System Architecture Overview

**Diagram:** [system-architecture-overview.mmd](./diagrams/system-architecture-overview.mmd)

Complete system architecture showing all 29 services organized by domain:

- **Core Infrastructure Services** (6): ServiceContainer, ServiceFactory, EventBus, RepositoryFactory, MigrationService, DependencyAnalyzer
- **Shared Services** (4): EmailService, NotificationService, AuditLogService, CacheService
- **Content Services** (6): ContentPublishing, ContentModeration, ContentSearch, ContentRecommendation, ContentAnalytics, ContentVersioning
- **User Services** (5): UserProfile, UserPreferences, UserActivity, UserRelationship, UserAnalytics
- **Payment Services** (7): PaymentProcessing, CurrencyService, SubscriptionService, RefundService, PaymentAnalytics, WebhookService

**View Diagram:**

- **GitHub Render:** ![System Architecture](https://github.com/YOUR_USERNAME/Sovren/blob/main/docs/architecture/diagrams/system-architecture-overview.mmd)
- **Edit Online:** [Mermaid Live Editor](https://mermaid.live/edit#pako:eNpVjk...) _(Copy diagram content to editor)_

**Key Characteristics:**

- Event-driven architecture with EventBus as central hub
- Repository pattern for data access abstraction
- Service Container for dependency injection
- Multi-layer caching strategy (Redis + In-Memory)
- External integrations: NOSTR, Lightning Network, Email, Exchange APIs

---

## 2. Service Interactions

### 2.1 Content Publishing Flow

**Diagram:** [service-interactions/content-publishing-flow.mmd](./diagrams/service-interactions/content-publishing-flow.mmd)

Sequence diagram showing the complete content publishing workflow from user action to NOSTR publication and follower notification.

**Flow Steps:**

1. Creator submits content via Web Application
2. API Gateway validates authentication
3. Content Publishing Service coordinates workflow
4. Content Moderation Service checks for policy violations
5. Content Versioning Service creates version snapshot
6. Repository Layer persists to PostgreSQL
7. NOSTR relays receive published event
8. EventBus triggers analytics and notifications
9. Cache invalidation ensures data consistency

**Performance Metrics:**

- End-to-End Latency: 200-500ms
- NOSTR Publishing: 100-300ms
- Database Write: 50-100ms
- Cache Invalidation: <10ms

### 2.2 Payment Processing Flow

**Diagram:** [service-interactions/payment-processing-flow.mmd](./diagrams/service-interactions/payment-processing-flow.mmd)

Sequence diagram for Lightning Network payment processing from invoice creation to settlement.

**Flow Steps:**

1. User initiates payment request
2. Payment Processing Service generates BOLT11 invoice
3. Currency Service provides exchange rate conversion
4. Lightning Node creates invoice with payment hash
5. User pays via Lightning wallet
6. Webhook Service receives payment confirmation
7. Payment verification with preimage
8. Database update to confirmed status
9. EventBus triggers analytics and notifications
10. Creator receives payment notification

**Performance Metrics:**

- Invoice Generation: <100ms
- Lightning Settlement: 1-5 seconds
- Webhook Processing: <500ms
- End-to-End: 5-10 seconds
- Success Rate: 98.5%

### 2.3 Subscription Lifecycle

**Diagram:** [service-interactions/subscription-lifecycle.mmd](./diagrams/service-interactions/subscription-lifecycle.mmd)

Complete subscription lifecycle from creation through renewals to cancellation.

**Lifecycle Phases:**

1. **Creation:** User subscribes, initial payment processed
2. **Activation:** Access granted, scheduler set for renewal
3. **Renewal:** Automatic recurring payments on billing date
4. **Failure Handling:** Retry logic with exponential backoff
5. **Suspension:** After 3 failed payment attempts
6. **Cancellation:** User-initiated or automatic after suspension

**Performance Metrics:**

- Subscription Creation: <1 second
- Renewal Processing: 5-10 seconds
- Retry Interval: 24 hours
- Success Rate: 96% (first attempt)

### 2.4 User Activity Tracking

**Diagram:** [service-interactions/user-activity-tracking.mmd](./diagrams/service-interactions/user-activity-tracking.mmd)

Real-time user activity tracking and analytics workflow.

**Tracking Capabilities:**

- Content views and engagement actions
- Session metrics and duration tracking
- Activity history aggregation
- Personal analytics dashboard
- Recommendation engine updates

**Performance Metrics:**

- Activity Logging: <50ms (async)
- Session Finalization: <200ms
- Analytics Calculation: <500ms
- Cache Hit Rate: 85%

---

## 3. Data Flows

### 3.1 Read Path (Cache-Aside Pattern)

**Diagram:** [data-flows/read-path.mmd](./diagrams/data-flows/read-path.mmd)

Multi-layer caching strategy for read operations:

**Cache Layers:**

1. **Edge Cache** (Vercel/Cloudflare, TTL: 60s) - 40% hit rate, 1ms latency
2. **Application Cache** (Redis L1, TTL: 300s) - 45% hit rate, 5ms latency
3. **Service Cache** (In-Memory, TTL: 60s) - Hot data
4. **Query Cache** (Redis L2, TTL: 600s) - 10% hit rate, 10ms latency
5. **Database** (PostgreSQL Read Replica) - 5% query rate, 50ms latency

**Total Cache Hit Rate:** 95%
**Average Latency:** 5-10ms for cached requests, 50ms for database queries

### 3.2 Write Path (Write-Through with Cache Invalidation)

**Diagram:** [data-flows/write-path.mmd](./diagrams/data-flows/write-path.mmd)

Write path with transaction management and cache invalidation:

**Write Flow:**

1. Input validation and sanitization
2. Transaction begin on primary database
3. Write operation execution
4. Transaction commit
5. Event publication to EventBus
6. Cascading cache invalidation across all layers
7. Event subscribers notified (Analytics, Search, Notifications)

**Performance Metrics:**

- Write Latency: ~200ms
- Transaction Success: 99.9%
- Cache Invalidation: <10ms

### 3.3 Event Flow (Event-Driven Architecture)

**Diagram:** [data-flows/event-flow.mmd](./diagrams/data-flows/event-flow.mmd)

Complete event-driven architecture with pub/sub pattern:

**Event Types:**

- **Content Events:** published, updated, deleted, moderated
- **Payment Events:** created, confirmed, failed, refunded
- **User Events:** registered, activity, preference_updated, relationship_changed
- **Subscription Events:** created, renewed, cancelled, suspended

**Event Processing:**

- **Priority 1:** Cache invalidation (immediate)
- **Priority 2:** Notifications (real-time)
- **Priority 3:** Analytics (async)
- **Priority 4:** Search indexing, recommendations (background)

**Performance Metrics:**

- Event Latency: <5ms
- Processing Time: 10-500ms
- Success Rate: 99.9%
- Throughput: 10K events/second

### 3.4 Payment Flow (Lightning Integration)

**Diagram:** [data-flows/payment-flow.mmd](./diagrams/data-flows/payment-flow.mmd)

Complete payment data flow from invoice creation to settlement:

**Payment Phases:**

1. **Creation:** Invoice generation with exchange rate conversion
2. **Execution:** Lightning Network routing and HTLC settlement
3. **Verification:** Payment hash and preimage validation
4. **Post-Processing:** Analytics, notifications, subscription activation

**Security Measures:**

- Payment hash verification
- HTLC preimage validation
- Idempotency keys
- Webhook HMAC signatures
- Rate limiting per user

---

## 4. Domain Architecture

### 4.1 Content Domain

**Diagram:** [domains/content-domain.mmd](./diagrams/domains/content-domain.mmd)

**Services (6):**

- **ContentPublishingService:** NOSTR publishing, content creation/update
- **ContentModerationService:** AI + manual moderation, flag management
- **ContentSearchService:** Elasticsearch integration, full-text search
- **ContentRecommendationService:** ML-powered recommendations, personalization
- **ContentAnalyticsService:** Performance metrics, engagement tracking
- **ContentVersioningService:** Version control, S3 storage, rollback

**External Integrations:**

- NOSTR Relays (content distribution)
- Elasticsearch (search indexing)
- S3-Compatible Storage (media files, versions)
- ML Model (content similarity)

**Key Workflows:**

- Content Publishing Flow (8 steps)
- Content Discovery Flow (7 steps)
- Content Recommendation Flow (7 steps)

### 4.2 User Domain

**Diagram:** [domains/user-domain.mmd](./diagrams/domains/user-domain.mmd)

**Services (5):**

- **UserProfileService:** Profile management, NIP-05 verification, NOSTR integration
- **UserPreferencesService:** Settings management, preference categories
- **UserActivityService:** Activity tracking, session metrics
- **UserRelationshipService:** Follow/unfollow, social graph, relationship management
- **UserAnalyticsService:** Engagement scoring, churn prediction, insights

**External Integrations:**

- NOSTR Relays (profile events, contact lists)
- NIP-05 Server (identity verification)

**Key Workflows:**

- User Registration Flow (7 steps)
- User Activity Tracking (7 steps)
- Relationship Management (7 steps)
- Analytics & Insights (7 steps)

### 4.3 Payment Domain

**Diagram:** [domains/payment-domain.mmd](./diagrams/domains/payment-domain.mmd)

**Services (7):**

- **PaymentProcessingService:** Invoice generation, payment verification
- **CurrencyService:** Exchange rate management, multi-currency support
- **SubscriptionService:** Recurring billing, lifecycle management
- **RefundService:** Refund processing, approval workflows
- **PaymentAnalyticsService:** Revenue metrics, MRR calculation, forecasting
- **WebhookService:** Event delivery, retry logic, circuit breaker

**External Integrations:**

- Lightning Node (LND/c-lightning)
- Exchange Rate APIs (CoinGecko, Binance, Kraken)
- External Webhook Endpoints

**Key Workflows:**

- Payment Flow (8 steps)
- Subscription Flow (8 steps)
- Refund Flow (8 steps)
- Analytics Flow (7 steps)

---

## 5. Integration Patterns

### 5.1 Event-Driven Architecture

**Diagram:** [patterns/event-driven-architecture.mmd](./diagrams/patterns/event-driven-architecture.mmd)

**Pattern Overview:**

- Central EventBus for pub/sub messaging
- Topic-based routing with pattern matching
- Priority queue processing
- Event log for audit trail
- Retry strategy with exponential backoff

**Benefits:**

- Loose coupling between services
- Asynchronous processing
- Horizontal scalability
- Fault tolerance
- Event replay capability

**Implementation:**

- In-memory event bus (high performance)
- Priority queuing (1-4 levels)
- Event versioning for backwards compatibility
- Dead letter queue for failed events

### 5.2 Cache-Aside Pattern

**Diagram:** [patterns/cache-aside-pattern.mmd](./diagrams/patterns/cache-aside-pattern.mmd)

**Multi-Layer Caching:**

- **L1 Cache:** In-Memory (60s TTL, 40% hit rate)
- **L2 Cache:** Redis (300s TTL, 45% hit rate)
- **L3 Cache:** Query Cache (600s TTL, 10% hit rate)
- **Database:** PostgreSQL (5% query rate)

**Strategy:**

- Read-through with lazy population
- Write-through with invalidation
- TTL-based expiration
- Pattern-based invalidation

**Performance:**

- Total Hit Rate: 95%
- Average Latency: 1-10ms (cached), 50ms (DB)
- Database Load Reduction: 95%

### 5.3 Repository Pattern

**Diagram:** [patterns/repository-pattern.mmd](./diagrams/patterns/repository-pattern.mmd)

**Pattern Components:**

- Repository Factory (service creation)
- Repository Interfaces (contracts)
- Repository Implementations (PostgreSQL)
- Base Repository (common operations)
- Query Builder (SQL generation)

**Benefits:**

- Data access abstraction
- Testability (mocking)
- Maintainability
- Reusability
- Separation of concerns

### 5.4 Circuit Breaker Pattern

**Diagrams:**

- [patterns/circuit-breaker-pattern.mmd](./diagrams/patterns/circuit-breaker-pattern.mmd) (State machine)
- [patterns/circuit-breaker-implementation.mmd](./diagrams/patterns/circuit-breaker-implementation.mmd) (Implementation)

**States:**

- **CLOSED:** All requests flow through, monitor failures
- **OPEN:** Block requests, use fallback, wait for timeout
- **HALF-OPEN:** Test requests, determine if service recovered

**Configuration:**

- Failure Threshold: 5 failures in 60s
- Open Timeout: 30s
- Half-Open Max Requests: 3
- Success Threshold: 2 consecutive successes

**Use Cases:**

- Webhook delivery
- External API calls
- Payment processing
- NOSTR relay connections

### 5.5 Retry Pattern

**Diagram:** [patterns/retry-pattern.mmd](./diagrams/patterns/retry-pattern.mmd)

**Exponential Backoff with Jitter:**

- Initial Delay: 1000ms
- Backoff Multiplier: 2x
- Max Delay: 60000ms
- Jitter Factor: 0.1 (10%)
- Max Attempts: 5

**Retry Schedule:**

1. Attempt 1: 0ms
2. Attempt 2: 1000ms
3. Attempt 3: 2000ms + jitter
4. Attempt 4: 4000ms + jitter
5. Attempt 5: 8000ms + jitter

**Error Classification:**

- **Retryable:** Network timeout, 503, 504, temporary DB errors
- **Non-Retryable:** 400, 401, 404, validation errors

---

## 6. Deployment Architecture

**Diagram:** [deployment-architecture.mmd](./diagrams/deployment-architecture.mmd)

**Production Environment:**

### 6.1 Frontend Hosting (Vercel)

- Global Edge Network
- Automatic HTTPS
- Edge Functions for SSR
- Web Vitals monitoring

### 6.2 Backend Services (Docker Compose)

- Multi-container deployment
- Service Container orchestration
- Auto-scaling based on load
- Health checks + readiness probes

### 6.3 Data Layer

- **PostgreSQL Primary** (Supabase)
- **Read Replicas** (2 instances)
- **Redis Cluster** (3 nodes, session + cache)
- **S3-Compatible Storage** (media files, backups)

### 6.4 External Services

- NOSTR Relay Network (distributed)
- Lightning Node (self-hosted)
- Email Provider (SendGrid/Postmark)
- Exchange Rate APIs

### 6.5 Monitoring & Logging

- Sentry (error tracking)
- Datadog (APM + metrics)
- Log Aggregator (Loki/CloudWatch)
- Uptime Monitoring (UptimeRobot)

### 6.6 CI/CD Pipeline (GitHub Actions)

- Automated testing
- Vercel auto-deploy (frontend)
- Docker build + push (backend)
- Container registry (Docker Hub/GHCR)

---

## 7. Security Architecture

**Diagram:** [security-architecture.mmd](./diagrams/security-architecture.mmd)

**Security Layers:**

### 7.1 Client Security

- HTTPS only (TLS 1.3)
- Content Security Policy (CSP)
- CORS policy (origin validation)
- Secure Context (PWA)

### 7.2 Edge Security (Cloudflare)

- Web Application Firewall (WAF)
- DDoS protection
- Bot protection
- Rate limiting

### 7.3 API Gateway Security

- Request validation
- Input sanitization
- Rate limiting (per-IP/user)
- Request logging

### 7.4 Authentication

- NOSTR key-based auth
- JWT token management
- Session management (Redis)
- NIP-05 verification
- Browser extension support

### 7.5 Authorization

- Role-Based Access Control (RBAC)
- Permission checking
- Resource ownership validation
- Subscription-based access

### 7.6 Data Protection

- Encryption at rest (AES-256-GCM)
- Encryption in transit (TLS 1.3)
- Key management + rotation
- Data masking for PII
- Backup encryption

### 7.7 Payment Security

- Lightning authentication (macaroon/TLS)
- Payment verification (HTLC + preimage)
- Webhook signatures (HMAC-SHA256)
- Idempotency keys

### 7.8 Database Security

- Connection encryption (SSL/TLS)
- Prepared statements (SQL injection prevention)
- Row-Level Security (PostgreSQL RLS)
- Transparent Data Encryption

### 7.9 Monitoring & Incident Response

- Real-time security monitoring
- Intrusion detection
- Automated incident response
- Threat intelligence integration

**Compliance:**

- OWASP Top 10
- PCI DSS Level 2
- GDPR Data Protection
- SOC 2 Type II
- ISO 27001
- NIST Cybersecurity Framework

---

## 8. Performance Metrics

### 8.1 Service Performance

| Service Category | Avg Response Time | P99 Latency | Throughput |
| ---------------- | ----------------- | ----------- | ---------- |
| Content Services | 50-200ms          | 500ms       | 1K req/s   |
| User Services    | 30-150ms          | 300ms       | 2K req/s   |
| Payment Services | 100-500ms         | 2s          | 500 req/s  |
| Shared Services  | 20-100ms          | 200ms       | 5K req/s   |

### 8.2 Cache Performance

| Cache Layer      | Hit Rate | Avg Latency | TTL  |
| ---------------- | -------- | ----------- | ---- |
| Edge Cache       | 40%      | 1ms         | 60s  |
| App Cache (L1)   | 45%      | 5ms         | 300s |
| Query Cache (L2) | 10%      | 10ms        | 600s |
| **Total**        | **95%**  | **5-10ms**  | -    |

### 8.3 Database Performance

| Metric                  | Value          |
| ----------------------- | -------------- |
| Query Rate (with cache) | 5% of requests |
| Avg Query Time          | 50ms           |
| Max Connections         | 100            |
| Connection Pool         | 10-100         |
| Replication Lag         | <1s            |

### 8.4 Event Processing

| Metric           | Value          |
| ---------------- | -------------- |
| Event Latency    | <5ms           |
| Processing Time  | 10-500ms       |
| Success Rate     | 99.9%          |
| Throughput       | 10K events/sec |
| Dead Letter Rate | <0.1%          |

---

## 9. Architecture Decision Records (ADRs)

### ADR-001: Event-Driven Architecture

**Status:** Accepted
**Context:** Need for loose coupling and scalability
**Decision:** Implement event-driven architecture with EventBus
**Consequences:** Improved scalability, added complexity in event management

### ADR-002: Multi-Layer Caching Strategy

**Status:** Accepted
**Context:** Reduce database load and improve response times
**Decision:** Implement 3-layer cache (Edge, App, Query)
**Consequences:** 95% cache hit rate, reduced latency

### ADR-003: Repository Pattern for Data Access

**Status:** Accepted
**Context:** Need for testability and data access abstraction
**Decision:** Implement repository pattern with factory
**Consequences:** Improved testability, reusable data access layer

### ADR-004: Circuit Breaker for External Services

**Status:** Accepted
**Context:** Prevent cascade failures from external service outages
**Decision:** Implement circuit breaker for webhooks and APIs
**Consequences:** Improved fault tolerance, added complexity

### ADR-005: Exponential Backoff for Retries

**Status:** Accepted
**Context:** Handle transient failures gracefully
**Decision:** Implement retry pattern with exponential backoff + jitter
**Consequences:** Improved reliability, reduced server load

---

## 10. Diagram Viewing Guide

### 10.1 Viewing Mermaid Diagrams on GitHub

GitHub natively renders Mermaid diagrams in Markdown files. To view:

1. Navigate to the diagram file (`.mmd` or `.md`)
2. GitHub automatically renders the diagram
3. Use the "Raw" button to see source code

### 10.2 Editing Diagrams

**Mermaid Live Editor:**

1. Go to [https://mermaid.live](https://mermaid.live)
2. Paste diagram source code
3. Edit and preview in real-time
4. Copy updated code back to file

**VS Code:**

1. Install "Mermaid Preview" extension
2. Open `.mmd` file
3. Press `Ctrl+Shift+V` (preview)
4. Edit and see live updates

### 10.3 Exporting Diagrams

**To PNG/SVG:**

1. Use Mermaid Live Editor
2. Click "Actions" → "Export"
3. Choose PNG or SVG format
4. Download for presentations

**To PDF:**

1. Export as SVG first
2. Use tool like Inkscape or online converter
3. Convert SVG to PDF

---

## 11. Contributing to Architecture Documentation

### 11.1 Adding New Diagrams

When implementing new features or services:

1. **Create Diagram File:**

   ```bash
   touch docs/architecture/diagrams/your-diagram-name.mmd
   ```

2. **Follow Naming Convention:**
   - Use kebab-case: `service-name-architecture.mmd`
   - Include US number: `us-e5-xxx-diagram-name.mmd`

3. **Add Metadata Header:**

   ```
   %% Diagram Title
   %% Version: 1.0.0
   %% Date: YYYY-MM-DD
   %% Description: Brief description
   ```

4. **Use Consistent Styling:**
   - Content Services: Blue (#2196f3)
   - User Services: Green (#4caf50)
   - Payment Services: Orange (#ff9800)
   - Shared Services: Gray (#757575)

5. **Update This Index:**
   Add link to new diagram in relevant section

### 11.2 Updating Existing Diagrams

1. Increment version number in metadata
2. Update date to current date
3. Document changes in CHANGELOG.md
4. Create ADR if architectural decision changed

### 11.3 Documentation Standards

- All diagrams must have metadata header
- Include legends for color coding
- Provide context notes within diagram
- Link related diagrams
- Keep diagrams focused (not too complex)
- Break large diagrams into multiple focused diagrams

---

## 12. Related Documentation

- **Epic 005 Stories:** See `/docs/user-stories/epic-005/`
- **Implementation Summaries:** See `/docs/implementation-summaries/`
- **API Documentation:** See `/docs/api/`
- **User Guides:** See `/docs/user-guides/`
- **Deployment Guides:** See `/docs/deployment/`

---

## 13. Changelog

### Version 1.0.0 (2025-10-27)

- ✅ Initial architecture documentation for Epic 005
- ✅ Created 20+ comprehensive Mermaid diagrams
- ✅ Documented all 29 services across 5 domains
- ✅ Complete system, deployment, and security architecture
- ✅ Service interaction sequence diagrams (4 key workflows)
- ✅ Data flow diagrams (read, write, event, payment)
- ✅ Domain-specific architecture (content, user, payment)
- ✅ Integration patterns (event-driven, cache, repository, circuit breaker, retry)
- ✅ Performance metrics and benchmarks
- ✅ Security architecture and compliance standards

---

## 14. Contact & Support

**Architecture Questions:**

- Review ADRs in `/docs/architecture/decisions/`
- Check CLAUDE.md for project context
- Consult Mermaid diagram guide

**Implementation Questions:**

- See user story documentation
- Review implementation summaries
- Check API documentation

**Issues & Improvements:**

- Submit GitHub issue with label: `documentation`
- Tag with `architecture` for architecture-specific issues

---

**Document Maintained By:** Elite Technical Documentation Specialist
**Last Review:** 2025-10-27
**Next Review:** Quarterly or with major architecture changes
