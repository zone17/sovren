# Security Review: Sovren v2.0 Creator Empowerment Platform

**Reviewer**: Security Auditor Agent
**Date**: 2026-02-12
**Scope**: P1 Pre-Requisite Validation, PRD v2.0 Security Review, New Attack Surface Analysis
**Status**: NEEDS REMEDIATION FIRST

---

## Executive Summary

This review validates the four P1 security pre-requisites identified in the epic decomposition, assesses the PRD v2.0 Section 8.4 security measures, and analyzes new attack surfaces introduced by the six v2.0 feature domains. The codebase was scanned using static analysis pattern matching against OWASP Top 10 (2021) and CWE Top 25 categories.

**Overall Security Readiness for v2.0: YELLOW (Needs Remediation First)**

| Category                 | Findings     |
| ------------------------ | ------------ |
| Critical Vulnerabilities | 2 confirmed  |
| High Vulnerabilities     | 2 confirmed  |
| Medium Vulnerabilities   | 3 identified |
| Low Vulnerabilities      | 2 identified |
| PRD Security Gaps        | 4 identified |
| New Attack Surface Risks | 8 identified |

**Verdict: NEEDS REMEDIATION FIRST** -- The 2 critical and 2 high severity issues must be resolved before any v2.0 epic work begins. The medium/low issues can be addressed in parallel with v2.0 development.

---

## 1. Pre-Requisite Validation

### PREREQ-1: SQL Injection in Lightning Payment Routes

| Field                    | Value                                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Confirmed**            | YES                                                                                                                                       |
| **Severity**             | CRITICAL (CVSS 9.1)                                                                                                                       |
| **CWE**                  | CWE-89: Improper Neutralization of Special Elements used in an SQL Command                                                                |
| **OWASP**                | A03:2021 - Injection                                                                                                                      |
| **Affected File**        | `/Users/fp/Desktop/Sovren/packages/backend/src/services/lightning-payment-service.ts`                                                     |
| **Affected Line**        | Line 719                                                                                                                                  |
| **Scoping Accuracy**     | PARTIALLY CORRECT -- The decomposition says "backend/routes/lightning" but the vulnerability is in the service layer, not the route layer |
| **Estimated Fix Effort** | 2-3 hours                                                                                                                                 |

**Evidence:**

```typescript
// lightning-payment-service.ts:719
metadata: metadata
  ? supabase.raw(`metadata || '${JSON.stringify(metadata)}'::jsonb`)
  : undefined,
```

This line uses string interpolation inside a `supabase.raw()` call to build a JSONB concatenation query. The `metadata` parameter comes from user-provided input. An attacker could craft a metadata object with carefully constructed values that break out of the JSON string context and inject arbitrary SQL.

**Attack Vector**: An authenticated user sends a payment status update with a crafted `metadata` field containing SQL injection payload. Since `JSON.stringify()` does not escape SQL, payloads like `'); DROP TABLE lightning_invoices; --` embedded in object values could execute arbitrary SQL.

**Note**: The main `lightning.ts` route file uses Zod validation and parameterized queries correctly. The `lightning-receipts.ts` route file also uses Zod validation properly. The vulnerability is specifically in the service-layer `updatePaymentStatus` method.

**Additional SQL Concern**: Line 351 of the same file uses `supabase.raw('priority + 1')` which is a static string and NOT vulnerable. However, the pattern of using `supabase.raw()` across the codebase (found in `subscription-management-service.ts:429,483`, `nip05-verification-service.ts:511`, `transaction-history-service.ts:655`) should be audited for dynamic input injection.

**Recommended Fix**: Replace the raw SQL string interpolation with parameterized JSONB operations:

```typescript
// BEFORE (vulnerable):
metadata: metadata
  ? supabase.raw(`metadata || '${JSON.stringify(metadata)}'::jsonb`)
  : undefined,

// AFTER (safe):
metadata: metadata
  ? supabase.raw(`metadata || ?::jsonb`, [JSON.stringify(metadata)])
  : undefined,
```

---

### PREREQ-2: Hardcoded Crypto Keys in Vault Handling

| Field                    | Value                                                                                                                                                                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Confirmed**            | YES (with modified scoping)                                                                                                                                                                                                                                                            |
| **Severity**             | CRITICAL (CVSS 9.4)                                                                                                                                                                                                                                                                    |
| **CWE**                  | CWE-798: Use of Hard-coded Credentials; CWE-312: Cleartext Storage of Sensitive Information                                                                                                                                                                                            |
| **OWASP**                | A02:2021 - Cryptographic Failures                                                                                                                                                                                                                                                      |
| **Affected Files**       | `/Users/fp/Desktop/Sovren/packages/backend/src/services/content/ContentPublishingService.ts` (lines 757-777), `/Users/fp/Desktop/Sovren/packages/backend/src/services/enhanced-nostr-auth.ts` (line 136)                                                                               |
| **Scoping Accuracy**     | INCORRECT -- There is no "vault service" in the codebase. The decomposition references "backend/services/vault" which does not exist. The actual issues are in ContentPublishingService (unencrypted private key storage) and EnhancedNostrAuthService (auto-generated encryption key) |
| **Estimated Fix Effort** | 4-6 hours                                                                                                                                                                                                                                                                              |

**Evidence -- Issue A: NOSTR Private Keys Stored Unencrypted in Database**

```typescript
// ContentPublishingService.ts:757-770
private async getNostrKeys(authorId: string): Promise<...> {
    const result = await this.db.query<any>(
      `SELECT nostr_public_key, nostr_private_key, nostr_relays
       FROM users WHERE id = $1`,
      [authorId]
    );
    // ...
    return {
      publicKey: row.nostr_public_key,
      privateKey: row.nostr_private_key,  // <-- Plaintext private key from DB
      relays: row.nostr_relays ? JSON.parse(row.nostr_relays) : undefined,
    };
}
```

The database schema stores NOSTR private keys as plaintext `VARCHAR(255)`:

```sql
-- From US-E5-012-COMPLETION-SUMMARY.md:263
ALTER TABLE users ADD COLUMN IF NOT EXISTS nostr_private_key VARCHAR(255);
```

NOSTR private keys (`nsec`) are the equivalent of a user's cryptographic identity. Storing them in plaintext means any database breach, SQL injection, or admin access leak exposes all user identities. This is the most severe finding in the audit.

**Evidence -- Issue B: Auto-generated Encryption Key (Not Persisted)**

```typescript
// enhanced-nostr-auth.ts:136
encryptionKey: config.encryptionKey || this.generateEncryptionKey(),
```

If no `encryptionKey` is provided in configuration, the service generates a random 32-byte key at runtime. This key is stored only in memory and lost on restart, meaning any encrypted sessions become unrecoverable. While the `SecretsService` (`/Users/fp/Desktop/Sovren/packages/backend/src/services/SecretsService.ts`) properly integrates with AWS Secrets Manager, the `EnhancedNostrAuthService` does not use it.

**Note**: The `SecretsService` itself is well-implemented with proper AWS Secrets Manager integration, caching, and environment fallbacks. The problem is that not all services use it.

**Recommended Fix**:

1. Encrypt NOSTR private keys at rest using AES-256-GCM with a key managed through `SecretsService`
2. Add a migration to encrypt existing plaintext keys in the `users` table
3. Wire `EnhancedNostrAuthService` to use `SecretsService` for its encryption key
4. Consider moving NOSTR private keys to a dedicated `user_keys` table with column-level encryption

---

### PREREQ-3: XSS Vulnerability in Markdown/RichText Editors

| Field                    | Value                                                                                                                                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Confirmed**            | YES                                                                                                                                                                                                                   |
| **Severity**             | HIGH (CVSS 7.5)                                                                                                                                                                                                       |
| **CWE**                  | CWE-79: Improper Neutralization of Input During Web Page Generation (XSS)                                                                                                                                             |
| **OWASP**                | A03:2021 - Injection                                                                                                                                                                                                  |
| **Affected Files**       | `/Users/fp/Desktop/Sovren/packages/frontend/src/features/content/components/MarkdownEditor.tsx` (line 540), `/Users/fp/Desktop/Sovren/packages/frontend/src/features/content/components/RichTextEditor.tsx` (line 88) |
| **Scoping Accuracy**     | CORRECT -- The decomposition accurately identified "frontend/features/content"                                                                                                                                        |
| **Estimated Fix Effort** | 3-4 hours                                                                                                                                                                                                             |

**Evidence -- MarkdownEditor.tsx (Stored XSS via Markdown Preview)**

```tsx
// MarkdownEditor.tsx:540
dangerouslySetInnerHTML={{ __html: convertMarkdownToHTML(markdown) }}
```

The `convertMarkdownToHTML` function (lines 303-353) performs regex-based Markdown-to-HTML conversion with **zero sanitization**. It directly converts user input to HTML and injects it into the DOM. Attack vectors include:

- Image tags: `![](javascript:alert(1))` -- the regex on line 336 creates `<img src="$2" alt="$1" />` without URL validation
- Link tags: `[click](javascript:void(document.cookie))` -- the regex on line 330 creates anchor tags without protocol validation
- Raw HTML injection: Since the markdown text is processed by regex substitution, any HTML tags not caught by the regexes pass through to the DOM unchanged. For example, `<script>alert('xss')</script>` that does not match any markdown pattern will be rendered as-is via `dangerouslySetInnerHTML`.

**Evidence -- RichTextEditor.tsx (Direct innerHTML Assignment)**

```tsx
// RichTextEditor.tsx:88
editorRef.current.innerHTML = content;
```

The `content` prop is directly assigned to `innerHTML` without any sanitization. If content comes from a database that was populated with malicious input (stored XSS), it executes in any user's browser who views it.

**Note**: The codebase does have a `ContentTransformationService` (`/Users/fp/Desktop/Sovren/packages/frontend/src/features/content/services/ContentTransformationService.ts`) with a `sanitize()` method (line 202), but this service is NOT used by either editor component. The sanitization is only applied during content import/export, not during rendering.

**Recommended Fix**:

1. Add DOMPurify (or a similar HTML sanitizer library) as a dependency
2. In `MarkdownEditor.tsx`, sanitize the output of `convertMarkdownToHTML()` before passing to `dangerouslySetInnerHTML`
3. In `RichTextEditor.tsx`, sanitize `content` before assigning to `innerHTML`
4. Consider switching to a purpose-built Markdown renderer (e.g., react-markdown + rehype-sanitize) instead of the custom regex-based approach

---

### PREREQ-4: Missing DI Controller Registration

| Field                    | Value                                                                                                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Confirmed**            | YES                                                                                                                                                                                      |
| **Severity**             | HIGH (CVSS 7.0)                                                                                                                                                                          |
| **CWE**                  | CWE-284: Improper Access Control (architectural issue leading to potential bypasses)                                                                                                     |
| **OWASP**                | A04:2021 - Insecure Design                                                                                                                                                               |
| **Affected Files**       | `/Users/fp/Desktop/Sovren/packages/backend/src/container/types.ts` (lines 124-126), `/Users/fp/Desktop/Sovren/packages/backend/src/container/bindings/*.bindings.ts` (all binding files) |
| **Scoping Accuracy**     | CORRECT -- The decomposition accurately identified "backend/controllers"                                                                                                                 |
| **Estimated Fix Effort** | 2-3 hours                                                                                                                                                                                |

**Evidence:**

Three controllers are declared in the DI type registry:

```typescript
// types.ts:124-126
ContentController: new ServiceToken<any>('ContentController', 'Content API controller'),
UserController: new ServiceToken<any>('UserController', 'User API controller'),
PaymentController: new ServiceToken<any>('PaymentController', 'Payment API controller'),
```

Controller implementation files exist:

- `/Users/fp/Desktop/Sovren/packages/backend/src/controllers/content/ContentController.ts`
- `/Users/fp/Desktop/Sovren/packages/backend/src/controllers/payment/PaymentController.ts`
- `/Users/fp/Desktop/Sovren/packages/backend/src/controllers/user/UserController.ts`

However, **none of the four binding modules** register these controllers:

- `content.bindings.ts` -- registers 7 content services, 0 controllers
- `user.bindings.ts` -- registers 5 user services, 0 controllers
- `payment.bindings.ts` -- registers 7 payment services, 0 controllers
- `shared.bindings.ts` -- registers 4 shared services, 0 controllers

The v1 route files (`routes/v1/*.routes.ts`) reference `ContentController`, `UserController`, and `PaymentController` from the container. At runtime, any attempt to resolve these controllers from the DI container will throw:

```
DI container not initialized. Call initializeContainer() before resolving services.
```

This means **all v1 controller-based routes are broken**. The existing route files in `routes/` (non-v1) work because they directly import services instead of going through the DI container. Adding new v2.0 routes through the DI container will fail until this is fixed.

**Recommended Fix**:

1. Create a `controller.bindings.ts` file that registers all three controllers
2. Wire each controller to its service dependencies via the DI container
3. Add integration tests that verify controller resolution

---

## 2. PRD Section 8.4 Security Review

### 2.1 OAuth Token Encryption: AES-256

**PRD Claim**: "Platform tokens encrypted at rest: OAuth tokens for connected platforms stored with AES-256 encryption in Supabase with RLS."

**Assessment: ADEQUATE with caveats**

AES-256 is the correct algorithm choice for OAuth token encryption at rest. However, the PRD lacks important implementation details:

- **Key management**: Where does the AES-256 encryption key live? It must NOT be in the same database. The existing `SecretsService` with AWS Secrets Manager integration is the correct home. The PRD should mandate this.
- **Encryption mode**: AES-256 alone is insufficient. The PRD should specify AES-256-GCM (authenticated encryption) to prevent ciphertext manipulation.
- **Key rotation**: No mention of key rotation strategy. OAuth tokens may be long-lived (refresh tokens). A key rotation policy is needed.
- **Token refresh**: The decomposition (US-E9-002) mentions "Token refresh scheduler" but doesn't address what happens if the encryption key is rotated -- old tokens need re-encryption.

**Recommendation**: Add to PRD:

- Mandate AES-256-GCM (not just AES-256)
- Specify encryption key stored in AWS Secrets Manager via existing SecretsService
- Define key rotation policy (quarterly recommended)
- Require re-encryption migration on key rotation

### 2.2 Wellness Data Privacy

**PRD Claim**: "Wellness data is sacred: All wellness pulse data stays with the creator. Never used for platform analytics, advertising, or shared with third parties."

**Assessment: ADEQUATE but needs enforcement mechanism**

The intent is correct. The decomposition (US-E7-001) correctly specifies RLS policies. However:

- **No mention of encryption at rest** for wellness data. Burnout scores and mental health indicators are sensitive health data that may fall under health data regulations in some jurisdictions.
- **No data retention policy** specified. "Creator can delete all wellness data at any time" is good, but what about backups? How long do database backups retain wellness data after deletion?
- **Anonymous benchmarking** (US-E7-007) creates a privacy risk: if circle sizes are small, aggregate stats could de-anonymize individual creators. The PRD should specify minimum anonymity set sizes (k-anonymity >= 20).

**Recommendation**: Add to PRD:

- Encrypt wellness data columns at rest
- Define data retention and backup purge policies
- Specify k-anonymity minimum for benchmark aggregations

### 2.3 Non-Custodial Emergency Fund Model

**PRD Claim**: "Emergency fund is non-custodial: Sovren tracks allocation amounts but funds stay in creator's Lightning wallet. Sovren never holds creator funds."

**Assessment: SOUND design, but trust model needs clarification**

The non-custodial model is the correct approach for a Lightning-native platform. However:

- **Data integrity risk**: Since Sovren only tracks allocations (not actual wallet balances), a creator's displayed "emergency fund balance" could diverge from reality. The PRD's open question #4 ("Honor system or wallet integration?") is critical and should be resolved before implementation.
- **No wallet verification**: Without read-only wallet access (e.g., a view-only Lightning wallet API), Sovren has no way to verify the fund balance is real. This is acceptable for MVP but should be documented as a known limitation.
- **Withdrawal tracking**: The "withdraw" endpoint (`POST /api/v2/income/emergency-fund/withdraw`) only records a tracking event. A user could "withdraw" without actually moving funds, or move funds without recording a withdrawal.

**Recommendation**:

- Resolve open question #4 in the PRD before EPIC-012 begins
- Document the trust model explicitly: "Sovren provides planning tools, not financial guarantees"
- Consider optional wallet balance verification via WebLN or LNURL-balance

### 2.4 Missing Security Measures in PRD

The following security considerations are absent from Section 8.4:

**GAP 1: NOSTR Group Encryption for Creator Circles (EPIC-010)**
The PRD mentions "NOSTR encrypted group messages" for Creator Circles but provides no detail on the encryption scheme. NIP-44 (encrypted payloads) covers 1:1 DMs but group encryption is not standardized. This needs an architectural decision.

**GAP 2: Content Fingerprint Timing Attacks (EPIC-008)**
The PRD states "Content fingerprints are public: Hashes are non-reversible." While perceptual hashes (pHash) are not reversible, the timing of fingerprint publication could reveal content scheduling patterns. If a fingerprint appears before the content is published, it confirms upcoming content.

**GAP 3: Cross-Platform API Key Scope Minimization (EPIC-009)**
The PRD specifies OAuth connections to X, YouTube, Bluesky, Mastodon but does not specify minimum required scopes. Over-permissioned API tokens are a common vulnerability. Each platform adapter should request only the scopes needed for cross-posting and analytics.

**GAP 4: Contract/Invoice Data Encryption (EPIC-011)**
The PRD says "Contract data is private: Contracts and invoices encrypted and accessible only to involved parties" but the epic decomposition makes no mention of encryption in US-E11-001 through US-E11-007. The data model creates tables with plaintext columns.

---

## 3. New Attack Surface Analysis

### 3.1 EPIC-007: Creator Wellness System

| Risk                     | Description                                                                                                                               | OWASP                          | Severity |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | -------- |
| **Health data exposure** | Wellness scores, burnout risk, work patterns are sensitive health-adjacent data. A data breach would expose creator mental health status. | A01:2021 Broken Access Control | Medium   |
| **Boundary bypass**      | DND/focus hours could be bypassed via direct NOSTR DM relay access (not routed through Sovren API)                                        | A04:2021 Insecure Design       | Low      |

**Required Controls Beyond PRD**:

- Column-level encryption for pulse check-in data (energy, motivation, stress scores)
- Audit logging for all wellness data access
- Rate limiting on wellness API to prevent profiling attacks

### 3.2 EPIC-008: Content Shield (AI Protection)

| Risk                      | Description                                                                            | OWASP                                     | Severity |
| ------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------- | -------- |
| **DMCA report abuse**     | One-click DMCA report generation could be weaponized for false takedown requests       | A04:2021 Insecure Design                  | Medium   |
| **Fingerprint poisoning** | An attacker could register fingerprints for content they don't own, claiming prior art | A08:2021 Software/Data Integrity Failures | Medium   |

**Required Controls Beyond PRD**:

- Verify content ownership before fingerprint registration (check NOSTR event authorship)
- Rate limit DMCA report generation
- Add cooldown period and human review for disputed provenance claims

### 3.3 EPIC-009: Multi-Platform Hub

| Risk                           | Description                                                                                                                            | OWASP                              | Severity                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------- |
| **OAuth token theft**          | Encrypted tokens in database are a high-value target. SQL injection (PREREQ-1) combined with unencrypted storage would be catastrophic | A02:2021 Cryptographic Failures    | Critical (if PREREQ-1 not fixed) |
| **CSRF on OAuth callback**     | OAuth callback endpoints must validate state parameter to prevent CSRF                                                                 | A01:2021 Broken Access Control     | High                             |
| **Token leakage in logs**      | Platform API errors often include tokens in error responses; these must not be logged                                                  | A09:2021 Security Logging Failures | Medium                           |
| **SSRF via platform adapters** | Platform URLs should be validated to prevent SSRF through cross-posting                                                                | A10:2021 SSRF                      | Medium                           |

**Required Controls Beyond PRD**:

- Mandatory OAuth state parameter validation (specified in US-E9-006 security audit items)
- Structured logging that redacts token values
- URL validation allowlist for platform API endpoints
- Token encryption at field level (not just RLS row-level)
- Implement token expiry monitoring and automatic disconnection on repeated refresh failures

### 3.4 EPIC-010: Creator Network

| Risk                               | Description                                                                              | OWASP                                     | Severity |
| ---------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------- | -------- |
| **Lightning escrow abuse**         | Marketplace escrow could be exploited if dispute resolution is not robust                | A04:2021 Insecure Design                  | Medium   |
| **Revenue split manipulation**     | Co-author revenue splits must be immutable after publication to prevent post-hoc changes | A08:2021 Software/Data Integrity Failures | High     |
| **NOSTR group message encryption** | No standardized NIP for group encryption; custom implementation could be flawed          | A02:2021 Cryptographic Failures           | Medium   |

**Required Controls Beyond PRD**:

- Revenue split percentages locked after first payment received
- Escrow timeout with automatic refund (prevent indefinite fund hold)
- Group encryption ADR before implementation
- Maximum circle size enforcement to prevent relay spam

### 3.5 EPIC-011: Business Manager

| Risk                               | Description                                                                              | OWASP                                 | Severity |
| ---------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------- | -------- |
| **Contract data exfiltration**     | Contracts contain sensitive business terms; must be encrypted not just access-controlled | A02:2021 Cryptographic Failures       | Medium   |
| **Invoice payment link hijacking** | Lightning payment links embedded in invoices could be intercepted or replaced            | A07:2021 Identification/Auth Failures | Medium   |

**Required Controls Beyond PRD**:

- End-to-end encryption for contract text (not just RLS)
- Invoice payment links should include HMAC verification
- Rate limit contract analysis endpoint (could be used to probe AI model)
- Tax export must sanitize data to prevent CSV injection

### 3.6 EPIC-012: Income Stabilizer

| Risk                                 | Description                                                                                | OWASP                          | Severity |
| ------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------ | -------- |
| **Forecast data manipulation**       | If subscriber health scores are accessible, they could reveal subscriber behavior patterns | A01:2021 Broken Access Control | Low      |
| **Emergency fund tracking accuracy** | Non-custodial model means tracking can diverge from reality                                | A04:2021 Insecure Design       | Low      |

**Required Controls Beyond PRD**:

- Subscriber health data accessible only to the creator (not to subscribers)
- Forecast confidence intervals should be validated to prevent misleading financial decisions
- Clear disclaimers that emergency fund tracking is informational, not financial advice

---

## 4. Security Pre-Req Execution Plan

### Recommended Fix Order

| Order | Issue                                         | Severity | Blocks                         | Estimated Effort | Approach                                                                                                   |
| ----- | --------------------------------------------- | -------- | ------------------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------- |
| 1     | SQL Injection in Lightning Service (PREREQ-1) | CRITICAL | EPIC-012, all payment features | 2-3 hours        | Parameterize `supabase.raw()` calls; audit all `supabase.raw()` usage across codebase                      |
| 2     | Unencrypted NOSTR Private Keys (PREREQ-2)     | CRITICAL | EPIC-008, EPIC-011             | 4-6 hours        | Add AES-256-GCM encryption layer for private keys; migration to encrypt existing keys; wire SecretsService |
| 3     | XSS in Editors (PREREQ-3)                     | HIGH     | EPIC-009                       | 3-4 hours        | Add DOMPurify; sanitize all dangerouslySetInnerHTML and innerHTML assignments                              |
| 4     | DI Controller Registration (PREREQ-4)         | HIGH     | All new v2 routes              | 2-3 hours        | Create controller bindings module; integration tests                                                       |

**Total Estimated Effort**: 11-16 hours (1.5-2 developer days)

### Implementation Recommendations

**PREREQ-1 (SQL Injection)**:

1. Fix the direct vulnerability at `lightning-payment-service.ts:719`
2. Run a codebase-wide audit of all `supabase.raw()` calls (found 6 instances)
3. Also audit `transaction-history-service.ts:655` which uses `supabase.raw()` with dynamic input
4. Add a lint rule to flag `supabase.raw()` usage for security review

**PREREQ-2 (Crypto Keys)**:

1. Create an encryption utility module that wraps AES-256-GCM with key from SecretsService
2. Add `encrypted_nostr_private_key` column to users table
3. Create migration: encrypt all existing `nostr_private_key` values, clear plaintext column
4. Update `ContentPublishingService.getNostrKeys()` to decrypt
5. Wire `EnhancedNostrAuthService` to use SecretsService for encryption key

**PREREQ-3 (XSS)**:

1. `npm install dompurify @types/dompurify`
2. Create sanitization wrapper: `sanitizeHTML(html: string): string`
3. Apply to `MarkdownEditor.tsx:540` and `RichTextEditor.tsx:88`
4. Audit all other uses of `dangerouslySetInnerHTML` (found in `SovereignOnboarding.tsx:1310` -- static CSS, acceptable)
5. Consider replacing custom markdown regex with `react-markdown` + `rehype-sanitize`

**PREREQ-4 (DI Registration)**:

1. Create `controller.bindings.ts` in `/packages/backend/src/container/bindings/`
2. Register `ContentController`, `UserController`, `PaymentController` with scoped lifetime
3. Wire dependencies from existing service bindings
4. Add integration test: resolve each controller from container

---

## 5. Risk Rating

### Overall Security Readiness: YELLOW

```
+-------------------+--------+------------------------------------------+
| Area              | Rating | Notes                                    |
+-------------------+--------+------------------------------------------+
| Authentication    | GREEN  | NOSTR auth well-implemented; Zod         |
|                   |        | validation on most routes                |
+-------------------+--------+------------------------------------------+
| Data Protection   | RED    | Private keys in plaintext; SQL injection  |
|                   |        | in payment service                       |
+-------------------+--------+------------------------------------------+
| Input Validation  | YELLOW | Zod used in most routes; XSS in editors; |
|                   |        | missing sanitization in frontend         |
+-------------------+--------+------------------------------------------+
| DI Architecture   | YELLOW | Services registered; controllers missing; |
|                   |        | blocks v2 route registration             |
+-------------------+--------+------------------------------------------+
| Secrets Mgmt      | GREEN  | SecretsService with AWS Secrets Manager   |
|                   |        | is well-designed; needs wider adoption    |
+-------------------+--------+------------------------------------------+
| PRD Security      | YELLOW | Core measures adequate; missing 4 gaps;   |
|                   |        | needs encryption details                 |
+-------------------+--------+------------------------------------------+
| v2 Attack Surface | YELLOW | 8 new risks identified; most mitigable   |
|                   |        | with standard controls                   |
+-------------------+--------+------------------------------------------+
```

### Final Verdict: NEEDS REMEDIATION FIRST

The two CRITICAL issues (SQL injection, plaintext private keys) and two HIGH issues (XSS, missing DI registration) must be resolved before v2.0 development begins. The estimated effort is 1.5-2 developer days.

The PRD v2.0 security measures are directionally correct but need more specificity on encryption algorithms, key management, and data privacy enforcement. Four security gaps were identified that should be added to the PRD before the corresponding epics begin.

The existing `SecretsService` infrastructure is solid and should be the foundation for all v2.0 encryption needs (OAuth tokens, contract data, wellness data).

### Positive Findings

Despite the issues above, several security patterns in the codebase are well-implemented:

1. **Zod validation** is used consistently across Lightning receipt routes and most API endpoints
2. **Rate limiting** is properly configured on the receipt routes (`express-rate-limit`)
3. **SecretsService** with AWS Secrets Manager integration, caching, and environment fallbacks is production-grade
4. **RLS policies** are specified in the epic decomposition for all new tables
5. **Authentication middleware** is consistently applied to all Lightning routes
6. **Content sanitization service** exists (just not wired to the editor components)
7. **Security headers middleware** exists at `/Users/fp/Desktop/Sovren/packages/backend/src/middleware/security-headers.ts`

---

## Appendix: Files Reviewed

| File                                                                   | Purpose                | Findings                                           |
| ---------------------------------------------------------------------- | ---------------------- | -------------------------------------------------- |
| `packages/backend/src/routes/lightning.ts`                             | Lightning API routes   | CLEAN - Uses auth middleware, Zod validation       |
| `packages/backend/src/routes/lightning-receipts.ts`                    | Receipt API routes     | CLEAN - Zod validation, rate limiting              |
| `packages/backend/src/services/lightning/lightningService.ts`          | Lightning core service | LOW RISK - Currently mock data, no DB queries      |
| `packages/backend/src/services/lightning-payment-service.ts`           | Payment processing     | CRITICAL - SQL injection at line 719               |
| `packages/backend/src/services/SecretsService.ts`                      | Secret management      | CLEAN - Well-implemented AWS integration           |
| `packages/backend/src/config/secrets.config.ts`                        | Secret configuration   | CLEAN - Proper env/AWS mapping                     |
| `packages/backend/src/services/enhanced-nostr-auth.ts`                 | Enhanced NOSTR auth    | MEDIUM - Auto-generated encryption key             |
| `packages/backend/src/services/content/ContentPublishingService.ts`    | Content publishing     | CRITICAL - Plaintext private key storage           |
| `packages/frontend/src/features/content/components/MarkdownEditor.tsx` | Markdown editor        | HIGH - XSS via unsanitized dangerouslySetInnerHTML |
| `packages/frontend/src/features/content/components/RichTextEditor.tsx` | Rich text editor       | HIGH - XSS via unsanitized innerHTML               |
| `packages/backend/src/container/types.ts`                              | DI type registry       | N/A - Documents the gap                            |
| `packages/backend/src/container/bindings/*.bindings.ts`                | DI bindings            | HIGH - Missing controller registrations            |
| `packages/backend/src/container/index.ts`                              | DI container entry     | CLEAN - Proper lazy initialization                 |

---

_Review generated by Security Auditor Agent on 2026-02-12. This review should be validated by a human security engineer before acting on remediations._
