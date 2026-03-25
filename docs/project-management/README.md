# Project Management Documentation

This directory contains comprehensive project management documentation for the Sovren Production Launch, organized for autonomous multi-agent development.

## Quick Links

- **Project Board**: https://github.com/users/zone17/projects/1
- **Repository**: https://github.com/zone17/Sovren
- **Epic Issues**: [#1](https://github.com/zone17/Sovren/issues/1) (Immediate), [#2](https://github.com/zone17/Sovren/issues/2) (Frontend), [#3](https://github.com/zone17/Sovren/issues/3) (Integration), [#4](https://github.com/zone17/Sovren/issues/4) (Production)

---

## Documentation Overview

### For Agents (Start Here)

📖 **[STORY_WORKFLOW.md](STORY_WORKFLOW.md)** - How to work with user stories

- Story lifecycle and phases
- How to update status via GitHub CLI
- Agent responsibilities and handoff procedures
- Example workflows (single-agent, multi-agent, blocked)
- **Read this first before starting any work**

### For Planning and Coordination

📊 **[DEPENDENCY_MAP.md](DEPENDENCY_MAP.md)** - Complete dependency analysis

- Visual dependency diagrams (Mermaid)
- Epic and story-level dependencies
- Critical path analysis (27 days)
- Blocking dependencies and mitigation strategies
- **Use this to understand what must be done first**

🔀 **[PARALLEL_STREAMS.md](PARALLEL_STREAMS.md)** - Parallel execution strategy

- Week-by-week execution plan
- Resource allocation (2-8 developers)
- Conflict avoidance strategy
- Integration points and merge order
- **Use this to maximize velocity with parallel work**

### For Project Managers

📈 **[PROJECT_BOARD_ENHANCEMENTS.md](PROJECT_BOARD_ENHANCEMENTS.md)** - Enhancement summary

- Current state analysis (67 stories, 4 epics)
- All enhancements delivered (custom fields, docs, diagrams)
- Success metrics and velocity tracking
- Risk assessment and mitigation
- **Comprehensive overview of project structure**

---

## Key Concepts

### Story Lifecycle

```
Backlog → Design → Implementation → Testing → Review → Done
```

Each story follows a 4-phase workflow:

1. **Design**: UX/UI mockups, architecture specs
2. **Implementation**: Code, components, services
3. **Testing**: Unit tests, integration tests (95%+ coverage)
4. **Review**: Code review, security review, approval

### Parallel Work Streams

**Maximum Parallelization**: Weeks 3-4 with 3 concurrent streams

- **Stream B1**: Content Creation (#27-41)
- **Stream B2**: Lightning Payments (#42-52)
- **Stream B3**: Subscription Tiers (#48-52)

**Velocity Multiplier**: 2.5x (vs sequential execution)
**Time Saved**: 3 weeks (15 working days)

### Critical Path

**Duration**: 27 working days (6 weeks)

```
Week 1: Fix Tests (#5-11)
   ↓
Week 2: NOSTR Auth (#12-26)
   ↓
Week 3: Content Creation (#27-41)
   ↓
Week 4: Lightning Payments (#42-52)
   ↓
Week 5: E2E Testing (#53-58)
   ↓
Week 6: Production Readiness (#63-71)
```

---

## Quick Start for Agents

### Step 1: Read the Workflow Guide

```bash
cat docs/project-management/STORY_WORKFLOW.md
```

### Step 2: Check Your Assigned Stories

```bash
# Open project board
gh project view 1 --owner zone17 --web

# Or list issues
gh issue list --repo zone17/Sovren --assignee @me --state open
```

### Step 3: Verify Dependencies

```bash
# Check if dependencies are met
gh issue view <ISSUE_NUMBER> --repo zone17/Sovren

# Look for "Blocked by" in issue description
# Ensure all blocking issues are closed
```

### Step 4: Start Work

```bash
# Update status to In Progress
./scripts/update-story-status.sh <ISSUE> "In Progress" 0 "<your-agent-name>"

# Example
./scripts/update-story-status.sh 12 "In Progress" 0 "design-ux-specialist"
```

### Step 5: Provide Updates

```bash
# Update progress periodically
./scripts/update-story-status.sh <ISSUE> "In Progress" 50 "<agent-name>" "Completed user flows"
```

### Step 6: Complete and Handoff

```bash
# Mark as done when 100%
./scripts/update-story-status.sh <ISSUE> "Done" 100 "<agent-name>" "All deliverables complete"

# Issue will auto-close
```

---

## Visual Diagrams

All diagrams are in `docs/architecture/diagrams/project-management/`

### Epic Dependencies

**File**: [epic-dependencies.mmd](../architecture/diagrams/project-management/epic-dependencies.mmd)
**Shows**: All 4 epics, story groupings, dependencies, parallel opportunities

### Critical Path

**File**: [critical-path.mmd](../architecture/diagrams/project-management/critical-path.mmd)
**Shows**: 6-week timeline, critical path stories, parallel paths

### Parallel Streams

**File**: [parallel-streams.mmd](../architecture/diagrams/project-management/parallel-streams.mmd)
**Shows**: 7 work streams, color-coded by type, timeline alignment

**View Diagrams**:

```bash
# View source
cat docs/architecture/diagrams/project-management/epic-dependencies.mmd

# Generate PNG (requires mermaid-cli)
mmdc -i docs/architecture/diagrams/project-management/epic-dependencies.mmd -o epic-dependencies.png
```

---

## GitHub Project Custom Fields

The project uses 10 fields for tracking:

| Field            | Type          | Purpose                                 | Update Via       |
| ---------------- | ------------- | --------------------------------------- | ---------------- |
| **Status**       | Single Select | Todo, In Progress, Done                 | Update script    |
| **Agent**        | Text          | Assigned agent name                     | Update script    |
| **Completion %** | Number        | 0-100% progress                         | Update script    |
| **Story Points** | Number        | Complexity (1-5)                        | Manual or script |
| **Priority**     | Single Select | Critical, High, Medium, Low             | Manual           |
| **Phase**        | Single Select | Design, Implementation, Testing, Review | Manual or script |
| **Labels**       | Tags          | epic:_, user-story, status:_, etc.      | Update script    |
| **Assignees**    | People        | GitHub usernames                        | Manual           |
| **Linked PRs**   | Links         | Auto-linked from PR description         | Automatic        |
| **Milestone**    | Milestone     | Epic milestone                          | Manual           |

**Update Command**:

```bash
./scripts/update-story-status.sh <ISSUE> <STATUS> <COMPLETION> <AGENT> [MESSAGE]
```

This automatically updates: Status, Agent, Completion %, Labels

---

## Epic Overview

### EPIC 1: Immediate Blockers (Week 1)

**Issues**: [#1](https://github.com/zone17/Sovren/issues/1) (Epic), #5-11 (Stories)
**Stories**: 7
**Duration**: 13 hours (~2 days)
**Focus**: Fix test infrastructure, security remediation
**Blocks**: All other epics

### EPIC 2: Frontend Critical Stories (Weeks 2-4)

**Issues**: [#2](https://github.com/zone17/Sovren/issues/2) (Epic), #12-52 (Stories)
**Stories**: 41
**Duration**: 3 weeks
**Focus**: NOSTR auth, content creation, Lightning payments, subscriptions
**Parallel Streams**: 3 (max parallelization)

### EPIC 3: Integration & Testing (Week 5)

**Issues**: [#3](https://github.com/zone17/Sovren/issues/3) (Epic), #53-62 (Stories)
**Stories**: 10
**Duration**: 5 days
**Focus**: E2E testing, NOSTR validation, accessibility audit
**Parallel Streams**: 2

### EPIC 4: Production Readiness (Week 6)

**Issues**: [#4](https://github.com/zone17/Sovren/issues/4) (Epic), #63-71 (Stories)
**Stories**: 9
**Duration**: 7 days
**Focus**: Security audit, performance optimization, monitoring, API docs
**Parallel Streams**: 2

**Total**: 67 stories across 4 epics, 6 weeks

---

## Story Decomposition Quality

✅ **EXCELLENT** - Already at optimal granularity

**Characteristics**:

- **Atomic**: Each story does one thing
- **Time-Boxed**: 0.5-1 day (1-point stories)
- **Independently Testable**: Clear acceptance criteria
- **Independently Deployable**: Can merge without breaking features
- **Clear DoD**: Unambiguous completion criteria

**Average Story Size**:

- EPIC 1: 1.9 hours (0.24 days)
- EPIC 2: 0.6 days
- EPIC 3: 0.5 days
- EPIC 4: 0.9 days

**No Changes Needed** - Stories already follow 1-point standard

---

## Communication Protocols

### Daily Standup Format

```
Stream B1 (Content Creation):
  - Yesterday: Completed ContentEditor (#32)
  - Today: MediaUploader implementation (#33)
  - Blockers: None

Stream B2 (Payments):
  - Yesterday: InvoiceDisplay component (#48)
  - Today: PaymentStatus updates (#49)
  - Blockers: Waiting for WebSocket endpoint (workaround: polling)
```

### Handoff Checklist

When passing work to next agent:

```markdown
☐ Code committed and pushed
☐ Branch clean (no WIP commits)
☐ Tests passing locally
☐ Documentation updated
☐ Next agent tagged in GitHub issue
☐ Handoff notes provided
☐ Deliverables list complete
```

### Cross-Stream Communication

Use GitHub issue comments to coordinate:

```markdown
@next-agent Ready for implementation.

**Deliverables**:

- User flow diagrams: docs/design/us-001-nostr-auth/flows/
- Wireframes: docs/design/us-001-nostr-auth/wireframes/
- Component specs: docs/design/us-001-nostr-auth/specs/

**Next Steps**:

1. Implement NOSTRAuthButton (#17)
2. Implement AuthModal (#18)
3. Follow component specs for props and state

**Dependencies**: None (all design assets ready)
```

---

## Troubleshooting

### Issue: Can't update project fields

**Solution**: Use the update script:

```bash
./scripts/update-story-status.sh <ISSUE> <STATUS> <COMPLETION> <AGENT>
```

### Issue: Story is blocked

**Solution**:

1. Add comment explaining blocker
2. Add "blocked" label
3. Find parallel work or notify PM

### Issue: Merge conflicts

**Solution**:

- Ensure working in correct feature directory
- Pull latest main before merging
- Follow merge order: content → payments → subscriptions

### Issue: Can't find dependencies

**Solution**:

- Check [DEPENDENCY_MAP.md](DEPENDENCY_MAP.md)
- Look for "Blocked by" in issue description
- Use gh to view linked issues

---

## Resources

### GitHub Documentation

- [Projects Documentation](https://docs.github.com/en/issues/planning-and-tracking-with-projects)
- [GitHub CLI Manual](https://cli.github.com/manual/)
- [GraphQL API](https://docs.github.com/en/graphql)

### Mermaid Diagrams

- [Mermaid Documentation](https://mermaid.js.org/)
- [Mermaid Live Editor](https://mermaid.live/)
- [GitHub Mermaid Support](https://github.blog/2022-02-14-include-diagrams-markdown-files-mermaid/)

### Agile Best Practices

- [Story Decomposition Guide](https://www.atlassian.com/agile/project-management/user-stories)
- [Dependency Mapping](https://www.scrum.org/resources/blog/dependency-management-scrum)
- [Parallel Development](https://www.scaledagileframework.com/team-and-technical-agility/)

---

## Success Metrics

Track these weekly:

| Metric                     | Current       | Target             | Status         |
| -------------------------- | ------------- | ------------------ | -------------- |
| Stories Completed          | 0/67          | 67/67              | 🔴 0%          |
| Epic Progress              | 0%            | 100%               | 🔴 Not Started |
| Test Coverage              | 95% (backend) | 85% (global)       | 🟢 Exceeded    |
| Velocity                   | TBD           | 11 stories/week    | -              |
| Parallelization Efficiency | TBD           | 0.65 (35% savings) | -              |

**Update Progress**:

```bash
# View project completion
gh project view 1 --owner zone17

# Calculate velocity
# (stories completed this week)
```

---

## Contact

For questions about project management or story workflow:

- Check this documentation first
- Review example workflows in STORY_WORKFLOW.md
- Check dependency map before starting work
- Contact project manager if blocked

---

**Documentation Version**: 1.0
**Last Updated**: 2025-11-06
**Maintained By**: Project Management Team
**Next Review**: Weekly (Mondays)
