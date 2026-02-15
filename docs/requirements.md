# Sovren Platform Requirements Document

## Project Overview

Sovren is a full-stack content creator platform built on the NOSTR protocol with Lightning Network monetization. The platform enables creators to publish content, manage subscription tiers, receive Lightning payments (95% revenue share), and grow their audience through a censorship-resistant, decentralized infrastructure.

**Current State:** 102 user stories completed across 6 phases. Core infrastructure for auth, payments, subscriptions, content management, analytics, and AI-powered recommendations exists. Phase 7 (US-103 to US-120) is planned but not started.

**Tech Stack:** TypeScript, React (Vite), Node.js/Express, nostr-tools v2.13.2, Lightning Network (LNbits), Supabase/PostgreSQL, npm workspaces monorepo.

**Market Context:** Creator economy pain points include platform dependency/censorship, monetization instability (payout cuts from YouTube/X), multi-platform workload burnout, and growth stagnation. NOSTR-specific challenges include small user base relative to network effects needed, technical complexity for non-developers, and community fragmentation. Sovren's 95% revenue share and decentralized identity directly address the top two creator pain points.

---

## User Personas

### Primary Persona: Creator (Alex)

- **Role:** Independent content creator (writer, artist, podcaster)
- **Technical Proficiency:** Moderate; comfortable with web apps but not a developer
- **Goals:** Monetize content directly without platform intermediaries; own audience relationship; publish across NOSTR clients
- **Pain Points:** Lost 30% of revenue to platform fees; had content demonetized without explanation; can't export subscriber list from current platform
- **Behaviors:** Publishes 3-5 pieces per week; manages 2-3 subscription tiers; checks analytics daily
- **Quote:** "I just want to create and get paid fairly without worrying about an algorithm burying my work."

### Secondary Persona: Supporter (Jordan)

- **Role:** Content consumer who subscribes to multiple creators
- **Technical Proficiency:** Basic; uses Lightning wallets but is not deeply technical
- **Goals:** Discover and support creators directly; access premium content seamlessly; manage subscriptions in one place
- **Pain Points:** Tired of ads and algorithmic feeds; wants to know money goes to creators, not platforms; subscription fatigue from too many separate platforms
- **Behaviors:** Subscribes to 3-8 creators; browses discovery feed daily; tips creators for exceptional content
- **Quote:** "I want to support creators I care about without jumping through hoops or wondering where my money goes."

### Tertiary Persona: Platform Administrator (Sam)

- **Role:** Sovren operations team member responsible for platform health
- **Technical Proficiency:** High; backend developer or DevOps engineer
- **Goals:** Monitor platform health, payment processing, and user activity; respond to incidents; manage compliance
- **Pain Points:** Needs visibility into Lightning payment failures, relay connectivity issues, and abuse patterns
- **Behaviors:** Reviews dashboards multiple times daily; investigates payment disputes; manages NIP-05 verification queue

---

## Functional Requirements

### Must Have (MVP for Phase 7)

#### FR-001: Production Database Integration

**User Story:** As a platform operator, I want all services to use persistent database storage so that data survives restarts and supports production workloads.

**Acceptance Criteria:**
- Given the backend starts, when a subscription is created, then it is persisted in PostgreSQL (not in-memory maps).
- Given the backend restarts, when a user queries their subscriptions, then all previously created subscriptions are returned.
- Given concurrent users create subscriptions, when the system is under load, then database transactions prevent data corruption.
- Given a payment is recorded, when the lightning service processes it, then the payment record is persisted with creator_id, supporter_id, amount, and settlement status.

**Priority:** P0 (Critical)

**Rationale:** Multiple backend services (SubscriptionService, PaymentProcessingService, InvoiceService) currently use InMemoryRepository implementations. This blocks production deployment.

---

#### FR-002: Creator Onboarding Flow

**User Story:** As a new creator, I want a guided onboarding experience so that I can set up my profile, connect my Lightning wallet, and create my first subscription tier within 10 minutes.

**Acceptance Criteria:**
- Given a user signs up with their NOSTR key, when they select the "creator" role, then they enter a step-by-step onboarding wizard.
- Given the onboarding wizard is active, when the creator completes each step (profile, wallet, first tier), then progress is saved and the creator can resume later.
- Given the creator connects a Lightning wallet, when they provide their Lightning address or LNURL, then the system verifies the wallet can receive payments.
- Given onboarding is complete, when the creator visits their dashboard, then they see their profile, tier, and a prompt to publish their first content.

**Priority:** P0 (Critical)

---

#### FR-003: Real-time WebSocket Infrastructure

**User Story:** As a supporter, I want to see payment confirmations and new content notifications in real time so that I have a responsive, live experience.

**Acceptance Criteria:**
- Given a supporter is viewing a creator's page, when they send a Lightning payment, then they see a confirmation within 3 seconds of settlement.
- Given a supporter is subscribed to a creator, when the creator publishes new content, then the supporter receives a push notification within 5 seconds.
- Given a WebSocket connection drops, when the client reconnects, then missed events are delivered in order.
- Given 1,000 concurrent WebSocket connections, when events are broadcast, then latency remains under 500ms for 95th percentile.

**Priority:** P0 (Critical)

---

#### FR-004: Cross-Client NOSTR Compatibility

**User Story:** As a creator, I want my Sovren profile, content, and subscription tiers to be visible in other NOSTR clients (Damus, Amethyst, Primal) so that I can reach the broader NOSTR audience.

**Acceptance Criteria:**
- Given a creator publishes a text note on Sovren, when a user views the creator's profile on Damus, then the note appears correctly with proper NIP-01 formatting.
- Given a creator sets up a subscription tier, when the tier is encoded as a NIP-33 parameterized replaceable event (kind 30027), then other NOSTR clients can display the tier metadata even if they do not support the full subscription flow.
- Given a supporter sends a Zap (NIP-57) to a creator on Primal, when Sovren receives the Zap receipt event, then it is displayed in the creator's analytics dashboard.
- Given a creator has a NIP-05 identifier (user@sovren.app), when another NOSTR client resolves it, then it correctly maps to the creator's public key.

**Priority:** P0 (Critical)

---

#### FR-005: Creator Analytics Dashboard (Enhanced)

**User Story:** As a creator, I want a real-time analytics dashboard showing revenue, subscriber growth, content performance, and audience demographics so that I can make data-driven content decisions.

**Acceptance Criteria:**
- Given a creator opens their dashboard, when revenue data is available, then they see total earnings, earnings by tier, and earnings trend over 7/30/90-day periods.
- Given a creator views content performance, when they select a specific piece of content, then they see views, engagement rate, and conversion to subscriptions.
- Given a creator has multiple subscription tiers, when they view tier analytics, then they see subscriber count per tier, churn rate, and average lifetime value.
- Given the analytics data is refreshed, when the dashboard displays metrics, then the data is no more than 5 minutes stale.

**Priority:** P1 (High)

---

#### FR-006: Supporter Discovery and Subscription Flow

**User Story:** As a supporter, I want to discover creators through personalized recommendations, preview their content, and subscribe with a single Lightning payment so that finding and supporting creators is frictionless.

**Acceptance Criteria:**
- Given a supporter opens the discovery page, when recommendations load, then they see creators ranked by relevance to their interests and past behavior.
- Given a supporter views a creator's profile, when the creator has subscription tiers, then the supporter sees tier names, prices (in sats), and benefits listed clearly.
- Given a supporter selects a tier, when they confirm the subscription, then a Lightning invoice is generated and presented (QR code and bolt11 string).
- Given a supporter completes payment, when the invoice is settled, then the subscription is activated within 10 seconds and the supporter gains access to gated content.

**Priority:** P1 (High)

---

#### FR-007: Content Access Control Enforcement

**User Story:** As a creator, I want to gate specific content behind subscription tiers so that only paying supporters can access premium material.

**Acceptance Criteria:**
- Given a creator publishes content marked as "premium" for a specific tier, when a non-subscriber tries to access it, then they see a paywall with the tier information and a subscribe button.
- Given a supporter has an active subscription at the required tier, when they access premium content, then the content loads fully without any paywall.
- Given a supporter's subscription expires, when they try to access premium content, then they see a renewal prompt instead of the content.
- Given a creator changes a content item from premium to free, when any user accesses it, then the content is fully visible without a paywall.

**Priority:** P1 (High)

---

#### FR-008: Payment Revenue Split Processing

**User Story:** As a creator, I want 95% of subscription and tip revenue deposited to my Lightning wallet automatically so that I receive my earnings without manual intervention.

**Acceptance Criteria:**
- Given a supporter pays 10,000 sats for a subscription, when the payment settles, then 9,500 sats are allocated to the creator and 500 sats to the platform.
- Given the creator has a verified Lightning address, when accumulated earnings exceed the minimum payout threshold (configurable, default 1,000 sats), then a payout is initiated automatically.
- Given a payout fails (e.g., creator's node is offline), when the system retries, then it attempts 3 retries with exponential backoff before marking the payout as failed and notifying the creator.
- Given a creator views their revenue page, when payouts are listed, then each payout shows amount, status (pending/completed/failed), and timestamp.

**Priority:** P0 (Critical)

---

#### FR-009: Creator Collaboration Tools

**User Story:** As a creator, I want to collaborate with other creators on joint content (co-authored posts, shared subscription bundles) so that we can cross-promote and grow audiences together.

**Acceptance Criteria:**
- Given a creator initiates a collaboration, when they invite another creator by NOSTR pubkey, then the invitee receives a notification and can accept or decline.
- Given two creators co-author content, when the content is published, then both creators are attributed and the content appears on both profiles.
- Given collaborating creators set up a shared subscription bundle, when a supporter subscribes to the bundle, then revenue is split according to the agreed ratio.
- Given a collaboration is dissolved, when either creator removes the collaboration, then future content is no longer cross-posted but existing co-authored content remains attributed to both.

**Priority:** P2 (Medium) - Phase 7: US-103 to US-106

---

#### FR-010: Internationalization and Localization

**User Story:** As a creator with a global audience, I want the platform interface available in multiple languages so that supporters worldwide can use Sovren in their preferred language.

**Acceptance Criteria:**
- Given the platform supports i18n, when a user sets their language preference to Spanish, then all UI text (navigation, buttons, labels, error messages) displays in Spanish.
- Given content is created in English, when a Spanish-speaking user views it, then the content remains in English but all surrounding UI is in Spanish.
- Given a new language is added, when translators provide a translation file, then the language becomes available without code changes.
- Given a user has not set a language preference, when they first visit, then the platform defaults to their browser's language setting.

**Priority:** P2 (Medium) - Phase 7: US-107 to US-110

---

### Should Have (Post-MVP)

- **FR-011:** Live streaming capabilities with Lightning tip integration during streams.
- **FR-012:** Content scheduling allowing creators to queue posts for future publication.
- **FR-013:** Multi-format content support (audio, video, long-form articles) with appropriate NOSTR event kinds.
- **FR-014:** Automated content moderation using AI-assisted detection with human review for flagged content.

### Could Have (Future Consideration)

- **FR-015:** Mobile native apps (iOS/Android) wrapping the web experience.
- **FR-016:** Creator marketplace for selling digital goods (e-books, courses, templates).
- **FR-017:** Advanced A/B testing framework for creators to optimize content performance.

### Explicitly Out of Scope

- **Fiat currency support:** Sovren is Lightning-native. No fiat on/off ramps are planned for Phase 7.
- **Custodial wallet:** Sovren does not hold user funds. All payments flow directly via Lightning.
- **Content hosting/CDN:** Content is stored on NOSTR relays per protocol design. Sovren does not operate centralized media storage.
- **Email-based authentication:** Authentication is exclusively via NOSTR keys. No email/password auth.

---

## Non-Functional Requirements

### Performance

- API response times: < 200ms for 95th percentile on read endpoints, < 500ms on write endpoints.
- Page load time: < 2 seconds on 3G connections (mobile-first design).
- WebSocket event delivery: < 500ms from event creation to client receipt under load.
- Lightning invoice generation: < 1 second.
- Support 10,000 concurrent users without degradation (scaling target: 100,000 for Phase 7 completion).

### Security

- NOSTR authentication using NIP-42 challenge-response; no passwords stored.
- All API endpoints validated with Zod schemas (already implemented).
- Rate limiting on authentication endpoints (10 requests per 15 minutes per IP, already implemented).
- OWASP Top 10 compliance across all endpoints.
- Lightning payment webhook signatures verified with HMAC-SHA256.
- Row-Level Security (RLS) on all Supabase tables containing user data.

### Scalability

- Database: PostgreSQL with connection pooling; read replicas for analytics queries.
- WebSocket: Horizontal scaling via Redis pub/sub for cross-server event delivery.
- NOSTR relays: Multi-relay architecture with automatic failover (relay-config.ts already supports this).

### Accessibility

- WCAG 2.1 AA compliance on all user-facing pages.
- Keyboard navigation for all interactive elements.
- Screen reader support with proper ARIA labels.
- Color contrast ratio minimum 4.5:1 for normal text.

### Reliability

- 99.9% uptime for API and WebSocket services.
- Payment processing: Zero data loss; all transactions persisted before acknowledgment.
- Graceful degradation: If a NOSTR relay is unreachable, the app continues functioning with cached data and remaining relays.

---

## Business Rules

### Payment and Revenue Split

| Rule | Description |
|------|-------------|
| BR-001 | Creator revenue share is 95% of all subscription and tip payments. Platform retains 5%. |
| BR-002 | Minimum payout threshold is 1,000 sats (configurable per creator). |
| BR-003 | Payouts are processed automatically when accumulated balance exceeds threshold. |
| BR-004 | Failed payouts are retried 3 times with exponential backoff (1 min, 5 min, 30 min). |
| BR-005 | Lightning invoices expire after 60 minutes (configurable in LightningConfigSchema). |
| BR-006 | Maximum single invoice amount is 1,000,000 sats (0.01 BTC). Minimum is 1 sat. |
| BR-007 | Payment disputes: No chargebacks (Lightning is final settlement). Refunds are creator-initiated. |

### Subscription Tiers

| Rule | Description |
|------|-------------|
| BR-008 | Creators can create up to 10 subscription tiers. |
| BR-009 | Each tier must have at least one benefit and a positive price in millisatoshis. |
| BR-010 | Supported billing intervals: daily, weekly, monthly, yearly. |
| BR-011 | Tiers can have optional maximum subscriber limits. |
| BR-012 | When a subscriber's billing period ends and auto-renew is on, a new invoice is generated automatically. |
| BR-013 | Grace period: 3 days after failed renewal before content access is revoked. |
| BR-014 | Tier changes (upgrade/downgrade) are prorated based on remaining billing period. |

### Content Access Control

| Rule | Description |
|------|-------------|
| BR-015 | Content can be marked as free (visible to all) or premium (gated to specific tier). |
| BR-016 | Premium content is not delivered to clients without a valid, active subscription at the required tier or higher. |
| BR-017 | Content access is verified on every request (no client-side-only gating). |
| BR-018 | Creators can change content from premium to free at any time; the reverse (free to premium) requires confirmation. |

### NOSTR Protocol

| Rule | Description |
|------|-------------|
| BR-019 | All user identities are NOSTR public keys (64-character hex strings). |
| BR-020 | Authentication uses NIP-42 challenge-response with JWT session tokens. |
| BR-021 | Content is published as NOSTR events (kind 1 for notes, kind 30023 for long-form, kind 30026 for gated content). |
| BR-022 | Subscription tiers are published as kind 30027 parameterized replaceable events. |
| BR-023 | Payment receipts are published as kind 30029 events. |
| BR-024 | NIP-05 verification (user@sovren.app) is available to all creators. |
| BR-025 | Relay list: Events are published to a configurable set of relays (minimum 3 for redundancy). |

### User Roles

| Rule | Description |
|------|-------------|
| BR-026 | Three roles: creator, supporter, admin. |
| BR-027 | A user can be both a creator and a supporter (they can subscribe to other creators). |
| BR-028 | Only creators can create subscription tiers and publish premium content. |
| BR-029 | Admins can view platform-wide analytics and manage NIP-05 verification. |

---

## Edge Cases

### EC-001: Concurrent Subscription and Payment Race Condition

**Scenario:** Two supporters attempt to subscribe to the last available slot on a tier with a max subscriber limit at the same time.

**Expected Behavior:** Database-level locking ensures only one subscription is created. The second subscriber receives a "Tier is full" error and their Lightning invoice (if generated) is cancelled. No double-charge occurs because Lightning invoices are unique and can only be paid once.

### EC-002: Lightning Payment Settles After Invoice Expiry

**Scenario:** A supporter's Lightning payment is routed slowly and settles after the 60-minute invoice expiry window.

**Expected Behavior:** The Lightning service checks the settlement against the invoice expiry. If the payment settles after expiry, the payment is still recorded (Lightning is irreversible) but the subscription is not activated. The creator receives the funds, and the supporter is notified to contact the creator or retry. Platform-initiated refund can be processed via the RefundService.

### EC-003: Creator Deletes Subscription Tier With Active Subscribers

**Scenario:** A creator attempts to delete a subscription tier that still has active subscribers.

**Expected Behavior:** Tier deletion is soft-delete only (is_active set to false). Existing subscribers retain access until their current billing period ends. No new subscriptions are accepted for the deactivated tier. The creator sees a warning about active subscribers before confirming.

### EC-004: NOSTR Relay Unavailability

**Scenario:** The primary NOSTR relay goes offline while a creator is publishing content.

**Expected Behavior:** The system attempts publication to all configured relays (minimum 3). If at least one relay accepts the event, the publication succeeds and the user is informed that some relays are temporarily unavailable. The system retries failed relays in the background. If all relays are down, the event is queued locally and published when connectivity is restored.

### EC-005: Double Payment Attempt

**Scenario:** A supporter clicks "Pay" twice rapidly, or their wallet sends the payment twice due to a timeout/retry.

**Expected Behavior:** Each Lightning invoice has a unique payment_hash. The second payment attempt either pays the same invoice (idempotent, no double charge) or fails because the invoice was already settled. The backend uses idempotency keys on the subscription creation endpoint to prevent duplicate subscriptions from a single user action.

### EC-006: Zero-Balance Payout Trigger

**Scenario:** The automated payout scheduler runs when a creator's accumulated balance is below the minimum threshold.

**Expected Behavior:** The payout service checks the balance against the threshold before initiating any Lightning payment. If below threshold, the payout is skipped silently. No failed transaction is recorded. The creator can see their current balance and the threshold on their revenue page.

### EC-007: Subscriber Upgrades Mid-Billing-Cycle

**Scenario:** A supporter with a monthly "Basic" tier subscription upgrades to the "Premium" tier 15 days into their billing cycle.

**Expected Behavior:** The system calculates a prorated amount: the supporter pays the difference between the remaining Basic period value and the equivalent Premium period value. A new invoice is generated for the prorated amount. Upon payment, the subscription is immediately upgraded and the next full billing cycle begins on the original renewal date.

### EC-008: Content Access During Payment Processing

**Scenario:** A supporter initiates a subscription payment (invoice generated) but the payment has not yet settled. They attempt to access premium content.

**Expected Behavior:** Access is denied. Content access is only granted after payment settlement confirmation. The subscriber sees a "Payment pending" status on their subscription page. Once the payment settles (via webhook or polling), access is granted automatically without requiring a page refresh (via WebSocket notification).

---

## Success Metrics

| Metric | Baseline | Target | Timeline | Measurement Method |
|--------|----------|--------|----------|--------------------|
| Creator onboarding completion rate | N/A (new flow) | 80% of new creators complete onboarding within one session | 3 months post-launch | Funnel analytics: steps completed / steps started |
| Payment success rate | N/A (in-memory only) | 98% of Lightning invoices are paid successfully | 1 month post-launch | Payment service logs: settled / generated |
| Subscription retention (monthly) | N/A | 85% of subscribers renew after first month | 3 months | Subscription service: renewed / eligible |
| Content discovery conversion | 23% follow-from-recommendation | 30% follow-from-recommendation | 3 months | Analytics: follows / recommendation impressions |
| API response time (p95) | < 200ms | Maintain < 200ms with 10x user growth | 6 months | Prometheus/Grafana latency histograms |
| WebSocket event delivery (p95) | N/A | < 500ms | 1 month post-launch | Event timestamp delta measurement |
| Creator revenue payout success | N/A | 99% of payouts succeed on first attempt | 3 months | Payout service logs |
| Cross-client content visibility | Unknown | 95% of Sovren-published NIP-01 events visible on Damus/Primal | 2 months | Manual QA + automated relay monitoring |
| Platform uptime | 99.9% | Maintain 99.9% | Ongoing | Uptime monitoring (Grafana/Sentry) |
| Creator satisfaction (NPS) | N/A | NPS > 50 | 6 months | In-app survey |

### Leading Indicators

- Daily active creators publishing content
- Number of Lightning invoices generated per day
- WebSocket connection count (concurrent)
- New creator signups completing onboarding wizard

### Lagging Indicators

- Monthly recurring revenue (total platform sats processed)
- Creator retention rate (creators active 90 days after first publish)
- Supporter-to-subscriber conversion rate
- Platform word-of-mouth referral rate

---

## Technical Constraints and Dependencies

### Technical Constraints

- **NOSTR Protocol:** All identity and content must conform to NIP specifications. Custom event kinds (30024-30030, 30078-30082) must not conflict with upstream NIP proposals.
- **Lightning Network:** Payments are irreversible. No chargeback mechanism exists. Refunds require explicit creator action.
- **nostr-tools v2.13.2:** The shared package depends on this specific version. Upgrades require compatibility testing across the monorepo.
- **Supabase:** Database hosting and real-time subscriptions depend on Supabase. RLS policies must be maintained for all tables.
- **Vercel:** Frontend deployment on Vercel imposes serverless function size limits and cold start latencies.

### Dependencies

- **External:** LNbits (Lightning payment processing), NOSTR relay network (event propagation), Supabase (database and auth)
- **Internal:** Shared package types must be updated before backend or frontend changes that modify NOSTR event schemas. Backend API contracts must be finalized before frontend integration.
- **Phase Dependencies:** FR-001 (database integration) must be completed before FR-008 (revenue split processing) and FR-006 (subscription flow) can be production-ready.

### Assumptions

- Creators have access to a Lightning wallet that supports receiving payments.
- NOSTR relay infrastructure remains available and performant.
- Supabase free/pro tier provides sufficient database capacity for initial launch.
- Users understand the basics of NOSTR key management (or will be taught during onboarding).

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| Network effects: creators won't migrate without audience | High | High | Focus on NOSTR-native creators first (already on Damus/Primal); provide migration tools for Twitter/YouTube audiences; ensure cross-client compatibility so creators don't lose existing NOSTR followers. |
| Lightning payment UX friction | Medium | High | Implement WebLN for in-browser payments; support multiple wallet types (LNURL, Lightning Address, BOLT11); provide clear payment status feedback via WebSocket. |
| NOSTR relay instability | Medium | Medium | Publish to 3+ relays; implement relay health monitoring (nip05-monitoring-service already exists); cache events locally; graceful degradation when relays are unavailable. |
| In-memory services data loss in production | High | High | FR-001 (database integration) is P0 priority. All InMemoryRepository implementations must be replaced before production launch. |
| Custom NOSTR event kind conflicts | Low | High | Register custom kinds with NOSTR community; use the 30000-39999 parameterized replaceable range per NIP-33; monitor NIP proposals for conflicts with kinds 30024-30030. |
| Creator key management errors | Medium | High | Provide clear key backup instructions during onboarding; implement NIP-07 browser extension support; warn users about key loss consequences (irrecoverable identity). |

---

## Open Questions

- [ ] **Q1:** What is the minimum number of relays a creator must publish to for content to be considered "published"? (Proposed: 1 successful relay write = published, with background propagation to remaining relays.)
- [ ] **Q2:** Should the platform charge a flat 5% fee on all payment types (subscriptions, tips, content purchases) or differentiate rates by payment type?
- [ ] **Q3:** What is the maximum number of subscription tiers per creator? (Current implementation allows 10; is this sufficient for enterprise creators?)
- [ ] **Q4:** Should creator collaboration revenue splits be enforced on-chain (via Lightning multi-path) or managed at the application layer?
- [ ] **Q5:** For internationalization, which languages should be prioritized first? (Proposed: English, Spanish, Portuguese, Japanese based on NOSTR user demographics.)
