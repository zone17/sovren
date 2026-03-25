# Sovren

Sovren is a decentralized creator monetization platform built on the NOSTR protocol and the Bitcoin Lightning Network. Creators own their content, their audience relationships, and their revenue streams — without platform intermediaries.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Sovren Monorepo                       │
│                    (npm workspaces)                          │
└─────────────────────────────────────────────────────────────┘
         │                │               │             │
         ▼                ▼               ▼             ▼
┌──────────────┐  ┌──────────────┐ ┌──────────┐ ┌──────────┐
│   frontend   │  │   backend    │ │  shared  │ │ testing  │
│              │  │              │ │          │ │          │
│ React 18     │  │ Node.js      │ │ Types    │ │ Test     │
│ TypeScript   │  │ TypeScript   │ │ Utils    │ │ Fixtures │
│ Vite         │  │ Express      │ │ Configs  │ │ Helpers  │
│ TailwindCSS  │  │ Docker       │ │          │ │          │
│              │  │              │ │          │ │          │
│ Deploy:      │  │ Deploy:      │ │          │ │          │
│ Vercel       │  │ GHCR/Docker  │ │          │ │          │
└──────────────┘  └──────────────┘ └──────────┘ └──────────┘
         │                │
         ▼                ▼
┌──────────────────────────────────┐
│         External Services        │
│                                  │
│  Supabase (DB + Auth)            │
│  Bitcoin Lightning Network       │
│  NOSTR Relays                    │
│  Redis (session cache)           │
└──────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | React 18.3 + TypeScript 5.3 |
| Build tool | Vite |
| Styling | TailwindCSS |
| State management | Redux Toolkit + React Query |
| Backend runtime | Node.js + TypeScript |
| Backend framework | Express |
| Database | Supabase (PostgreSQL) |
| Authentication | Supabase Auth + NOSTR keys |
| Payments | Bitcoin Lightning Network (BOLT11, WebLN) |
| Decentralized protocol | NOSTR (nostr-tools) |
| Session cache | Redis |
| Frontend deployment | Vercel |
| Backend deployment | Docker (GHCR) |
| Testing | Vitest + React Testing Library + Playwright |
| Monorepo tooling | npm workspaces |

---

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- Docker Desktop (required for integration tests and backend local development)

### Install

```bash
git clone <repository-url>
cd Sovren
npm install
```

### Develop

```bash
# Start the frontend development server (port 3000)
npm run dev

# Start the full stack locally (frontend + backend + Redis + DB)
docker compose -f docker-compose.dev.yml up
```

### Test

```bash
# Run all tests (unit + integration + E2E)
npm test

# Unit tests only
npm run test:unit

# Integration tests (requires Docker)
npm run test:integration

# E2E tests (Playwright)
npm run test:e2e
```

### Code Quality

```bash
# Lint
npm run lint

# Type check
npm run type-check

# Format
npm run format

# Full quality gate
npm run quality:check
```

---

## Package Structure

```
packages/
├── frontend/     React application — feature-based modular architecture
├── backend/      Node.js API server — services, routes, repositories
├── shared/       Shared TypeScript types, utilities, and configs
└── testing/      Shared test fixtures, helpers, and utilities
```

| Package | README | Description |
|---------|--------|-------------|
| `packages/frontend` | [frontend/README.md](packages/frontend/README.md) | React app with NOSTR and Lightning integration |
| `packages/backend` | [backend/README.md](packages/backend/README.md) | REST API, payment processing, auth middleware |
| `packages/shared` | [shared/README.md](packages/shared/README.md) | Shared types and utilities |
| `packages/testing` | [testing/README.md](packages/testing/README.md) | Test helpers and fixtures |

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/architecture/](docs/architecture/) | System architecture, data flows, component diagrams |
| [docs/deployment/DEPLOYMENT_GUIDE.md](docs/deployment/DEPLOYMENT_GUIDE.md) | Production deployment procedures |
| [docs/deployment/DISASTER_RECOVERY.md](docs/deployment/DISASTER_RECOVERY.md) | RTO/RPO targets and recovery procedures |
| [docs/development/](docs/development/) | Development setup, branching strategy, contributing guide |
| [docs/incident-response/INCIDENT_PLAYBOOK.md](docs/incident-response/INCIDENT_PLAYBOOK.md) | Incident severity, declaration, post-mortem template |
| [docs/incident-response/ON_CALL_POLICY.md](docs/incident-response/ON_CALL_POLICY.md) | On-call rotation and escalation matrix |
| [docs/api/](docs/api/) | API reference and integration guides |
| [docs/security/](docs/security/) | Security guidelines and threat model |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute to Sovren |
| [CHANGELOG.md](CHANGELOG.md) | Release history |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contributing guide, including:
- Branch naming conventions (`feat/squad-a/SOV-123-slug`)
- Commit message format (Conventional Commits)
- Code review process
- Quality gates that must pass before merge

All merges to `main` go through the CI/CD pipeline. Direct pushes to `main` are blocked.

---

## License

[License TBD]
