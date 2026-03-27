# Service Level Agreement and Service Level Objectives

This document defines Sovren's public service level commitments. SLOs are measured monthly against production traffic. SLA terms apply to paid subscribers on active plans.

---

## Uptime SLA

| Tier | Monthly Uptime Commitment | Maximum Allowable Downtime (per month) |
|------|--------------------------|----------------------------------------|
| API (all endpoints) | **99.9%** | 43.8 minutes |
| Payment processing | **99.5%** | 3.65 hours |
| NOSTR relay fanout | Best-effort | Not SLA-bound (see Exclusions) |

Uptime is measured as the percentage of one-minute intervals in a calendar month during which the API health endpoint (`/health`) returns HTTP 200. Scheduled maintenance windows are excluded from uptime calculations.

---

## API Latency SLOs

Latency is measured at the edge (after TLS termination), excluding client network time.

| Metric | Target |
|--------|--------|
| p50 (median) | < 80ms |
| p95 | **< 200ms** |
| p99 | **< 500ms** |
| p99.9 | < 2,000ms |

These targets apply to all authenticated API endpoints under normal load. Endpoints performing cross-platform sync, AI recommendations, or bulk export operations are excluded and operate on a best-effort basis with individual endpoint-level documentation.

---

## Payment Processing SLO

| Metric | Target |
|--------|--------|
| Payment success rate (Lightning invoices) | **99.5%** per month |
| Invoice creation latency (p95) | < 300ms |
| Payment confirmation latency (p95) | < 5 seconds |
| Webhook delivery (first attempt) | < 10 seconds after event |
| Webhook delivery (with retries, up to 5 attempts) | < 24 hours |

Payment success rate is calculated as `(successful_payments / total_payment_attempts) × 100`, excluding attempts where the user cancelled, the invoice expired, or the failure was caused by an out-of-scope third-party service (see Exclusions).

---

## Error Budget

| Period | Error Budget (downtime allowance) |
|--------|----------------------------------|
| Monthly | **0.1%** = 43.8 minutes |
| Weekly | 10.1 minutes |
| Daily | 1.44 minutes |

When the monthly error budget is exhausted, the engineering team shifts to reliability work and new feature deployments are paused until the budget is restored at the start of the next calendar month.

---

## Incident Response Times

Response times are measured from the moment an incident is declared internally or reported by a user, whichever comes first.

| Priority | Definition | Acknowledgment | Mitigation Target | Resolution Target |
|----------|-----------|----------------|-------------------|-------------------|
| **P0** | Complete service outage; payment processing down; data integrity risk | **15 minutes** | 1 hour | 4 hours |
| **P1** | Major feature unavailable; >10% error rate on any endpoint group; latency SLO breach | **1 hour** | 4 hours | 24 hours |
| **P2** | Degraded performance; non-critical feature outage; isolated errors | **4 hours** | 24 hours | 72 hours |
| **P3** | Minor bugs; cosmetic issues; non-impacting anomalies | Next business day | Next sprint | Best effort |

Incidents are declared and tracked publicly at [status.sovren.dev](https://status.sovren.dev) (when available). P0 and P1 incidents include a post-mortem within 5 business days of resolution.

---

## Scheduled Maintenance Windows

Planned maintenance that requires downtime is performed during the following windows:

| Window | UTC Time | Frequency |
|--------|----------|-----------|
| Primary maintenance | **Tuesdays 02:00–04:00 UTC** | As needed (not every week) |
| Emergency hotfix | Any time | Only for P0 security patches |

Maintenance events are announced at least **72 hours in advance** via the status page and, for paid subscribers, via email. Emergency hotfixes may be deployed without advance notice but will be communicated immediately on the status page.

Downtime during scheduled maintenance windows is excluded from uptime SLA calculations.

---

## Data Durability and Backup

| Guarantee | Detail |
|-----------|--------|
| Data durability | 99.999999999% (11 nines) via Supabase managed Postgres |
| Point-in-time recovery (PITR) | Enabled; recovery to any second within the retention window |
| Backup retention | **30 days** |
| Backup frequency | Continuous WAL archiving (near-real-time) |
| Cross-region replication | Enabled for production database |
| Recovery time objective (RTO) | < 1 hour for full database restoration |
| Recovery point objective (RPO) | < 60 seconds (WAL-based PITR) |

---

## Measurement and Reporting

- Uptime and latency metrics are collected via Prometheus and exposed on the internal observability dashboard
- Monthly SLO reports are generated automatically and reviewed by engineering leadership
- Public status history is available at [status.sovren.dev](https://status.sovren.dev)
- Users may request their personal service record by emailing support@sovren.dev

---

## Exclusions

The following conditions are excluded from all uptime and SLO calculations:

- **Scheduled maintenance windows** (see above)
- **Force majeure** — natural disasters, war, pandemic, government action, or other events outside Sovren's reasonable control
- **Third-party NOSTR relay outages** — Sovren publishes to multiple relays but does not operate or guarantee relay availability
- **Lightning Network node unavailability** — routing failures, liquidity shortfalls, or outages at third-party Lightning nodes used for payment routing
- **Supabase platform incidents** — degradation caused by Supabase infrastructure (tracked at status.supabase.com)
- **Vercel platform incidents** — frontend CDN or edge function degradation caused by Vercel (tracked at vercel-status.com)
- **Client-side issues** — failures caused by client network conditions, browser incompatibilities, or misconfigured API keys
- **Attacks** — DDoS, volumetric abuse, or other malicious traffic that exceeds normal operational capacity

---

## SLA Credits

Service credits are available to paid subscribers when the monthly uptime SLA of 99.9% is not met (excluding the exclusions listed above).

| Monthly Uptime Achieved | Credit |
|------------------------|--------|
| 99.0% – 99.9% | 10% of monthly fee |
| 95.0% – 99.0% | 25% of monthly fee |
| < 95.0% | 50% of monthly fee |

Credits must be requested within 30 days of the end of the affected month by emailing support@sovren.dev with the subject line `[SLA Credit Request] <month/year>`. Credits are applied to the next billing cycle and are not redeemable for cash.
