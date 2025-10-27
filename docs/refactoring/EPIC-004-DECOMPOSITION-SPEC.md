# Epic 004: State Management Boundaries - Decomposition Specification

**Status**: Ready for Decomposition
**Date**: 2025-10-23
**Orchestrator**: Project Orchestrator Agent

---

## Executive Summary

This document provides the complete specification for decomposing Epic 004 (State Management Boundaries) into granular 1-point user stories following the same pattern established in Epic 001 and Epic 002.

**Epic Overview**:
- **Objective**: Define clear architectural boundaries between Redux Toolkit and React Query to eliminate confusion and improve developer experience
- **Estimated Stories**: 24-30 stories (1 point each)
- **Estimated Effort**: 24-30 story points (2-3 weeks with 2-3 developers)
- **Risk Level**: MEDIUM (affects state management architecture)
- **Business Impact**: 20% faster feature development, improved onboarding, fewer state-related bugs

---

## Decomposition Strategy

### Work Stream Organization

Based on the Epic 004 technical scope, the decomposition should create **5 parallel work streams**:

#### Stream A: Guidelines & Architecture (4-5 stories)
**Focus**: Define state management patterns and decision trees
**Developer Profile**: Tech lead or senior architect
**Estimated Time**: 8-10 hours

**Suggested Stories**:
1. **Story 1**: Create state management decision tree and guidelines
   - Decision tree (When to use Redux vs React Query vs local state)
   - Developer guidelines document
   - Code examples for common patterns
   - 2-3 hours

2. **Story 2**: Define Redux Toolkit patterns and slice structure
   - Redux slice organization standards
   - Action creator patterns
   - Selector patterns
   - Async thunk guidelines (when to avoid)
   - 2 hours

3. **Story 3**: Define React Query patterns and query organization
   - Query key structure and naming conventions
   - Cache configuration standards
   - Optimistic update patterns
   - Error handling patterns
   - 2 hours

4. **Story 4**: Create state management architecture diagrams
   - Mermaid diagrams (all 5 required types)
   - Redux architecture diagram
   - React Query architecture diagram
   - Data flow diagram
   - 2-3 hours

5. **Story 5**: Create migration guide and code transformation examples
   - Before/after examples for common patterns
   - Migration checklist
   - Common pitfalls to avoid
   - 2 hours

#### Stream B: Server State → React Query Migration (8-10 stories)
**Focus**: Move server data from Redux to React Query
**Developer Profile**: Frontend developer with API experience
**Estimated Time**: 16-20 hours

**Suggested Stories**:
6. **Story 6**: Audit and categorize all current state (Redux + React Query)
   - Inventory all Redux slices
   - Inventory all React Query usage
   - Categorize: client state vs server state
   - Identify duplications
   - 2-3 hours

7. **Story 7**: Create React Query hooks for creator data
   - useCreators, useCreatorProfile, useCreatorAnalytics
   - Proper cache configuration
   - Error handling
   - 2-3 hours

8. **Story 8**: Create React Query hooks for content data
   - useContent, useContentStream, useContentStats
   - Optimistic updates for content creation
   - Real-time NOSTR integration
   - 2-3 hours

9. **Story 9**: Create React Query hooks for payment data
   - useSubscriptions, useInvoices, usePaymentStatus
   - Payment polling logic
   - Error handling and retry
   - 2-3 hours

10. **Story 10**: Create React Query hooks for NOSTR data
    - useNostrEvents, useNostrProfile
    - Real-time event stream
    - Cached profile data
    - 2 hours

11. **Story 11**: Migrate creator features from Redux to React Query
    - Update components to use new hooks
    - Remove creatorsSlice from Redux
    - Integration tests
    - 2-3 hours

12. **Story 12**: Migrate content features from Redux to React Query
    - Update components to use new hooks
    - Handle optimistic updates
    - Integration tests
    - 2-3 hours

13. **Story 13**: Migrate payment features from Redux to React Query
    - Update components to use new hooks
    - Handle payment polling
    - Integration tests
    - 2-3 hours

14. **Story 14**: Remove server data from CMS and analytics slices
    - Split cmsSlice (keep client state, remove server state)
    - Split analyticsSlice (keep client state, remove server state)
    - Create React Query hooks for server portions
    - 2 hours

15. **Story 15**: Add React Query cache invalidation patterns
    - Implement proper invalidation on mutations
    - Add query prefetching
    - Optimize cache configuration
    - 2 hours

#### Stream C: Client State → Redux Consolidation (4-6 stories)
**Focus**: Consolidate UI state in Redux
**Developer Profile**: Frontend developer with Redux experience
**Estimated Time**: 8-12 hours

**Suggested Stories**:
16. **Story 16**: Create unified UI slice for application state
    - Modal state management
    - Theme state
    - Sidebar/drawer state
    - Notification state
    - 2-3 hours

17. **Story 17**: Consolidate authentication and session state in Redux
    - authSlice enhancements
    - Session management
    - Token refresh logic
    - 2 hours

18. **Story 18**: Create preferences slice for user settings
    - Local settings management
    - localStorage persistence
    - Default preferences
    - 2 hours

19. **Story 19**: Migrate scattered UI state to Redux
    - Move modal state from component state
    - Move theme state from Context
    - Update components
    - 2-3 hours

20. **Story 20**: Remove UI state from React Query
    - Identify UI state incorrectly in React Query
    - Migrate to appropriate Redux slices
    - Cleanup React Query usage
    - 2 hours

#### Stream D: Testing & Validation (3-4 stories)
**Focus**: Comprehensive testing of new state patterns
**Developer Profile**: QA focus or senior frontend developer
**Estimated Time**: 6-8 hours

**Suggested Stories**:
21. **Story 21**: Create state management integration test suite
    - Test Redux state persistence
    - Test React Query cache behavior
    - Test data flow from API to components
    - 2-3 hours

22. **Story 22**: Add performance testing for state management
    - Benchmark query response times
    - Measure bundle size impact
    - Test cache hit rates
    - Monitor re-render performance
    - 2 hours

23. **Story 23**: Add state management E2E tests
    - Test critical user flows (login, content creation, payment)
    - Test optimistic update scenarios
    - Test cache invalidation
    - 2-3 hours

#### Stream E: Documentation & Training (3-4 stories)
**Focus**: Documentation and team enablement
**Developer Profile**: Technical writer or senior developer
**Estimated Time**: 6-8 hours

**Suggested Stories**:
24. **Story 24**: Create developer guide with code examples
    - Redux patterns section
    - React Query patterns section
    - Common patterns library
    - Anti-patterns to avoid
    - 2-3 hours

25. **Story 25**: Create troubleshooting and debugging guide
    - Redux DevTools usage
    - React Query DevTools usage
    - Common issues and solutions
    - Debugging strategies
    - 2 hours

26. **Story 26**: Create team training materials and conduct workshops
    - Create training presentation
    - Conduct hands-on workshop (2 hours)
    - Record session for future onboarding
    - 2-3 hours

27. **Story 27**: Update codebase documentation and ADRs
    - Document state management architecture decision
    - Update README with state management section
    - Create ADR for Redux vs React Query boundaries
    - 2 hours

**Optional Stories** (if needed):
28. **Story 28**: Add React Query DevTools integration
29. **Story 29**: Implement advanced caching strategies (optimistic updates, prefetching)
30. **Story 30**: Create state management linting rules

---

## Dependency Structure

### Critical Path (Sequential)

```
Story 1 (Guidelines) → Story 2 (Redux Patterns) + Story 3 (React Query Patterns) → Story 4 (Diagrams)
                              ↓
Story 6 (Audit) → Stories 7-10 (Create Hooks) → Stories 11-13 (Migration) → Story 15 (Cache)
                              ↓
Story 16-20 (Redux Consolidation) [Can run parallel with Stories 7-15]
                              ↓
Stories 21-23 (Testing) → Stories 24-27 (Documentation)
```

### Parallel Work Opportunities

**Phase 1: Foundation** (Week 1, Days 1-2)
- Stories 1-5 (Guidelines) - Sequential by 1 developer
- Story 6 (Audit) - Can run parallel with Stories 2-3

**Phase 2: React Query Migration** (Week 1-2)
- Stories 7-10 (Create hooks) - Can all run in parallel by 2-4 developers
- Stories 11-13 (Migration) - Can run in parallel once hooks are ready

**Phase 3: Dual Track** (Week 2)
- Stream B (Stories 14-15) and Stream C (Stories 16-20) are 100% parallel

**Phase 4: Finalization** (Week 3)
- Stories 21-23 (Testing) - Can run in parallel
- Stories 24-27 (Documentation) - Sequential or parallel

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
- [ ] Has Definition of Done checklist?

---

## Required Mermaid Diagrams

Each Epic must include these 5 diagram types:

### 1. Sequence Diagram
**Purpose**: Show data flow from API → React Query → Component
**Actors**: API, React Query, Redux, Component

### 2. Flowchart
**Purpose**: Show state management decision tree (When to use Redux vs React Query vs local state)

### 3. State Diagram
**Purpose**: Show React Query cache states (fresh, stale, fetching, error)

### 4. Architecture Diagram
**Purpose**: Show overall state management architecture (Redux store structure + React Query organization)

### 5. Gantt Chart
**Purpose**: Show sprint timeline and story dependencies

---

## Testing Requirements

### Unit Tests (95%+ Coverage)
- All Redux reducers and selectors
- All React Query hooks
- All custom hook logic

### Integration Tests
- Redux state persistence (localStorage)
- React Query cache behavior
- Data flow from API to components
- Optimistic update scenarios

### E2E Tests
- Critical user flows (login, content creation, payment)
- State persistence across page refreshes
- Cache invalidation on mutations

### Performance Tests
- Query response times (baseline vs new)
- Bundle size impact
- Cache hit rates (target > 80%)
- Re-render performance (React DevTools Profiler)
- Redux state update performance (< 16ms for 60fps)

---

## Security Requirements

### Security Considerations

**Story 17** (Authentication State):
- **Risk**: Session management vulnerabilities
- **Required Review**: 1 security specialist
- **Tests**: Token refresh, session expiry, XSS prevention

**Story 18** (Preferences Slice):
- **Risk**: localStorage security
- **Required Review**: 1 frontend security specialist
- **Tests**: Prevent localStorage poisoning, sanitize preferences

All other stories have low security risk.

---

## Documentation Requirements

### Must Create Documents (Similar to Epic 001/002)

1. **EPIC-004-STORY-BREAKDOWN.md**
   - All 24-30 stories with full specifications
   - User story format
   - Acceptance criteria (Given-When-Then)
   - Technical implementation (code examples, file paths)
   - Dependencies
   - Definition of Done
   - Testing requirements

2. **EPIC-004-STORY-MAP.md**
   - Work stream organization
   - Sprint structure (3-4 sprints recommended)
   - Developer allocation strategies
   - Dependency chain visualization
   - Risk mitigation strategy
   - Testing and communication plans

3. **EPIC-004-QUICK-REFERENCE.md**
   - Story quick reference table
   - Files modified by each story
   - Common state management patterns (copy-paste code)
   - Redux patterns library
   - React Query patterns library
   - Useful commands
   - Troubleshooting guide

4. **EPIC-004-DEPENDENCY-GRAPH.mmd**
   - Mermaid diagram showing all 5 types
   - Story dependencies
   - Parallel work visualization
   - Risk levels color-coded

5. **EPIC-004-README.md**
   - Documentation index
   - Quick start guide
   - Story assignments
   - Timeline estimates
   - Success criteria

6. **EPIC-004-GITHUB-ISSUE-TEMPLATE.md**
   - Generic issue template
   - Complete example for Story 1
   - Bulk creation script (bash + gh CLI)

7. **EPIC-004-IMPLEMENTATION-SUMMARY.md**
   - Executive summary
   - Deliverables created
   - Next steps
   - Approval signatures

---

## Risk Assessment

### High-Risk Areas

1. **Breaking Existing Features** (Impact: HIGH, Likelihood: MEDIUM)
   - **Mitigation**: Feature flags, comprehensive tests, incremental migration
   - **Stories Affected**: 11-13 (migration stories), 19-20 (Redux consolidation)

2. **Cache Invalidation Bugs** (Impact: HIGH, Likelihood: MEDIUM)
   - **Mitigation**: Comprehensive integration tests, cache debugging tools
   - **Stories Affected**: 15 (cache invalidation), 21-23 (testing)

### Medium-Risk Areas

3. **Performance Regression** (Impact: MEDIUM, Likelihood: LOW)
   - **Mitigation**: Performance testing in Story 22, benchmarking
   - **Stories Affected**: All React Query stories (7-15)

4. **Developer Resistance to Change** (Impact: MEDIUM, Likelihood: MEDIUM)
   - **Mitigation**: Clear guidelines, training, examples
   - **Stories Affected**: 24-27 (documentation and training)

---

## Success Metrics

### Technical Metrics
- Clear state management guidelines documented: ✅
- All server data in React Query: ✅
- All UI state in Redux: ✅
- Zero duplicate data storage: ✅
- React Query cache hit rate: > 80%
- Redux state updates: < 16ms (60fps)
- Bundle size impact: < 5KB increase

### Business Metrics
- 20% faster feature development (measured by story velocity)
- New developer onboarding: < 1 day to understand state management
- Reduced state-related bugs (25% reduction)
- Developer satisfaction: Positive feedback in retrospective

---

## Prompt Template for story-decomposer Agent

Use this exact prompt when invoking the story-decomposer agent:

```
You are the story-decomposer agent for the Sovren refactoring initiative. Your task is to decompose Epic 004 (State Management Boundaries) into granular 1-point user stories following the exact pattern established in Epic 001 and Epic 002.

**Context Files**:
- Epic Document: /Users/fp/Desktop/Sovren/docs/refactoring/EPIC-004-state-management-boundaries.md
- Decomposition Spec: /Users/fp/Desktop/Sovren/docs/refactoring/EPIC-004-DECOMPOSITION-SPEC.md
- Reference Pattern Epic 001: /Users/fp/Desktop/Sovren/docs/refactoring/EPIC-001-story-breakdown.md
- Reference Pattern Epic 002: /Users/fp/Desktop/Sovren/docs/refactoring/EPIC-002-USER-STORIES.md

**Your Deliverables**:

1. **EPIC-004-STORY-BREAKDOWN.md** (PRIMARY)
   - 24-30 granular 1-point user stories
   - Each story must have:
     * User story format (As a... I want... So that...)
     * 3-5 acceptance criteria in Given-When-Then format
     * Technical implementation with code examples and file paths
     * Dependencies (which stories must be done first)
     * Definition of Done checklist
     * Testing requirements (unit, integration, E2E)
     * Performance benchmarks (if applicable)
   - Follow the EXACT structure from EPIC-001-story-breakdown.md

2. **EPIC-004-STORY-MAP.md**
   - Work stream organization (5 streams: Guidelines, React Query Migration, Redux Consolidation, Testing, Documentation)
   - Sprint structure (3-4 sprints recommended)
   - Developer allocation strategies (1-dev, 2-dev, 3-dev scenarios)
   - Dependency chain visualization (ASCII art)
   - Risk mitigation strategy
   - Testing and communication plans
   - Follow the EXACT structure from EPIC-001-story-map.md

3. **EPIC-004-QUICK-REFERENCE.md**
   - Story quick reference table
   - Files modified by each story
   - Common state management patterns (Redux and React Query)
   - Code examples for common patterns
   - Testing checklists
   - Useful commands for debugging state
   - Troubleshooting guide
   - Follow the EXACT structure from EPIC-001-quick-reference.md

4. **EPIC-004-DEPENDENCY-GRAPH.mmd**
   - Mermaid diagrams showing ALL 5 required types:
     1. Sequence Diagram (API → React Query → Component data flow)
     2. Flowchart (state management decision tree)
     3. State Diagram (React Query cache states)
     4. Architecture Diagram (Redux + React Query architecture)
     5. Gantt Chart (sprint timeline)
   - Color-code by work stream
   - Show risk levels

5. **EPIC-004-README.md**
   - Documentation index
   - Quick start guide for developers
   - Story assignments (1-dev, 2-dev, 3-dev scenarios)
   - Timeline estimates
   - Success criteria
   - Follow the EXACT structure from EPIC-001-README.md

6. **EPIC-004-GITHUB-ISSUE-TEMPLATE.md**
   - Generic GitHub issue template
   - Complete example for Story 1
   - Bulk creation script (bash + gh CLI)

7. **EPIC-004-IMPLEMENTATION-SUMMARY.md**
   - Executive summary
   - Deliverables created
   - Risk assessment
   - Next steps
   - Approval signatures

**Story Breakdown Guidance** (from EPIC-004-DECOMPOSITION-SPEC.md):

Stream A: Guidelines & Architecture (Stories 1-5)
- Story 1: State management decision tree
- Story 2: Redux patterns
- Story 3: React Query patterns
- Story 4: Architecture diagrams
- Story 5: Migration guide

Stream B: Server State → React Query Migration (Stories 6-15)
- Story 6: Audit current state
- Stories 7-10: Create React Query hooks (creators, content, payments, NOSTR)
- Stories 11-13: Migrate features to React Query
- Story 14: Remove server data from CMS/analytics slices
- Story 15: Cache invalidation patterns

Stream C: Client State → Redux Consolidation (Stories 16-20)
- Story 16: Unified UI slice
- Story 17: Authentication state
- Story 18: Preferences slice
- Story 19: Migrate scattered UI state
- Story 20: Remove UI state from React Query

Stream D: Testing & Validation (Stories 21-23)
- Story 21: Integration test suite
- Story 22: Performance testing
- Story 23: E2E tests

Stream E: Documentation & Training (Stories 24-27)
- Story 24: Developer guide
- Story 25: Troubleshooting guide
- Story 26: Team training
- Story 27: Update ADRs

**Quality Standards**:
- Each story: 1 point (2-4 hours)
- 95%+ test coverage required
- Security reviews for Stories 17, 18
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

Before considering Epic 004 decomposition complete, verify:

- [ ] **All documents created**: 7 required documents exist
- [ ] **Story count**: 24-30 stories, all 1-point
- [ ] **Consistency**: Same format/structure as Epic 001 and Epic 002
- [ ] **5 Mermaid diagrams**: Sequence, Flowchart, State, Architecture, Gantt
- [ ] **Work streams**: 5 streams clearly defined with assignments
- [ ] **Dependencies**: Critical path and parallel work identified
- [ ] **Testing**: Unit, integration, E2E, performance requirements
- [ ] **Security**: Security-critical stories identified (Stories 17, 18)
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
   - Create Epic 004 issue
   - Create 24-30 story issues
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
