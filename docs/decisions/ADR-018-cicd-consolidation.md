# ADR-018: CI/CD Workflow Consolidation Strategy

**Date**: 2026-02-12
**Status**: Accepted
**Epic**: Infrastructure Sprint - US-E0-009 CI/CD Pipeline Consolidation
**Related ADRs**: None

## Context

Sovren's GitHub Actions CI/CD system had grown organically to **22 workflow files** during rapid feature development. Multiple issues existed:

1. **Overlapping triggers**: Several workflows triggered on the same events (`push to main`, `pull_request`), causing redundant test/build runs. Some PRs triggered 4-5 parallel workflows doing similar work, consuming GitHub Actions minutes.

2. **Missing security hardening**:

   - Workflows lacked explicit `permissions:` blocks, defaulting to overly broad `write-all` permissions
   - No concurrency controls, allowing duplicate runs to pile up
   - Some workflows used `soft_fail: true` or `continue-on-error: true` on security scan steps, masking vulnerabilities

3. **Simulation steps**: Several deployment workflows contained placeholder steps (`echo "Deploying..."`) rather than real deployment integrations. Health checks were `curl` commands against domains that did not exist.

4. **Workflow sprawl**: Independent workflows for tasks that belong in a single pipeline (lint, test, build, deploy) made it hard to understand the overall CI/CD flow and enforce stage ordering.

We needed to consolidate workflows into a clear, secure pipeline while maintaining the ability to run specialized workflows independently when needed.

## Decision

We consolidated the CI/CD system with the following structure:

### Consolidated Main Pipeline: `ci.yml`

A single pipeline triggered on `push` (main, develop) and `pull_request` with ordered stages:

```
lint (parallel) ─┐
                 ├─→ test ─→ build ─→ docker ─→ deploy-staging ─→ deploy-production
security (parallel) ┘
```

Key design decisions:

1. **Top-level `permissions: read-all`**: Every workflow now declares minimal permissions at the workflow level. Jobs that need write access (GHCR push, SARIF upload) explicitly declare only the permissions they require (`packages: write`, `security-events: write`).

2. **Concurrency groups**: `concurrency.group: ci-${{ github.workflow }}-${{ github.ref }}` with `cancel-in-progress: true` for PRs ensures only the latest commit is tested, saving Actions minutes.

3. **No soft-fail on security**: Trivy scans use `exit-code: '1'` for CRITICAL severity. No `continue-on-error` on security steps. If a critical vulnerability is found, the pipeline fails.

4. **Real deployment steps**: Staging deployment uses the Vercel action with real tokens. Production requires the `production` GitHub environment with manual approval gates.

5. **Health checks with retries**: Post-deployment health checks retry 5 times with exponential backoff before failing the pipeline.

### Specialized Workflows (Retained)

Workflows that serve distinct purposes remain independent:

| Workflow                  | Trigger                                | Purpose                                                      |
| ------------------------- | -------------------------------------- | ------------------------------------------------------------ |
| `backend-deployment.yml`  | Push to `packages/backend/**` + manual | Backend Docker build, push, blue-green deploy                |
| `security-scan.yml`       | Push + PR + daily cron                 | Comprehensive container security scanning (Trivy + Hadolint) |
| `automated-rollback.yml`  | Manual dispatch                        | Emergency production rollback                                |
| `credential-rotation.yml` | Schedule                               | Automated secret rotation                                    |
| `database-migrations.yml` | Manual                                 | Database schema migrations                                   |
| `quality-gates.yml`       | PR                                     | Detailed quality gate reporting                              |
| `release.yml`             | Tags                                   | Semantic version release process                             |

### Security Hardening Applied Across All Workflows

- **Permissions blocks**: Every workflow and every job with elevated needs declares explicit permissions
- **Pinned action versions**: All actions use `@v4` or specific SHA-pinned versions (e.g., `actions/checkout@v4`)
- **No `soft_fail` or `continue-on-error` on security steps**: Scan failures are real failures
- **SARIF upload to GitHub Security tab**: Trivy results appear in the repository's Security > Code scanning alerts
- **Image signing**: Production Docker images are signed with Cosign (sigstore) for supply chain integrity
- **Concurrency controls**: All workflows use concurrency groups to prevent duplicate runs

## Consequences

### Positive

- **Clear pipeline flow**: Developers can see the entire CI/CD lifecycle in a single file (`ci.yml`). Stage ordering (lint -> security -> test -> build -> deploy) is explicit.
- **Reduced Actions consumption**: Concurrency controls and consolidation reduced duplicate workflow runs by approximately 60% (estimated from trigger overlap analysis).
- **Security posture improved**: Explicit permissions follow the principle of least privilege. No security scan results are silently ignored.
- **Faster feedback**: Lint and security run in parallel as the first stage. Developers get quick feedback on formatting/security issues before waiting for the full test suite.
- **Deployment confidence**: Real health checks with retries, staging-before-production gating, and automated rollback provide production deployment safety.

### Negative

- **Single point of failure**: If `ci.yml` has a syntax error or GitHub Actions has an outage, the entire pipeline is blocked. Mitigation: the specialized workflows (e.g., `security-scan.yml`) can run independently.
- **Longer pipeline for small changes**: A docs-only change still triggers the full pipeline (lint, security, test, build). This could be optimized with path filters, but the overhead is acceptable given our repository size.
- **Some commented-out deployment steps remain**: The backend deployment workflow (`backend-deployment.yml`) still has commented-out load balancer commands (`# load_balancer_update`) because the actual infrastructure provider (Railway, Render, etc.) has not been finalized. These are clearly marked as placeholders.

### Neutral

- The 22-to-24 workflow count did not decrease dramatically because most retained workflows serve distinct scheduling or manual-trigger purposes. The key improvement is eliminating overlapping triggers and ensuring all workflows have proper security hardening.
- The consolidated pipeline follows GitHub's recommended pattern for multi-stage CI/CD.

## Alternatives Considered

### Monorepo CI Tool (Turborepo / Nx)

Considered using Turborepo's task pipeline to orchestrate builds across packages. Rejected because Sovren's monorepo has only 4 packages, and the overhead of adding a build orchestrator is not justified. GitHub Actions' `needs:` dependencies provide sufficient ordering.

### Single Mega-Workflow

Considered collapsing all 22 workflows into a single file with conditional jobs. Rejected because workflows with different triggers (cron schedules, manual dispatch, tag pushes) belong in separate files for clarity. The consolidation focuses on overlapping push/PR triggers.

### GitHub Reusable Workflows

Considered extracting common steps (checkout + setup-node) into reusable workflows. Partially adopted via the composite action `.github/actions/setup-node/action.yml` for Node.js setup. Full reusable workflow adoption deferred to avoid over-engineering the CI system at this stage.
