# Epic 005: Backend Service Refactoring - Decomposition Specification

**Status**: Ready for Decomposition
**Date**: 2025-10-23
**Orchestrator**: Project Orchestrator Agent

---

## Executive Summary

This document provides the complete specification for decomposing Epic 005 (Backend Service Refactoring) into granular 1-point user stories following the same pattern established in Epic 001 and Epic 002.

**Epic Overview**:

- **Objective**: Refactor large, monolithic backend service classes into smaller, focused services following SOLID principles
- **Estimated Stories**: 36-45 stories (1 point each)
- **Estimated Effort**: 36-45 story points (4-6 weeks with 2-3 backend developers)
- **Risk Level**: MEDIUM-HIGH (payment services are critical)
- **Business Impact**: 40% faster backend changes, easier testing, team scalability

---

## Decomposition Strategy

### Work Stream Organization

Based on the Epic 005 technical scope, the decomposition should create **7 parallel work streams**:

#### Stream A: Foundation & Design (5-6 stories)

**Focus**: Service architecture design and dependency injection setup
**Developer Profile**: Senior backend architect
**Estimated Time**: 10-12 hours

**Suggested Stories**:

1. **Story 1**: Define service interfaces and contracts
   - Create interface definitions for all services
   - Define service boundaries
   - Document service responsibilities
   - 2-3 hours

2. **Story 2**: Design dependency injection architecture
   - Set up InversifyJS container
   - Define service types and bindings
   - Create DI container configuration
   - 2-3 hours

3. **Story 3**: Create repository pattern for data access
   - Define repository interfaces
   - Implement base repository class
   - Create repositories for Content, User, Payment entities
   - 2-3 hours

4. **Story 4**: Extract shared utility services
   - EmailService (notification emails)
   - NotificationService (multi-channel)
   - AuditLogService (compliance)
   - CacheService (shared caching)
   - 2 hours

5. **Story 5**: Create service architecture diagrams
   - Mermaid diagrams (all 5 required types)
   - Service interaction diagrams
   - Dependency graphs
   - 2-3 hours

#### Stream B: Content Service Decomposition (7-9 stories)

**Focus**: Break ContentService (680 lines) into 7 focused services
**Developer Profile**: Backend developer with content domain knowledge
**Estimated Time**: 14-18 hours

**Suggested Stories**: 6. **Story 6**: Create ContentCreationService

- Extract content creation logic
- Implement draft management
- Content validation
- Unit tests (95%+ coverage)
- 2-3 hours

7. **Story 7**: Create ContentPublishingService
   - Extract publishing logic
   - Scheduling functionality
   - Distribution to NOSTR
   - Unit tests
   - 2-3 hours

8. **Story 8**: Create ContentModerationService
   - Extract moderation logic
   - Flagging and filtering
   - Automated moderation rules
   - Unit tests
   - 2 hours

9. **Story 9**: Create ContentSearchService
   - Extract search logic
   - Implement search indexing
   - Filter and query functionality
   - Unit tests
   - 2-3 hours

10. **Story 10**: Create ContentRecommendationService
    - Extract recommendation logic
    - Personalization algorithms
    - Recommendation scoring
    - Unit tests
    - 2 hours

11. **Story 11**: Create ContentAnalyticsService
    - Extract analytics logic
    - Metrics tracking
    - Insights generation
    - Unit tests
    - 2 hours

12. **Story 12**: Create ContentVersioningService
    - Extract versioning logic
    - History tracking
    - Rollback functionality
    - Unit tests
    - 2 hours

13. **Story 13**: Migrate API routes to use new Content services
    - Update all content API endpoints
    - Wire up dependency injection
    - Integration tests
    - 2-3 hours

14. **Story 14**: Remove old ContentService and validate
    - Delete ContentService.ts
    - Verify all functionality migrated
    - Full regression testing
    - 2 hours

#### Stream C: User Service Decomposition (6-8 stories)

**Focus**: Break UserService (650 lines) into 6 focused services
**Developer Profile**: Backend developer with auth/user domain knowledge
**Estimated Time**: 12-16 hours

**Suggested Stories**: 15. **Story 15**: Create UserAuthenticationService - Extract authentication logic - Login/logout/session management - Token handling - Unit tests (95%+ coverage) - 2-3 hours

16. **Story 16**: Create UserProfileService
    - Extract profile CRUD logic
    - Profile validation
    - Avatar/media handling
    - Unit tests
    - 2 hours

17. **Story 17**: Create UserPreferencesService
    - Extract preferences logic
    - Settings management
    - Default preferences
    - Unit tests
    - 1.5-2 hours

18. **Story 18**: Create UserActivityService
    - Extract activity tracking logic
    - Activity logging
    - Activity feed generation
    - Unit tests
    - 2 hours

19. **Story 19**: Create UserRelationshipService
    - Extract relationship logic (follow, block, mute)
    - Follower/following management
    - Relationship queries
    - Unit tests
    - 2-3 hours

20. **Story 20**: Create UserAnalyticsService
    - Extract user analytics logic
    - User metrics
    - Segmentation
    - Unit tests
    - 2 hours

21. **Story 21**: Migrate API routes to use new User services
    - Update all user API endpoints
    - Update authentication middleware
    - Wire up dependency injection
    - Integration tests
    - 2-3 hours

22. **Story 22**: Remove old UserService and validate
    - Delete UserService.ts
    - Verify all functionality migrated
    - Full regression testing
    - 2 hours

#### Stream D: Payment Service Decomposition (8-10 stories) ⚠️ CRITICAL

**Focus**: Break PaymentService (720 lines) into 7 focused services
**Developer Profile**: Senior backend developer with payment system experience
**Estimated Time**: 16-20 hours

**Suggested Stories**: 23. **Story 23**: Create InvoiceService - Extract invoice generation logic - Invoice management - Invoice sending - Unit tests (95%+ coverage) - 2-3 hours

24. **Story 24**: Create PaymentProcessingService (CRITICAL)
    - Extract payment processing logic
    - Payment execution
    - Payment verification
    - Retry logic (from Epic 002)
    - Comprehensive unit tests
    - 3-4 hours

25. **Story 25**: Create SubscriptionService
    - Extract subscription lifecycle logic
    - Create, update, cancel, renew
    - Upgrade/downgrade logic
    - Unit tests
    - 2-3 hours

26. **Story 26**: Create RefundService
    - Extract refund processing logic
    - Refund approval workflow
    - Automated refund rules
    - Unit tests
    - 2 hours

27. **Story 27**: Create PaymentAnalyticsService
    - Extract payment analytics logic
    - Revenue metrics
    - Churn analysis
    - Cohort tracking
    - Unit tests
    - 2 hours

28. **Story 28**: Create WebhookService
    - Extract webhook handling logic
    - Webhook validation (HMAC signatures)
    - Replay attack prevention
    - Unit tests
    - 2-3 hours

29. **Story 29**: Create CurrencyService
    - Extract currency conversion logic
    - Multi-currency pricing
    - Real-time conversion rates
    - Unit tests
    - 2 hours

30. **Story 30**: Migrate API routes to use new Payment services (CRITICAL)
    - Update all payment API endpoints
    - Update webhook handlers
    - Wire up dependency injection
    - Extensive integration tests
    - Security review
    - 3-4 hours

31. **Story 31**: Remove old PaymentService and validate (CRITICAL)
    - Delete PaymentService.ts
    - Verify all payment functionality works
    - Full regression testing
    - Payment flow E2E testing
    - 2-3 hours

#### Stream E: Integration & Testing (4-5 stories)

**Focus**: Comprehensive testing and validation
**Developer Profile**: QA or senior backend developer
**Estimated Time**: 8-10 hours

**Suggested Stories**: 32. **Story 32**: Create comprehensive service integration test suite - Test service interactions - Test database transactions - Test external API calls - 2-3 hours

33. **Story 33**: Add performance testing and benchmarking
    - Benchmark service response times
    - Database query optimization
    - Memory leak detection
    - Compare before/after metrics
    - 2-3 hours

34. **Story 34**: Create E2E tests for critical workflows
    - User signup flow
    - Content publishing flow
    - Payment flow (invoice → payment → subscription)
    - 2-3 hours

35. **Story 35**: Add service observability and monitoring
    - Service-level metrics
    - Error tracking per service
    - Performance dashboards
    - 2 hours

#### Stream F: Documentation & Cleanup (3-4 stories)

**Focus**: Documentation and final cleanup
**Developer Profile**: Technical writer or senior developer
**Estimated Time**: 6-8 hours

**Suggested Stories**: 36. **Story 36**: Create service API documentation - Document all service interfaces - Create JSDoc/TSDoc comments - Generate API reference - 2-3 hours

37. **Story 37**: Create dependency injection guide and examples
    - DI container usage guide
    - Service registration examples
    - Testing with DI
    - 2 hours

38. **Story 38**: Create service migration guide
    - Before/after examples
    - Migration checklist
    - Common patterns
    - 2 hours

39. **Story 39**: Update ADRs and architectural documentation
    - Document service architecture decision
    - Update architecture diagrams
    - Create ADR for SOLID principles
    - 2 hours

**Optional Stories** (if needed): 40. **Story 40**: Extract to microservices (future consideration) 41. **Story 41**: Add service-to-service authentication 42. **Story 42**: Implement event-driven architecture between services 43. **Story 43**: Add service health checks 44. **Story 44**: Create service-level SLAs 45. **Story 45**: Add distributed tracing (OpenTelemetry)

---

## Dependency Structure

### Critical Path (Sequential)

```
Story 1 (Interfaces) → Story 2 (DI) → Story 3 (Repositories) → Story 4 (Shared Services)
                              ↓
Stream B: Content Services (Stories 6-14)
Stream C: User Services (Stories 15-22)      [PARALLEL]
Stream D: Payment Services (Stories 23-31)   [PARALLEL - CRITICAL]
                              ↓
Stream E: Integration & Testing (Stories 32-35)
                              ↓
Stream F: Documentation (Stories 36-39)
```

### Parallel Work Opportunities

**Phase 1: Foundation** (Week 1)

- Stories 1-5 (Foundation) - Sequential, 1 senior developer
- Must complete before service decomposition

**Phase 2: Service Decomposition** (Weeks 2-4)

- Stream B (Content, Stories 6-14) - 1 developer
- Stream C (User, Stories 15-22) - 1 developer
- Stream D (Payment, Stories 23-31) - 1 senior developer (CRITICAL PATH)
- All three streams are 100% parallel

**Phase 3: Integration** (Week 5)

- Stories 32-35 (Testing) - Can run in parallel

**Phase 4: Documentation** (Week 6)

- Stories 36-39 (Documentation) - Can run in parallel

---

## Story Sizing Guidelines

Each story MUST be:

- **1 point**: 2-4 hours of work (except critical payment stories: 3-4 hours acceptable)
- **Testable**: Has clear acceptance criteria
- **Atomic**: Can be completed independently
- **Deployable**: Can be merged without breaking existing functionality

### Size Validation Checklist

For each story, verify:

- [ ] Can be completed in 2-4 hours by an experienced developer?
- [ ] Has 3-5 clear acceptance criteria in Given-When-Then format?
- [ ] Has specific file paths and code examples?
- [ ] Has testing requirements defined (95%+ coverage)?
- [ ] Has security considerations if applicable?
- [ ] Has Definition of Done checklist?

---

## Required Mermaid Diagrams

Each Epic must include these 5 diagram types:

### 1. Sequence Diagram

**Purpose**: Show payment processing flow across multiple services
**Actors**: API → InvoiceService → PaymentProcessingService → SubscriptionService → Database

### 2. Flowchart

**Purpose**: Show service decomposition decision tree (which service handles which responsibility)

### 3. State Diagram

**Purpose**: Show subscription lifecycle states (trial, active, past_due, canceled)

### 4. Class Diagram (or Architecture Diagram)

**Purpose**: Show service architecture with all services, interfaces, and dependencies

### 5. Gantt Chart

**Purpose**: Show sprint timeline and story dependencies

---

## Testing Requirements

### Unit Tests (95%+ Coverage)

- All service classes
- All repository classes
- All utility services
- 100% coverage for payment services (critical)

### Integration Tests

- Service interactions
- Database transactions (especially payment transactions)
- External API calls
- Event publishing

### E2E Tests

- User signup and profile management
- Content creation and publishing
- Payment flow (invoice → payment → subscription)
- Refund flow

### Performance Tests

- Service response times (< 100ms for simple operations)
- Database query performance
- Load testing for payment services
- Memory leak detection

---

## Security Requirements

### Security-Critical Stories

**Story 15** (UserAuthenticationService):

- **Risk**: Authentication vulnerabilities
- **Required Review**: 1 senior security specialist
- **Tests**: Token validation, session hijacking prevention, brute force protection

**Story 24** (PaymentProcessingService):

- **Risk**: Payment processing vulnerabilities
- **Required Review**: 1 payment security specialist + 1 senior backend engineer
- **Tests**: Payment state race conditions, double-charging prevention, fraud detection

**Story 28** (WebhookService):

- **Risk**: Webhook security vulnerabilities
- **Required Review**: 1 security specialist
- **Tests**: HMAC signature validation, replay attack prevention, rate limiting

**Story 30** (Payment API Migration):

- **Risk**: Breaking payment flows
- **Required Review**: 1 senior backend engineer + full security audit
- **Tests**: Full payment flow E2E, penetration testing

---

## Documentation Requirements

### Must Create Documents (Similar to Epic 001/002)

1. **EPIC-005-STORY-BREAKDOWN.md**
   - All 36-45 stories with full specifications
   - User story format
   - Acceptance criteria (Given-When-Then)
   - Technical implementation (code examples, file paths, DI setup)
   - Dependencies
   - Definition of Done
   - Security considerations
   - Testing requirements

2. **EPIC-005-STORY-MAP.md**
   - Work stream organization
   - Sprint structure (6 sprints recommended)
   - Developer allocation strategies
   - Dependency chain visualization
   - Risk mitigation strategy
   - Testing and communication plans

3. **EPIC-005-QUICK-REFERENCE.md**
   - Story quick reference table
   - Files modified by each story
   - Common service patterns (copy-paste code)
   - DI container usage examples
   - Security checklists
   - Testing checklists
   - Useful commands
   - Troubleshooting guide

4. **EPIC-005-DEPENDENCY-GRAPH.mmd**
   - Mermaid diagram showing all 5 types
   - Story dependencies
   - Parallel work visualization
   - Critical path highlighted
   - Risk levels color-coded

5. **EPIC-005-README.md**
   - Documentation index
   - Quick start guide
   - Story assignments
   - Timeline estimates
   - Success criteria

6. **EPIC-005-GITHUB-ISSUE-TEMPLATE.md**
   - Generic issue template
   - Complete example for Story 1
   - Bulk creation script (bash + gh CLI)

7. **EPIC-005-IMPLEMENTATION-SUMMARY.md**
   - Executive summary
   - Deliverables created
   - Next steps
   - Approval signatures

---

## Risk Assessment

### Critical-Risk Areas

1. **Breaking Payment Flows** (Impact: CRITICAL, Likelihood: MEDIUM)
   - **Mitigation**: Extensive testing, feature flags, canary deployment, payment-focused security audit
   - **Stories Affected**: 23-31 (all payment service stories)

2. **Database Transaction Issues** (Impact: HIGH, Likelihood: LOW)
   - **Mitigation**: Careful transaction boundary design, database rollback testing
   - **Stories Affected**: 3 (repositories), 24 (payment processing), 32 (integration tests)

### High-Risk Areas

3. **Breaking Authentication** (Impact: CRITICAL, Likelihood: LOW)
   - **Mitigation**: Comprehensive auth testing, session validation
   - **Stories Affected**: 15 (UserAuthenticationService), 21 (User API migration)

4. **Performance Degradation** (Impact: MEDIUM, Likelihood: LOW)
   - **Mitigation**: Benchmark before/after, optimize DI container, database query optimization
   - **Stories Affected**: 33 (performance testing)

### Medium-Risk Areas

5. **Increased Complexity** (Impact: MEDIUM, Likelihood: MEDIUM)
   - **Mitigation**: Clear documentation, DI guide, architectural diagrams
   - **Stories Affected**: All documentation stories (36-39)

---

## Success Metrics

### Technical Metrics

- All services < 300 lines of code: ✅
- Each service has single responsibility: ✅
- All services have interface definitions: ✅
- 95%+ test coverage (100% for payment services): ✅
- Dependency injection implemented: ✅
- No functionality regressions: ✅
- Performance maintained or improved: ✅

### Business Metrics

- 40% reduction in time to modify backend services
- Team can work on multiple services in parallel (team scalability)
- Easier unit testing (95%+ coverage achieved)
- 25% reduction in backend bugs

---

## Prompt Template for story-decomposer Agent

Use this exact prompt when invoking the story-decomposer agent:

```
You are the story-decomposer agent for the Sovren refactoring initiative. Your task is to decompose Epic 005 (Backend Service Refactoring) into granular 1-point user stories following the exact pattern established in Epic 001 and Epic 002.

**Context Files**:
- Epic Document: /Users/fp/Desktop/Sovren/docs/refactoring/EPIC-005-backend-service-refactoring.md
- Decomposition Spec: /Users/fp/Desktop/Sovren/docs/refactoring/EPIC-005-DECOMPOSITION-SPEC.md
- Reference Pattern Epic 001: /Users/fp/Desktop/Sovren/docs/refactoring/EPIC-001-story-breakdown.md
- Reference Pattern Epic 002: /Users/fp/Desktop/Sovren/docs/refactoring/EPIC-002-USER-STORIES.md

**Your Deliverables**:

1. **EPIC-005-STORY-BREAKDOWN.md** (PRIMARY)
   - 36-45 granular 1-point user stories
   - Each story must have:
     * User story format (As a... I want... So that...)
     * 3-5 acceptance criteria in Given-When-Then format
     * Technical implementation with code examples, file paths, and DI setup
     * Dependencies (which stories must be done first)
     * Definition of Done checklist
     * Security considerations (for auth, payment, webhook stories)
     * Testing requirements (unit, integration, E2E, performance)
   - Follow the EXACT structure from EPIC-001-story-breakdown.md

2. **EPIC-005-STORY-MAP.md**
   - Work stream organization (7 streams: Foundation, Content, User, Payment, Integration, Documentation, Cleanup)
   - Sprint structure (6 sprints recommended)
   - Developer allocation strategies (1-dev, 2-dev, 3-dev scenarios)
   - Dependency chain visualization (ASCII art)
   - Risk mitigation strategy
   - Testing and communication plans
   - Follow the EXACT structure from EPIC-001-story-map.md

3. **EPIC-005-QUICK-REFERENCE.md**
   - Story quick reference table
   - Files modified by each story
   - Common service patterns (DI, repository pattern, service layer)
   - Code examples for service creation
   - Security checklists
   - Testing checklists
   - Useful commands for service testing
   - Troubleshooting guide
   - Follow the EXACT structure from EPIC-001-quick-reference.md

4. **EPIC-005-DEPENDENCY-GRAPH.mmd**
   - Mermaid diagrams showing ALL 5 required types:
     1. Sequence Diagram (payment processing flow across services)
     2. Flowchart (service decomposition decision tree)
     3. State Diagram (subscription lifecycle)
     4. Class/Architecture Diagram (all services and dependencies)
     5. Gantt Chart (sprint timeline)
   - Color-code by work stream
   - Highlight critical path (payment services)
   - Show risk levels

5. **EPIC-005-README.md**
   - Documentation index
   - Quick start guide for developers
   - Story assignments (1-dev, 2-dev, 3-dev scenarios)
   - Timeline estimates
   - Success criteria
   - Follow the EXACT structure from EPIC-001-README.md

6. **EPIC-005-GITHUB-ISSUE-TEMPLATE.md**
   - Generic GitHub issue template
   - Complete example for Story 1
   - Bulk creation script (bash + gh CLI)

7. **EPIC-005-IMPLEMENTATION-SUMMARY.md**
   - Executive summary
   - Deliverables created
   - Risk assessment
   - Next steps
   - Approval signatures

**Story Breakdown Guidance** (from EPIC-005-DECOMPOSITION-SPEC.md):

Stream A: Foundation & Design (Stories 1-5)
- Story 1: Service interfaces and contracts
- Story 2: Dependency injection architecture
- Story 3: Repository pattern
- Story 4: Shared utility services
- Story 5: Architecture diagrams

Stream B: Content Service Decomposition (Stories 6-14)
- Stories 6-12: Create 7 focused Content services
- Story 13: Migrate API routes
- Story 14: Remove old ContentService

Stream C: User Service Decomposition (Stories 15-22)
- Stories 15-20: Create 6 focused User services
- Story 21: Migrate API routes
- Story 22: Remove old UserService

Stream D: Payment Service Decomposition (Stories 23-31) ⚠️ CRITICAL
- Stories 23-29: Create 7 focused Payment services
- Story 30: Migrate API routes (CRITICAL)
- Story 31: Remove old PaymentService (CRITICAL)

Stream E: Integration & Testing (Stories 32-35)
- Story 32: Integration test suite
- Story 33: Performance testing
- Story 34: E2E tests
- Story 35: Observability

Stream F: Documentation & Cleanup (Stories 36-39)
- Story 36: Service API documentation
- Story 37: DI guide
- Story 38: Migration guide
- Story 39: ADRs

**Quality Standards**:
- Each story: 1 point (2-4 hours, payment stories can be 3-4 hours)
- 95%+ test coverage (100% for payment services)
- Security reviews for Stories 15, 24, 28, 30
- All 5 Mermaid diagram types required
- Follow Sovren documentation standards (@project-rules.mdc)

**Consistency Requirements**:
- Use EXACT same format as Epic 001 and Epic 002
- Use same section headings, table structures, code block formats
- Match tone and level of detail
- Include all sections that Epic 001 and Epic 002 have

**CRITICAL ATTENTION AREAS**:
- Payment service stories (23-31) are CRITICAL and require extra security attention
- All payment stories must have comprehensive testing and security reviews
- Payment migration (Story 30) must be done with canary deployment and feature flags

Begin decomposition now. Create all 7 documents with comprehensive detail.
```

---

## Validation Checklist

Before considering Epic 005 decomposition complete, verify:

- [ ] **All documents created**: 7 required documents exist
- [ ] **Story count**: 36-45 stories, all 1-point
- [ ] **Consistency**: Same format/structure as Epic 001 and Epic 002
- [ ] **5 Mermaid diagrams**: Sequence, Flowchart, State, Class/Architecture, Gantt
- [ ] **Work streams**: 7 streams clearly defined with assignments
- [ ] **Dependencies**: Critical path and parallel work identified
- [ ] **Testing**: Unit (95%+), integration, E2E, performance requirements
- [ ] **Security**: Security-critical stories identified (Stories 15, 24, 28, 30)
- [ ] **Documentation**: All required documentation sections included
- [ ] **GitHub templates**: Issue template with bulk creation script
- [ ] **Quality**: Follows @project-rules.mdc and @ways-of-working.mdc
- [ ] **Payment Focus**: Payment stories have extra security and testing attention

---

## Next Steps After Decomposition

1. **Review** (2-3 hours):
   - Tech lead reviews all 7 documents
   - Payment specialist reviews payment stories (23-31)
   - Validate story sizing (all 1-point)
   - Verify consistency with Epic 001/002

2. **Refinement** (if needed):
   - Adjust story breakdown based on feedback
   - Split any stories > 1 point
   - Merge any stories < 0.5 point

3. **Approval**:
   - Tech lead approval
   - Payment specialist approval
   - Product owner approval
   - Engineering manager approval
   - Security team review (for payment stories)

4. **GitHub Setup** (3 hours):
   - Create Epic 005 issue
   - Create 36-45 story issues
   - Apply labels (stream, priority, risk, sprint, security)
   - Set up project board
   - Mark payment stories as CRITICAL

5. **Ready for Development**:
   - Assign senior developer to payment stream
   - Assign developers to other work streams
   - Schedule kickoff meeting
   - Begin implementation!

---

**Status**: ✅ Ready for story-decomposer agent

**Last Updated**: 2025-10-23

**Orchestrator**: Project Orchestrator Agent
