# Security Policy

## Supported Versions

| Version | Supported          | Notes                          |
|---------|--------------------|--------------------------------|
| 2.x     | Yes                | Current release — actively maintained |
| 1.x     | No                 | End-of-life — upgrade to v2    |
| < 1.0   | No                 | Never supported in production  |

All security patches are applied exclusively to v2.x. Users on v1.x must migrate to continue receiving security updates. See the [v1 to v2 Migration Guide](docs/api/MIGRATION_GUIDE_V1_TO_V2.md).

---

## Reporting a Vulnerability

**Do NOT open a public GitHub issue for security vulnerabilities.** Public disclosure before a fix is available puts all users at risk.

### How to Report

Email **security@sovren.dev** with the subject line `[Security] <brief description>`.

**Expected response time:** We will acknowledge your report within **48 hours** of receipt. You will receive a status update at least every 7 days thereafter while the issue is being investigated.

**What to include in your report:**

- A clear description of the vulnerability and the potential impact
- The affected component, endpoint, or feature
- Step-by-step reproduction instructions (proof of concept preferred)
- Any relevant request/response payloads, screenshots, or logs
- Your assessment of severity (using CVSS v3.1 if possible)
- Any suggested remediation (optional but appreciated)

### What to Expect After Reporting

1. **Acknowledgment** — within 48 hours confirming receipt
2. **Triage** — we assess severity using CVSS v3.1 scoring and assign an internal priority
3. **Resolution timeline**:
   - Critical (CVSS 9.0–10.0): patched within **72 hours**
   - High (CVSS 7.0–8.9): patched within **7 days**
   - Medium (CVSS 4.0–6.9): patched within **30 days**
   - Low (CVSS 0.1–3.9): addressed in the next scheduled release
4. **Coordinated disclosure** — we will work with you to agree on a public disclosure date after the fix is deployed

---

## Responsible Disclosure Policy

We follow a coordinated disclosure model:

- We ask that you give us reasonable time to investigate and remediate before any public disclosure
- We will not take legal action against researchers who follow this policy in good faith
- We will credit reporters in our release notes (unless you prefer to remain anonymous)
- We ask that you avoid accessing, modifying, or deleting user data during your research

---

## Bug Bounty

We do not currently offer a bug bounty program, but we will credit reporters by name in the release notes for the version that includes the fix, unless you prefer to remain anonymous. We are grateful to the security community for helping keep Sovren safe.

---

## Security Update Process

1. The security team triages the report and assigns a severity rating
2. A fix is developed in a private branch and reviewed by at least two engineers
3. Automated security scans (SAST, dependency audit, container scan) must pass before merge
4. The fix is deployed to staging, smoke-tested, and promoted to production
5. A GitHub Security Advisory is published after the fix is live
6. The reporter is notified and credited in the corresponding release notes

---

## Known Security Features

Sovren is built with security-first design across all layers:

| Feature | Description |
|---------|-------------|
| **Row-Level Security (RLS)** | All Supabase tables enforce RLS policies; no query bypasses tenant isolation |
| **HMAC Webhook Signatures** | Outbound webhooks are signed with HMAC-SHA256; consumers must verify the `X-Sovren-Signature` header |
| **Timing-Safe Cryptography** | All secret and token comparisons use constant-time functions to prevent timing attacks |
| **Rate Limiting** | Per-endpoint rate limiting is enforced at the middleware layer for all API consumers |
| **Content Security Policy (CSP)** | Strict CSP headers are set on all responses to mitigate XSS and data injection |
| **CORS** | Cross-Origin Resource Sharing is restricted to approved origins; wildcard origins are not permitted |
| **NOSTR Key Isolation** | Private keys are never stored server-side; all signing occurs client-side via browser extensions or user-controlled wallets |
| **Idempotency Keys** | Payment-mutating endpoints require idempotency keys to prevent duplicate charges |
| **NOSTR Signature Verification** | Payment endpoints enforce `requireNostrSignature` middleware for cryptographic proof of intent |
| **Automated Scanning** | npm audit, Snyk, CodeQL, Trivy, and gitleaks run on every PR and push to main |
| **Credential Rotation** | Automated 90-day secret rotation via HashiCorp Vault |
| **GDPR Compliance** | Account deletion and data export endpoints are available to all authenticated users |

---

## Out of Scope

The following are **not** eligible for security reports:

- Social engineering attacks targeting Sovren staff or contractors
- Denial-of-service (DoS) or distributed DoS attacks against production infrastructure
- Attacks requiring physical access to a user's device
- Vulnerabilities in third-party dependencies that have not been patched upstream (report these to the upstream project)
- Theoretical vulnerabilities with no demonstrated impact
- Spam, phishing, or abuse of NOSTR relay infrastructure not operated by Sovren
- Lightning Network node infrastructure not operated by Sovren
- Rate-limit bypass that requires an unrealistic number of requests per second
- Reports generated solely by automated scanners with no manual validation

---

## Security Scanning Infrastructure

| Scanner | Trigger | Scope |
|---------|---------|-------|
| `npm audit` | Every PR, push to main | Dependency vulnerabilities |
| Snyk Code (SAST) | Every PR, push to main | Source code analysis |
| CodeQL | Every PR, push to main | Static analysis |
| Trivy (filesystem) | Every PR, push to main | Dependencies and IaC |
| Trivy (container) | Push to main | Docker image layers |
| Docker Scout | Push to main | Container CVEs |
| Hadolint | Every PR | Dockerfile linting |
| gitleaks | Pre-commit, CI | Secret detection |
| GitHub secret scanning | Continuous | Repository-wide secret detection |
| Checkov | Every PR | Infrastructure-as-Code misconfigurations |

### Severity Levels That Block Deployment

| Severity | CVSS Score | Blocks PR Merge | Blocks Production Deploy |
|----------|------------|-----------------|--------------------------|
| Critical | 9.0–10.0   | Yes             | Yes                      |
| High     | 7.0–8.9    | Yes             | Yes                      |
| Medium   | 4.0–6.9    | No (warning)    | No (warning)             |
| Low      | 0.1–3.9    | No              | No                       |

---

## Security Best Practices for Contributors

- Never commit secrets, API keys, credentials, or private keys to the repository
- Use environment variables for all sensitive configuration (see `env.example`)
- Follow the principle of least privilege for all access controls
- Docker images must run as non-root users
- All new endpoints must apply authentication middleware unless explicitly designed as public
- Payment-mutating endpoints must require both `authenticate` and `requireNostrSignature`
- Review [docs/security/security-guidelines.md](docs/security/security-guidelines.md) before contributing to auth or payment code
