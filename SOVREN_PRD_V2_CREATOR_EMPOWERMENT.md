# PRD: Sovren v2.0 - Creator Empowerment Platform

## 1. Product overview

### 1.1 Document title and version

- PRD: Sovren v2.0 - Creator Empowerment Platform
- Version: 2.0
- Date: 2026-02-12
- Supersedes: SOVREN_PRD.md (v1.0)
- Research basis: 25 X posts (10,832 likes), 30 web sources, Jan-Feb 2026 creator economy data

### 1.2 Problem statement

Content creators in 2026 face a compounding crisis. Research from the last 30 days reveals:

| Pain Point                 | Severity | Evidence                                                                              |
| -------------------------- | -------- | ------------------------------------------------------------------------------------- |
| **Burnout**                | Critical | 79-90% of creators affected; 2/3 report anxiety/depression (3x national avg)          |
| **Algorithm suppression**  | Critical | Platform changes destroy reach overnight; small accounts seeing 50 views/post         |
| **Income instability**     | Critical | $250B industry with no benefits, no income floor, no safety net                       |
| **AI content crisis**      | High     | Clipper accounts outperform originals; consumer skepticism doubled (18% to 32%)       |
| **Solo operator overload** | High     | Editing, planning, posting, contracts, marketing — all one person                     |
| **Platform dependency**    | High     | Creators build on rented land with no audience portability                            |
| **Isolation**              | Medium   | 54% want peer support networks but only 27% are in one                                |
| **Contract exploitation**  | Medium   | Bad contracts identified as major income drain; 50% of marketers spend <30min vetting |

Sovren v1.0 already addresses platform dependency (NOSTR), income instability (Lightning), and algorithmic suppression (decentralized distribution). **v2.0 closes the remaining gaps**: burnout prevention, AI content protection, multi-platform distribution, creator community, and business management tools.

### 1.3 Product summary

Sovren v2.0 evolves from a decentralized monetization platform into a **complete creator empowerment platform**. It wraps Sovren's existing NOSTR + Lightning foundation with tools that directly combat the six creator pain points the industry still ignores: burnout, content theft, multi-platform burden, isolation, contract risk, and income volatility.

The thesis: **creators who own their audience, automate their operations, protect their content, and support each other will outlast every algorithm change.**

### 1.4 Relationship to v1.0

Sovren v1.0 (SOVREN_PRD.md) defined the core platform: NOSTR authentication, Lightning payments, content management, analytics dashboards, subscription tiers, and content discovery. All v1.0 user stories (US-001 through US-020) remain valid.

v2.0 adds **six new feature domains** built on top of v1.0 infrastructure:

| v2.0 Domain        | Builds On (v1.0)                     | New Capability                                       |
| ------------------ | ------------------------------------ | ---------------------------------------------------- |
| Creator Wellness   | US-004 Analytics, US-002 Content     | Burnout detection, sustainable pacing                |
| Content Shield     | US-002 Content, US-015 NOSTR Sync    | AI provenance, theft detection, verification         |
| Multi-Platform Hub | US-002 Content, US-017 Organization  | Cross-posting, repurposing, unified inbox            |
| Creator Network    | US-009 Messaging, US-011 Engagement  | Peer communities, mentorship, collaboration          |
| Business Manager   | US-003 Subscriptions, US-013 Payouts | Contracts, invoicing, tax prep, income planning      |
| Income Stabilizer  | US-004 Analytics, US-013 Payouts     | Revenue forecasting, diversification, emergency fund |

## 2. Goals

### 2.1 Business goals

- Reduce creator churn by 40% through wellness and stability features
- Increase average creator revenue by 50% through income diversification tools
- Achieve 25,000 active creators within 18 months (up from v1.0 target of 10,000)
- Become the platform creators recommend when asked "how do you avoid burnout?"
- Establish Sovren as the only platform where creators own content, audience, AND business tools
- Drive 30% of new signups through creator-to-creator referrals via Creator Network

### 2.2 User goals

- **Survive**: Stop burning out from always-on content demands
- **Protect**: Ensure AI cannot steal or replicate content without attribution
- **Simplify**: Post once, distribute everywhere without manual per-platform work
- **Connect**: Find peers who understand the creator struggle and collaborate
- **Stabilize**: Predict income, plan for slow months, and build financial resilience
- **Own**: Control audience relationships, content, and revenue with no platform risk

### 2.3 Non-goals

- Replacing social media platforms (Sovren is the home base, not the only distribution point)
- Building a full accounting/tax software (integrate with existing tools instead)
- Providing mental health therapy (surface signals and suggest resources, not diagnose)
- Becoming a talent agency or managing creator-brand deals end-to-end
- Supporting non-Bitcoin payment rails (Lightning remains primary; fiat on-ramps are complementary)

## 3. Updated user personas

### 3.1 Persona updates (informed by research)

All v1.0 personas remain. v2.0 adds context based on 2026 research:

- **Sophia (Professional Creator)**: Now works 60+ hrs/week across 4 platforms. Has experienced algorithm suppression that cut her reach 70% overnight. Uses scheduling tools but still feels overwhelmed. Needs burnout prevention and income stability.

- **Marcus (Emerging Creator)**: Handles everything alone — filming, editing, posting, responding. Saw AI-generated copies of his content getting more engagement than originals. Needs multi-platform automation and content protection.

- **Aisha (Technical Creator)**: Values sovereignty but spends too much time on platform management instead of creating. Wants peer community of technical creators to share strategies. Needs creator network and business tools.

- **Thomas (Dedicated Fan)**: Wants to know his payments go directly to creators, not platforms. Concerned about AI-generated fake creator content. Needs content authenticity verification.

### 3.2 New persona

- **Carmen (Creator Manager)**: Manages 3-5 creators, handles their contracts, cross-posting, and business operations. Needs multi-creator dashboard, contract management, and cross-platform analytics.

## 4. Feature domains

### Domain 1: Creator Wellness System

**Research driver**: 79-90% burnout rate, 2/3 report anxiety/depression, only 4% of 8+ year creators describe mental health as "excellent"

**Existing foundation**: Content scheduling (US-072), notification controls, content strategy AI

#### US-201: Wellness Dashboard

- **Description**: As a creator, I want a wellness dashboard that tracks my work patterns so I can identify burnout risks before they become crises.
- **Acceptance criteria**:
  - Display work hours heatmap (content creation, engagement, management time)
  - Track posting frequency with "sustainable pace" indicator based on creator's history
  - Show rest day streak and work/rest ratio
  - Compare current week patterns to personal baseline
  - Surface warnings when patterns indicate burnout risk (e.g., posting frequency spike + engagement drop + irregular hours)
  - Integrate with existing CreatorDashboard as a tab

#### US-202: Sustainable Scheduling Assistant

- **Description**: As a creator, I want the scheduling system to recommend sustainable posting cadences so I can maintain consistency without overwork.
- **Acceptance criteria**:
  - Analyze historical performance to find optimal posting frequency (not maximum)
  - Suggest batch content creation windows based on creator's productive hours
  - Auto-distribute scheduled content to maintain presence during rest periods
  - "Creative Battery" indicator showing content buffer depth (how many days of scheduled content ahead)
  - Alert when content buffer drops below creator-set threshold
  - Build on existing content scheduling (US-072) infrastructure

#### US-203: Creator Boundaries Controls

- **Description**: As a creator, I want to set engagement boundaries so I can protect my time and mental energy.
- **Acceptance criteria**:
  - Configurable "focus hours" where notifications are silenced and auto-replies activate
  - Audience-facing "creator availability" status (available, creating, offline)
  - Auto-response templates for DMs during off hours
  - Weekly engagement time budget with alerts when approaching limit
  - "Do Not Disturb" mode that batches notifications for later review
  - Build on existing NotificationSettings component

#### US-204: Wellness Insights & Resources

- **Description**: As a creator, I want periodic wellness check-ins and resource recommendations so I can proactively manage my mental health.
- **Acceptance criteria**:
  - Optional weekly wellness pulse check (1-5 scale on energy, motivation, stress)
  - Trend visualization of wellness scores over time
  - Curated resource library (articles, communities, tools) for creator mental health
  - Anonymous benchmarking ("You're working X% more than similar creators")
  - All data stays local to the creator — never shared or used for platform metrics
  - Opt-in only, dismissible, never nagging

### Domain 2: Content Shield (AI Protection)

**Research driver**: AI clipper accounts outperform originals, consumer skepticism doubled to 32%, platforms implementing AI content restrictions

**Existing foundation**: NOSTR event publishing (US-015), NIP-05 verification (US-016)

#### US-211: Content Provenance Signing

- **Description**: As a creator, I want my content cryptographically signed at publication so I can prove original authorship.
- **Acceptance criteria**:
  - Every published content piece is signed with creator's NOSTR key with timestamp
  - Provenance metadata embedded in NOSTR event tags (NIP-compliant)
  - Human-readable "Verified Original" badge on content
  - Provenance chain viewable by any supporter (author, timestamp, relay confirmations)
  - Export provenance certificate for DMCA/legal use
  - Build on existing NOSTR event signing infrastructure

#### US-212: Content Fingerprinting

- **Description**: As a creator, I want my content fingerprinted at publication so copies can be detected across platforms.
- **Acceptance criteria**:
  - Generate perceptual hash for images and text content at publish time
  - Store fingerprints in creator's content registry (Supabase + NOSTR backup)
  - Fingerprint comparison API for detecting similar content elsewhere
  - Dashboard showing fingerprint registry size and coverage
  - Support text, image, and video content types
  - Hashes stored alongside existing content_analytics records

#### US-213: AI Content Alerts

- **Description**: As a creator, I want to be notified when potential copies of my content are detected so I can take action.
- **Acceptance criteria**:
  - Periodic scan of NOSTR relay network for content matching creator's fingerprints
  - Alert notification with side-by-side comparison (original vs detected copy)
  - Confidence score on match (exact copy, derivative, coincidental similarity)
  - One-click "Report" action that generates DMCA-ready documentation
  - Alert history with resolution status tracking
  - Integration with existing NotificationCenter component

#### US-214: Authenticity Verification Badge

- **Description**: As a supporter, I want to verify that content is from the original creator so I can trust what I'm consuming.
- **Acceptance criteria**:
  - Visual badge on all content showing verification status (verified original, unverified, disputed)
  - Click-through to provenance chain showing cryptographic proof
  - NIP-05 verification integrated with provenance display
  - Badge renders in Sovren UI and is embedded in NOSTR event metadata for other clients
  - Build on existing NIP-05 verification (packages/shared/src/types/nip05.ts)

### Domain 3: Multi-Platform Hub

**Research driver**: Creators drowning in multi-platform management, editing fatigue, 6+ hours editing per stream, algorithm penalizing multi-niche creators

**Existing foundation**: Content management (US-002), content scheduling (US-072), content organization (US-017)

#### US-221: Cross-Platform Publisher

- **Description**: As a creator, I want to publish content once on Sovren and distribute it to other platforms so I can maintain multi-platform presence without manual work.
- **Acceptance criteria**:
  - Connect external platform accounts (X/Twitter, YouTube, Bluesky, Mastodon, Threads)
  - Per-platform formatting options (character limits, media requirements, hashtag strategies)
  - Preview how content will appear on each platform before publishing
  - Publish to selected platforms simultaneously or on per-platform schedules
  - Track cross-platform performance in unified view
  - OAuth-based platform connections stored securely
  - Build on planned social-media-integration backend type

#### US-222: Content Repurposing Engine

- **Description**: As a creator, I want to automatically generate platform-optimized versions of my content so I can reach audiences everywhere without manual reformatting.
- **Acceptance criteria**:
  - Long-form article to thread converter (for X/Bluesky)
  - Article to key-takeaways summary (for short-form platforms)
  - Image resizing/reformatting per platform requirements
  - AI-suggested headlines/hooks per platform audience norms
  - Creator approval required before any repurposed content publishes
  - Repurposed versions link back to Sovren original (driving traffic to owned platform)

#### US-223: Unified Engagement Inbox

- **Description**: As a creator, I want a single inbox showing comments, messages, and mentions from all connected platforms so I don't have to context-switch between apps.
- **Acceptance criteria**:
  - Aggregate comments, replies, DMs, and mentions from connected platforms
  - Platform badge on each item showing source (NOSTR, X, YouTube, etc.)
  - Reply directly from unified inbox (response routes to correct platform)
  - Filter by platform, sentiment, priority, or unread status
  - Batch actions (mark read, archive, respond with template)
  - Build on existing NOSTR messaging (US-009) and NotificationCenter

#### US-224: Cross-Platform Analytics

- **Description**: As a creator, I want to see performance metrics from all platforms in one dashboard so I can understand my total reach and optimize distribution.
- **Acceptance criteria**:
  - Aggregate follower/subscriber counts across platforms
  - Cross-platform content performance comparison (same content, different platforms)
  - Identify which platforms drive the most engagement and revenue per effort
  - Audience overlap estimation between platforms
  - "Platform ROI" metric showing engagement-per-hour-invested per platform
  - Build on existing analytics infrastructure (CreatorDashboard, EnhancedCreatorDashboard)

### Domain 4: Creator Network

**Research driver**: 54% of creators want peer support networks but only 27% are in one; isolation and mental strain are widespread

**Existing foundation**: NOSTR messaging (US-009), content engagement (US-011), discovery (US-006)

#### US-231: Creator Circles

- **Description**: As a creator, I want to join private peer groups of similar creators so I can share strategies, challenges, and support.
- **Acceptance criteria**:
  - Create or join creator circles (private groups of 5-20 creators)
  - Circle matching based on niche, audience size, and experience level
  - Shared discussion feed within circle (NOSTR encrypted group messages)
  - Circle analytics dashboard comparing member performance (opt-in only)
  - Resource sharing (templates, tools, strategies) within circle
  - All communication decentralized via NOSTR (no Sovren lock-in)

#### US-232: Mentorship Matching

- **Description**: As an emerging creator, I want to connect with experienced creators for mentorship so I can learn from their mistakes and accelerate growth.
- **Acceptance criteria**:
  - Experienced creators can opt-in as mentors with availability settings
  - Emerging creators can browse mentors by niche, style, and audience size
  - Structured mentorship program (goals, check-ins, milestones)
  - Mentor compensation via Lightning micropayments (voluntary or structured)
  - Mentor reputation system based on mentee growth outcomes
  - Build on existing creator profiles and discovery system

#### US-233: Collaborative Content

- **Description**: As a creator, I want to co-create content with other creators so we can cross-pollinate audiences and share workload.
- **Acceptance criteria**:
  - Invite other Sovren creators as co-authors on content
  - Revenue split configuration (percentage per co-author, settable per content piece)
  - Co-authored content appears on all co-authors' profiles
  - Automated Lightning payment splitting based on configured ratios
  - Collaboration request/accept workflow via NOSTR DMs
  - Build on existing content publishing (US-002) and payment splitting

#### US-234: Creator Marketplace

- **Description**: As a creator, I want to find and hire other creators for services (editing, thumbnails, writing) so I can delegate tasks I don't enjoy.
- **Acceptance criteria**:
  - Service listings (editing, design, writing, coaching, consulting)
  - Portfolio showcasing for service providers
  - Lightning-based escrow for service payments
  - Rating/review system for completed services
  - Direct messaging for project scoping
  - Build on existing discovery (US-006) and payments infrastructure

### Domain 5: Business Manager

**Research driver**: Bad contracts drain creator income; no institutional support; creators do every business task themselves

**Existing foundation**: Subscription tiers (US-003), payouts (US-013), transaction history

#### US-241: Smart Contract Templates

- **Description**: As a creator, I want access to pre-built contract templates for common deals (sponsorships, collaborations, licensing) so I can protect my interests.
- **Acceptance criteria**:
  - Template library for sponsorship, brand deal, licensing, and collaboration agreements
  - Fill-in-the-blank format with creator-friendly defaults
  - Red flag analyzer that highlights unfavorable terms in pasted contracts
  - Export as PDF for signing
  - Version history for contract iterations
  - Templates reviewed by creator-economy legal experts

#### US-242: Invoice Generator

- **Description**: As a creator, I want to generate professional invoices for brand deals and services so I can manage accounts receivable.
- **Acceptance criteria**:
  - Invoice creation with line items, tax calculations, payment terms
  - Lightning payment link embedded in invoice
  - Invoice tracking (sent, viewed, paid, overdue)
  - Recurring invoice templates for ongoing partnerships
  - Export for accounting software (CSV, PDF)
  - Build on existing payment and transaction infrastructure

#### US-243: Revenue Diversification Planner

- **Description**: As a creator, I want to see how my income is distributed across sources so I can reduce dependency on any single revenue stream.
- **Acceptance criteria**:
  - Revenue breakdown by source (subscriptions, tips, sponsorships, services, affiliate)
  - Concentration risk indicator (warns if >50% of income from single source)
  - Suggestions for underexplored revenue streams based on creator's niche and audience
  - Goal-setting for revenue diversification targets
  - Historical trend showing diversification progress
  - Build on existing RevenueAnalytics component

#### US-244: Tax Preparation Assistant

- **Description**: As a creator, I want automated categorization of income and expenses so tax preparation is less painful.
- **Acceptance criteria**:
  - Automatic categorization of Lightning payments by type (subscription, tip, sponsorship, service)
  - Expense tracking for creator-related costs (equipment, software, services)
  - Quarterly income summary with estimated tax liability
  - Export transaction history in tax-software-compatible formats
  - Currency conversion records (BTC/sats to USD at time of receipt)
  - Build on existing payment history and transaction tracking

### Domain 6: Income Stabilizer

**Research driver**: No steady paycheck, one month great / next month debating quitting, $250B industry with no safety net

**Existing foundation**: Revenue tracking (US-004), subscription management (US-003, US-012), payout system (US-013)

#### US-251: Revenue Forecasting

- **Description**: As a creator, I want AI-powered revenue predictions so I can plan my finances with confidence.
- **Acceptance criteria**:
  - 30/60/90-day revenue forecast based on subscriber trends, seasonal patterns, and content pipeline
  - Confidence intervals on predictions (optimistic, expected, conservative)
  - Scenario modeling ("What if I lose 10% of subscribers?", "What if I add a new tier?")
  - Forecast accuracy tracking over time
  - Weekly forecast email digest (opt-in)
  - Build on existing PerformancePredictionViewer and GrowthForecastingChart

#### US-252: Subscriber Health Monitor

- **Description**: As a creator, I want early warning when subscribers are at risk of churning so I can take action before losing income.
- **Acceptance criteria**:
  - Churn risk scoring per subscriber based on engagement decline, payment patterns
  - Cohort analysis showing subscriber retention curves
  - Automated re-engagement suggestions for at-risk subscribers
  - "Win-back" campaign tools for recently churned subscribers
  - Monthly subscriber health report
  - Build on existing subscription management and analytics

#### US-253: Creator Emergency Fund

- **Description**: As a creator, I want to automatically set aside a percentage of earnings into a reserve so I have a buffer during slow periods.
- **Acceptance criteria**:
  - Configurable auto-save percentage (e.g., 10% of all incoming Lightning payments)
  - Emergency fund balance visible on dashboard
  - Target fund size based on monthly expenses (creator-configured)
  - Progress indicator toward target
  - Easy withdrawal to creator's Lightning wallet when needed
  - Fund stored in creator's own wallet (non-custodial, Sovren only tracks the allocation)

#### US-254: Income Milestone Tracking

- **Description**: As a creator, I want to track progress toward income milestones so I can stay motivated and measure growth.
- **Acceptance criteria**:
  - Configurable milestones (first $100, $1K month, $10K month, etc.)
  - Visual progress tracker on dashboard
  - Celebration moments when milestones are reached (shareable achievement cards)
  - Milestone history showing date achieved
  - Community leaderboard (opt-in, anonymous tier-based)
  - Build on existing analytics infrastructure

## 5. User experience

### 5.1 Updated navigation (v2.0 additions)

```
Sovren App
├── Home (Feed)
├── Create (Content Editor)
├── Dashboard
│   ├── Analytics (existing)
│   ├── Revenue (existing)
│   ├── Wellness (NEW - US-201)
│   └── Income Planner (NEW - US-251, US-253, US-254)
├── Distribute (NEW)
│   ├── Connected Platforms (US-221)
│   ├── Cross-Post Queue (US-221, US-222)
│   └── Unified Inbox (US-223)
├── Community (NEW)
│   ├── My Circles (US-231)
│   ├── Mentorship (US-232)
│   ├── Collaborations (US-233)
│   └── Marketplace (US-234)
├── Business (NEW)
│   ├── Contracts (US-241)
│   ├── Invoices (US-242)
│   ├── Tax Prep (US-244)
│   └── Revenue Mix (US-243)
├── Content Shield (NEW)
│   ├── Provenance Registry (US-211, US-212)
│   ├── Alerts (US-213)
│   └── Verification (US-214)
├── Discover (existing)
├── Subscriptions (existing)
└── Settings
    ├── Profile (existing)
    ├── Connected Platforms (US-221)
    ├── Wellness Preferences (US-203)
    └── Notification Boundaries (US-203)
```

### 5.2 Progressive disclosure strategy

New v2.0 features are introduced gradually:

1. **Week 1**: Wellness Dashboard and Creator Boundaries appear as suggestions after first week of activity
2. **Week 2**: Content Shield is auto-enabled (provenance signing is automatic, alerts are opt-in)
3. **Week 3**: Multi-Platform Hub prompts when creator publishes 5+ pieces of content
4. **Week 4+**: Creator Network, Business Manager, and Income Stabilizer unlock as creator establishes baseline activity
5. **Anytime**: All features accessible from settings for power users

### 5.3 Core experience changes

- **Dashboard** becomes the creator's command center with wellness, income, and shield status at a glance
- **Publishing** now includes one-click cross-platform distribution with automatic provenance signing
- **Analytics** expands from "how did content perform?" to "how am I performing as a business?"
- **Community** transforms from passive discovery to active creator-to-creator engagement

## 6. Narrative

Marcus has been creating gaming content for two years. He posts daily across X, YouTube, and TikTok — filming, editing, and uploading to each platform manually. Last month, an AI clipper account stole his best video, added subtitles, and got 10x his views. His income dropped 30% when YouTube changed its algorithm, and he has no savings to cushion the blow. He's exhausted, isolated, and considering quitting.

Then Marcus finds Sovren. He connects his NOSTR keys and links his existing platform accounts. Now he creates content once and Sovren distributes it everywhere with platform-optimized formatting. His content is cryptographically signed the moment he publishes, and when a clipper account copies it, Sovren alerts him with a ready-to-file DMCA report. His Wellness Dashboard shows he's been working 70-hour weeks and suggests a sustainable schedule that maintains his output with two rest days. He joins a Creator Circle of similar-sized gaming creators who share editing tricks, and hires a thumbnail designer from the Creator Marketplace, paying instantly via Lightning.

Six months later, Marcus's Sovren subscribers generate 40% of his income — money that flows directly to his wallet with no algorithm in between. His Revenue Forecaster shows stable growth, his Emergency Fund has two months of runway, and his burnout risk score has dropped from "critical" to "healthy." He's creating better content, working fewer hours, and for the first time feels like he's building a career, not just chasing algorithms.

## 7. Success metrics

### 7.1 Creator wellness metrics (NEW)

- Average creator work hours per week (target: stabilize at <45 hrs)
- Burnout risk score distribution (target: <20% in "high risk" category)
- Wellness feature adoption rate (target: 60% of active creators)
- Creator retention at 6 months (target: 70%, up from industry avg of 40%)
- Rest day compliance rate (target: creators take 2+ rest days/week)

### 7.2 Content protection metrics (NEW)

- Content pieces with provenance signing (target: 100% of new content)
- AI copy detection rate (target: detect 80%+ of copies on NOSTR network)
- Average time from detection to creator alert (target: <24 hours)
- DMCA report generation rate (target: 1-click generation for 100% of detected copies)

### 7.3 Multi-platform metrics (NEW)

- Cross-platform distribution adoption (target: 50% of creators connect 2+ platforms)
- Time saved per creator per week on distribution (target: 5+ hours)
- Cross-platform engagement increase (target: 30% more total engagement)
- Unified inbox response time improvement (target: 40% faster)

### 7.4 Creator network metrics (NEW)

- Creator Circle participation rate (target: 40% of active creators)
- Mentorship matches made (target: 500 in first 6 months)
- Collaborative content published (target: 10% of all content)
- Marketplace transactions (target: 200/month by month 6)

### 7.5 Business and income metrics (NEW)

- Revenue forecast accuracy (target: within 15% at 30-day horizon)
- Revenue diversification index improvement (target: 20% improvement at 6 months)
- Creators with emergency fund active (target: 30%)
- Income milestone celebrations (engagement proxy for creator motivation)

### 7.6 Inherited metrics (from v1.0)

All metrics from SOVREN_PRD.md Section 7 remain active and tracked.

## 8. Technical considerations

### 8.1 New integration points (v2.0)

- **Platform APIs**: X/Twitter API v2, YouTube Data API, Bluesky AT Protocol, Mastodon ActivityPub, Threads API
- **Content hashing**: Perceptual hashing libraries (pHash for images, SimHash for text)
- **AI services**: Content repurposing models (summarization, format adaptation)
- **Scheduling infrastructure**: Reliable job queue (BullMQ or similar) for scheduled cross-platform publishing
- **Financial tools**: Currency conversion APIs (BTC/USD), tax categorization rules engine

### 8.2 Architecture extensions

```
packages/
├── frontend/
│   └── src/features/
│       ├── wellness/          # NEW - Creator Wellness System
│       ├── content-shield/    # NEW - AI Protection & Provenance
│       ├── multi-platform/    # NEW - Cross-Platform Hub
│       ├── creator-network/   # NEW - Circles, Mentorship, Marketplace
│       ├── business/          # NEW - Contracts, Invoicing, Tax
│       └── income/            # NEW - Forecasting, Emergency Fund
├── backend/
│   └── src/
│       ├── services/
│       │   ├── wellness/      # Work pattern analysis, burnout scoring
│       │   ├── provenance/    # Content signing, fingerprinting
│       │   ├── distribution/  # Cross-platform publishing queue
│       │   ├── community/     # Circles, mentorship matching
│       │   └── finance/       # Revenue forecasting, tax categorization
│       └── routes/
│           └── v2/            # v2 API routes for new domains
└── shared/
    └── src/types/
        ├── wellness.ts
        ├── provenance.ts
        ├── distribution.ts
        ├── community.ts
        └── finance.ts
```

### 8.3 Data storage additions

| Table                        | Purpose                             | Key Columns                                                   |
| ---------------------------- | ----------------------------------- | ------------------------------------------------------------- |
| `wellness_snapshots`         | Weekly wellness pulse data          | creator_id, energy, motivation, stress, work_hours, timestamp |
| `content_fingerprints`       | Perceptual hashes for content       | content_id, hash_type, hash_value, created_at                 |
| `provenance_records`         | Cryptographic provenance chain      | content_id, nostr_event_id, signature, relay_confirmations    |
| `platform_connections`       | OAuth tokens for external platforms | creator_id, platform, access_token, refresh_token, scopes     |
| `cross_posts`                | Cross-platform publication tracking | content_id, platform, platform_post_id, status, metrics       |
| `creator_circles`            | Private creator groups              | circle_id, name, niche, max_members                           |
| `circle_members`             | Circle membership                   | circle_id, creator_id, role, joined_at                        |
| `mentorships`                | Mentor-mentee relationships         | mentor_id, mentee_id, goals, status                           |
| `service_listings`           | Creator Marketplace services        | creator_id, service_type, description, price_sats             |
| `contracts`                  | Creator contract records            | creator_id, counterparty, terms, status, template_id          |
| `invoices`                   | Generated invoices                  | creator_id, client, amount, lightning_invoice, status         |
| `emergency_fund_allocations` | Auto-save tracking                  | creator_id, payment_id, amount_sats, fund_balance             |

### 8.4 Privacy & security considerations

- **Wellness data is sacred**: All wellness pulse data stays with the creator. Never used for platform analytics, advertising, or shared with third parties. Creator can delete all wellness data at any time.
- **Platform tokens encrypted at rest**: OAuth tokens for connected platforms stored with AES-256 encryption in Supabase with RLS.
- **Content fingerprints are public**: Hashes are non-reversible and published to NOSTR for open verification.
- **Emergency fund is non-custodial**: Sovren tracks allocation amounts but funds stay in creator's Lightning wallet. Sovren never holds creator funds.
- **Contract data is private**: Contracts and invoices encrypted and accessible only to involved parties.

### 8.5 Scalability considerations

- Cross-platform publishing requires reliable job queue with retry logic (dead letter queues for failed posts)
- Content fingerprint matching is computationally expensive; batch processing with async workers
- Creator Circle messaging uses NOSTR group encrypted messages; relay load scales with circle count
- Revenue forecasting ML models run as batch jobs, not real-time (daily refresh)

## 9. Milestones & sequencing

### 9.1 Project estimate

- Phase 7 (Wellness + Shield): 3-4 weeks
- Phase 8 (Multi-Platform + Network): 4-5 weeks
- Phase 9 (Business + Income): 3-4 weeks
- Phase 10 (Integration + Polish): 2-3 weeks
- Total: 12-16 weeks for full v2.0 feature set

### 9.2 Suggested phases

#### Phase 7: Creator Safety Net (Weeks 1-4)

**Why first**: Addresses the most acute pain (burnout + content theft) with features that build on existing infrastructure.

- US-201: Wellness Dashboard
- US-202: Sustainable Scheduling Assistant
- US-203: Creator Boundaries Controls
- US-211: Content Provenance Signing
- US-212: Content Fingerprinting
- US-214: Authenticity Verification Badge

**Gate**: Wellness dashboard showing real data; all new content auto-signed with provenance.

#### Phase 8: Creator Reach (Weeks 5-9)

**Why second**: Solves the multi-platform burden and builds community — high-impact features that differentiate Sovren.

- US-221: Cross-Platform Publisher
- US-222: Content Repurposing Engine
- US-223: Unified Engagement Inbox
- US-224: Cross-Platform Analytics
- US-231: Creator Circles
- US-232: Mentorship Matching

**Gate**: Creators can publish to 2+ platforms from Sovren; at least one Creator Circle active.

#### Phase 9: Creator Business (Weeks 10-13)

**Why third**: Builds on the audience and analytics data accumulated from Phases 7-8.

- US-204: Wellness Insights & Resources
- US-213: AI Content Alerts
- US-241: Smart Contract Templates
- US-242: Invoice Generator
- US-243: Revenue Diversification Planner
- US-251: Revenue Forecasting
- US-252: Subscriber Health Monitor

**Gate**: Revenue forecasting showing predictions; contract templates available.

#### Phase 10: Creator Ecosystem (Weeks 14-16)

**Why last**: Advanced features that require a baseline creator community and activity history.

- US-233: Collaborative Content
- US-234: Creator Marketplace
- US-244: Tax Preparation Assistant
- US-253: Creator Emergency Fund
- US-254: Income Milestone Tracking

**Gate**: Full v2.0 feature set live; all domains functional.

## 10. Dependencies on v1.0

### 10.1 Must be complete before v2.0 work begins

- **P1 Security fixes**: SQL injection in Lightning routes, hardcoded crypto keys, XSS in editors (from existing backend TODO tracker)
- **Authentication backend integration**: Required for multi-platform OAuth flows
- **DI controller registration**: Required for new v2 route handlers

### 10.2 Can proceed in parallel

- All v2.0 frontend features can begin once v1.0 UI framework is stable
- New database tables can be added alongside existing schema
- NOSTR provenance signing can build on existing event infrastructure immediately

## 11. Open questions

1. **Multi-platform API limits**: What are the current rate limits and costs for X, YouTube, and Bluesky APIs? Will we need paid API tiers?
2. **Content fingerprinting scope**: Should fingerprinting start with text-only (simpler) or include images/video from day one?
3. **Creator Circle size**: Research suggests 5-20 members. Should we start with fixed size or let circles grow organically?
4. **Emergency fund custody**: Non-custodial is ideal, but how do we track allocations if funds stay in the creator's wallet? Honor system or wallet integration?
5. **Revenue forecasting model**: Simple regression on historical data for MVP, or invest in proper ML pipeline from the start?
6. **Contract template licensing**: Do we need legal review for contract templates, or start with community-contributed templates with disclaimers?

## 12. Appendix: Research sources

### X/Twitter (25 posts, 10,832 likes, 1,808 reposts)

- @AmyMek: Reach suppression complaint (4,528 likes)
- @DarkSalxm: Small creator multi-platform burden (1,891 likes)
- @SoveyX: Algorithm favoring monetized creators (1,101 likes)
- @mws: Mental health rollercoaster of inconsistent performance (719 likes)
- @ToriCosmica: Solo creator task drain poll (868 likes)

### Web sources (30 pages)

- Campaign US: "The honeymoon is officially over for creator content and GenAI" (2026)
- Digiday: "What's in and out for creators in 2026"
- netinfluencer: "The Creator Economy In Review 2025: What 77 Professionals Say Must Change"
- Bitdefender: "Influencer Burnout Is on the Rise: Mental Health Struggles of Content Creators"
- eMarketer: "Creator Economy Trends to Watch in 2026"
- Fourthwall: "How to Make Money as a Content Creator in 2026"
- The Creator Index: "Why General Content is Killing Creator Growth in 2026"

### Key statistics

- 79-90% of creators experience burnout
- 2/3 of creators report anxiety/depression (3x national average)
- Only 8% of creators describe mental health as "excellent" (4% for 8+ year veterans)
- Consumer skepticism toward AI in creator economy doubled: 18% to 32%
- 54% want peer support networks; only 27% are in one
- $250 billion industry with no benefits, no income floor, no institutional support
- Small accounts seeing as low as 50 views/post after algorithm changes
