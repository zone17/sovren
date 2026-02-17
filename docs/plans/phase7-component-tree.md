# Phase 7: Frontend Component Tree

## Feature Module: `features/wellness/`

```
WellnessDashboard                      [Main container — tab in CreatorDashboard]
├── WorkPatternHeatmap                 [7x24 grid heatmap showing activity by day/hour]
│   └── HeatmapCell                    [Individual cell with intensity color]
├── BurnoutRiskGauge                   [Circular gauge: green/yellow/orange/red]
│   └── RiskFactorBreakdown            [Expandable factor detail list]
├── RestDayTracker                     [Streak counter + work/rest ratio bar]
├── SustainablePaceIndicator           [Current vs recommended posting frequency]
├── SustainableScheduler               [Recommended posting cadence panel]
│   ├── CreativeBuffer                 [Buffer depth indicator with threshold line]
│   └── BatchCreationWindows           [Suggested productive time slots]
├── BoundarySettings                   [Focus hours + DND + engagement budget config]
│   ├── FocusHoursConfig               [Time range picker + day selector]
│   ├── EngagementBudget               [Progress bar + weekly limit setter]
│   ├── DNDToggle                      [DND mode switch + auto-response editor]
│   └── CreatorAvailabilityStatus      [Status selector: available/creating/offline]
├── WellnessPulseSection               [Pulse check-in area]
│   ├── WellnessPulseModal             [Modal: energy/motivation/stress sliders]
│   └── WellnessTrend                  [Line chart of composite score over time]
└── WellnessResources                  [Curated resource cards, filterable]
    └── ResourceCard                   [Card: title, category, description, external link]
```

### Component Responsibilities

| Component | Data Source (TanStack Query) | Props | Key Behavior |
|-----------|---------------------------|-------|-------------|
| `WellnessDashboard` | Orchestrator — no direct data | None (fetches via children) | Lazy-loaded tab. Renders all wellness panels. |
| `WorkPatternHeatmap` | `useWellnessPatterns('heatmap')` | `period: '7d' \| '30d'` | 7 rows (Mon-Sun) x 24 cols (hours). Color intensity maps 0-1. Tooltip on hover shows minutes. |
| `BurnoutRiskGauge` | `useBurnoutScore()` | None | Circular gauge with animated fill. Shows score number, level badge, and top recommendation. Click expands `RiskFactorBreakdown`. |
| `RiskFactorBreakdown` | Passed from parent | `factors: Factor[]` | List of 5 factors with weight, value, and detail text. Bar chart per factor. |
| `RestDayTracker` | `useWellnessPatterns('7d')` | None | Shows current rest day streak, work/rest ratio as a segmented bar, target indicator. |
| `SustainablePaceIndicator` | `useScheduleRecommendations()` | None | Side-by-side: "You're posting X/week" vs "Recommended: Y/week". Color indicator (on-pace/over-pace). |
| `SustainableScheduler` | `useScheduleRecommendations()` | None | Panel with optimal days/hours, productive windows calendar view. |
| `CreativeBuffer` | `useScheduleRecommendations()` | None | Horizontal bar showing buffer_days vs threshold. Red if below threshold. |
| `BatchCreationWindows` | `useScheduleRecommendations()` | None | Weekly calendar with highlighted productive windows. |
| `BoundarySettings` | `useBoundaries()` | None | Form with all boundary controls. Saves via PUT mutation. |
| `FocusHoursConfig` | Passed from parent | `value, onChange` | Time range pickers (start/end) + multi-select day checkboxes. |
| `EngagementBudget` | Passed from parent | `budget, used` | Progress bar (used/budget). Number input for weekly limit. |
| `DNDToggle` | Passed from parent | `value, onChange` | Toggle switch + textarea for auto-response template. |
| `CreatorAvailabilityStatus` | Passed from parent | `status, onChange` | Segmented control: available / creating / offline. |
| `WellnessPulseModal` | `useWellnessPulse()` | `isOpen, onClose` | Modal with 3 slider inputs (1-5). Submit creates POST. Dismissible, never re-appears if dismissed permanently. |
| `WellnessTrend` | `useWellnessPulse('history')` | `period: '30d' \| '90d'` | Line chart (Recharts) with composite_score over time. Shows trend direction badge. |
| `WellnessResources` | Static JSON import | `category?: string` | Filterable grid of resource cards. Categories: communities, articles, tools, crisis. |
| `ResourceCard` | Passed from parent | `resource: Resource` | Card with title, description, category badge, external link button. |

---

## Feature Module: `features/content-shield/`

```
ShieldDashboard                        [Main container — top-level nav item]
├── ProvenanceOverview                 [Summary: total signed, coverage %, recent]
├── FingerprintCoverage                [Coverage stats + coverage gap list]
├── AlertsFeed                         [List of copy detection alerts]
│   ├── AlertCard                      [Alert summary: original, copy, score, status]
│   │   └── AlertStatusBadge           [Status pill: new/reviewed/resolved/etc.]
│   └── AlertDetailPanel               [Side-by-side comparison expanded view]
│       ├── OriginalContentPreview     [Original content excerpt + provenance]
│       ├── DetectedCopyPreview        [Detected copy excerpt + metadata]
│       ├── SimilarityIndicator        [Score gauge + match level label]
│       └── DMCAReportButton           [One-click DMCA report generation]
└── AlertResolutionActions             [Status transition buttons]

AuthenticityBadge                      [Standalone — injected into FeedItem]
├── BadgeIcon                          [Verified/unverified/disputed icon]
└── ProvenanceChainViewer              [Click-through: full provenance display]
    ├── SignatureBlock                  [Creator pubkey, signature, timestamp]
    ├── RelayConfirmations             [List of relay confirmations with timestamps]
    └── NIP05Badge                     [NIP-05 verification status]
```

### Component Responsibilities

| Component | Data Source (TanStack Query) | Props | Key Behavior |
|-----------|---------------------------|-------|-------------|
| `ShieldDashboard` | Orchestrator | None | Lazy-loaded route. Renders overview, coverage, and alerts panels. |
| `ProvenanceOverview` | `useProvenanceChain('summary')` | None | Cards showing: total content signed, total relay confirmations, latest signed content. |
| `FingerprintCoverage` | `useFingerprintCoverage()` | None | Donut chart: fingerprinted vs total content. List of un-fingerprinted content with "Fingerprint Now" action. |
| `AlertsFeed` | `useAlerts(status)` | `status: AlertStatus` | Paginated list. Tab bar for status filters. Badge count for "new" alerts. |
| `AlertCard` | Passed from parent | `alert: ContentAlert` | Compact card: original title, copy URL, similarity score bar, status badge. Click expands detail. |
| `AlertStatusBadge` | Passed from parent | `status: AlertStatus` | Colored pill: new=blue, reviewed=yellow, resolved=green, false_positive=gray, reported=red. |
| `AlertDetailPanel` | `useAlertDetail(id)` | `alertId: string` | Full comparison view. Side-by-side original vs copy with highlighted differences. |
| `OriginalContentPreview` | Passed from parent | `original: OriginalContent` | Excerpt + published_at + provenance signature badge. |
| `DetectedCopyPreview` | Passed from parent | `detected: DetectedContent` | Excerpt + published_at + author pubkey + relay. |
| `SimilarityIndicator` | Passed from parent | `score, matchLevel` | Horizontal bar (red=exact, orange=derivative, green=coincidental) + percentage label. |
| `DMCAReportButton` | `useDmcaReport()` | `alertId: string` | Button that triggers report generation. Shows loading state. Downloads PDF or opens JSON. |
| `AlertResolutionActions` | `useAlerts()` mutation | `alertId, currentStatus` | Button group for valid status transitions. Disabled buttons for invalid transitions. |
| `AuthenticityBadge` | `useProvenanceChain(contentId)` | `contentId: string` | Small badge: checkmark (verified), question mark (unverified), exclamation (disputed). Click opens `ProvenanceChainViewer` as popover. |
| `ProvenanceChainViewer` | `useProvenanceChain(contentId)` | `contentId: string` | Detailed provenance display. Shows signature, relay confirmations, NIP-05 status. |
| `SignatureBlock` | Passed from parent | `provenance: Provenance` | Monospace display of pubkey + signature + timestamp. Copy-to-clipboard buttons. |
| `RelayConfirmations` | Passed from parent | `confirmations: RelayConfirmation[]` | List with relay URL + confirmation timestamp + checkmark icon. |
| `NIP05Badge` | Passed from parent | `nip05Verified: boolean, nip05: string` | Shows NIP-05 identifier with verified/unverified state. |

---

## Integration with Existing Components

### CreatorDashboard Tab Integration

The existing `CreatorDashboard` in `features/analytics/components/CreatorDashboard.tsx` gets a new tab:

```tsx
// Lazy-loaded import
const WellnessDashboard = React.lazy(
  () => import('@/features/wellness/components/WellnessDashboard')
);

// In tab configuration:
{ id: 'wellness', label: 'Wellness', component: WellnessDashboard }
```

### FeedItem Badge Integration

The `AuthenticityBadge` is composed into the existing feed item component:

```tsx
// In existing FeedItem component
<div className="feed-item-header">
  <CreatorInfo ... />
  <AuthenticityBadge contentId={item.id} />
  <Timestamp ... />
</div>
```

### App.tsx Route Integration

New top-level route for Content Shield:

```tsx
const ShieldDashboard = React.lazy(
  () => import('@/features/content-shield/components/ShieldDashboard')
);

// In route config
<Route path="/shield" element={
  <Suspense fallback={<PageLoader />}>
    <ShieldDashboard />
  </Suspense>
} />
```

---

## Shared UI Components Used

These existing components from `components/ui/` are reused across both new feature modules:

| Component | Usage |
|-----------|-------|
| `Card` | Container for dashboard panels |
| `Badge` | Status indicators, category labels |
| `Button` | Actions, form submissions |
| `Modal` | Pulse check-in, provenance viewer |
| `Tabs` | Dashboard tab navigation |
| `Tooltip` | Heatmap cell hover, badge hover |
| `ProgressBar` | Buffer depth, engagement budget |
| `Spinner` / `Skeleton` | Loading states for TanStack Query |

---

## State Management Strategy

Both feature modules use **TanStack Query only** (no Redux):

```
features/wellness/hooks/
├── useWellnessPatterns.ts      → GET /api/v2/wellness/patterns
├── useBurnoutScore.ts          → GET /api/v2/wellness/risk-score
├── useWellnessPulse.ts         → GET + POST /api/v2/wellness/pulse
├── useBoundaries.ts            → GET + PUT /api/v2/wellness/boundaries
└── useScheduleRecommendations.ts → GET /api/v2/wellness/schedule/recommendations

features/content-shield/hooks/
├── useProvenanceChain.ts       → GET /api/v2/shield/provenance/:id
├── useAlerts.ts                → GET + PUT /api/v2/shield/alerts
├── useFingerprintCoverage.ts   → GET /api/v2/shield/fingerprints/:id
└── useDmcaReport.ts            → POST /api/v2/shield/alerts/:id/dmca-report
```

Query key conventions:
- `['wellness', 'patterns', period]`
- `['wellness', 'risk-score']`
- `['wellness', 'pulse', period]`
- `['wellness', 'boundaries']`
- `['wellness', 'schedule']`
- `['shield', 'provenance', contentId]`
- `['shield', 'alerts', status, page]`
- `['shield', 'fingerprints', creatorId, page]`

Stale time: 5 minutes for most queries, 1 minute for alerts (more time-sensitive).

---

## Accessibility Requirements

All new components must meet:
- ARIA labels on interactive elements
- Keyboard navigation (Tab, Enter, Escape for modals)
- Screen reader support for data visualizations (heatmap, gauge, charts)
- Color-blind safe palettes (not relying solely on color to convey meaning — always pair with text/icons)
- Focus management for modals and panels
- `role="status"` for live-updating regions (alert counts, risk score)
