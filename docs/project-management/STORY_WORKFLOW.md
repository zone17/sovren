# Story Workflow Guide for Agents

This guide explains how agents should interact with GitHub Projects to track story progress and update status throughout the development lifecycle.

## Table of Contents

1. [Project Structure](#project-structure)
2. [Story Lifecycle](#story-lifecycle)
3. [How to Update Story Status](#how-to-update-story-status)
4. [Custom Fields Reference](#custom-fields-reference)
5. [Agent Responsibilities](#agent-responsibilities)
6. [Example Workflows](#example-workflows)

---

## Project Structure

**Project Name**: Sovren Production Launch
**Project Number**: 1
**Owner**: zone17
**URL**: https://github.com/users/zone17/projects/1

### Epics

The project is organized into 4 main epics:

1. **EPIC-IMMEDIATE** (Issue #1) - Immediate Blockers (Week 1)
   - 7 stories
   - Focus: Fix test suite, security remediation, commit staged work

2. **EPIC-FRONTEND** (Issue #2) - Critical Frontend User Stories (Weeks 2-4)
   - 41 stories
   - Focus: NOSTR auth, content creation, Lightning payments, subscription management

3. **EPIC-INTEGRATION** (Issue #3) - Integration & Testing (Week 5)
   - 10 stories
   - Focus: E2E testing, NOSTR protocol validation, accessibility audit

4. **EPIC-PRODUCTION** (Issue #4) - Production Readiness (Week 6)
   - 9 stories
   - Focus: Security audit, performance optimization, monitoring, API docs

**Total Stories**: 67

---

## Story Lifecycle

Each user story follows a 4-phase lifecycle:

```
Backlog → Design → Implementation → Testing → Review → Done
```

### Phase Definitions

1. **Design Phase**: UX/UI design, architecture planning, technical specifications
   - Agent: `design-ux-specialist`, `architecture-specialist`
   - Deliverables: Mockups, diagrams, component specs

2. **Implementation Phase**: Actual coding and development
   - Agent: `elite-frontend-dev`, `backend-api-builder`
   - Deliverables: Code, components, services

3. **Testing Phase**: Unit tests, integration tests, test automation
   - Agent: `test-automation-engineer`, `e2e-testing-specialist`
   - Deliverables: Test suites, coverage reports

4. **Review Phase**: Code review, security review, quality gates
   - Agent: `code-review-specialist`, `security-engineer`
   - Deliverables: Review approval, merge to main

---

## How to Update Story Status

### Using GitHub CLI

Agents should use the `update_story_status.sh` script to update story progress:

```bash
# Basic usage
./scripts/update-story-status.sh <ISSUE_NUMBER> <STATUS> <COMPLETION_%> <AGENT_NAME>

# Example
./scripts/update-story-status.sh 12 "In Progress" 40 "design-ux-specialist"
```

### Manual Update via GitHub UI

1. Navigate to the project board: https://github.com/users/zone17/projects/1
2. Find the story card
3. Click to open the issue
4. Update the custom fields on the right sidebar:
   - **Status**: Todo, In Progress, or Done
   - **Phase**: Design, Implementation, Testing, or Review
   - **Agent**: Your agent name
   - **Completion %**: 0-100
   - **Story Points**: 1-5 (usually 1 for atomic stories)
   - **Priority**: Critical, High, Medium, Low

### Update via GraphQL API

For programmatic updates, use the GitHub GraphQL API:

```bash
gh api graphql -f query='
  mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: String!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: {text: $value}
    }) {
      projectV2Item {
        id
      }
    }
  }
' -f projectId="PVT_kwHOADc3Q84BHW4s" -f itemId="<ITEM_ID>" -f fieldId="<FIELD_ID>" -f value="<VALUE>"
```

---

## Custom Fields Reference

| Field Name       | Type          | Purpose                | Values                                        |
| ---------------- | ------------- | ---------------------- | --------------------------------------------- |
| **Status**       | Single Select | Current workflow state | Todo, In Progress, Done                       |
| **Phase**        | Single Select | Development phase      | Design, Implementation, Testing, Review       |
| **Agent**        | Text          | Assigned agent name    | Any agent name (e.g., "design-ux-specialist") |
| **Completion %** | Number        | Progress percentage    | 0-100                                         |
| **Story Points** | Number        | Complexity estimate    | 1-5 (target: 1-2 for atomic stories)          |
| **Priority**     | Single Select | Urgency level          | Critical, High, Medium, Low                   |
| **Labels**       | Tags          | Issue labels           | epic:\*, user-story, frontend, backend, etc.  |
| **Assignees**    | People        | GitHub assignees       | GitHub usernames                              |

### Field IDs (for GraphQL)

```
Status Field:        PVTSSF_lAHOADc3Q84BHW4szg4ItJE
Agent Field:         PVTF_lAHOADc3Q84BHW4szg4N3wk
Completion % Field:  PVTF_lAHOADc3Q84BHW4szg4N33Q
Story Points Field:  PVTF_lAHOADc3Q84BHW4szg4N3wg
Priority Field:      PVTSSF_lAHOADc3Q84BHW4szg4N38c
Phase Field:         PVTSSF_lAHOADc3Q84BHW4szg4N38g
```

---

## Agent Responsibilities

### During Story Execution

1. **At Start**:
   - Update Status to "In Progress"
   - Set Phase to your phase (Design, Implementation, Testing, Review)
   - Set Agent to your name
   - Set Completion % to 0

2. **During Work**:
   - Update Completion % incrementally (e.g., 25%, 50%, 75%)
   - Add comments to the issue with progress updates
   - Link commits/PRs to the issue

3. **At Completion**:
   - Update Completion % to 100
   - Update Status to "Done" (if final phase) or pass to next agent
   - Add final comment with deliverables
   - Close issue if story is complete

### Handoff Between Agents

When multiple agents work on a story sequentially:

```
design-ux-specialist (Design Phase, 0-40%)
  ↓ handoff
elite-frontend-dev (Implementation Phase, 40-70%)
  ↓ handoff
test-automation-engineer (Testing Phase, 70-90%)
  ↓ handoff
code-review-specialist (Review Phase, 90-100%)
```

**Handoff Process**:

1. Completing agent:
   - Updates Completion % to phase milestone (e.g., 40%)
   - Adds comment tagging next agent
   - Updates Phase to next phase

2. Next agent:
   - Updates Agent field to their name
   - Confirms receipt in comment
   - Begins work

---

## Example Workflows

### Example 1: Simple Single-Agent Story

**Story**: IMMED-001 - Fix Jest Configuration Collision
**Agent**: None (direct fix)
**Estimated Hours**: 2.0

```bash
# Start work
./scripts/update-story-status.sh 5 "In Progress" 0 "direct-fix"

# Progress updates
# (work on fixing Jest config)
./scripts/update-story-status.sh 5 "In Progress" 50 "direct-fix"

# Complete work
./scripts/update-story-status.sh 5 "Done" 100 "direct-fix"
gh issue close 5 --repo zone17/Sovren --comment "✅ Jest configuration fixed. All tests passing."
```

### Example 2: Multi-Agent Story (NOSTR Auth)

**Story**: FE-001 through FE-011 - NOSTR Authentication UI
**Agents**: design-ux-specialist → elite-frontend-dev → test-automation-engineer → code-review-specialist

#### Phase 1: Design (Issues #12-16)

```bash
# Agent: design-ux-specialist
# Story: FE-001 - Design NOSTR Auth User Flows

# Start design phase
./scripts/update-story-status.sh 12 "In Progress" 0 "design-ux-specialist"
gh issue comment 12 --repo zone17/Sovren --body "🎨 Starting user flow design for NOSTR authentication"

# Progress update
./scripts/update-story-status.sh 12 "In Progress" 50 "design-ux-specialist"

# Complete design
./scripts/update-story-status.sh 12 "Done" 100 "design-ux-specialist"
gh issue comment 12 --repo zone17/Sovren --body "✅ Design complete. Deliverables:
- User flow diagrams (4 flows)
- Mermaid files in docs/design/us-001-nostr-auth/flows/
- PNG exports for stakeholders

📁 Files committed: [commit hash]
👉 Ready for implementation by elite-frontend-dev"

gh issue close 12 --repo zone17/Sovren
```

#### Phase 2: Implementation (Issues #17-21)

```bash
# Agent: elite-frontend-dev
# Story: FE-006 - Implement NOSTRAuthButton Component

# Start implementation
./scripts/update-story-status.sh 17 "In Progress" 0 "elite-frontend-dev"
gh issue comment 17 --repo zone17/Sovren --body "⚛️ Starting NOSTRAuthButton implementation
Design reference: docs/design/us-001-nostr-auth/
Target: packages/frontend/src/features/auth/components/NOSTRAuthButton.tsx"

# Progress updates
./scripts/update-story-status.sh 17 "In Progress" 33 "elite-frontend-dev"
# (component structure complete)

./scripts/update-story-status.sh 17 "In Progress" 66 "elite-frontend-dev"
# (extension detection logic added)

# Complete implementation
./scripts/update-story-status.sh 17 "Done" 100 "elite-frontend-dev"
gh issue comment 17 --repo zone17/Sovren --body "✅ Implementation complete. Deliverables:
- NOSTRAuthButton component with extension detection
- Props: onAuthSuccess, onAuthError, buttonText
- Detects: Alby, nos2x, Nostrum extensions
- Fallback to manual key input

📁 Files: packages/frontend/src/features/auth/components/NOSTRAuthButton.tsx
🔗 Commit: [commit hash]
📖 Storybook story added
👉 Ready for testing by test-automation-engineer"

gh issue close 17 --repo zone17/Sovren
```

#### Phase 3: Testing (Issues #22-26)

```bash
# Agent: test-automation-engineer
# Story: FE-011 - Write NOSTR Auth Integration Tests

# Start testing
./scripts/update-story-status.sh 22 "In Progress" 0 "test-automation-engineer"
gh issue comment 22 --repo zone17/Sovren --body "🧪 Starting integration tests for NOSTR auth
Code under test: packages/frontend/src/features/auth/
Target coverage: 95%+"

# Progress
./scripts/update-story-status.sh 22 "In Progress" 50 "test-automation-engineer"
# (unit tests complete)

./scripts/update-story-status.sh 22 "In Progress" 75 "test-automation-engineer"
# (integration tests complete)

# Complete testing
./scripts/update-story-status.sh 22 "Done" 100 "test-automation-engineer"
gh issue comment 22 --repo zone17/Sovren --body "✅ Testing complete. Results:
- Unit tests: 42 passing
- Integration tests: 8 passing
- Coverage: 97.3% (exceeds 95% target)
- All tests passing in CI/CD

📁 Files: packages/frontend/src/features/auth/__tests__/
📊 Coverage report: [link]
👉 Ready for code review"

gh issue close 22 --repo zone17/Sovren
```

#### Phase 4: Review (Story-Level)

```bash
# Agent: code-review-specialist
# Review all NOSTR auth stories collectively

gh issue comment 2 --repo zone17/Sovren --body "📋 Code Review - NOSTR Authentication (US-001/005)

## Review Summary
**Stories Reviewed**: FE-001 through FE-026 (26 stories)
**Code Location**: packages/frontend/src/features/auth/

## Quality Gates ✅

### Code Quality
- ✅ TypeScript strict mode compliance
- ✅ Zero ESLint/Prettier violations
- ✅ Proper error handling throughout
- ✅ Loading states implemented

### Architecture
- ✅ Feature-based structure followed
- ✅ Service layer properly abstracted
- ✅ Redux integration correct
- ✅ API client usage proper

### Testing
- ✅ Coverage 97.3% (exceeds 95% target)
- ✅ Critical paths tested
- ✅ Edge cases covered
- ✅ Mocks properly implemented

### Security
- ✅ Private keys never logged
- ✅ Secure storage patterns
- ✅ XSS prevention implemented
- ✅ CSRF token handling correct

### Performance
- ✅ No unnecessary re-renders
- ✅ Proper memoization (React.memo, useMemo)
- ✅ Bundle size impact: +45KB (acceptable)

### Documentation
- ✅ JSDoc comments complete
- ✅ README updated
- ✅ Storybook stories working
- ✅ CHANGELOG.md updated

## Recommendation: ✅ APPROVED FOR MERGE

**Next Steps**:
1. Create PR for NOSTR auth feature
2. Merge to main after CI/CD passes
3. Deploy to staging for QA validation

**Reviewed by**: code-review-specialist
**Review Date**: 2025-11-06"
```

### Example 3: Blocked Story

If a story gets blocked:

```bash
# Update to blocked status
gh issue comment 25 --repo zone17/Sovren --body "🚫 BLOCKED: Cannot proceed with Lightning payment implementation

**Blocker**: Waiting for backend Lightning service endpoint deployment
**Blocked By**: Issue #60 (Backend Lightning API)
**Impact**: Cannot implement frontend payment flow without API
**ETA**: 2 days (Nov 8)

**Action Items**:
1. Backend team to prioritize Lightning API deployment
2. Frontend can proceed with UI design and mocks
3. Will integrate with real API once available

**Workaround**: Using mocked API responses for development"

# Update project field (requires GraphQL or manual update)
# Set a "Blocked" label on the issue
gh issue edit 25 --repo zone17/Sovren --add-label "blocked"
```

---

## Best Practices

### 1. Frequent Updates

Update status at least twice per day:

- Morning: Start of work
- Evening: Progress update or completion

### 2. Clear Communication

Always add a comment when updating status to explain:

- What was done
- What's next
- Any blockers or issues

### 3. Link Everything

Link related artifacts to the issue:

- Commits: Use "Fixes #123" or "Relates to #123" in commit messages
- PRs: Auto-link by mentioning issue number in PR description
- Documentation: Link to design files, diagrams, test reports

### 4. Definition of Done

Before marking story as "Done", verify:

- All subtasks completed
- Code committed and pushed
- Tests passing (95%+ coverage)
- Documentation updated
- PR created (if applicable)
- Code review approved (if multi-agent story)

### 5. Handoff Protocol

When passing work to next agent:

- Tag them in comment: @next-agent
- Provide clear handoff notes
- List deliverables and their locations
- Update Phase field
- Set Completion % to phase milestone

---

## Troubleshooting

### Issue: Can't update project fields

**Solution**: Use the update script or GraphQL API. GitHub UI sometimes has delays.

```bash
# Use the script
./scripts/update-story-status.sh <ISSUE_NUMBER> <STATUS> <COMPLETION> <AGENT>
```

### Issue: Story is blocked

**Solution**:

1. Add comment explaining blocker
2. Add "blocked" label
3. Update dependency information
4. Notify project manager
5. Find workaround or parallel work

### Issue: Multiple agents working on same story

**Solution**:

- Break story into smaller substories (one per agent)
- Use clear handoff protocol
- Update Agent field when taking over
- Previous agent updates Completion % before handoff

---

## Quick Reference Commands

```bash
# View project board
gh project view 1 --owner zone17 --web

# List all project issues
gh issue list --repo zone17/Sovren --label "user-story" --state open

# Update story status
./scripts/update-story-status.sh <ISSUE_NUMBER> <STATUS> <COMPLETION_%> <AGENT_NAME>

# Add comment to issue
gh issue comment <ISSUE_NUMBER> --repo zone17/Sovren --body "Your comment"

# Close issue
gh issue close <ISSUE_NUMBER> --repo zone17/Sovren --comment "Completion comment"

# View issue details
gh issue view <ISSUE_NUMBER> --repo zone17/Sovren --web
```

---

## Support

For questions or issues with the workflow:

- Check this guide first
- Review example workflows above
- Check GitHub Projects documentation: https://docs.github.com/en/issues/planning-and-tracking-with-projects
- Contact project manager

---

**Document Version**: 1.0
**Last Updated**: 2025-11-06
**Maintained By**: Project Management Team
