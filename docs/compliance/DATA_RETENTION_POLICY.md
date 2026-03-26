# Data Retention Policy

**Document owner:** Engineering / Compliance
**Effective date:** 2026-03-25
**Review cycle:** Annual (or on regulatory change)
**Last reviewed:** 2026-03-25

---

## 1. Purpose

This policy defines how long Sovren retains different categories of user and operational data, the legal basis for each retention period, and the deletion / anonymisation procedures applied when data reaches the end of its retention window. It is designed to satisfy:

- **GDPR** (Regulation EU 2016/679) — data minimisation and storage limitation principles
- **CCPA / CPRA** (California Consumer Privacy Act) — right to deletion
- **Financial record-keeping** obligations (IRS, EU VAT directives) for payment records
- **Sovren Terms of Service** and user consent agreements

---

## 2. Data Categories and Retention Periods

### 2.1 Content Analytics (IP / Location PII)

| Field | Table / Store | Retention | Basis |
|-------|--------------|-----------|-------|
| IP address | `content_analytics` | **90 days** | Legitimate interest (fraud detection, abuse prevention); GDPR Art. 6(1)(f) |
| Geolocation (country/region/city) | `content_analytics` | **90 days** | Same as above |
| User agent string | `content_analytics` | **90 days** | Same as above |
| Aggregated analytics (no PII) | `content_analytics_aggregated` | Indefinite | Statistical / business analytics; no personal data after aggregation |

**Deletion procedure:** A scheduled job runs nightly and hard-deletes rows in `content_analytics` where `created_at < NOW() - INTERVAL '90 days'`. Aggregated summaries (hourly/daily/monthly) are preserved permanently with PII stripped.

**Note:** Raw IP and geolocation are considered personal data under GDPR. After 90 days the data is no longer necessary for fraud detection and must be purged.

---

### 2.2 User Sessions

| Field | Table / Store | Retention | Basis |
|-------|--------------|-----------|-------|
| Session records (token hash, device info, activity log) | `sessions` / `user_sessions` | **30 days after expiry** | Security auditing, session replay investigation; GDPR Art. 6(1)(f) |
| Active sessions | `sessions` | Until explicitly revoked or TTL expires | Necessary for service delivery; GDPR Art. 6(1)(b) |

**Deletion procedure:** The `UnifiedSessionManager` / `DatabaseSessionManager` expiry TTL defaults to 7 days of inactivity. A background cleanup job (`POST /api/unified-sessions/cleanup`) hard-deletes expired sessions. Sessions are also deleted 30 days after their `expires_at` timestamp regardless of revocation status.

**IP addresses in session metadata** are subject to the 90-day PII retention window from §2.1.

---

### 2.3 Payment Records

| Field | Table / Store | Retention | Basis |
|-------|--------------|-----------|-------|
| Payment invoices, amounts, status, timestamps | `payments` | **7 years** | Financial compliance — IRS record-keeping (26 CFR 1.6001-1), EU VAT Directive (6 years + current year), UK HMRC (6 years) |
| Lightning payment hashes | `payments` | **7 years** | Same; required to prove settlement |
| Subscription billing records | `subscriptions` / `subscription_payments` | **7 years** | Same |
| Refund records | `refunds` | **7 years** | Same |
| Payer identity (user_id, nostr_pubkey) | `payments` | **7 years** | Same; anonymisation not permitted for financial records |

**Deletion procedure:** Payment records are NOT deleted. After 7 years, records may be archived to cold storage (object storage with object-lock) and removed from the primary database. Archived data is accessible only to finance/legal teams with formal request process.

**Important:** Payment records are exempt from GDPR right-to-erasure (Art. 17(3)(b) — legal obligation). Respond to erasure requests by confirming legal hold applies and providing a timeline for archive-stage deletion.

---

### 2.4 Audit Logs

Retention periods are configured in `AuditLogService` and differ by log category:

| Category | Retention | Configuration constant | Basis |
|----------|-----------|----------------------|-------|
| Security events (login, auth changes, permission escalations) | **365 days (1 year)** | `AUDIT_RETENTION_SECURITY` | Security incident investigation; regulatory compliance |
| Payment / financial events | **2555 days (~7 years)** | `AUDIT_RETENTION_FINANCIAL` | Financial record-keeping obligations (same as §2.3) |
| General operational events (content CRUD, profile updates) | **90 days** | `AUDIT_RETENTION_OPERATIONAL` | Debugging, dispute resolution; GDPR data minimisation |

**Deletion procedure:** `AuditLogService` runs a nightly cleanup job that deletes audit log rows where `created_at < NOW() - retention_period` for each category. Financial audit logs are archived (not deleted) at the 7-year mark consistent with §2.3.

---

## 3. User-Initiated Deletion (Right to Erasure)

Under GDPR Art. 17 and CCPA § 1798.105, users may request deletion of their personal data. Sovren responds as follows:

| Data type | Action on erasure request |
|-----------|--------------------------|
| Profile data (display_name, bio, avatar) | Immediate deletion / anonymisation |
| Content | Soft-delete within 72 hours; hard-delete from storage within 30 days |
| Session data | Immediate revocation + deletion |
| Analytics PII (IP/location) | Deleted immediately, ahead of the 90-day schedule |
| Wellness data | Immediate deletion via `DELETE /api/v2/wellness/data` |
| Payment records | **Retained under legal hold** — user notified of financial record-keeping obligation |
| Audit logs (security + financial) | Retained under legal hold; operational logs deleted immediately |

**Process:** Users submit a deletion request via account settings or `api@sovren.app`. The request is actioned within **30 days** (GDPR) / **45 days** (CCPA). A confirmation email is sent upon completion.

---

## 4. Data Residency

All primary data is stored in the Supabase-hosted PostgreSQL instance. The selected region must comply with data residency requirements for the user base (EU users → EU region). Verify in Supabase project settings before expanding to new regions.

---

## 5. Implementation References

| Component | File / Service |
|-----------|---------------|
| Session cleanup | `packages/backend/src/services/DatabaseSessionManager.ts` |
| Audit log retention config | `packages/backend/src/services/AuditLogService.ts` |
| Analytics PII purge | Nightly cron job (see `packages/backend/src/jobs/`) |
| Payment record archival | Planned — finance team to coordinate |
| User erasure endpoint | `DELETE /api/v2/wellness/data`, user account delete flow |

---

## 6. Policy Violations

Violations of this retention policy (e.g., retaining data beyond the defined window or deleting data subject to legal hold) must be reported to the Data Protection Officer (DPO) within 24 hours. Potential data breaches arising from over-retention must be assessed under GDPR Art. 33 (72-hour supervisory authority notification window).

---

## 7. Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-03-25 | Initial policy creation | Engineering / Compliance |
