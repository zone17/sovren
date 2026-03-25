# GitHub Issue Templates for Epic 003 Stories

This document provides ready-to-use GitHub issue templates for all 26 stories. Copy the template for each story and create as a GitHub issue.

## Story Labels

Create these labels in your GitHub repository first:

```bash
# Epic label
epic-003

# Phase labels
phase-1-core
phase-2-adapters
phase-3-frontend-migration
phase-4-backend-migration
phase-5-cleanup

# Stream labels
stream-a-core
stream-b-browser
stream-c-node
stream-d-frontend
stream-e-backend

# Type labels
refactoring
nostr
1-point

# Priority labels
critical-path
high-priority
standard-priority
```

## General Template Structure

```markdown
## User Story

**As a** [role]
**I want** [capability]
**So that** [benefit]

## Acceptance Criteria

- [ ] **Given** [context]
      **When** [action]
      **Then** [outcome]

- [ ] **Given** [context]
      **When** [action]
      **Then** [outcome]

- [ ] **Given** [context]
      **When** [action]
      **Then** [outcome]

## Technical Implementation

[Detailed implementation notes with code examples]

## Files to Create/Modify

- `path/to/file.ts`

## Dependencies

**Blocked by**: #[issue-number]
**Blocks**: #[issue-number]
**Related**: #[issue-number]

## Testing Requirements

### Unit Tests

- [ ] Test case 1
- [ ] Test case 2

### Integration Tests

- [ ] Integration test 1
- [ ] Integration test 2

## Definition of Done

- [ ] Code implemented
- [ ] Unit tests written and passing
- [ ] Integration tests passing
- [ ] Code reviewed and approved
- [ ] Documentation updated
- [ ] Merged to main branch

## Estimated Effort

**Size**: 1 point (2-4 hours)

## Additional Context

[Any additional notes or links]
```

## Quick Issue Creation Commands

### Using GitHub CLI

```bash
# Install GitHub CLI if not already installed
# brew install gh

# Authenticate
gh auth login

# Create issue from template
gh issue create \
  --title "[NS-001] Create Core NOSTR Service Structure" \
  --body-file story-ns-001.md \
  --label "epic-003,phase-1-core,stream-a-core,refactoring,nostr,1-point,critical-path" \
  --milestone "Epic 003 - NOSTR Consolidation" \
  --assignee "developer-username"
```

## Individual Story Templates

### NS-001: Create Core NOSTR Service Structure

```markdown
## User Story

**As a** developer
**I want** to establish the foundational structure for the shared NOSTR service
**So that** all core functionality has a well-organized home

## Acceptance Criteria

- [ ] **Given** the shared package exists
      **When** I create the NOSTR service structure
      **Then** the following directories and files should exist: - `packages/shared/src/services/nostr/core/` - `packages/shared/src/services/nostr/adapters/` - `packages/shared/src/services/nostr/types/` - `packages/shared/src/services/nostr/index.ts`

- [ ] **Given** the core service structure is created
      **When** I add base interfaces
      **Then** TypeScript interfaces for INostrService, IRelayManager, IEventManager should be defined

- [ ] **Given** the type definitions exist
      **When** I export them from index.ts
      **Then** other packages can import types from '@sovren/shared/nostr'

## Technical Implementation

Create the following directory structure:

\`\`\`typescript
// packages/shared/src/services/nostr/types/base.ts
export interface INostrService {
events: IEventManager;
relays: IRelayManager;
subscriptions: ISubscriptionManager;
crypto: ICryptoManager;
}

// packages/shared/src/services/nostr/core/index.ts
export class NostrService implements INostrService {
constructor(config: NostrConfig) { }
}

// packages/shared/src/services/nostr/index.ts
export _ from './core';
export _ from './types';
export \* from './adapters';
\`\`\`

## Files to Create

- `packages/shared/src/services/nostr/types/base.ts`
- `packages/shared/src/services/nostr/types/events.ts`
- `packages/shared/src/services/nostr/types/relays.ts`
- `packages/shared/src/services/nostr/types/index.ts`
- `packages/shared/src/services/nostr/core/index.ts`
- `packages/shared/src/services/nostr/index.ts`

## Dependencies

**Blocked by**: None (can start immediately)
**Blocks**: NS-002, NS-003, NS-004, NS-005, NS-006, NS-007, NS-009

## Testing Requirements

### Unit Tests

- [ ] Service initialization test
- [ ] Type export validation test
- [ ] Interface completeness test

### Integration Tests

- [ ] Package import test from frontend
- [ ] Package import test from backend

## Definition of Done

- [ ] Directory structure created
- [ ] All base interfaces defined
- [ ] Export paths working
- [ ] TypeScript compilation passing
- [ ] Tests written and passing
- [ ] Code reviewed and approved
- [ ] Documentation updated
- [ ] Merged to main branch

## Estimated Effort

**Size**: 1 point (2 hours)
**Priority**: CRITICAL - Blocks all other stories
**Risk**: Low

## Reference

See [STORY_BREAKDOWN.md](../epic-003-stories/STORY_BREAKDOWN.md#ns-001) for complete details.
```

**Labels**: `epic-003`, `phase-1-core`, `stream-a-core`, `refactoring`, `nostr`, `1-point`, `critical-path`
**Milestone**: Epic 003 - NOSTR Consolidation
**Assignee**: [Developer]

---

### NS-015: Add Feature Flag for Frontend Migration

```markdown
## User Story

**As a** developer
**I want** a feature flag to toggle between old and new NOSTR implementation
**So that** we can safely migrate and rollback if needed

## Acceptance Criteria

- [ ] **Given** feature flag configuration
      **When** flag is enabled
      **Then** new shared NOSTR service is used

- [ ] **Given** feature flag disabled
      **When** NOSTR operations occur
      **Then** old implementation is used

- [ ] **Given** runtime flag toggle
      **When** flag value changes
      **Then** implementation switches without restart

## Technical Implementation

\`\`\`typescript
// packages/frontend/src/services/nostr/migration.ts
export class NostrServiceMigration {
private useNewImplementation: boolean;
private oldService: OldNostrService;
private newAdapter: BrowserNostrAdapter;

constructor() {
this.useNewImplementation = getFeatureFlag('use_new_nostr_service');
this.oldService = new OldNostrService();
this.newAdapter = new BrowserNostrAdapter();

    // Listen for feature flag changes
    onFeatureFlagChange('use_new_nostr_service', (value) => {
      this.useNewImplementation = value;
      this.handleMigrationToggle();
    });

}

async initialize(): Promise<void> {
if (this.useNewImplementation) {
await this.newAdapter.initialize({
platform: 'browser',
relays: getDefaultRelays()
});
} else {
await this.oldService.initialize();
}
}

get events() {
return this.useNewImplementation
? this.newAdapter.events
: this.oldService.events;
}
}
\`\`\`

## Files to Create

- `packages/frontend/src/services/nostr/migration.ts`

## Files to Modify

- `packages/shared/src/featureFlags.ts` (add flag definition)
- `packages/frontend/src/App.tsx` (use migration service)

## Dependencies

**Blocked by**: #[NS-012-issue-number]
**Blocks**: #[NS-016-issue-number], #[NS-017-issue-number], #[NS-018-issue-number]
**Related**: #[NS-019-issue-number] (backend equivalent)

## Testing Requirements

### Unit Tests

- [ ] Feature flag toggle test
- [ ] Old implementation used when flag disabled
- [ ] New implementation used when flag enabled
- [ ] Runtime toggle test

### Integration Tests

- [ ] Subscription migration test
- [ ] State preservation test
- [ ] Rollback test

### E2E Tests

- [ ] User workflow with old implementation
- [ ] User workflow with new implementation
- [ ] Toggle during session test

## Definition of Done

- [ ] Feature flag implemented
- [ ] Migration service created
- [ ] Old service still works (flag off)
- [ ] New service works (flag on)
- [ ] Tests written and passing
- [ ] Rollback tested
- [ ] Code reviewed and approved
- [ ] Documentation updated
- [ ] Merged to main branch

## Estimated Effort

**Size**: 1 point (2 hours)
**Priority**: HIGH - Required for safe migration
**Risk**: Medium - Must handle state correctly

## Rollback Plan

If issues occur:

1. Set feature flag to `false`
2. Old implementation takes over immediately
3. No code changes needed

## Reference

See [STORY_BREAKDOWN.md](../epic-003-stories/STORY_BREAKDOWN.md#ns-015) for complete details.
```

**Labels**: `epic-003`, `phase-3-frontend-migration`, `stream-d-frontend`, `refactoring`, `nostr`, `1-point`, `high-priority`
**Milestone**: Epic 003 - NOSTR Consolidation
**Assignee**: [Frontend Developer]

---

## Bulk Issue Creation Script

Save this as `create-epic-003-issues.sh`:

```bash
#!/bin/bash

# Epic 003 - NOSTR Service Consolidation
# Bulk GitHub issue creation script

REPO="your-org/your-repo"
MILESTONE="Epic 003 - NOSTR Consolidation"

# Create milestone if it doesn't exist
gh api repos/$REPO/milestones --field title="$MILESTONE" --field description="NOSTR Service Consolidation - 26 stories"

# Phase 1: Core Service (NS-001 to NS-008)
echo "Creating Phase 1 stories..."

gh issue create \
  --title "[NS-001] Create Core NOSTR Service Structure" \
  --body "See epic-003-stories/STORY_BREAKDOWN.md#ns-001" \
  --label "epic-003,phase-1-core,stream-a-core,refactoring,nostr,1-point,critical-path" \
  --milestone "$MILESTONE"

gh issue create \
  --title "[NS-002] Implement Event Creation Logic" \
  --body "See epic-003-stories/STORY_BREAKDOWN.md#ns-002" \
  --label "epic-003,phase-1-core,stream-a-core,refactoring,nostr,1-point" \
  --milestone "$MILESTONE"

# ... repeat for all 26 stories ...

echo "All 26 issues created successfully!"
```

## Project Board Setup

Create a GitHub project with these columns:

1. **Backlog** - All unstarted stories
2. **Sprint 0: Core Service** - NS-001 to NS-008
3. **Sprint 1: Adapters** - NS-009 to NS-014
4. **Sprint 2: Migration** - NS-015 to NS-022
5. **Sprint 3: Cleanup** - NS-023 to NS-026
6. **In Progress** - Currently being worked on
7. **In Review** - PR submitted
8. **Done** - Merged and complete

## Automation Rules

Set up GitHub Actions automation:

```yaml
name: Epic 003 - Story Management

on:
  issues:
    types: [opened, labeled, closed]
  pull_request:
    types: [opened, closed]

jobs:
  manage-project:
    runs-on: ubuntu-latest
    steps:
      - name: Move to In Progress when assigned
        if: github.event.issue.assignee
        uses: alex-page/github-project-automation-plus@v0.8.1
        with:
          project: Epic 003 - NOSTR Consolidation
          column: In Progress

      - name: Move to In Review when PR opened
        if: github.event_name == 'pull_request' && github.event.action == 'opened'
        uses: alex-page/github-project-automation-plus@v0.8.1
        with:
          project: Epic 003 - NOSTR Consolidation
          column: In Review

      - name: Move to Done when merged
        if: github.event_name == 'pull_request' && github.event.pull_request.merged == true
        uses: alex-page/github-project-automation-plus@v0.8.1
        with:
          project: Epic 003 - NOSTR Consolidation
          column: Done
```

## Issue Naming Convention

All issues follow this format:

```
[NS-XXX] [Story Title in Present Tense]

Examples:
[NS-001] Create Core NOSTR Service Structure
[NS-002] Implement Event Creation Logic
[NS-015] Add Feature Flag for Frontend Migration
[NS-026] Performance Validation and Benchmarking
```

## Story Point Tracking

Add to each issue:

```markdown
## Story Points

**Estimate**: 1 point (2-4 hours)
**Actual**: [To be filled during implementation]
**Variance**: [Calculate after completion]
```

## Progress Tracking Template

Create a tracking issue:

```markdown
# Epic 003: NOSTR Service Consolidation - Progress Tracker

## Overall Progress: XX/26 stories complete (XX%)

### Sprint 0: Core Service (X/8 complete)

- [ ] NS-001 - Create Core Structure
- [ ] NS-002 - Event Creation
- [ ] NS-003 - Event Validation
- [ ] NS-004 - Relay Connection Pool
- [ ] NS-005 - Relay Auto-Reconnection
- [ ] NS-006 - Subscription Management
- [ ] NS-007 - Cryptographic Operations
- [ ] NS-008 - NIP-07 Extension Support

### Sprint 1: Adapters (X/6 complete)

- [ ] NS-009 - Define Adapter Interfaces
- [ ] NS-010 - Browser Adapter Base
- [ ] NS-011 - React Hooks
- [ ] NS-012 - Browser Storage
- [ ] NS-013 - Node.js Adapter Base
- [ ] NS-014 - Server Event Emitter

### Sprint 2: Migration (X/8 complete)

- [ ] NS-015 - Frontend Feature Flag
- [ ] NS-016 - Frontend Event Publishing
- [ ] NS-017 - Frontend Subscriptions
- [ ] NS-018 - Frontend Integration
- [ ] NS-019 - Backend Feature Flag
- [ ] NS-020 - Backend Event Publishing
- [ ] NS-021 - Backend API Endpoints
- [ ] NS-022 - Backend Webhooks

### Sprint 3: Cleanup (X/4 complete)

- [ ] NS-023 - Remove Frontend Code
- [ ] NS-024 - Remove Backend Code
- [ ] NS-025 - Architecture Documentation
- [ ] NS-026 - Performance Validation

## Metrics

- **Stories Complete**: XX/26
- **Story Points Complete**: XX/26
- **Estimated Days Remaining**: XX
- **Actual vs Estimated**: XX%
- **Blockers**: [List any blockers]
```

## Daily Standup Template

```markdown
## Epic 003 Daily Standup - [Date]

### Developer 1

**Yesterday**:

- Completed: [Story IDs]
- In Progress: [Story IDs]

**Today**:

- Plan to work on: [Story IDs]

**Blockers**: [Any blockers]

### Developer 2

**Yesterday**:

- Completed: [Story IDs]
- In Progress: [Story IDs]

**Today**:

- Plan to work on: [Story IDs]

**Blockers**: [Any blockers]

### Sprint Progress

- Stories complete: XX/YY
- On track: ✅ / ⚠️ / ❌
- Risks: [Any new risks]
```

---

## Complete Issue Creation Reference

For complete issue details, see [STORY_BREAKDOWN.md](./STORY_BREAKDOWN.md) which contains all 26 stories with full:

- Acceptance criteria
- Technical implementation
- Code examples
- Testing requirements
- Dependencies

Simply copy the relevant story section and paste into a GitHub issue with appropriate labels and milestone.
