---
status: complete
priority: p3
issue_id: 608
tags: [code-review, docs, agents]
dependencies: []
---

# Stale Workflow References in Agent Briefs After PR #117 Deletions

## Problem Statement

PR #117 deleted 13 deprecated workflow files. However, several agent instruction files and development docs still reference the deleted workflows by name. Agents spawned with these briefs will attempt `gh workflow run backend-deployment.yml` and get "no such workflow" errors.

## Findings

- **Git history analyzer**: P2 — found references in 2 agent files and 1 active dev doc

**Highest-risk files:**

- `.claude/agents/project-orchestrator.md` — references `backend-deployment.yml`, `automated-rollback.yml`
- `.claude/agents/DEPLOYMENT_INTEGRATION_TEMPLATE.md` — 8+ references to deleted workflows
- `docs/development/DEPLOYMENT_INTEGRATION_STANDARDS.md` — 15+ references

**Lower-risk (historical archives, no action needed):**

- `docs/quality-workflow-audit-2026-02-20 2.md`
- `docs/solutions/infrastructure-issues/pr111-*.md`
- `CHANGELOG.md`

## Proposed Solutions

### Option A: Update agent briefs and active docs (Recommended)

Replace references to deleted workflows with the current `ci.yml` equivalents. For deployment commands, reference the Vercel deploy steps in `ci.yml` and manual `workflow_dispatch`.

**Effort**: Medium (3 files to update)
**Risk**: Low

## Acceptance Criteria

- [ ] `project-orchestrator.md` references only existing workflows
- [ ] `DEPLOYMENT_INTEGRATION_TEMPLATE.md` updated to current CI structure
- [ ] `DEPLOYMENT_INTEGRATION_STANDARDS.md` updated
- [ ] Historical/archive docs left as-is (they describe past state accurately)

## Work Log

| Date       | Action                                 | Learnings                        |
| ---------- | -------------------------------------- | -------------------------------- |
| 2026-03-01 | Created from 8-agent review of PR #117 | Git history agent found the refs |
