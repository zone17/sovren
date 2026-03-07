# Epic 003: NOSTR Service Consolidation - Dependency Diagram

## Story Dependency Graph

This diagram shows the dependencies between all 26 user stories, illustrating the critical path and parallel work opportunities.

```mermaid
graph TB
    subgraph "Phase 1: Core Service Extraction (Sprint 0)"
        NS001["NS-001: Create Core Structure"]
        NS002["NS-002: Event Creation"]
        NS003["NS-003: Event Validation"]
        NS004["NS-004: Relay Connection Pool"]
        NS005["NS-005: Relay Auto-Reconnection"]
        NS006["NS-006: Subscription Management"]
        NS007["NS-007: Cryptographic Operations"]
        NS008["NS-008: NIP-07 Extension Support"]
    end

    subgraph "Phase 2: Adapter Implementation (Sprint 1)"
        NS009["NS-009: Define Adapter Interfaces"]

        subgraph "Stream B: Browser Adapter"
            NS010["NS-010: Browser Adapter Base"]
            NS011["NS-011: React Hooks"]
            NS012["NS-012: Browser Storage"]
        end

        subgraph "Stream C: Node.js Adapter"
            NS013["NS-013: Node Adapter Base"]
            NS014["NS-014: Server Event Emitter"]
        end
    end

    subgraph "Phase 3: Frontend Migration (Sprint 2)"
        NS015["NS-015: Frontend Feature Flag"]
        NS016["NS-016: Frontend Event Publishing"]
        NS017["NS-017: Frontend Subscriptions"]
        NS018["NS-018: Frontend Integration"]
    end

    subgraph "Phase 4: Backend Migration (Sprint 2)"
        NS019["NS-019: Backend Feature Flag"]
        NS020["NS-020: Backend Event Publishing"]
        NS021["NS-021: Backend API Endpoints"]
        NS022["NS-022: Backend Webhooks"]
    end

    subgraph "Phase 5: Cleanup & Validation (Sprint 3)"
        NS023["NS-023: Remove Frontend Code"]
        NS024["NS-024: Remove Backend Code"]
        NS025["NS-025: Architecture Docs"]
        NS026["NS-026: Performance Validation"]
    end

    %% Phase 1 Dependencies
    NS001 --> NS002
    NS001 --> NS004
    NS001 --> NS006
    NS001 --> NS009

    NS002 --> NS003
    NS002 --> NS007

    NS004 --> NS005

    NS007 --> NS008

    %% Phase 2 Dependencies
    NS009 --> NS010
    NS009 --> NS013

    NS008 --> NS010

    NS010 --> NS011
    NS010 --> NS012

    NS013 --> NS014

    %% Phase 3 Dependencies
    NS012 --> NS015
    NS015 --> NS016
    NS015 --> NS017

    NS016 --> NS018
    NS017 --> NS018

    %% Phase 4 Dependencies
    NS014 --> NS019
    NS019 --> NS020
    NS019 --> NS021
    NS019 --> NS022

    %% Phase 5 Dependencies
    NS018 --> NS023

    NS020 --> NS024
    NS021 --> NS024
    NS022 --> NS024

    NS023 --> NS025
    NS024 --> NS025

    NS023 --> NS026
    NS024 --> NS026

    %% Parallel work opportunities (dashed lines)
    NS002 -."Can work in parallel".-> NS004
    NS002 -."Can work in parallel".-> NS006
    NS004 -."Can work in parallel".-> NS006
    NS007 -."Can work in parallel".-> NS005

    NS010 -."Stream B parallel with Stream C".-> NS013
    NS011 -."Stream B parallel with Stream C".-> NS014
    NS012 -."Stream B parallel with Stream C".-> NS014

    NS015 -."Stream D parallel with Stream E".-> NS019
    NS016 -."Stream D parallel with Stream E".-> NS020
    NS017 -."Stream D parallel with Stream E".-> NS021
    NS018 -."Stream D parallel with Stream E".-> NS022

    NS023 -."Can work in parallel".-> NS024

    %% Styling
    classDef phase1 fill:#e1f5e1
    classDef phase2Browser fill:#e1e5f5
    classDef phase2Node fill:#f5e1e5
    classDef phase2Shared fill:#fff4e1
    classDef phase3 fill:#f5e1e1
    classDef phase4 fill:#e1f5f5
    classDef phase5 fill:#f5f5e1
    classDef critical fill:#ffcccc,stroke:#ff0000,stroke-width:3px

    class NS001,NS002,NS003,NS004,NS005,NS006,NS007,NS008 phase1
    class NS009 phase2Shared
    class NS010,NS011,NS012 phase2Browser
    class NS013,NS014 phase2Node
    class NS015,NS016,NS017,NS018 phase3
    class NS019,NS020,NS021,NS022 phase4
    class NS023,NS024,NS025,NS026 phase5
    class NS001,NS009,NS015,NS019 critical
```

## Critical Path Analysis

The **critical path** (highlighted in red) represents the minimum time to complete the epic:

```
NS-001 (2h) → NS-009 (2h) → NS-010 (3h) → NS-012 (3h) → NS-015 (2h) → NS-018 (4h) → NS-023 (2h) → NS-026 (4h)
```

**Total Critical Path Duration**: 22 hours (~3 days with single developer)

With 2 developers working in parallel, actual duration can be reduced to **6-9 days**.

## Work Stream Dependencies

```mermaid
graph LR
    subgraph "Sequential Foundation"
        A[Stream A: Core Service<br/>NS-001 to NS-008]
    end

    subgraph "Parallel Adapters"
        B[Stream B: Browser Adapter<br/>NS-010 to NS-012]
        C[Stream C: Node Adapter<br/>NS-013 to NS-014]
    end

    subgraph "Parallel Migration"
        D[Stream D: Frontend<br/>NS-015 to NS-018]
        E[Stream E: Backend<br/>NS-019 to NS-022]
    end

    subgraph "Parallel Cleanup"
        F[Stream F: Frontend Cleanup<br/>NS-023]
        G[Stream G: Backend Cleanup<br/>NS-024]
    end

    subgraph "Final Validation"
        H[Documentation & Performance<br/>NS-025, NS-026]
    end

    A --> B
    A --> C
    B --> D
    C --> E
    D --> F
    E --> G
    F --> H
    G --> H

    B -."Parallel".-> C
    D -."Parallel".-> E
    F -."Parallel".-> G

    style A fill:#e1f5e1
    style B fill:#e1e5f5
    style C fill:#f5e1e5
    style D fill:#f5e1e1
    style E fill:#e1f5f5
    style F fill:#ffe1e1
    style G fill:#ffe1e1
    style H fill:#f5f5e1
```

## Parallel Work Opportunities

### Sprint 0: Core Service (Phase 1)

```mermaid
gantt
    title Phase 1 - Core Service Extraction
    dateFormat HH:mm
    axisFormat %H:%M

    section Developer 1
    NS-001 Structure       :a1, 00:00, 2h
    NS-002 Event Creation  :a2, after a1, 3h
    NS-003 Event Validation:a3, after a2, 3h
    NS-007 Cryptography    :a7, after a3, 4h
    NS-008 NIP-07          :a8, after a7, 2h

    section Developer 2
    Wait for NS-001        :crit, b1, 00:00, 2h
    NS-004 Relay Pool      :b4, after b1, 4h
    NS-005 Auto-Reconnect  :b5, after b4, 3h
    NS-006 Subscriptions   :b6, after b5, 4h
```

**Parallel Opportunities**:

- After NS-001 (2h), both developers can work simultaneously
- Dev 1: Event-related stories (NS-002, NS-003, NS-007, NS-008)
- Dev 2: Network-related stories (NS-004, NS-005, NS-006)

### Sprint 1: Adapters (Phase 2)

```mermaid
gantt
    title Phase 2 - Adapter Implementation
    dateFormat HH:mm
    axisFormat %H:%M

    section Shared
    NS-009 Interfaces      :crit, a9, 00:00, 2h

    section Developer 1 (Browser)
    Wait for NS-009        :b10, 00:00, 2h
    NS-010 Browser Base    :b11, after b10, 3h
    NS-011 React Hooks     :b12, after b11, 4h
    NS-012 Storage         :b13, after b12, 3h

    section Developer 2 (Node)
    Wait for NS-009        :c10, 00:00, 2h
    NS-013 Node Base       :c13, after c10, 3h
    NS-014 Event Emitter   :c14, after c13, 3h
    Free Time              :c15, after c14, 4h
```

**Parallel Opportunities**:

- After NS-009 (2h), Streams B and C are **fully independent**
- Dev 1: Browser adapter (10h total)
- Dev 2: Node adapter (6h total, can help with testing)

### Sprint 2: Migration (Phases 3 & 4)

```mermaid
gantt
    title Phases 3 & 4 - Frontend and Backend Migration
    dateFormat HH:mm
    axisFormat %H:%M

    section Developer 1 (Frontend - Stream D)
    NS-015 Feature Flag    :d15, 00:00, 2h
    NS-016 Event Publish   :d16, after d15, 3h
    NS-017 Subscriptions   :d17, after d15, 3h
    NS-018 Integration     :d18, after d16 d17, 4h

    section Developer 2 (Backend - Stream E)
    NS-019 Feature Flag    :e19, 00:00, 2h
    NS-020 Event Publish   :e20, after e19, 3h
    NS-021 API Endpoints   :e21, after e19, 3h
    NS-022 Webhooks        :e22, after e19, 4h
```

**Parallel Opportunities**:

- Streams D and E are **completely independent**
- Dev 1: Frontend migration (12h)
- Dev 2: Backend migration (12h)
- Both work simultaneously, maximum parallelization

### Sprint 3: Cleanup (Phase 5)

```mermaid
gantt
    title Phase 5 - Cleanup and Validation
    dateFormat HH:mm
    axisFormat %H:%M

    section Developer 1
    NS-023 Frontend Cleanup :f23, 00:00, 2h
    NS-025 Documentation    :f25, after f23, 3h

    section Developer 2
    NS-024 Backend Cleanup  :g24, 00:00, 2h
    NS-026 Performance      :g26, after g24, 4h
```

**Parallel Opportunities**:

- NS-023 and NS-024 can be done simultaneously
- Documentation can start alongside cleanup
- Performance validation is final step

## Dependency Chains

### Event Management Chain

```
NS-001 → NS-002 → NS-003 → NS-007 → NS-008 → NS-010 → NS-011 → NS-015 → NS-016
```

### Relay Management Chain

```
NS-001 → NS-004 → NS-005 → NS-010 → NS-015 → NS-016
```

### Subscription Chain

```
NS-001 → NS-006 → NS-010 → NS-011 → NS-015 → NS-017 → NS-018
```

### Backend Chain

```
NS-001 → NS-009 → NS-013 → NS-014 → NS-019 → NS-020/NS-021/NS-022 → NS-024
```

## Blocking Relationships

### NS-001 Blocks (Foundation)

- NS-002, NS-004, NS-006, NS-009
- **Impact**: Blocks everything
- **Priority**: CRITICAL - must complete first

### NS-009 Blocks (Interfaces)

- NS-010, NS-013
- **Impact**: Blocks all adapter work
- **Priority**: HIGH - complete early in Sprint 1

### NS-015 & NS-019 Block (Feature Flags)

- NS-015 blocks: NS-016, NS-017, NS-018
- NS-019 blocks: NS-020, NS-021, NS-022
- **Impact**: Blocks migration phases
- **Priority**: HIGH - complete early in Sprint 2

### NS-018 & NS-022 Block (Migration Complete)

- NS-018 blocks: NS-023
- NS-020, NS-021, NS-022 block: NS-024
- **Impact**: Blocks cleanup phase
- **Priority**: MEDIUM - natural progression

## Timeline Visualization

```mermaid
gantt
    title Epic 003 - Overall Timeline (2 Developers)
    dateFormat YYYY-MM-DD

    section Sprint 0
    Core Service (NS-001 to NS-008)  :s0, 2025-01-01, 3d

    section Sprint 1
    Adapters (NS-009 to NS-014)      :s1, after s0, 2d

    section Sprint 2
    Frontend Migration (NS-015 to NS-018) :s2a, after s1, 2d
    Backend Migration (NS-019 to NS-022)  :s2b, after s1, 2d

    section Sprint 3
    Cleanup & Validation (NS-023 to NS-026) :s3, after s2a s2b, 2d

    section Milestones
    Core Complete       :milestone, m1, after s0, 0d
    Adapters Ready      :milestone, m2, after s1, 0d
    Migration Complete  :milestone, m3, after s2a s2b, 0d
    Epic Complete       :milestone, m4, after s3, 0d
```

**Total Duration**: 9 working days (~2 weeks)

## Resource Allocation

| Sprint   | Dev 1 Focus            | Dev 2 Focus           | Parallel?               |
| -------- | ---------------------- | --------------------- | ----------------------- |
| Sprint 0 | Events, Crypto         | Relays, Subscriptions | ✅ Yes (after NS-001)   |
| Sprint 1 | Browser Adapter        | Node.js Adapter       | ✅ Yes (after NS-009)   |
| Sprint 2 | Frontend Migration     | Backend Migration     | ✅ Yes (fully parallel) |
| Sprint 3 | Frontend Cleanup, Docs | Backend Cleanup, Perf | ✅ Yes (parallel)       |

## Risk Assessment by Dependency

### High Risk (Blocks Many Stories)

- **NS-001**: Blocks 4 immediate stories, entire epic depends on it
- **NS-009**: Blocks both adapter streams
- **NS-004**: Relay management is critical functionality

### Medium Risk (Blocks Phase)

- **NS-015**: Blocks frontend migration
- **NS-019**: Blocks backend migration
- **NS-010**: Blocks React hooks implementation

### Low Risk (Few Dependencies)

- **NS-005**: Only blocks itself from completion
- **NS-011**: Only blocks frontend migration stories
- **NS-025, NS-026**: Final stories, don't block anything

## Optimization Opportunities

1. **NS-002 and NS-004 can start in parallel** after NS-001
2. **Streams B and C fully parallel** in Sprint 1
3. **Streams D and E fully parallel** in Sprint 2
4. **NS-016 and NS-017 can partially overlap** (different components)
5. **NS-020, NS-021, NS-022 can partially overlap** (different controllers)

## Recommendations

1. **Complete NS-001 ASAP**: Unblocks most work
2. **Pair on NS-009**: Critical interface design, get it right
3. **Sprint 1 & 2 maximize parallelization**: Two independent streams
4. **Don't skip NS-015/NS-019**: Feature flags are safety net
5. **NS-026 is validation gate**: Don't merge cleanup until validated
