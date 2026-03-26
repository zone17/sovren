# Architecture Diagrams

This directory contains Mermaid diagrams documenting the Sovren platform architecture. Diagrams are grouped by domain.

## How to Use

- **GitHub**: `.mmd` files render automatically in GitHub's markdown viewer
- **VS Code**: Use a Mermaid preview extension for live rendering
- **Mermaid Live Editor**: Copy content to [mermaid.live](https://mermaid.live) for interactive editing
- **CLI**: `mmdc -i <file>.mmd -o <file>.svg`

---

## System Overview

| Diagram | Description |
|---------|-------------|
| [system-architecture-overview.mmd](system-architecture-overview.mmd) | Top-level platform architecture |
| [deployment-architecture.mmd](deployment-architecture.mmd) | Infrastructure and deployment topology |
| [security-architecture.mmd](security-architecture.mmd) | Security controls and trust boundaries |

---

## Authentication & Sessions

| Diagram | Description |
|---------|-------------|
| [unified-auth-architecture.mmd](unified-auth-architecture.mmd) | Unified auth system design |
| [unified-auth-flow.mmd](unified-auth-flow.mmd) | Auth request flow |
| [jwt-lifecycle.mmd](jwt-lifecycle.mmd) | JWT issuance, refresh, and revocation |
| [us-311-unified-session-architecture.mmd](us-311-unified-session-architecture.mmd) | Multi-device session management (US-311) |
| [us-311-session-lifecycle.mmd](us-311-session-lifecycle.mmd) | Session state transitions |
| [US-311-multi-device-flow.mmd](US-311-multi-device-flow.mmd) | Multi-device coordination flow |
| [us-311-data-flow.mmd](us-311-data-flow.mmd) | Session data flow |
| [US-311-architecture-overview.mmd](US-311-architecture-overview.mmd) | US-311 architecture overview |

---

## Payments & Lightning Network

| Diagram | Description |
|---------|-------------|
| [payment-state-machine.mmd](payment-state-machine.mmd) | Payment state machine overview |
| [payment-state-machine-flow.mmd](payment-state-machine-flow.mmd) | Full state transition flow |
| [payment-state-machine-detailed.mmd](payment-state-machine-detailed.mmd) | Detailed state machine with error paths |
| [payment-state-machine-concurrent.mmd](payment-state-machine-concurrent.mmd) | Concurrent payment handling |
| [payment-state-machine-sequence.mmd](payment-state-machine-sequence.mmd) | Sequence diagram for payment processing |
| [us-221-lightning-payment-processing.mmd](us-221-lightning-payment-processing.mmd) | Lightning payment processing (US-221) |
| [us-e5-025-payment-processing-architecture.mmd](us-e5-025-payment-processing-architecture.mmd) | Payment processing architecture |
| [us-e5-025-payment-sequence.mmd](us-e5-025-payment-sequence.mmd) | Payment sequence |
| [us-e5-025-payment-state-machine.mmd](us-e5-025-payment-state-machine.mmd) | Payment state machine (Epic 5) |
| [us-e5-026-subscription-lifecycle.mmd](us-e5-026-subscription-lifecycle.mmd) | Subscription lifecycle |
| [us-e5-026-renewal-flow.mmd](us-e5-026-renewal-flow.mmd) | Subscription renewal flow |
| [us-e5-026-upgrade-downgrade-flow.mmd](us-e5-026-upgrade-downgrade-flow.mmd) | Subscription upgrade/downgrade |
| [us-e5-027-refund-flow.mmd](us-e5-027-refund-flow.mmd) | Refund processing flow |
| [us-e5-027-refund-state-machine.mmd](us-e5-027-refund-state-machine.mmd) | Refund state machine |
| [us-e5-029-retry-strategy.mmd](us-e5-029-retry-strategy.mmd) | Payment retry with exponential backoff |
| [us-e5-029-webhook-flow.mmd](us-e5-029-webhook-flow.mmd) | Payment webhook flow |
| [us-e5-030-currency-service-architecture.mmd](us-e5-030-currency-service-architecture.mmd) | BTC/USD currency conversion service |
| [us-e5-030-provider-fallback-chain.mmd](us-e5-030-provider-fallback-chain.mmd) | Rate provider fallback chain |

---

## Webhooks

| Diagram | Description |
|---------|-------------|
| [webhook-data-flow.mmd](webhook-data-flow.mmd) | Webhook ingestion and processing flow |
| [webhook-signature-verification-architecture.mmd](webhook-signature-verification-architecture.mmd) | Signature verification architecture |
| [webhook-verification-sequence.mmd](webhook-verification-sequence.mmd) | Verification sequence diagram |
| [webhook-attack-prevention.mmd](webhook-attack-prevention.mmd) | Attack prevention controls |

---

## Content Management

| Diagram | Description |
|---------|-------------|
| [us-216-unified-cms-architecture.mmd](us-216-unified-cms-architecture.mmd) | Unified CMS architecture (US-216) |
| [us-216-consolidation-process.mmd](us-216-consolidation-process.mmd) | Before/after content consolidation |
| [us-216-test-coverage.mmd](us-216-test-coverage.mmd) | CMS test coverage pyramid |
| [US-E5-014-content-search-architecture.mmd](US-E5-014-content-search-architecture.mmd) | Full-text search architecture |
| [US-E5-014-search-flow.mmd](US-E5-014-search-flow.mmd) | Search request flow |

---

## Analytics & Recommendations

| Diagram | Description |
|---------|-------------|
| [us-225-analytics-service-architecture.mmd](us-225-analytics-service-architecture.mmd) | Analytics service architecture |
| [us-225-analytics-data-flow.mmd](us-225-analytics-data-flow.mmd) | Analytics data flow |
| [us-e5-023-architecture-overview.mmd](us-e5-023-architecture-overview.mmd) | Recommendation engine architecture |
| [us-e5-023-churn-prediction.mmd](us-e5-023-churn-prediction.mmd) | Churn prediction flow |
| [us-e5-023-event-driven-tracking.mmd](us-e5-023-event-driven-tracking.mmd) | Event-driven analytics tracking |
| [US-E5-019-architecture.mmd](US-E5-019-architecture.mmd) | Analytics pipeline architecture |

---

## Caching & Performance

| Diagram | Description |
|---------|-------------|
| [event-cache-architecture.mmd](event-cache-architecture.mmd) | Event cache design |
| [event-cache-data-flow.mmd](event-cache-data-flow.mmd) | Event cache data flow |
| [event-cache-invalidation.mmd](event-cache-invalidation.mmd) | Cache invalidation strategy |
| [event-cache-memory-management.mmd](event-cache-memory-management.mmd) | Memory management for event cache |
| [US-317-caching-architecture.mmd](US-317-caching-architecture.mmd) | Global caching architecture (US-317) |
| [US-317-cache-data-flow.mmd](US-317-cache-data-flow.mmd) | Cache data flow |
| [US-317-cache-invalidation.mmd](US-317-cache-invalidation.mmd) | Cache invalidation |
| [us-317-cache-ttl-strategy.mmd](us-317-cache-ttl-strategy.mmd) | TTL strategy per entity type |
| [US-317-memory-management.mmd](US-317-memory-management.mmd) | In-process memory management |

---

## NOSTR Protocol

| Diagram | Description |
|---------|-------------|
| [nip04-message-flow.mmd](nip04-message-flow.mmd) | NIP-04 encrypted DM flow |
| [nip04-security-architecture.mmd](nip04-security-architecture.mmd) | NIP-04 security model |
| [nip04-threat-model.mmd](nip04-threat-model.mmd) | NIP-04 threat model |
| [us-006-pool-architecture.mmd](us-006-pool-architecture.mmd) | Relay pool architecture |
| [us-006-connection-lifecycle.mmd](us-006-connection-lifecycle.mmd) | Relay connection lifecycle |
| [us-006-monitoring-flow.mmd](us-006-monitoring-flow.mmd) | Relay pool monitoring |
| [us-309-relay-config-architecture.mmd](us-309-relay-config-architecture.mmd) | Relay configuration architecture |
| [us-309-relay-config-flow.mmd](us-309-relay-config-flow.mmd) | Relay config update flow |

---

## Infrastructure & CI/CD

| Diagram | Description |
|---------|-------------|
| [cicd-dashboard-architecture.mmd](cicd-dashboard-architecture.mmd) | CI/CD dashboard architecture |
| [cicd-dashboard-component-interaction.mmd](cicd-dashboard-component-interaction.mmd) | CI/CD component interaction |
| [cicd-dashboard-data-flow.mmd](cicd-dashboard-data-flow.mmd) | CI/CD data flow |
| [cicd-dashboard-deployment-process.mmd](cicd-dashboard-deployment-process.mmd) | Deployment process diagram |
| [us-322-backup-recovery-architecture.mmd](us-322-backup-recovery-architecture.mmd) | Backup and recovery architecture |
| [us-322-encryption-process.mmd](us-322-encryption-process.mmd) | Backup encryption process |

---

## Monitoring & Observability

| Diagram | Description |
|---------|-------------|
| [US-316-monitoring-architecture.mmd](US-316-monitoring-architecture.mmd) | Monitoring stack architecture |
| [US-316-monitoring-data-flow.mmd](US-316-monitoring-data-flow.mmd) | Metrics collection and alerting flow |
| [US-316-metrics-collection.mmd](US-316-metrics-collection.mmd) | Metrics collection detail |

---

## Secrets & Security

| Diagram | Description |
|---------|-------------|
| [us-005-secrets-management-architecture.mmd](us-005-secrets-management-architecture.mmd) | Secrets management architecture |
| [us-005-secrets-management-deployment.mmd](us-005-secrets-management-deployment.mmd) | Secrets deployment flow |
| [us-005-secrets-management-sequence.mmd](us-005-secrets-management-sequence.mmd) | Secrets access sequence |
| [us-005-secrets-management-error-handling.mmd](us-005-secrets-management-error-handling.mmd) | Error handling for secrets access |

---

## Backend Services (Epic 5)

| Diagram | Description |
|---------|-------------|
| [us-e5-032-architecture-overview.mmd](us-e5-032-architecture-overview.mmd) | Service bootstrap and lifecycle |
| [us-e5-032-dependency-graph.mmd](us-e5-032-dependency-graph.mmd) | Service dependency graph |
| [us-e5-033-api-architecture.mmd](us-e5-033-api-architecture.mmd) | API layer architecture |
| [us-e5-033-controller-pattern.mmd](us-e5-033-controller-pattern.mmd) | Controller pattern |
| [us-e5-033-request-flow.mmd](us-e5-033-request-flow.mmd) | Request processing flow |
| [us-e5-028-architecture-overview.mmd](us-e5-028-architecture-overview.mmd) | User profile service architecture |
| [us-e5-021-architecture-overview.mmd](us-e5-021-architecture-overview.mmd) | Session activity service |
| [us-e5-022-architecture-overview.mmd](us-e5-022-architecture-overview.mmd) | Creator network architecture |

---

## Diagram Conventions

**Color coding (consistent across all diagrams):**

- Blue (`#e1f5fe`) — Primary components / frontend
- Purple (`#f3e5f5`) — State management / Redux
- Green (`#e8f5e8`) — Backend / API / database
- Orange (`#fff3e0`) — Infrastructure / external services
- Red (`#ffebee`) — Error paths / legacy / deprecated

**Update policy:** Diagrams must be updated alongside code changes that affect architecture. Include diagram updates in PR reviews.
