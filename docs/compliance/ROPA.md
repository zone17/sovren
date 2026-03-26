# Record of Processing Activities (ROPA)

**Organization**: Sovren Platform
**Last Updated**: 2026-03-26
**Regulation**: GDPR Art. 30 / equivalent data protection frameworks

This document records all personal data processing activities carried out by Sovren. It is maintained as required by data protection law and reviewed quarterly.

---

## Processing Activities

| # | Activity | Data Categories | Purpose | Legal Basis | Retention Period | Third-Party Processors |
|---|----------|----------------|---------|-------------|-----------------|------------------------|
| 1 | User Account Registration | Name, email address, NOSTR public key, username | Create and manage user accounts; enable authentication | Contractual necessity (Art. 6(1)(b)) | Duration of account + 30 days after deletion | Supabase (Auth & DB) |
| 2 | Payment Processing | Bitcoin transaction hashes, Lightning invoice data, amount, payer/recipient identifiers | Process creator payments and tips via Lightning Network | Contractual necessity (Art. 6(1)(b)) | 7 years (financial records regulatory requirement) | Supabase (DB), LND / Voltage Cloud (Lightning routing) |
| 3 | Content Publication | Content text, media URLs, creator identifier, publication timestamp | Host and distribute creator content on the platform | Contractual necessity (Art. 6(1)(b)) | Duration of account; archived content 90 days after deletion request | Supabase (DB), Vercel (CDN/hosting) |
| 4 | Analytics & Usage Tracking | User behavior events (page views, content interactions), session data, IP address (hashed) | Improve platform performance and content recommendations | Legitimate interest (Art. 6(1)(f)) — balanced against user rights | 90 days rolling; aggregated stats kept indefinitely | Supabase (DB) |
| 5 | Session Management | Session token hash, device fingerprint, IP address, user agent string | Maintain authenticated sessions; detect anomalous access | Contractual necessity (Art. 6(1)(b)) | Active sessions + 24 hours; expired sessions 30 days | Supabase (DB), Redis (session store) |
| 6 | NOSTR Identity Verification (NIP-05) | NOSTR public key, NIP-05 identifier, domain, verification timestamp | Verify creator identity on the NOSTR protocol | Contractual necessity (Art. 6(1)(b)) | Duration of account | Supabase (DB), public NOSTR relays |
| 7 | Subscription Management | Subscriber identifier, creator identifier, tier, payment schedule, subscription status | Manage recurring creator subscriptions | Contractual necessity (Art. 6(1)(b)) | Duration of subscription + 7 years (financial records) | Supabase (DB) |
| 8 | Creator Analytics Dashboard | Aggregated content views, follower counts, revenue totals, engagement rates | Provide creators with performance insights | Contractual necessity (Art. 6(1)(b)) | Aggregated — retained indefinitely; raw events 90 days | Supabase (DB) |
| 9 | Webhook Event Logging | Payment hash, event type, source IP, processing timestamps, payload | Idempotent processing of Lightning payment events; audit trail | Legitimate interest (Art. 6(1)(f)) — security and fraud prevention | 90 days | Supabase (DB) |
| 10 | Social Graph (Followers/Comments) | Follower/following identifiers, comment text, content identifiers | Enable creator-audience relationships and content discussion | Contractual necessity (Art. 6(1)(b)) | Duration of account; deleted comments anonymized within 30 days | Supabase (DB) |
| 11 | Cross-Platform Distribution | Platform usernames, OAuth access tokens (encrypted), platform post identifiers | Publish creator content to external platforms (Mastodon, Bluesky, etc.) | Explicit consent (Art. 6(1)(a)) — user initiates OAuth connection | OAuth tokens: refreshed continuously or revoked on disconnect; post metadata: duration of account | Mastodon instances, Bluesky (AT Protocol), Twitter/X API, YouTube API |
| 12 | Business Invoicing | Client names, invoice amounts, Lightning payment links, due dates | Enable creators to invoice clients directly | Contractual necessity (Art. 6(1)(b)) | 7 years (financial records) | Supabase (DB) |
| 13 | Expense & Revenue Tracking | Expense descriptions, amounts, BTC/USD conversion rates, categories | Assist creators with financial management | Contractual necessity (Art. 6(1)(b)) | 7 years (financial records) | Supabase (DB), external BTC/USD rate providers |
| 14 | Marketplace Service Orders | Buyer/seller identifiers, service descriptions, escrow amounts, order status | Facilitate creator marketplace transactions | Contractual necessity (Art. 6(1)(b)) | Duration of dispute window (30 days) + 7 years (financial records) | Supabase (DB) |
| 15 | Error Logging & Monitoring | Request paths, correlation IDs, error messages, stack traces (no PII in traces by policy) | Diagnose and resolve platform errors | Legitimate interest (Art. 6(1)(f)) | 30 days rolling | Prometheus / Grafana (self-hosted or managed) |

---

## Third-Party Processor Register

| Processor | Role | Data Transferred | DPA / Adequacy | Location |
|-----------|------|-----------------|----------------|----------|
| Supabase | Database, Auth, Storage | All personal data categories | SCCs / DPA in place | EU (default), configurable |
| Vercel | Frontend hosting, CDN | IP addresses, request logs | SCCs / DPA in place | USA + Global CDN |
| Voltage Cloud | Lightning Network node hosting | Lightning invoice/payment data | DPA reviewed | USA |
| Public NOSTR Relays | Decentralized message propagation | NOSTR public keys, event content | No DPA — public protocol by design; no PII should be published | Global / decentralized |
| Prometheus / Grafana | Metrics collection and alerting | Anonymized request metrics, no PII | Self-hosted (no transfer) | Same infrastructure as backend |
| External BTC/USD Rate Providers | Currency conversion | No personal data — rate queries only | N/A | Various |

---

## Data Subject Rights

Users may exercise the following rights by contacting privacy@sovren.dev:

| Right | How Fulfilled | SLA |
|-------|--------------|-----|
| Access (Art. 15) | Export all personal data via account settings or manual request | 30 days |
| Rectification (Art. 16) | Update profile data via account settings | Immediate |
| Erasure (Art. 17) | Account deletion removes personal data subject to retention requirements | 30 days |
| Portability (Art. 20) | Data export in JSON format available via account settings | 30 days |
| Objection to legitimate interest processing (Art. 21) | Opt-out of analytics tracking available in privacy settings | Immediate |
| Withdraw consent (Art. 7(3)) | Revoke OAuth platform connections via platform settings | Immediate |

---

## Retention Summary

| Category | Retention Period | Basis |
|----------|-----------------|-------|
| Financial records (payments, invoices, expenses) | 7 years | Legal obligation (tax/accounting law) |
| Active account data | Duration of account | Contractual necessity |
| Deleted account personal data | 30 days post-deletion (then purged) | Erasure right compliance |
| Analytics / behavioral events | 90 days rolling | Legitimate interest — minimized |
| Session data | 30 days post-expiry | Fraud detection |
| Error logs | 30 days rolling | Operational necessity |
| Aggregated statistics | Indefinite | No PII — anonymized |

---

## Review Schedule

This ROPA is reviewed:
- Quarterly by the data protection lead
- Immediately upon introduction of a new data processing activity
- Upon any change to third-party processors

**Next review date**: 2026-06-26
