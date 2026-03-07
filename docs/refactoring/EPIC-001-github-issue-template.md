# GitHub Issue Template for Epic 001 Stories

Use this template when creating GitHub issues for each story.

---

## Story Template

````markdown
## Story [STORY-ID]: [Story Title]

**Epic**: #[epic-issue-number] - Type Safety Improvements
**Priority**: [High/Medium/Low/Critical]
**Size**: 1 point (2-3 hours)
**Work Stream**: [Stream A: Frontend / Stream B: Shared / Stream C: API / Stream D: Strict Mode]
**Risk**: [Low/Medium/High]

---

### User Story

**As a** [user type]
**I want** [specific capability]
**So that** [business benefit]

---

### Acceptance Criteria

- [ ] **Given** [context]
      **When** [action]
      **Then** [expected outcome]

- [ ] **Given** [context]
      **When** [action]
      **Then** [expected outcome]

- [ ] **Given** [context]
      **When** [action]
      **Then** [expected outcome]

---

### Technical Implementation

**Files to Modify**:

- `path/to/file1.ts`
- `path/to/file2.tsx`

**Approach**:

```typescript
// Code examples showing before/after
```
````

**Type Patterns**:

- [List key type patterns to use]

---

### Dependencies

**Blocked by**: [None / Story #X]
**Blocks**: [Story #X]
**Related to**: [Story #X, Story #Y]

---

### Parallel Work Opportunities

**Can work simultaneously with**: [Story #X, #Y, #Z]
**Work stream**: `[stream-label]`
**Rationale**: [Why parallel work is safe]

---

### Definition of Done

- [ ] All acceptance criteria met
- [ ] TypeScript compiler shows no errors
- [ ] All existing tests continue to pass
- [ ] New tests added for new functionality
- [ ] No new ESLint warnings for explicit-any
- [ ] IDE autocomplete works correctly
- [ ] Code review completed and approved
- [ ] Security review completed (if required)
- [ ] Documentation updated (if needed)
- [ ] PR merged to main branch

---

### Security Considerations

[If security-sensitive story:]

- [List security requirements]
- [List security tests needed]

[If not security-sensitive:]

- No security vulnerabilities introduced by type changes

---

### Testing Requirements

**Unit Tests**:

- [Test description]
- [Test description]

**Integration Tests** (if applicable):

- [Test description]

**Security Tests** (if required):

- [Test description]

---

### Performance Requirements

- [Specific performance requirement, e.g., "No performance impact"]
- Build time increase: < [X]ms

---

### Estimated Complexity

**Size**: 1 point ([X] hours)
**Breakdown**:

- [x] hour: [Task description]
- [x] hour: [Task description]
- [x] hour: [Task description]

**Priority**: [High/Medium/Low/Critical]
**Risk**: [Low/Medium/High] - [Risk explanation]

---

### Labels

Apply these labels to this issue:

- `epic-001-type-safety`
- `type-refactoring`
- `1-point-story`
- `stream-[a/b/c/d]-[frontend/shared/api/strict]`
- `priority-[critical/high/medium/low]`
- `risk-[low/medium/high]`
- `sprint-[0/1]-[foundation/strict-mode]`
- `security-review-required` (if applicable)

---

### Assignee

- [Developer Name]

---

### Linked Issues

- Epic: #[epic-issue-number]
- Blocked by: #[issue-number]
- Blocks: #[issue-number]
- Related: #[issue-number]

````

---

## Example: Story 1

Here's a complete example for Story 1:

```markdown
## Story EPIC-001-S01: Replace `any` in Event Handlers and Form Components

**Epic**: #XXX - Type Safety Improvements
**Priority**: High
**Size**: 1 point (2-3 hours)
**Work Stream**: Stream A: Frontend Types
**Risk**: Low

---

### User Story

**As a** frontend developer
**I want** properly typed event handlers and form component props
**So that** I get accurate IDE autocomplete and compile-time error detection for user interactions

---

### Acceptance Criteria

- [ ] **Given** a React component with event handlers
      **When** TypeScript analyzes the component
      **Then** all event handlers use proper React event types (MouseEvent, ChangeEvent, FormEvent, etc.)

- [ ] **Given** form components with input handlers
      **When** developers implement onChange/onSubmit handlers
      **Then** TypeScript infers correct event target types without casting

- [ ] **Given** custom event handlers with data payloads
      **When** events are dispatched
      **Then** payload types are validated at compile time

---

### Technical Implementation

**Files to Modify**:
- `packages/frontend/src/pages/Login.tsx`
- `packages/frontend/src/pages/Signup.tsx`
- `packages/frontend/src/pages/Profile.tsx`
- `packages/frontend/src/pages/Post.tsx`

**Approach**:
```typescript
// BEFORE (incorrect)
const handleSubmit = (e: any) => {
  e.preventDefault();
  const formData = new FormData(e.target);
};

// AFTER (correct)
const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const formData = new FormData(e.currentTarget);
};

// BEFORE (incorrect)
const handleChange = (e: any) => {
  setValue(e.target.value);
};

// AFTER (correct)
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setValue(e.currentTarget.value);
};
````

**Type Patterns**:

- `React.FormEvent<HTMLFormElement>` for form submissions
- `React.ChangeEvent<HTMLInputElement>` for input changes
- `React.MouseEvent<HTMLButtonElement>` for button clicks
- `React.KeyboardEvent<HTMLInputElement>` for keyboard events

---

### Dependencies

**Blocked by**: None (can start immediately)
**Blocks**: Story #11 (strict mode depends on this)
**Related to**: Story #2 (API response types), Story #5 (test utilities)

---

### Parallel Work Opportunities

**Can work simultaneously with**: Stories #2, #3, #4, #5, #6, #7, #8, #9, #10
**Work stream**: `stream-a-frontend`
**Rationale**: No shared dependencies with other stories; modifications are isolated to page components

---

### Definition of Done

- [ ] All event handlers in Login.tsx use proper React.FormEvent types
- [ ] All event handlers in Signup.tsx use proper React.ChangeEvent types
- [ ] All event handlers in Profile.tsx use proper event types
- [ ] All event handlers in Post.tsx use proper event types
- [ ] TypeScript compiler shows no errors for these files
- [ ] All existing tests continue to pass
- [ ] No new ESLint warnings for explicit-any
- [ ] IDE autocomplete works correctly for event properties
- [ ] Code review approved by team member

---

### Security Considerations

- Input validation types ensure proper data sanitization at compile time
- Form event types prevent XSS vulnerabilities through type-safe value access
- No security vulnerabilities introduced by type changes

---

### Testing Requirements

**Unit Tests**:

- Test that form submission handlers receive correct event types
- Test that input change handlers receive correct target types
- Test that existing component tests still pass with new types

**Manual Testing**:

- Verify IDE autocomplete works for event.currentTarget
- Verify no runtime errors when interacting with forms
- Test all form submission flows (login, signup, profile update, post creation)

---

### Performance Requirements

- No performance impact (compile-time only change)
- Build time increase: < 1 second

---

### Estimated Complexity

**Size**: 1 point (2-3 hours)
**Breakdown**:

- 1 hour: Update all event handler types
- 0.5 hour: Fix any type errors revealed
- 0.5 hour: Run tests and verify
- 1 hour: Code review buffer

**Priority**: High
**Risk**: Low - Well-understood React event types with comprehensive test coverage

---

### Labels

- `epic-001-type-safety`
- `type-refactoring`
- `1-point-story`
- `stream-a-frontend`
- `priority-high`
- `risk-low`
- `sprint-0-foundation`

---

### Assignee

- [Frontend Developer Name]

---

### Linked Issues

- Epic: #XXX
- Blocks: #XXX (Story 11)
- Related: #XXX (Story 2), #XXX (Story 5)

````

---

## Bulk Issue Creation Script

Use this script to create all 12 issues at once using GitHub CLI:

```bash
#!/bin/bash

# Epic 001: Type Safety Improvements - Bulk Issue Creation
# Requires: gh CLI installed and authenticated

EPIC_NUMBER="XXX" # Replace with actual Epic issue number

# Story 1
gh issue create \
  --title "EPIC-001-S01: Replace any in Event Handlers and Form Components" \
  --body-file story-01-body.md \
  --label "epic-001-type-safety,type-refactoring,1-point-story,stream-a-frontend,priority-high,risk-low,sprint-0-foundation" \
  --assignee "@me"

# Story 2
gh issue create \
  --title "EPIC-001-S02: Type API Response Handlers with Proper Interfaces" \
  --body-file story-02-body.md \
  --label "epic-001-type-safety,type-refactoring,1-point-story,stream-a-frontend,priority-high,risk-low,sprint-0-foundation" \
  --assignee "@me"

# Story 3
gh issue create \
  --title "EPIC-001-S03: Replace any in Validation Middleware" \
  --body-file story-03-body.md \
  --label "epic-001-type-safety,type-refactoring,1-point-story,stream-a-frontend,priority-high,risk-medium,sprint-0-foundation,security-review-required" \
  --assignee "@me"

# Story 4
gh issue create \
  --title "EPIC-001-S04: Type Email Service Templates and Methods" \
  --body-file story-04-body.md \
  --label "epic-001-type-safety,type-refactoring,1-point-story,stream-a-frontend,priority-medium,risk-low,sprint-0-foundation" \
  --assignee "@me"

# Story 5
gh issue create \
  --title "EPIC-001-S05: Type Test Utilities and Mock Providers" \
  --body-file story-05-body.md \
  --label "epic-001-type-safety,type-refactoring,1-point-story,stream-a-frontend,priority-medium,risk-low,sprint-0-foundation" \
  --assignee "@me"

# Story 6
gh issue create \
  --title "EPIC-001-S06: Replace any in Quality Metrics Types with Proper Zod Schemas" \
  --body-file story-06-body.md \
  --label "epic-001-type-safety,type-refactoring,1-point-story,stream-b-shared,priority-high,risk-low,sprint-0-foundation" \
  --assignee "@me"

# Story 7
gh issue create \
  --title "EPIC-001-S07: Type NOSTR Key Management Interfaces" \
  --body-file story-07-body.md \
  --label "epic-001-type-safety,type-refactoring,1-point-story,stream-b-shared,priority-medium,risk-low,sprint-0-foundation,security-review-required" \
  --assignee "@me"

# Story 8
gh issue create \
  --title "EPIC-001-S08: Type Environment Validator with Proper Type Guards" \
  --body-file story-08-body.md \
  --label "epic-001-type-safety,type-refactoring,1-point-story,stream-b-shared,priority-low,risk-low,sprint-0-foundation" \
  --assignee "@me"

# Story 9
gh issue create \
  --title "EPIC-001-S09: Type API Route Handlers with Proper Request/Response Types" \
  --body-file story-09-body.md \
  --label "epic-001-type-safety,type-refactoring,1-point-story,stream-c-api,priority-high,risk-medium,sprint-0-foundation,security-review-required" \
  --assignee "@me"

# Story 10
gh issue create \
  --title "EPIC-001-S10: Type NOSTR Service Event Validation" \
  --body-file story-10-body.md \
  --label "epic-001-type-safety,type-refactoring,1-point-story,stream-c-api,priority-medium,risk-low,sprint-0-foundation" \
  --assignee "@me"

# Story 11
gh issue create \
  --title "EPIC-001-S11: Enable Stricter TypeScript Compiler Options Incrementally" \
  --body-file story-11-body.md \
  --label "epic-001-type-safety,type-refactoring,1-point-story,stream-d-strict,priority-critical,risk-medium,sprint-1-strict-mode" \
  --assignee "@me"

# Story 12
gh issue create \
  --title "EPIC-001-S12: Fix Strict Mode Violations and Validate Type Coverage" \
  --body-file story-12-body.md \
  --label "epic-001-type-safety,type-refactoring,1-point-story,stream-d-strict,priority-critical,risk-low,sprint-1-strict-mode" \
  --assignee "@me"

echo "All 12 issues created successfully!"
````

---

## Manual Issue Creation Checklist

If creating issues manually through GitHub UI:

### For Each Story:

1. **Create New Issue**
   - [ ] Click "New Issue" button
   - [ ] Paste title from template
   - [ ] Paste body from story breakdown document

2. **Apply Labels**
   - [ ] `epic-001-type-safety`
   - [ ] `type-refactoring`
   - [ ] `1-point-story`
   - [ ] Work stream label (stream-a/b/c/d)
   - [ ] Priority label (critical/high/medium/low)
   - [ ] Risk label (low/medium/high)
   - [ ] Sprint label (sprint-0/1)
   - [ ] `security-review-required` (if applicable)

3. **Link to Epic**
   - [ ] In issue body, reference Epic number: `#XXX`
   - [ ] In Epic issue, add link to story

4. **Set Project**
   - [ ] Add to "Epic 001: Type Safety" project board
   - [ ] Set column to "Sprint 0" or "Sprint 1"

5. **Assign Developer**
   - [ ] Assign to appropriate developer based on work stream

6. **Set Milestone** (optional)
   - [ ] Create milestone "Epic 001: Type Safety"
   - [ ] Add story to milestone

---

## Post-Creation Tasks

After creating all 12 issues:

1. **Update Epic Issue**
   - [ ] Add checklist of all 12 story links
   - [ ] Add dependency information
   - [ ] Add work stream assignments

2. **Create Project Board**
   - [ ] Create columns: Sprint 0, Sprint 1, In Progress, In Review, Done
   - [ ] Add all stories to appropriate sprint columns

3. **Notify Team**
   - [ ] Post in #engineering Slack channel
   - [ ] Include links to all documentation
   - [ ] Schedule kickoff meeting

4. **Set Up Automation** (optional)
   - [ ] Auto-move to "In Progress" when issue assigned
   - [ ] Auto-move to "In Review" when PR opened
   - [ ] Auto-move to "Done" when PR merged

---

**Template Version**: 1.0
**Last Updated**: 2025-10-23
