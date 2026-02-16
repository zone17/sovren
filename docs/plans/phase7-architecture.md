# Phase 7: Creator Safety Net — Architecture Plan

## Overview

Phase 7 delivers two new feature domains for the Sovren platform:

- **EPIC-007: Creator Wellness System** — Burnout detection, sustainable scheduling, wellness dashboard, creator boundaries
- **EPIC-008: Content Shield (AI Protection)** — Cryptographic provenance signing, perceptual fingerprinting, copy detection, authenticity badges

Both domains are privacy-first, creator-owned, and build on existing NOSTR + Supabase infrastructure.

---

## System Architecture

### High-Level Data Flow

```
Creator Activity (publish, engage, manage)
        │
        ├──→ [Auto-Tracking Middleware] ──→ wellness_snapshots / creator_work_patterns
        │
        ├──→ [Provenance Signing Hook] ──→ provenance_records (NOSTR event tags)
        │
        └──→ [Fingerprint Pipeline] ──→ content_fingerprints (SimHash + pHash)
                                              │
                                              ▼
                                    [Scanner Job (BullMQ)]
                                              │
                                              ▼
                                       content_alerts
```

### Backend Service Architecture

New services follow the existing DI container pattern (`ServiceContainer` + `ServiceRegistry` + `TYPES` tokens). All new services are registered as singletons in the container.

```
packages/backend/src/
├── services/
│   ├── wellness/
│   │   ├── WellnessService.ts          # Work pattern CRUD, pulse check-ins
│   │   ├── BurnoutScoringService.ts    # Weighted scoring algorithm
│   │   ├── ScheduleService.ts          # Sustainable cadence recommendations
│   │   └── BoundaryService.ts          # Focus hours, DND, auto-responses
│   └── provenance/
│       ├── ProvenanceService.ts        # Content signing, chain retrieval
│       ├── FingerprintService.ts       # SimHash text + pHash image hashing
│       ├── ScannerService.ts           # NOSTR relay content scanning (BullMQ job)
│       ├── AlertService.ts             # Alert CRUD, status transitions
│       └── DmcaService.ts             # Report generation (PDF + JSON)
├── routes/
│   └── v2/
│       ├── index.ts                    # v2 route aggregator
│       ├── wellness.routes.ts          # /api/v2/wellness/*
│       └── shield.routes.ts            # /api/v2/shield/*
├── interfaces/
│   ├── wellness/
│   │   ├── IWellnessService.ts
│   │   ├── IBurnoutScoringService.ts
│   │   ├── IScheduleService.ts
│   │   └── IBoundaryService.ts
│   └── provenance/
│       ├── IProvenanceService.ts
│       ├── IFingerprintService.ts
│       ├── IScannerService.ts
│       ├── IAlertService.ts
│       └── IDmcaService.ts
├── validators/
│   ├── wellness.ts                     # Zod schemas for wellness endpoints
│   └── shield.ts                       # Zod schemas for shield endpoints
└── container/
    └── types.ts                        # Extended with new TYPES entries
```

### Frontend Feature Architecture

New feature modules follow the existing feature-based modular pattern (self-contained modules with components, services, types, barrel exports). New modules use TanStack Query for server state (no Redux).

```
packages/frontend/src/features/
├── wellness/
│   ├── components/
│   │   ├── WellnessDashboard.tsx       # Main dashboard view (tab in CreatorDashboard)
│   │   ├── WorkPatternHeatmap.tsx      # 7x24 hourly heatmap (D3 or Recharts)
│   │   ├── BurnoutRiskGauge.tsx        # Green/yellow/orange/red gauge
│   │   ├── RestDayTracker.tsx          # Streak + work/rest ratio
│   │   ├── SustainablePaceIndicator.tsx
│   │   ├── SustainableScheduler.tsx    # Recommended vs current cadence
│   │   ├── CreativeBuffer.tsx          # Buffer depth visual
│   │   ├── BatchCreationWindows.tsx    # Suggested productive hours
│   │   ├── BoundarySettings.tsx        # Focus hours, DND, engagement budget
│   │   ├── CreatorAvailabilityStatus.tsx
│   │   ├── WellnessPulseModal.tsx      # Weekly check-in (opt-in, dismissible)
│   │   ├── WellnessTrend.tsx           # Pulse score line chart
│   │   └── WellnessResources.tsx       # Static curated resource cards
│   ├── hooks/
│   │   ├── useWellnessPatterns.ts      # TanStack Query for patterns API
│   │   ├── useBurnoutScore.ts          # TanStack Query for risk score
│   │   ├── useWellnessPulse.ts         # TanStack Query for pulse CRUD
│   │   ├── useBoundaries.ts            # TanStack Query for boundary settings
│   │   └── useScheduleRecommendations.ts
│   ├── services/
│   │   └── wellnessApi.ts              # API client (fetch wrapper)
│   ├── types/
│   │   └── index.ts                    # Wellness-specific component props/UI types
│   └── index.ts                        # Barrel exports
├── content-shield/
│   ├── components/
│   │   ├── ShieldDashboard.tsx         # Provenance registry, coverage stats
│   │   ├── AlertsFeed.tsx              # Detected copies with comparison
│   │   ├── DMCAReportButton.tsx        # One-click report generation
│   │   ├── FingerprintCoverage.tsx     # Coverage stats
│   │   ├── AuthenticityBadge.tsx       # Verified/unverified/disputed badge
│   │   └── ProvenanceChainViewer.tsx   # Cryptographic proof display
│   ├── hooks/
│   │   ├── useProvenanceChain.ts       # TanStack Query for provenance API
│   │   ├── useAlerts.ts               # TanStack Query for alerts API
│   │   ├── useFingerprintCoverage.ts
│   │   └── useDmcaReport.ts           # TanStack mutation for report generation
│   ├── services/
│   │   └── shieldApi.ts               # API client (fetch wrapper)
│   ├── types/
│   │   └── index.ts
│   └── index.ts
```

### Shared Types

```
packages/shared/src/types/
├── wellness.ts                         # Wellness domain types + Zod schemas
└── provenance.ts                       # Provenance/shield domain types + Zod schemas
```

---

## Integration Points with Existing Codebase

### 1. Route Registration (Backend)

The existing `packages/backend/src/routes/index.ts` currently mounts `/v1`. We add `/v2`:

```typescript
// routes/index.ts — add:
import v2Routes from './v2';
router.use('/v2', v2Routes);
```

The v2 route aggregator (`routes/v2/index.ts`) mounts:
- `/wellness` → `wellness.routes.ts`
- `/shield` → `shield.routes.ts`

### 2. DI Container Registration

New service tokens are added to `container/types.ts` under a new `PHASE_7` section:

```typescript
// Wellness Services
WellnessService: new ServiceToken<IWellnessService>('WellnessService', '...'),
BurnoutScoringService: new ServiceToken<IBurnoutScoringService>('BurnoutScoringService', '...'),
ScheduleService: new ServiceToken<IScheduleService>('ScheduleService', '...'),
BoundaryService: new ServiceToken<IBoundaryService>('BoundaryService', '...'),

// Provenance Services
ProvenanceService: new ServiceToken<IProvenanceService>('ProvenanceService', '...'),
FingerprintService: new ServiceToken<IFingerprintService>('FingerprintService', '...'),
ScannerService: new ServiceToken<IScannerService>('ScannerService', '...'),
AlertService: new ServiceToken<IAlertService>('AlertService', '...'),
DmcaService: new ServiceToken<IDmcaService>('DmcaService', '...'),
```

A new service module (`container/bindings/phase7-bindings.ts`) registers factories following the existing binding pattern.

### 3. Content Publish Pipeline Hook

`ProvenanceService.signContent()` hooks into the existing content publish flow. When `POST /api/v1/content/publish` completes, the `EventBusService` emits a `content.published` event. `ProvenanceService` subscribes to this event and:
1. Signs the content with the creator's NOSTR key
2. Generates SimHash/pHash fingerprints
3. Creates `provenance_records` and `content_fingerprints` entries

This event-driven approach avoids modifying the existing v1 publish route.

**Critical constraint (BR-E8-007)**: Signing failure MUST NOT block content publication. The EventBus subscriber runs asynchronously after the publish response is sent. If signing fails, the error is logged, the creator is notified, and the failed signing is queued for retry (max 3 retries over 24 hours).

**Immutability constraint (BR-E8-001)**: Provenance records have no UPDATE or DELETE RLS policies. Once created, they serve as a permanent, tamper-proof audit trail.

### 4. Auto-Tracking Middleware (Wellness)

A lightweight Express middleware (`middleware/wellness-tracking.ts`) intercepts specific v1 actions and emits `wellness.activity` events:
- `POST /api/v1/content/publish` → `content_creation` activity
- `POST /api/v1/users/*/messages` → `engagement` activity
- `GET /api/v1/content/analytics` → `management` activity

`WellnessService` subscribes to these events and writes to `creator_work_patterns`.

### 5. Frontend Integration

- **Wellness Dashboard**: Integrated as a new tab in the existing `CreatorDashboard` component (`features/analytics/components/CreatorDashboard.tsx`). Lazy-loaded via `React.lazy()`.
- **Content Shield Dashboard**: New top-level nav item. Lazy-loaded in `App.tsx` route config.
- **AuthenticityBadge**: Injected into existing feed item components via composition.
- **CreatorAvailabilityStatus**: Added to creator profile display components.

### 6. Notification Integration

Both domains integrate with the existing `NotificationService`:
- Wellness: Burnout risk threshold alerts, buffer depth warnings
- Shield: Copy detection alerts, DMCA report status updates

---

## Implementation Batch Order

### Batch 1: Data Models & Shared Types (No dependencies)
**Stories**: US-E7-001, US-E8-001
**What**: Database migrations, RLS policies, shared TypeScript types, Zod schemas
**Duration**: ~3 hours
**Agents**: architect → backend

### Batch 2: Core Backend Services (Depends on Batch 1)
**Stories**: US-E7-002, US-E8-002, US-E8-003, US-E8-007
**What**: Work pattern tracking API, provenance signing service, fingerprint service, auto-signing integration
**Duration**: ~6 hours
**Agents**: backend (parallelizable: wellness API + shield services)

### Batch 3: Scoring & Scheduling (Depends on Batch 2)
**Stories**: US-E7-003, US-E7-005, US-E7-006, US-E7-007
**What**: Burnout risk scoring engine, sustainable scheduler, creator boundaries, pulse check-ins
**Duration**: ~6 hours
**Agents**: backend + frontend

### Batch 4: Scanner & Alert System (Depends on Batch 2)
**Stories**: US-E8-004a, US-E8-004b, US-E8-004c
**What**: NOSTR relay scanner job, alert management API, DMCA report generator
**Duration**: ~5 hours
**Agents**: backend

### Batch 5: Frontend Dashboards (Depends on Batches 2-4)
**Stories**: US-E7-004, US-E8-005, US-E8-006
**What**: Wellness dashboard UI, authenticity badge, content shield dashboard
**Duration**: ~6 hours
**Agents**: frontend

### Batch 6: Static Content & Low Priority (No blocking dependencies)
**Stories**: US-E7-008
**What**: Wellness resource library (static data, no API)
**Duration**: ~1 hour
**Agents**: frontend

### Batch 7: Integration Tests (Depends on Batches 5-6)
**Stories**: US-E7-009, US-E8-008
**What**: E2E and integration tests for both domains
**Duration**: ~4 hours
**Agents**: qa

### Batch 8: Documentation (Depends on all)
**Stories**: US-E7-010, US-E8-009
**What**: Mermaid diagrams, ADRs, CHANGELOG entries
**Duration**: ~2 hours
**Agents**: architect

---

## Dependency Graph

```
Batch 1: [US-E7-001] [US-E8-001]         (parallel)
              │             │
              ▼             ▼
Batch 2: [US-E7-002] [US-E8-002] [US-E8-003] [US-E8-007]  (parallel)
              │           │           │
              ▼           ▼           ▼
Batch 3: [US-E7-003]  Batch 4: [US-E8-004a]
         [US-E7-005]           [US-E8-004b]
         [US-E7-006]           [US-E8-004c]
         [US-E7-007]
              │                    │
              ▼                    ▼
Batch 5: [US-E7-004] [US-E8-005] [US-E8-006]   (parallel)
              │
Batch 6: [US-E7-008]            (can run any time)
              │                    │
              ▼                    ▼
Batch 7: [US-E7-009] [US-E8-008]                (parallel)
              │
              ▼
Batch 8: [US-E7-010] [US-E8-009]                (parallel)
```

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| API versioning | `/api/v2/` prefix | Separates new domains from v1; avoids breaking existing clients |
| Server state management (FE) | TanStack Query (no Redux) | Per CLAUDE.md: "All new v2 modules use TanStack Query for server state" |
| Lazy loading | `React.lazy()` + `Suspense` | Per CLAUDE.md: "New feature modules lazy-loaded" |
| Burnout scoring | Weighted sum, 5 factors, 0-100 scale | Transparent, configurable, testable — see ADR-019 |
| Fingerprinting | SimHash (text) + pHash (images) | Industry-standard perceptual hashing — see ADR-020 |
| Provenance chain | NOSTR event tags (NIP-compliant) | Builds on existing NOSTR infrastructure; decentralized verification |
| Auto-tracking | EventBus subscriber (not middleware mutation) | Non-invasive; existing routes untouched; event-driven pattern already in codebase |
| Copy detection scanning | BullMQ scheduled job | Matches PRD requirement (US-E8-004a depends on US-E0-001 BullMQ) |
| Wellness data privacy | RLS + creator-only access | "All wellness data is PRIVATE to creator — never shared or used for platform metrics" |
| DMCA export format | PDF + JSON | PDF for legal filing; JSON for programmatic use |

---

## Privacy & Security Considerations

1. **Wellness data**: RLS policies enforce `creator_id = auth.uid()`. No admin bypass. Creator can delete all their wellness data via `DELETE /api/v2/wellness/data`.
2. **Pulse check-ins**: Opt-in only. Anonymous benchmarking uses aggregates computed server-side; no individual data leaves the creator's records.
3. **Content fingerprints**: Hashes are one-way (non-reversible). Published to NOSTR for open verification.
4. **Provenance records**: Cryptographic signatures are public by design (proves authorship).
5. **Alert data**: Creator-private. Only the content owner sees copy detection alerts.
6. **DMCA reports**: Generated on-demand, not stored permanently. Creator controls export.

---

## Technology Choices (Within Existing Stack)

| Concern | Technology | Notes |
|---------|------------|-------|
| Text hashing | `simhash-js` or custom SimHash | Lightweight, no native deps |
| Image hashing | `sharp` + custom pHash | sharp already in dependency tree for image processing |
| Job queue | BullMQ + Redis | Already planned in US-E0-001; required for scanner |
| PDF generation | `pdfkit` or `pdf-lib` | For DMCA report export |
| Charts (FE) | Recharts | Already used in analytics feature for charts |
| Heatmap (FE) | Custom component with TailwindCSS grid or Recharts | Lightweight; no new charting library needed |

---

## Risk Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| BullMQ dependency not yet available (US-E0-001) | Scanner job blocked | Scanner job can be implemented with a simple `setInterval` fallback; swap to BullMQ when available |
| NOSTR relay rate limits | Scanner banned from relays | Configurable rate limits per relay; exponential backoff; distribute across relays |
| pHash accuracy for small images | False positives/negatives | Configurable similarity thresholds; creators can tune sensitivity |
| Burnout score gaming | Creators manipulate data to get "good" scores | Wellness data is for the creator's benefit only; no platform consequences; no incentive to game |
| Large fingerprint registry | Slow comparison queries | Indexed hash columns; batch scanning with bloom filter pre-check |
