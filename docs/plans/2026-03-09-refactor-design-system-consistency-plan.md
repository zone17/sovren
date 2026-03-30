---
title: "refactor: Design System Consistency — Full Frontend Token Migration"
type: refactor
date: 2026-03-09
reviewed: 2026-03-09 (DHH, Kieran TypeScript, Simplicity — all findings applied)
---

# refactor: Design System Consistency — Full Frontend Token Migration

## Overview

Migrate ~135 frontend files from hardcoded Tailwind colors (`gray-*`, `bg-white`, `bg-black`) to design system CSS custom properties. This ensures consistent UI/UX, proper dark/light theme support, and the warm-tinted aesthetic established in PR #157.

**Scope**: ~1,423 `gray-*` occurrences across 135 `.tsx` files. Brand tokens in 9 files. 8 test files.

**Reference implementation**: `src/pages/Home.tsx` — this is what "done" looks like.

## Token Mapping

### Disambiguation Rules

When the mapping is ambiguous, these rules resolve it. When the rules produce a visually wrong result, the developer uses their eyes and picks the right token — no rule overrides visual correctness.

**Rule 1 — Container hierarchy determines the surface token:**
- Full-page container (`min-h-screen`) → `bg-background`
- Direct child with border/shadow (`.rounded-lg border`) → `bg-card`
- Nested inside a card (data display, code blocks, info boxes) → `bg-muted`
- When multiple conditions match, the deepest nesting context wins

**Rule 2 — Interaction state determines the hover token:**
- List item/row hover → `hover:bg-accent/10`
- Button/tab hover → `hover:bg-muted`
- Active/pressed → `hover:bg-secondary`

**Rule 3 — Text hierarchy determines the text token:**
- Primary text (headings, body) → `text-foreground`
- Secondary text (labels, metadata, timestamps) → `text-muted-foreground`
- Tertiary text (placeholders, disabled, captions) → `text-muted-foreground/60`

**Rule 4 — `dark:` pairs collapse to the token matching the dark value:**
- `bg-white dark:bg-gray-800` → `bg-card`
- `bg-white dark:bg-gray-900` → `bg-background`
- `bg-gray-50 dark:bg-gray-900/50` → `bg-muted`
- `bg-gray-200 dark:bg-gray-700` → `bg-secondary`

### Quick Reference Table

| Old | New |
|-----|-----|
| `bg-gray-50` (page layout) | `bg-background` |
| `bg-gray-50` (inside card) | `bg-muted` |
| `bg-gray-100/200` | `bg-muted` |
| `bg-gray-700/800/900` | `bg-card` |
| `bg-white` with border/shadow | `bg-card` |
| `bg-white` as page bg | `bg-background` |
| `bg-black/50` | **KEEP** (modal overlay) |
| `text-gray-300/400` | `text-muted-foreground/60` |
| `text-gray-500/600` | `text-muted-foreground` |
| `text-gray-700/800/900` | `text-foreground` |
| `text-white` on gray bg | `text-foreground` |
| `text-white` on colored bg | **KEEP** |
| `border-gray-*` (all) | `border-border` |
| `divide-gray-*` | `divide-border` |
| `ring-gray-*` | `ring-ring` |
| `hover:bg-gray-50/100` (list) | `hover:bg-accent/10` |
| `hover:bg-gray-50/100` (button) | `hover:bg-muted` |
| `hover:bg-gray-700/800` | `hover:bg-secondary` |
| `disabled:bg-gray-300/400` | `disabled:bg-muted disabled:opacity-50` |
| `focus:ring-gray-*` | `focus:ring-ring` |

## Exceptions (DO NOT MIGRATE)

| Exception | File(s) | Reason |
|-----------|---------|--------|
| Premium button variant `bg-gray-800` | `button.tsx:45` | Deliberate "dark luxury" aesthetic — same in both themes |
| `text-white` on colored backgrounds | 92 files, ~200 instances | Prevents invisible text in light mode |
| `bg-black/50` modal overlays | RestoreDialog, SocialShareButtons | Theme-independent scrim layers |
| Status indicator grays | NIP05Manager, OrderTracker, EscrowStatus | Semantic "neutral status" alongside green/red/yellow |
| `@media print` styles | index.css | Print requires absolute colors |

**Pre-migration audit**: Run `grep -rn 'text-white' --include='*.tsx' src/ | grep 'bg-gray-[56]'` — any `bg-gray-5xx` with `text-white` must migrate to `text-foreground` (fails WCAG AA at 2.68:1).

## Pre-Migration Cleanup

- [ ] Delete duplicate: `rm "src/features/creator-network/components/FollowButton 2.tsx"`
- [ ] Run text-white contrast audit (grep above)

## Implementation

### Phase 1: UI Primitives + Layout (22 files + 8 test files)

These have the highest cascade impact. Single agent or lead handles shared UI to prevent cross-domain test breakage.

**UI Primitives (12 files):**
- [ ] `src/components/ui/dropdown-menu.tsx` (16 gray + 9 dark: pairs)
- [ ] `src/components/ui/button.tsx` (premium variant exception — migrate the rest)
- [ ] `src/components/ui/avatar.tsx` (4 gray)
- [ ] `src/components/ui/tooltip.tsx` (3 gray)
- [ ] `src/components/ui/MobileNavigation.tsx` (14 gray)
- [ ] `src/components/ui/loading-spinner.tsx` (1 gray)
- [ ] `src/components/ui/qrcode.tsx` (2 gray)
- [ ] `src/components/ui/PersonalizedRecommendations.tsx` (14 gray)
- [ ] `src/components/ui/RecommendationFeedback.tsx` (13 gray)
- [ ] `src/components/ui/ContentSimilarity.tsx` (28 gray)
- [ ] `src/components/ui/TouchOptimization.tsx` (1 gray)
- [ ] `src/components/ui/OfflineCapabilities.tsx` (1 gray)

**Layout + Auth (10 files):**
- [ ] `src/components/layout/MobileResponsiveLayout.tsx` (5 gray)
- [ ] `src/monitoring/ErrorBoundary.tsx` (3 gray)
- [ ] `src/components/providers/NotificationProvider.tsx` (8 gray)
- [ ] `src/queries/errorHandling.tsx` (13 gray)
- [ ] `src/components/SessionManager.tsx` (10 gray)
- [ ] `src/components/auth/NOSTRKeyManager.tsx` (26 gray)
- [ ] `src/components/auth/NOSTRSessionProtection.tsx` (35 gray)
- [ ] `src/components/auth/NOSTRSigningValidator.tsx` (16 gray)
- [ ] `src/components/auth/ExtensionSelector.tsx` (13 gray)
- [ ] `src/features/auth/components/ProtectedRoute.tsx` (4 gray)

**Tests (8 files):**
- [ ] Update `src/components/ui/__tests__/MobileComponents.test.tsx`
- [ ] Update `src/components/ui/__tests__/MobileNavigation.test.tsx`
- [ ] Update `src/components/ui/__tests__/design-system.integration.test.tsx`
- [ ] Update `src/components/auth/__tests__/ExtensionSelector.test.tsx`
- [ ] Update `src/components/layout/__tests__/MobileResponsiveLayout.test.tsx`
- [ ] Update `src/features/subscriptions/components/__tests__/SubscriptionCard.test.tsx`
- [ ] Update `src/features/creator-network/components/__tests__/MentorDirectory.test.tsx`
- [ ] Regenerate `__snapshots__/button.snapshot.test.tsx.snap`

### Phase 2: Everything Else (101 files)

All remaining feature components. Domain-scoped parallel agents (zero file overlap = zero merge conflicts).

**Business (10 files):**
- [ ] `src/features/business/components/TaxSummary.tsx` (20 gray)
- [ ] `src/features/business/components/ExpenseTracker.tsx` (20 gray)
- [ ] `src/features/business/components/RevenueMix.tsx` (15 gray)
- [ ] `src/features/business/components/ContractLibrary.tsx` (14 gray)
- [ ] `src/features/business/components/ContractEditor.tsx` (11 gray)
- [ ] `src/features/business/components/InvoiceEditor.tsx` (17 gray)
- [ ] `src/features/business/components/InvoiceDashboard.tsx` (11 gray)
- [ ] `src/features/business/components/DiversificationGoals.tsx` (7 gray)
- [ ] `src/features/business/components/RedFlagReport.tsx` (1 gray)
- [ ] `src/features/business/components/BusinessNav.tsx` (2 gray)

**Creator Network (13 files):**
- [ ] `src/features/creator-network/components/CirclesBrowser.tsx` (18 gray)
- [ ] `src/features/creator-network/components/MentorshipDashboard.tsx` (15 gray)
- [ ] `src/features/creator-network/components/MentorDirectory.tsx` (13 gray)
- [ ] `src/features/creator-network/components/ServiceListingForm.tsx` (11 gray)
- [ ] `src/features/creator-network/components/OrderTracker.tsx` (9 gray — status exception)
- [ ] `src/features/creator-network/components/MarketplaceBrowser.tsx` (8 gray)
- [ ] `src/features/creator-network/components/RevenueSplitEditor.tsx` (8 gray)
- [ ] `src/features/creator-network/components/CircleFeed.tsx` (8 gray)
- [ ] `src/features/creator-network/components/CollaborationInvite.tsx` (7 gray)
- [ ] `src/features/creator-network/components/EscrowStatus.tsx` (8 gray — status exception)
- [ ] `src/features/creator-network/components/CircleManagement.tsx` (5 gray)
- [ ] `src/features/creator-network/components/CommunityNav.tsx` (2 gray)
- [ ] `src/features/creator-network/components/FollowButton.tsx` (1 gray)

**Content (4 files):**
- [ ] `src/features/content/components/SimpleContentEditor.tsx` (24 gray + brand tokens)
- [ ] `src/features/content/components/ContentLibrary.tsx` (19 gray)
- [ ] `src/features/content/components/PremiumContentPaywall.tsx` (13 gray)
- [ ] `src/features/content/components/ContentManagementHub.tsx` (11 gray)

**Multi-platform (15 files):**
- [ ] `src/features/multi-platform/components/UnifiedInbox.tsx` (15 gray)
- [ ] `src/features/multi-platform/components/TemplateManager.tsx` (12 gray)
- [ ] `src/features/multi-platform/components/AudienceOverlap.tsx` (11 gray)
- [ ] `src/features/multi-platform/components/PlatformROI.tsx` (10 gray)
- [ ] `src/features/multi-platform/components/CrossPlatformDashboard.tsx` (8 gray)
- [ ] `src/features/multi-platform/components/CrossPlatformAnalytics.tsx` (8 gray)
- [ ] `src/features/multi-platform/components/BYOKSetup.tsx` (8 gray)
- [ ] `src/features/multi-platform/components/RepurposePreview.tsx` (8 gray)
- [ ] `src/features/multi-platform/components/PlatformConnector.tsx` (7 gray)
- [ ] `src/features/multi-platform/components/ReplyComposer.tsx` (7 gray)
- [ ] `src/features/multi-platform/components/PlatformComparison.tsx` (8 gray)
- [ ] `src/features/multi-platform/components/DistributionPanel.tsx` (5 gray)
- [ ] `src/features/multi-platform/components/BatchActionToolbar.tsx` (4 gray)
- [ ] `src/features/multi-platform/components/MultiPlatformDashboard.tsx` (2 gray)
- [ ] `src/features/multi-platform/components/InboxFilterBar.tsx` (1 gray)

**Supporter + Subscriptions + Social (5 files):**
- [ ] `src/features/supporter/components/SupporterExperience.tsx` (56 gray)
- [ ] `src/features/subscriptions/components/SubscriptionCard.tsx` (20 gray)
- [ ] `src/features/subscriptions/components/UserSubscriptionManager.tsx` (33 gray)
- [ ] `src/features/subscriptions/components/SubscriptionManager.tsx` (1 gray)
- [ ] `src/components/social-media/SocialShareButtons.tsx` (14 gray)

**NOSTR components (7 files):**
- [ ] `src/components/nostr/NostrKeyManagement.tsx` (42 gray)
- [ ] `src/components/nostr/backup/RestoreDialog.tsx` (37 gray + 50 dark: pairs)
- [ ] `src/components/nostr/DMInbox.tsx` (24 gray)
- [ ] `src/components/nostr/errors/PublishErrorHandler.tsx` (17 gray)
- [ ] `src/components/nostr/errors/ConnectionErrorDisplay.tsx` (11 gray)
- [ ] `src/components/nostr/errors/SubscriptionErrorDisplay.tsx` (11 gray)
- [ ] `src/components/nostr/errors/ErrorMessage.tsx` (3 gray)

**NOSTR features (9 files):**
- [ ] `src/features/nostr/notifications/components/NotificationSettings.tsx` (15 gray)
- [ ] `src/features/nostr/feed/components/FeedTimeline.tsx` (5 gray)
- [ ] `src/features/nostr/feed/components/FeedFilters.tsx` (8 gray)
- [ ] `src/features/nostr/feed/components/FeedItem.tsx` (5 gray)
- [ ] `src/features/nostr/feed/components/FeedSort.tsx` (2 gray)
- [ ] `src/features/nostr/feed/components/FeedEmpty.tsx` (2 gray)
- [ ] `src/features/nostr/notifications/components/NotificationEmpty.tsx` (3 gray)
- [ ] `src/features/nostr/notifications/components/NotificationBadge.tsx` (1 gray)
- [ ] `src/features/nostr/notifications/components/NotificationItem.tsx` (1 gray)

**Lightning (3 files):**
- [ ] `src/components/lightning/PaymentHistory.tsx` (17 gray)
- [ ] `src/components/lightning/LightningWalletManager.tsx` (4 gray)
- [ ] `src/components/lightning/LightningPaymentButton.tsx` (1 gray)

**Wellness (8 files):**
- [ ] `src/features/wellness/components/SustainableScheduler.tsx` (16 gray)
- [ ] `src/features/wellness/components/BurnoutRiskGauge.tsx` (10 gray)
- [ ] `src/features/wellness/components/WorkPatternHeatmap.tsx` (9 gray)
- [ ] `src/features/wellness/components/BoundarySettings.tsx` (8 gray)
- [ ] `src/features/wellness/components/WellnessPulseModal.tsx` (6 gray)
- [ ] `src/features/wellness/components/WellnessTrend.tsx` (5 gray)
- [ ] `src/features/wellness/components/RestDayTracker.tsx` (4 gray)
- [ ] `src/features/wellness/components/WellnessResources.tsx` (3 gray)

**Content Shield (4 files):**
- [ ] `src/features/content-shield/components/AlertsFeed.tsx` (17 gray)
- [ ] `src/features/content-shield/components/ProvenanceChainViewer.tsx` (21 gray)
- [ ] `src/features/content-shield/components/FingerprintCoverage.tsx` (8 gray)
- [ ] `src/features/content-shield/components/AuthenticityBadge.tsx` (3 gray)

**Dashboards (5 files):**
- [ ] `src/features/dashboard/components/AIDashboard.tsx` (46 gray)
- [ ] `src/features/dashboard/components/MonitoringDashboard.tsx` (11 gray)
- [ ] `src/features/cicd-dashboard/components/DeploymentStatusPanel.tsx` (34 gray)
- [ ] `src/features/cicd-dashboard/components/DeploymentDashboard.tsx` (20 gray)
- [ ] `src/features/cicd-dashboard/components/HealthCheckMonitor.tsx` (12 gray)

**Analytics (5 files):**
- [ ] `src/components/analytics/AnalyticsDashboard.tsx` (26 gray)
- [ ] `src/features/analytics/components/RevenueAnalytics.tsx` (1 gray)
- [ ] `src/features/analytics/components/CreatorDashboard.tsx` (1 gray)
- [ ] `src/components/analytics/EngagementAnalyticsDashboard.tsx` (1 gray)
- [ ] `src/components/analytics/OptimizationSuggestionPanel.tsx` (1 gray)

**Performance monitors (7 files):**
- [ ] `src/components/performance/ImageOptimizer.tsx` (19 gray)
- [ ] `src/components/performance/PageLoadOptimizer.tsx` (18 gray)
- [ ] `src/components/performance/APIResponseCache.tsx` (17 gray)
- [ ] `src/components/performance/NetworkPerformanceOptimizer.tsx` (14 gray)
- [ ] `src/components/performance/IntelligentContentCache.tsx` (12 gray)
- [ ] `src/components/performance/StaticAssetOptimizer.tsx` (11 gray)
- [ ] `src/components/performance/DatabaseQueryOptimizer.tsx` (9 gray)

**Admin + Remaining (8 files):**
- [ ] `src/components/admin/AutomatedContentModerationDashboard.tsx` (4 gray)
- [ ] `src/components/admin/AutonomousUserManagementDashboard.tsx` (1 gray)
- [ ] `src/components/ProfileDashboard.tsx` (19 sovereign-* + gray)
- [ ] `src/components/NIP05Manager.tsx` (16 gray — status exception)
- [ ] `src/components/DevTools/FeatureFlagToggle.tsx` (4 gray)
- [ ] `src/components/quality-metrics/QualityMetricsDashboard.tsx` (16 gray)
- [ ] `src/features/ai/components/PersonalizedRecommendations.tsx` (14 gray)
- [ ] `src/features/comments/components/CommentItem.tsx` (1 gray)

### Verification Checklist

- [ ] Remove old brand color scales from `tailwind.config.js` (`sovereign`, `lightning`, `premium`, `sats`)
- [ ] Grep verification — all should return 0 (excluding exceptions):
  ```bash
  grep -rn "bg-gray-\|text-gray-\|border-gray-" src/ --include="*.tsx" \
    --exclude="*.stories.tsx" \
    | grep -v "NIP05Manager\|OrderTracker\|EscrowStatus\|@media print" | wc -l
  grep -rn "sovereign-\|lightning-\|premium-\|sats-" src/ --include="*.tsx" | wc -l
  ```
- [ ] Run full test suite (`npm test`)
- [ ] Run E2E suite (`npm run test:e2e`)
- [ ] Visual spot-check: key screens in both dark AND light mode (89 files gained dark mode for the first time)

## Agent Brief Checklist

Each agent gets:
- The quick reference table above
- The exception list above
- Rule: `text-white` on colored bg → KEEP; `text-white` on gray bg → `text-foreground`
- Rule: `dark:` pairs → collapse to single token, remove BOTH halves atomically
- Rule: status indicator grays → KEEP (semantic, not decorative)
- Rule: `bg-black/50` overlays → KEEP
- Rule: After each file, grep it for remaining gray-/bg-white/bg-black (Pattern #28)
- Rule: Use `cn()` for files with `dark:` pairs where collapse is needed (18 files). For other files, migrate tokens in-place using existing className syntax.

## Acceptance Criteria

- [ ] Zero hardcoded `gray-*` classes (excluding documented exceptions)
- [ ] Zero `bg-white` or `bg-black` outside documented exceptions
- [ ] All `dark:` prefix pairs collapsed to single design tokens
- [ ] Zero old brand tokens in `.tsx` files
- [ ] All 8 test files updated
- [ ] All E2E tests pass
- [ ] Visual spot-check both themes
- [ ] Old brand color scales removed from tailwind.config.js

## Risks

| Risk | Mitigation |
|------|-----------|
| `text-white` → `text-foreground` makes text invisible on colored bg | KEEP text-white on colored backgrounds. Pre-migration audit of bg-gray-500/600 |
| `dark:` pair partial collapse creates specificity bugs | Atomic collapse: remove both halves together |
| Test assertions on class names break | Update tests in same commit as component. 8 test files identified |
| Status indicators lose semantic meaning | Exception: keep status-specific grays |
| 89 files gain dark mode for first time | Visual QA these files specifically |

## References

- PR #157: Design system overhaul (established tokens + glass morphism)
- PR #158: Onboarding migration (first batch)
- `src/index.css`: Token definitions (lines 1-90) + glass utilities (lines 207-298)
- `src/lib/utils.ts:14`: `cn()` utility
- `tailwind.config.js`: Old brand scales to remove (lines 59-114)
- `src/pages/Home.tsx`: Reference implementation
- Pattern #28: Grep same file after fixing
