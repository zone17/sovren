# Epic 003: NOSTR Service Consolidation - Decomposition Specification

**Status**: Ready for Decomposition
**Date**: 2025-10-23
**Orchestrator**: Project Orchestrator Agent

---

## Executive Summary

This document provides the complete specification for decomposing Epic 003 (NOSTR Service Consolidation) into granular 1-point user stories following the same pattern established in Epic 001 and Epic 002.

**Epic Overview**:
- **Objective**: Consolidate duplicated NOSTR protocol services into a single, well-tested shared implementation
- **Estimated Stories**: 22-28 stories (1 point each)
- **Estimated Effort**: 22-28 story points (3-4 weeks with 2 developers)
- **Risk Level**: MEDIUM (affects core NOSTR functionality)
- **Business Impact**: 15% code reduction, 30% maintenance reduction, improved consistency

---

## Decomposition Strategy

### Work Stream Organization

Based on the Epic 003 technical scope, the decomposition should create **5 parallel work streams**:

#### Stream A: Core Service Foundation (6-8 stories)
**Focus**: Extract and create shared NOSTR core logic
**Developer Profile**: NOSTR protocol expert + strong TypeScript skills
**Estimated Time**: 12-16 hours

**Suggested Stories**:
1. **Story 1**: Define core NOSTR type definitions and interfaces
   - Create comprehensive type definitions for events, relays, subscriptions
   - Implement NIP compliance types
   - 2-3 hours

2. **Story 2**: Create event creation and validation service
   - Implement event creation for all supported kinds (0, 1, 3, 4, 30023)
   - Event signature validation
   - Event serialization/deserialization
   - 2-3 hours

3. **Story 3**: Implement relay connection management core
   - Connection pooling logic
   - Reconnection with exponential backoff
   - Relay health monitoring
   - 2-3 hours

4. **Story 4**: Create subscription handling service
   - Filter creation and validation
   - Subscription lifecycle management
   - Event stream processing
   - 2-3 hours

5. **Story 5**: Implement cryptography service
   - Key pair generation (NIP-06)
   - Event signing
   - Encrypted DM support (NIP-04)
   - 2-3 hours

6. **Story 6**: Add multi-relay publishing with fallback
   - Implement multi-relay strategy
   - Read/write relay separation
   - Fallback logic
   - 2 hours

#### Stream B: Platform Adapters (4-6 stories)
**Focus**: Create browser and Node.js adapters
**Developer Profile**: Frontend + Backend experience
**Estimated Time**: 8-12 hours

**Suggested Stories**:
7. **Story 7**: Design adapter interface pattern
   - Define platform adapter interfaces
   - Create adapter base classes
   - Design dependency injection structure
   - 2 hours

8. **Story 8**: Implement browser adapter
   - React hooks for NOSTR (useNostrEvents, useNostrPublish)
   - Browser extension integration (NIP-07)
   - LocalStorage relay management
   - 3-4 hours

9. **Story 9**: Implement Node.js server adapter
   - Server-side NOSTR client
   - Event emitter-based subscriptions
   - Server-specific optimizations
   - 2-3 hours

10. **Story 10**: Create adapter testing framework
    - Unit tests for adapters
    - Integration test helpers
    - Mock NOSTR relay for testing
    - 2 hours

#### Stream C: Frontend Migration (4-5 stories)
**Focus**: Migrate frontend to shared service
**Developer Profile**: Frontend React specialist
**Estimated Time**: 8-10 hours

**Suggested Stories**:
11. **Story 11**: Replace frontend event publishing with shared service
    - Migrate event creation to shared service
    - Update all components using event publishing
    - Integration tests
    - 2-3 hours

12. **Story 12**: Replace frontend relay management with shared service
    - Migrate relay connection logic
    - Update relay health monitoring
    - Update UI components
    - 2 hours

13. **Story 13**: Replace frontend subscription handling with shared service
    - Migrate subscription logic
    - Update React hooks
    - Integration tests
    - 2-3 hours

14. **Story 14**: Migrate frontend NOSTR profile sync
    - Update profile sync logic
    - Integrate with shared service
    - Tests
    - 1.5-2 hours

#### Stream D: Backend Migration (4-5 stories)
**Focus**: Migrate backend to shared service
**Developer Profile**: Backend Node.js specialist
**Estimated Time**: 8-10 hours

**Suggested Stories**:
15. **Story 15**: Replace backend event publishing with shared service
    - Migrate API endpoints to shared service
    - Update webhook handlers
    - Integration tests
    - 2-3 hours

16. **Story 16**: Replace backend relay management with shared service
    - Migrate relay connection logic
    - Update health monitoring
    - Server-side optimizations
    - 2 hours

17. **Story 17**: Replace backend subscription handling with shared service
    - Migrate subscription logic
    - Update event processing
    - Integration tests
    - 2-3 hours

18. **Story 18**: Migrate backend webhook integration
    - Update webhook NOSTR integration
    - Integrate with shared service
    - Tests
    - 1.5-2 hours

#### Stream E: Testing, Security & Cleanup (4-6 stories)
**Focus**: Comprehensive testing, security, documentation
**Developer Profile**: QA focus, documentation skills
**Estimated Time**: 8-12 hours

**Suggested Stories**:
19. **Story 19**: Create comprehensive NOSTR integration test suite
    - Test multi-relay publishing
    - Test subscription filtering
    - Test connection resilience
    - 2-3 hours

20. **Story 20**: Add NOSTR security testing and NIP compliance
    - NIP compliance test suite
    - Security testing (signature validation, event verification)
    - Performance testing
    - 2-3 hours

21. **Story 21**: Create NOSTR architecture documentation
    - Mermaid diagrams (all 5 required types)
    - API documentation
    - Migration guide
    - 2-3 hours

22. **Story 22**: Remove old NOSTR implementations and cleanup
    - Delete old frontend NOSTR service
    - Delete old backend NOSTR service
    - Update imports across codebase
    - Final validation
    - 2 hours

**Optional Stories** (if needed):
23. **Story 23**: Add NIP-42 relay authentication support
24. **Story 24**: Implement advanced relay selection strategy
25. **Story 25**: Add NOSTR event caching layer

---

## Dependency Structure

### Critical Path (Sequential)

```
Story 1 (Types) → Story 2 (Events) → Story 3 (Relays) → Story 4 (Subscriptions) → Story 5 (Crypto)
                      ↓
Story 7 (Adapter Interface) → Story 8 (Browser) + Story 9 (Node.js)
                      ↓
Story 11-14 (Frontend) + Story 15-18 (Backend) [PARALLEL]
                      ↓
Story 19-22 (Testing & Cleanup)
```

### Parallel Work Opportunities

**Phase 1: Core Foundation** (Week 1)
- Stories 1-6 can run in sequence (same developer)
- Story 10 (adapter testing) can run in parallel

**Phase 2: Adapters** (Week 1-2)
- Story 8 (browser) and Story 9 (node) can run in parallel

**Phase 3: Migration** (Week 2-3)
- Stream C (Frontend, Stories 11-14) and Stream D (Backend, Stories 15-18) are 100% parallel

**Phase 4: Finalization** (Week 3-4)
- Stories 19-22 should run sequentially

---

## Story Sizing Guidelines

Each story MUST be:
- **1 point**: 2-4 hours of work
- **Testable**: Has clear acceptance criteria
- **Atomic**: Can be completed independently
- **Deployable**: Can be merged without breaking existing functionality

### Size Validation Checklist

For each story, verify:
- [ ] Can be completed in 2-4 hours by an experienced developer?
- [ ] Has 3-5 clear acceptance criteria in Given-When-Then format?
- [ ] Has specific file paths and code examples?
- [ ] Has testing requirements defined?
- [ ] Has security considerations if applicable?
- [ ] Has Definition of Done checklist?

---

## Required Mermaid Diagrams

Each Epic must include these 5 diagram types:

### 1. Sequence Diagram
**Purpose**: Show NOSTR event publishing flow across services
**Actors**: Frontend → Shared Service → Relay → Backend

### 2. Flowchart
**Purpose**: Show decision tree for relay selection and fallback

### 3. State Diagram
**Purpose**: Show relay connection state machine (connecting, connected, disconnected, error)

### 4. Entity Relationship Diagram (or Architecture Diagram)
**Purpose**: Show NOSTR service architecture (Core → Adapters → Frontend/Backend)

### 5. Gantt Chart
**Purpose**: Show sprint timeline and story dependencies

---

## Testing Requirements

### Unit Tests (95%+ Coverage)
- All core NOSTR services (events, relays, subscriptions, crypto)
- All adapter implementations
- All utility functions

### Integration Tests
- Multi-relay publishing
- Subscription event processing
- Connection resilience and reconnection
- Browser extension integration (NIP-07)

### E2E Tests
- Frontend: User creates content and publishes to NOSTR
- Backend: API endpoint publishes NOSTR event
- Cross-platform: Frontend and backend communicate via NOSTR

### Performance Tests
- Event publishing latency (< 100ms p95)
- Relay connection time (< 2s p95)
- Subscription throughput (> 1000 events/sec)
- Memory footprint (< 50MB for relay connections)

---

## Security Requirements

### Security-Critical Stories

**Story 5** (Cryptography Service):
- **Risk**: Key management vulnerabilities
- **Required Review**: 1 security specialist
- **Tests**: Key rotation, signature validation, DM encryption

**Story 8** (Browser Adapter):
- **Risk**: Browser extension integration vulnerabilities
- **Required Review**: 1 frontend security specialist
- **Tests**: NIP-07 compliance, XSS prevention, localStorage security

**Story 20** (Security Testing):
- **Risk**: NOSTR protocol vulnerabilities
- **Required Review**: 1 senior backend engineer
- **Tests**: Signature forgery, event tampering, relay impersonation

---

## Documentation Requirements

### Must Create Documents (Similar to Epic 001/002)

1. **EPIC-003-STORY-BREAKDOWN.md**
   - All 22-28 stories with full specifications
   - User story format (As a... I want... So that...)
   - Acceptance criteria (Given-When-Then)
   - Technical implementation (code examples, file paths)
   - Dependencies
   - Definition of Done
   - Security considerations
   - Testing requirements

2. **EPIC-003-STORY-MAP.md**
   - Work stream organization
   - Sprint structure (4 sprints recommended)
   - Developer allocation strategies
   - Dependency chain visualization
   - Risk mitigation strategy
   - Testing and communication plans

3. **EPIC-003-QUICK-REFERENCE.md**
   - Story quick reference table
   - Files modified by each story
   - Common NOSTR patterns (copy-paste code)
   - Security checklists
   - Testing checklists
   - Useful commands
   - Troubleshooting guide

4. **EPIC-003-DEPENDENCY-GRAPH.mmd**
   - Mermaid diagram showing all 5 types
   - Story dependencies
   - Parallel work visualization
   - Risk levels color-coded

5. **EPIC-003-README.md**
   - Documentation index
   - Quick start guide
   - Story assignments
   - Timeline estimates
   - Success criteria

6. **EPIC-003-GITHUB-ISSUE-TEMPLATE.md**
   - Generic issue template
   - Complete example for Story 1
   - Bulk creation script (bash + gh CLI)

7. **EPIC-003-IMPLEMENTATION-SUMMARY.md**
   - Executive summary
   - Deliverables created
   - Next steps
   - Approval signatures

---

## Risk Assessment

### High-Risk Areas

1. **Breaking NOSTR Functionality** (Impact: CRITICAL, Likelihood: MEDIUM)
   - **Mitigation**: Feature flags, parallel running, comprehensive tests
   - **Stories Affected**: 11-18 (migration stories)

2. **Performance Degradation** (Impact: HIGH, Likelihood: LOW)
   - **Mitigation**: Benchmark before/after, optimize adapters
   - **Stories Affected**: All core service stories (1-6)

3. **NIP Compliance Issues** (Impact: HIGH, Likelihood: LOW)
   - **Mitigation**: NIP compliance test suite in Story 20
   - **Stories Affected**: 2, 4, 5, 8

### Medium-Risk Areas

4. **Migration Complexity** (Impact: MEDIUM, Likelihood: MEDIUM)
   - **Mitigation**: Incremental migration, feature flags
   - **Stories Affected**: 11-18

5. **Relay Connection Issues** (Impact: HIGH, Likelihood: MEDIUM)
   - **Mitigation**: Extensive relay testing on testnet/mainnet
   - **Stories Affected**: 3, 6, 12, 16

---

## Success Metrics

### Technical Metrics
- Single shared NOSTR service implementation: ✅
- Code reduction: ~1,000 lines eliminated (15% reduction)
- Test coverage: 95%+ for core service
- Zero regression in NOSTR features
- Performance: No degradation in event publishing or relay connections

### Business Metrics
- 30% reduction in NOSTR-related maintenance effort
- Faster NOSTR feature development (estimated 20% faster)
- Improved reliability (fewer NOSTR-related bugs)

---

## Prompt Template for story-decomposer Agent

Use this exact prompt when invoking the story-decomposer agent:

```
You are the story-decomposer agent for the Sovren refactoring initiative. Your task is to decompose Epic 003 (NOSTR Service Consolidation) into granular 1-point user stories following the exact pattern established in Epic 001 and Epic 002.

**Context Files**:
- Epic Document: /Users/fp/Desktop/Sovren/docs/refactoring/EPIC-003-nostr-service-consolidation.md
- Decomposition Spec: /Users/fp/Desktop/Sovren/docs/refactoring/EPIC-003-DECOMPOSITION-SPEC.md
- Reference Pattern Epic 001: /Users/fp/Desktop/Sovren/docs/refactoring/EPIC-001-story-breakdown.md
- Reference Pattern Epic 002: /Users/fp/Desktop/Sovren/docs/refactoring/EPIC-002-USER-STORIES.md

**Your Deliverables**:

1. **EPIC-003-STORY-BREAKDOWN.md** (PRIMARY)
   - 22-28 granular 1-point user stories
   - Each story must have:
     * User story format (As a... I want... So that...)
     * 3-5 acceptance criteria in Given-When-Then format
     * Technical implementation with code examples and file paths
     * Dependencies (which stories must be done first)
     * Definition of Done checklist
     * Security considerations (if applicable)
     * Testing requirements (unit, integration, E2E)
     * Performance benchmarks (if applicable)
   - Follow the EXACT structure from EPIC-001-story-breakdown.md

2. **EPIC-003-STORY-MAP.md**
   - Work stream organization (5 streams: Core, Adapters, Frontend, Backend, Testing)
   - Sprint structure (4 sprints recommended)
   - Developer allocation strategies (1-dev, 2-dev, 3-dev scenarios)
   - Dependency chain visualization (ASCII art)
   - Risk mitigation strategy
   - Testing and communication plans
   - Follow the EXACT structure from EPIC-001-story-map.md

3. **EPIC-003-QUICK-REFERENCE.md**
   - Story quick reference table
   - Files modified by each story
   - Common NOSTR patterns (copy-paste code examples)
   - Security checklists
   - Testing checklists
   - Useful commands for NOSTR testing
   - Troubleshooting guide
   - Follow the EXACT structure from EPIC-001-quick-reference.md

4. **EPIC-003-DEPENDENCY-GRAPH.mmd**
   - Mermaid diagrams showing ALL 5 required types:
     1. Sequence Diagram (NOSTR event publishing flow)
     2. Flowchart (relay selection decision tree)
     3. State Diagram (relay connection states)
     4. Architecture Diagram (service structure)
     5. Gantt Chart (sprint timeline)
   - Color-code by work stream
   - Show risk levels

5. **EPIC-003-README.md**
   - Documentation index
   - Quick start guide for developers
   - Story assignments (1-dev, 2-dev, 3-dev scenarios)
   - Timeline estimates
   - Success criteria
   - Follow the EXACT structure from EPIC-001-README.md

6. **EPIC-003-GITHUB-ISSUE-TEMPLATE.md**
   - Generic GitHub issue template
   - Complete example for Story 1
   - Bulk creation script (bash + gh CLI)

7. **EPIC-003-IMPLEMENTATION-SUMMARY.md**
   - Executive summary
   - Deliverables created
   - Risk assessment
   - Next steps
   - Approval signatures

**Story Breakdown Guidance** (from EPIC-003-DECOMPOSITION-SPEC.md):

Stream A: Core Service Foundation (Stories 1-6)
- Story 1: Core type definitions
- Story 2: Event creation and validation
- Story 3: Relay connection management
- Story 4: Subscription handling
- Story 5: Cryptography service
- Story 6: Multi-relay publishing

Stream B: Platform Adapters (Stories 7-10)
- Story 7: Adapter interface pattern
- Story 8: Browser adapter
- Story 9: Node.js adapter
- Story 10: Adapter testing framework

Stream C: Frontend Migration (Stories 11-14)
- Story 11: Event publishing migration
- Story 12: Relay management migration
- Story 13: Subscription handling migration
- Story 14: Profile sync migration

Stream D: Backend Migration (Stories 15-18)
- Story 15: Event publishing migration
- Story 16: Relay management migration
- Story 17: Subscription handling migration
- Story 18: Webhook integration migration

Stream E: Testing & Cleanup (Stories 19-22)
- Story 19: Integration test suite
- Story 20: Security testing & NIP compliance
- Story 21: Architecture documentation
- Story 22: Cleanup old implementations

**Quality Standards**:
- Each story: 1 point (2-4 hours)
- 95%+ test coverage required
- Security reviews for Stories 5, 8, 20
- All 5 Mermaid diagram types required
- Follow Sovren documentation standards (@project-rules.mdc)

**Consistency Requirements**:
- Use EXACT same format as Epic 001 and Epic 002
- Use same section headings, table structures, code block formats
- Match tone and level of detail
- Include all sections that Epic 001 and Epic 002 have

Begin decomposition now. Create all 7 documents with comprehensive detail.
```

---

## Validation Checklist

Before considering Epic 003 decomposition complete, verify:

- [ ] **All documents created**: 7 required documents exist
- [ ] **Story count**: 22-28 stories, all 1-point
- [ ] **Consistency**: Same format/structure as Epic 001 and Epic 002
- [ ] **5 Mermaid diagrams**: Sequence, Flowchart, State, Architecture, Gantt
- [ ] **Work streams**: 5 streams clearly defined with assignments
- [ ] **Dependencies**: Critical path and parallel work identified
- [ ] **Testing**: Unit, integration, E2E, performance requirements
- [ ] **Security**: Security-critical stories identified with review requirements
- [ ] **Documentation**: All required documentation sections included
- [ ] **GitHub templates**: Issue template with bulk creation script
- [ ] **Quality**: Follows @project-rules.mdc and @ways-of-working.mdc

---

## Next Steps After Decomposition

1. **Review** (1-2 hours):
   - Tech lead reviews all 7 documents
   - Validate story sizing (all 1-point)
   - Verify consistency with Epic 001/002

2. **Refinement** (if needed):
   - Adjust story breakdown based on feedback
   - Split any stories > 1 point
   - Merge any stories < 0.5 point

3. **Approval**:
   - Tech lead approval
   - Product owner approval
   - Engineering manager approval

4. **GitHub Setup** (2 hours):
   - Create Epic 003 issue
   - Create 22-28 story issues
   - Apply labels (stream, priority, risk, sprint)
   - Set up project board

5. **Ready for Development**:
   - Assign developers to work streams
   - Schedule kickoff meeting
   - Begin implementation!

---

**Status**: ✅ Ready for story-decomposer agent

**Last Updated**: 2025-10-23

**Orchestrator**: Project Orchestrator Agent
