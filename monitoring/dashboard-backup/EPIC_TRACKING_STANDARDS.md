# Epic Tracking Standards for Agent Orchestration Dashboard

## Overview

This document defines the standards and conventions for tracking epics and user stories in the Sovren Agent Orchestration Dashboard. These standards ensure consistent display, accurate metadata, and seamless integration across all epics.

**Last Updated**: 2025-10-26
**Applies To**: Epic 003, Epic 004, Epic 005, and all future epics

---

## Epic Structure

### Epic Hierarchy

```
Project
└── Epic (High-level initiative)
    └── User Stories (1-point granular tasks)
        └── Tasks/Subtasks (agent execution steps)
```

### Data Structure

**Epic Parent Task**:
```json
{
  "id": "epic-{number}-parent",
  "type": "epic",
  "name": "Epic {number}: {Epic Name} - {X}/{Total} complete",
  "agent": "project-orchestrator",
  "status": "pending|in_progress|completed",
  "progress_percent": 0-100,
  "started_at": "ISO 8601 timestamp or null",
  "completed_at": "ISO 8601 timestamp or null"
}
```

**User Story Task**:
```json
{
  "id": "story-us-{number}-{timestamp}",
  "type": "story",
  "story_id": "US-{number}",
  "name": "US-{number}: {Story Name}",
  "description": "{User story description}",
  "agent": "{agent-name}|unassigned",
  "agent_type": "{backend|frontend|testing|documentation|monitoring|cicd|tech-architecture}",
  "status": "pending|in_progress|testing|completed",
  "progress_percent": 0-100,
  "started_at": "ISO 8601 timestamp or null",
  "completed_at": "ISO 8601 timestamp or null",
  "epic_label": "Epic {number}: {Epic Name}",
  "priority": "P0|P1|P2",
  "files_modified": [],
  "test_coverage": null|number
}
```

---

## Epic Naming Conventions

### Epic Numbers
- **Epic 003**: NOSTR Consolidation
- **Epic 004**: State Management
- **Epic 005**: Backend Services
- **Epic 006+**: Future epics (sequential numbering)

### Story ID Format
- **Epic 003**: US-301 through US-326 (26 stories)
- **Epic 004**: US-401 through US-425 (25 stories)
- **Epic 005**: US-501 through US-542 (42 stories)

**Pattern**: `US-{epic_number}{sequential_number}`
- Epic 003: 3XX series
- Epic 004: 4XX series
- Epic 005: 5XX series

---

## Agent Type Classification

All user stories must have a valid `agent_type` for proper color coding in the Kanban board.

### Valid Agent Types

| Agent Type | Color | Icon | Example Stories |
|------------|-------|------|-----------------|
| `backend` | Green | 🔧 | API services, database migrations, backend refactoring |
| `frontend` | Blue | 🎨 | React components, UI state, frontend features |
| `testing` | Yellow | 🧪 | Unit tests, integration tests, E2E tests |
| `documentation` | Purple | 📝 | Developer docs, architecture diagrams, guides |
| `monitoring` | Orange | 📊 | Observability, metrics, alerting |
| `cicd` | Teal | 🚀 | CI/CD pipelines, deployment automation |
| `tech-architecture` | Pink | 🏗️ | Architecture decisions, design patterns |

### Agent Type Assignment Rules

1. **Backend**: Server-side code, APIs, databases, services
2. **Frontend**: Client-side React, UI components, styling
3. **Testing**: Any testing-focused story (unit, integration, E2E)
4. **Documentation**: Documentation, diagrams, guides, ADRs
5. **Monitoring**: Observability, logging, metrics, alerts
6. **CI/CD**: Build, deployment, automation pipelines
7. **Tech-Architecture**: Design, architecture, patterns, decisions

---

## Epic Lifecycle

### Status Progression

```
EPIC STATUSES:
pending → in_progress → completed

STORY STATUSES:
pending → in_progress → testing → completed
```

### Story Status Definitions

| Status | Meaning | Kanban Lane | Agent Assignment |
|--------|---------|-------------|------------------|
| `pending` | Not started, in backlog | To Do | Usually `unassigned` |
| `in_progress` | Active work by agent | In Progress | Assigned to specific agent |
| `testing` | Implementation complete, under test | Testing | Usually test automation agent |
| `completed` | Fully done, tested, merged | Complete | Shows completing agent |

---

## Epic Metadata Requirements

### Required Fields

Every story **MUST** have:
- ✅ `story_id` (e.g., "US-401")
- ✅ `name` (format: "US-XXX: Story Name")
- ✅ `epic_label` (e.g., "Epic 004: State Management")
- ✅ `agent_type` (one of the 7 valid types)
- ✅ `status` (valid status value)
- ✅ `priority` (P0, P1, or P2)

### Optional But Recommended

- ⚠️ `description` - Brief summary of the story
- ⚠️ `started_at` - When work began (set when status becomes in_progress)
- ⚠️ `completed_at` - When work finished (set when status becomes completed)
- ⚠️ `files_modified` - Array of file paths changed
- ⚠️ `test_coverage` - Percentage (0-100) or null

---

## Story Details Templates

All user stories should have detailed templates in `app.js` → `getStoryDetails()` function.

### Template Structure

```javascript
'US-XXX': {
  description: 'As a {role}, I want {feature} so that {benefit}',
  outcome: '{What will be achieved}',
  definitionOfDone: [
    'Item 1: Specific, measurable criteria',
    'Item 2: Clear acceptance criterion',
    'Item 3: Technical requirement',
    // ... 5-8 total items
  ]
}
```

### Template Guidelines

1. **Description**: Follow "As a... I want... so that..." user story format
2. **Outcome**: Clear, measurable result of completing the story
3. **Definition of Done**: 5-8 specific, testable acceptance criteria
4. **Completeness**: All stories should have templates (no generic placeholders)

---

## Duration Tracking

### Timestamp Requirements

```javascript
// When story starts:
started_at: new Date().toISOString()

// When story completes:
completed_at: new Date().toISOString()
```

### Duration Calculation

```javascript
const duration = (new Date(completed_at) - new Date(started_at)) / 1000; // seconds
const minutes = Math.floor(duration / 60);
const seconds = duration % 60;
const durationString = `${minutes}m ${seconds}s`;
```

### Duration Display

- **Complete stories**: Show actual duration (e.g., "17m 6s")
- **In-progress stories**: Show elapsed time or progress percentage
- **Pending stories**: No duration shown

---

## Dashboard Display Standards

### Kanban Board

**Lane Organization**:
1. **To Do**: `status === 'pending' || status === 'queued'`
2. **In Progress**: `status === 'in_progress' || status === 'active'`
3. **Testing**: `status === 'testing' || status === 'review'`
4. **Complete**: `status === 'completed' || status === 'done'`

**Card Display**:
```
┌─────────────────────────────────────┐
│ EPIC 004: State Management          │ ← Epic label badge
│                                      │
│ US-401  Audit Redux Store Structure │ ← Story ID + Title
│                                      │
│ 🔧 backend-api-builder               │ ← Agent badge (if assigned)
└─────────────────────────────────────┘
```

### Story Detail Modal

**Required Sections**:
1. Epic label
2. Story ID and title
3. User story description
4. Desired outcome
5. Definition of done (with checkmarks if completed)
6. Agent information (if assigned)
7. Duration (if completed)
8. Progress percentage

---

## Agent Assignment Standards

### Unassigned Stories

Stories in backlog should use:
```json
{
  "agent": "unassigned",
  "agent_type": "backend|frontend|testing|..." // Still specify type
}
```

### Active Stories

When an agent starts work:
```json
{
  "agent": "backend-api-builder", // Specific agent name
  "agent_type": "backend",
  "status": "in_progress",
  "started_at": "2025-10-26T14:00:00.000Z"
}
```

### Agent Naming Convention

Valid agent names:
- `backend-api-builder`
- `elite-frontend-dev`
- `test-automation-engineer`
- `technical-docs-writer`
- `monitoring-observability-architect`
- `cicd-pipeline-architect`
- `tech-architecture-planner`
- `project-orchestrator`

---

## Priority System

### Priority Levels

| Priority | Meaning | When to Use |
|----------|---------|-------------|
| **P0** | Critical path, blocking | Must complete first, blocks other work |
| **P1** | High priority | Important but not blocking |
| **P2** | Medium priority | Can be deferred if needed |

### Priority Assignment Rules

1. **Foundation stories** (audits, guidelines, setup): P0
2. **Core functionality**: P1
3. **Nice-to-have features**: P2
4. **Documentation** (unless blocking): P1-P2
5. **Testing** (critical paths): P0, others P1

---

## Epic Completion Tracking

### Parent Epic Update

When stories complete, update the epic parent:

```javascript
const totalStories = 25; // Epic 004
const completedStories = tasks.filter(t =>
  t.epic_label === 'Epic 004: State Management' &&
  (t.status === 'completed' || t.status === 'done')
).length;

const progressPercent = Math.round((completedStories / totalStories) * 100);

epicParent.name = `Epic 004: State Management - ${completedStories}/${totalStories} complete`;
epicParent.progress_percent = progressPercent;

if (completedStories === totalStories) {
  epicParent.status = 'completed';
  epicParent.completed_at = new Date().toISOString();
}
```

---

## Export Report Standards

### Epic Completion Reports

Reports should include:
1. **Executive Summary**: Epic count, story count, completion %
2. **Epic Breakdown**: Stories per epic
3. **Agent Distribution**: Who completed what
4. **Story Details**: Full information for each completed story
5. **Metadata**: Timestamps, durations, test coverage

### Report Format

```markdown
# Epic Completion Report

**Generated**: {date}

## Executive Summary
- Total Epics: {count}
- Total Stories Completed: {count}
- Completion Rate: {percent}%

## Epic XXX: {Name}

**Stories Completed**: {count}

### Agent Breakdown
- 🔧 backend-api-builder: {count} stories
- 🎨 elite-frontend-dev: {count} stories

### Completed Stories

#### 1. US-XXX: {Story Name}

**Completed By**: {agent} ({agent_type})
**Completed On**: {date}
**Duration**: {time}

**User Story**: {description}
**Desired Outcome**: {outcome}
**Definition of Done**:
1. ✅ {criterion 1}
2. ✅ {criterion 2}
...
```

---

## File Organization

### Required Files

```
monitoring/dashboard/
├── data/
│   └── tasks.json                    # Main data file (all epics)
├── scripts/
│   ├── add-epic-004-005-stories.js  # Epic population script
│   ├── restore-epic-003-data.js     # Epic 003 restoration
│   └── verify-kanban-data.js        # Data validation
├── public/
│   ├── index.html                    # Dashboard UI (v3.4+)
│   ├── app.js                        # Client logic (story templates)
│   └── styles.css                    # Kanban styling
└── docs/
    ├── EPIC_TRACKING_STANDARDS.md   # This document
    ├── STORY_METADATA_COMPLETE.md   # Epic 003 metadata guide
    └── EXPORT_FEATURE_SUMMARY.md    # Export functionality docs
```

---

## Data Validation

### Pre-Commit Checks

Before adding stories, verify:
1. ✅ Story IDs are unique
2. ✅ Epic labels match format
3. ✅ Agent types are valid
4. ✅ Status values are valid
5. ✅ Priority values are P0, P1, or P2
6. ✅ Timestamps are ISO 8601 format
7. ✅ All required fields present

### Validation Script

```javascript
function validateStory(story) {
  const validAgentTypes = ['backend', 'frontend', 'testing', 'documentation', 'monitoring', 'cicd', 'tech-architecture'];
  const validStatuses = ['pending', 'in_progress', 'testing', 'completed'];
  const validPriorities = ['P0', 'P1', 'P2'];

  return (
    story.type === 'story' &&
    story.story_id &&
    story.name &&
    story.epic_label &&
    validAgentTypes.includes(story.agent_type) &&
    validStatuses.includes(story.status) &&
    validPriorities.includes(story.priority)
  );
}
```

---

## Common Patterns

### Adding a New Epic

1. **Define epic metadata**:
   - Epic number (sequential)
   - Epic name
   - Total story count
   - Story ID range

2. **Create story list**:
   - Define all user stories
   - Assign agent types
   - Set priorities
   - Write descriptions

3. **Run population script**:
   ```bash
   node scripts/add-epic-{number}-stories.js
   ```

4. **Add story templates**:
   - Update `app.js` → `getStoryDetails()`
   - Add all story templates
   - Follow template format

5. **Verify in dashboard**:
   - Force refresh browser
   - Check Kanban board
   - Click story cards
   - Test export

### Updating Story Status

```javascript
// Find story
const story = tasks.find(t => t.story_id === 'US-401');

// Start work
story.status = 'in_progress';
story.agent = 'backend-api-builder';
story.started_at = new Date().toISOString();
story.progress_percent = 0;

// Update progress
story.progress_percent = 50;

// Complete work
story.status = 'completed';
story.completed_at = new Date().toISOString();
story.progress_percent = 100;

// Save
fs.writeFileSync('data/tasks.json', JSON.stringify(tasksData, null, 2));
```

---

## Troubleshooting

### Stories Not Showing

**Problem**: Added stories don't appear on Kanban board

**Checklist**:
1. ✅ `type === 'story'` (not 'task' or 'epic')
2. ✅ `epic_label` field present
3. ✅ `status` is one of: pending, in_progress, testing, completed
4. ✅ `agent_type` is valid
5. ✅ tasks.json is valid JSON
6. ✅ Browser cache cleared (Cmd+Shift+R)

### Agent Not Showing

**Problem**: Agent badge missing or shows "unassigned"

**Fix**:
```json
{
  "agent": "backend-api-builder",  // Must be specific agent name
  "agent_type": "backend"           // Must match valid type
}
```

### Duration Missing

**Problem**: Completed stories show no duration

**Fix**:
```json
{
  "started_at": "2025-10-26T10:00:00.000Z",  // Required
  "completed_at": "2025-10-26T10:17:06.000Z" // Required
}
```

---

## Version History

- **v1.0 (2025-10-26)**: Initial standards document
  - Epic 003, 004, 005 tracking
  - Kanban board display standards
  - Story template requirements
  - Export report format

---

## References

- [STORY_METADATA_COMPLETE.md](STORY_METADATA_COMPLETE.md) - Epic 003 metadata guide
- [EXPORT_FEATURE_SUMMARY.md](EXPORT_FEATURE_SUMMARY.md) - Export functionality
- [DATA_RESTORE_COMPLETE.md](DATA_RESTORE_COMPLETE.md) - Data restoration guide
- [Epic 004 Documentation](../docs/refactoring/epic-004-stories/)
- [Epic 005 Documentation](../docs/refactoring/EPIC-005-backend-service-refactoring.md)

---

**Maintained By**: Sovren Engineering Team
**Questions**: Open GitHub issue with label `dashboard` or `epic-tracking`
