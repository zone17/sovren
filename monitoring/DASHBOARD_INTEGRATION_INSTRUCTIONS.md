# Dashboard Integration Instructions for project-orchestrator Agent

## Overview
This document provides comprehensive instructions for the `project-orchestrator` agent to ensure all work appears on the Sovren Agent Orchestration Dashboard and is monitored in real-time.

## Dashboard Architecture

### Real-Time Monitoring System
- **Server**: http://localhost:3001
- **Technology**: Node.js + Express + Socket.IO
- **Data Files**: `/monitoring/dashboard/data/`
  - `tasks.json` - All user stories and subtasks
  - `agents.json` - Active agent status
  - `metrics.json` - Project metrics
  - `orchestration.log` - Activity logs

### Automatic Updates
The dashboard server uses Chokidar file watching to detect changes to JSON files and automatically broadcasts updates to all connected clients via Socket.IO. **Any change to the data files triggers an immediate real-time update.**

## Critical Requirements for Dashboard Visibility

### 1. Task Data Structure

All user stories MUST be added to `/monitoring/dashboard/data/tasks.json` in the following structure:

```json
{
  "project_id": "sovren-refactoring",
  "started_at": "2025-10-27T19:00:00.000Z",
  "current_phase": "active-development",
  "phases": {
    "active-development": {
      "status": "in_progress",
      "started_at": "2025-10-27T19:00:00.000Z",
      "tasks": [
        {
          "id": "story-us-XXX",
          "type": "story",
          "story_id": "US-XXX",
          "name": "US-XXX: Story Title",
          "description": "As a [user], I want [feature] so that [benefit]",
          "agent": "agent-name",
          "agent_type": "backend|frontend|fullstack",
          "status": "pending|in_progress|testing|completed",
          "priority": "P0|P1|P2|P3",
          "epic_label": "Epic 00X: Epic Name",
          "progress_percent": 0,
          "started_at": null,
          "completed_at": null,
          "subtasks": [
            {
              "order": 1,
              "description": "Subtask description",
              "status": "pending|in_progress|completed"
            }
          ],
          "definition_of_done": [
            "DoD item 1",
            "DoD item 2"
          ]
        }
      ]
    }
  }
}
```

### 2. Required Story Fields

**MANDATORY fields for dashboard visibility:**

- `id` - Unique identifier (format: `story-us-XXX`)
- `type` - MUST be `"story"` (not task, epic, etc.)
- `story_id` - Story identifier (format: `US-XXX`)
- `name` - Full story name including ID (format: `US-XXX: Title`)
- `agent` - Agent assigned to this story (REQUIRED for "Active Agents" display)
- `status` - Current status (see Status Values below)
- `epic_label` - Epic this story belongs to (format: `Epic 00X: Name`)
- `subtasks` - Array of subtasks (REQUIRED for progress tracking)

**RECOMMENDED fields:**

- `description` - User story in "As a/I want/So that" format
- `priority` - P0 (critical), P1 (high), P2 (medium), P3 (low)
- `definition_of_done` - Array of DoD criteria
- `started_at` - ISO timestamp when work begins
- `completed_at` - ISO timestamp when work completes
- `progress_percent` - Auto-calculated from subtasks, but can be set manually

### 3. Status Values

Stories use these status values for Kanban lane placement:

- `"pending"` or `"queued"` → **To Do Lane**
- `"in_progress"` or `"testing"` → **In Progress Lane**
- `"completed"` → **Complete Lane**

**CRITICAL**: No "active epic filter" exists anymore. ALL stories appear regardless of status.

### 4. Epic Color Coding

Epics are automatically color-coded based on epic number:

- Epic 003 → Purple (#8b5cf6)
- Epic 004 → Blue (#3b82f6)
- Epic 005 → Green (#10b981)
- Epic 006 → Amber (#f59e0b)
- Epic 007 → Red (#ef4444)

Epic number is extracted from `epic_label` field via regex: `/Epic\s*(\d+)/i`

### 5. Subtask Structure

Subtasks are **REQUIRED** for:
- Progress percentage calculation
- Detailed story tracking
- Real-time completion updates

Each subtask must have:
```json
{
  "order": 1,
  "description": "Clear, actionable subtask description",
  "status": "pending|in_progress|completed"
}
```

**Subtask Ordering**: Subtasks should be ordered in the sequence they need to be completed (order of operations for implementation).

### 6. Agent Integration

For a story to appear in the "Active Agents" section:

1. Story `status` must be `"in_progress"` or `"testing"`
2. Story must have an `agent` field set to the agent name
3. Story must have `subtasks` array (can auto-populate from agent activity)

**Agent Status Updates**:
The project-orchestrator can update `/monitoring/dashboard/data/agents.json`:

```json
{
  "agents": [
    {
      "name": "backend-api-builder",
      "status": "active",
      "current_task": "US-501",
      "started_at": "2025-10-27T19:00:00.000Z",
      "thoughts": [
        "Analyzing database schema requirements...",
        "Creating ERD diagram...",
        "Implementing migration files..."
      ]
    }
  ]
}
```

## Step-by-Step Integration Process

### Step 1: Initialize Epic Planning

When starting an epic, ensure ALL stories are added to `tasks.json`:

```javascript
// Read current data
const tasksData = JSON.parse(fs.readFileSync('/monitoring/dashboard/data/tasks.json'));

// Add all stories to active-development phase
tasksData.phases['active-development'].tasks.push(...allStories);

// Write back
fs.writeFileSync('/monitoring/dashboard/data/tasks.json', JSON.stringify(tasksData, null, 2));
```

### Step 2: Assign Agents

Every story MUST have an agent assigned:

```javascript
story.agent = determineAgent(story); // e.g., "backend-api-builder"
story.agent_type = "backend"; // or "frontend", "fullstack"
```

### Step 3: Create Subtasks

Generate subtasks in the correct order of operations:

```javascript
story.subtasks = [
  { order: 1, description: "Read and analyze PRD requirements", status: "pending" },
  { order: 2, description: "Design database schema with ERD", status: "pending" },
  { order: 3, description: "Create migration files", status: "pending" },
  { order: 4, description: "Implement repository layer", status: "pending" },
  { order: 5, description: "Implement service layer", status: "pending" },
  { order: 6, description: "Create API endpoints", status: "pending" },
  { order: 7, description: "Write unit tests", status: "pending" },
  { order: 8, description: "Write integration tests", status: "pending" },
  { order: 9, description: "Update documentation", status: "pending" },
  { order: 10, description: "Code review and quality checks", status: "pending" }
];
```

### Step 4: Mark Stories as Active

To make a story appear in the "In Progress" lane and "Active Agents" section:

```javascript
story.status = "in_progress";
story.started_at = new Date().toISOString();
story.progress_percent = 0;
```

### Step 5: Update Progress in Real-Time

As agents complete subtasks:

```javascript
// Mark subtask as complete
story.subtasks[0].status = "completed";

// Recalculate progress
const completed = story.subtasks.filter(st => st.status === "completed").length;
story.progress_percent = Math.round((completed / story.subtasks.length) * 100);

// Update story status
if (completed === story.subtasks.length) {
  story.status = "testing"; // or "completed"
}

// Save changes
fs.writeFileSync('/monitoring/dashboard/data/tasks.json', JSON.stringify(tasksData, null, 2));
```

**IMPORTANT**: File writes trigger automatic Socket.IO broadcasts. No additional notification required.

### Step 6: Log Activities

Update the orchestration log for activity tracking:

```javascript
const logEntry = `[${new Date().toISOString()}] [${agentName}] ${message}\n`;
fs.appendFileSync('/monitoring/dashboard/data/orchestration.log', logEntry);
```

### Step 7: Complete Stories

When a story is done:

```javascript
story.status = "completed";
story.completed_at = new Date().toISOString();
story.progress_percent = 100;

// Mark all subtasks as completed
story.subtasks.forEach(st => st.status = "completed");
```

## Dashboard Features and Capabilities

### Metric Tiles
Auto-calculated from `tasks.json`:
- Total Epics - Unique count of `epic_label` values
- User Stories - Total count of stories where `type === "story"`
- Active Stories - Count where `status === "in_progress" || status === "testing"`
- Completed - Count where `status === "completed"`

### Active Agents Section
Shows agents working on stories where:
- `story.status === "in_progress"` OR `story.status === "testing"`
- Grouped by `story.agent` field
- Clickable to show agent details and thought streams

### 3-Lane Kanban Board
- **To Do**: `status === "pending" || status === "queued"`
- **In Progress**: `status === "in_progress" || status === "testing"`
- **Complete**: `status === "completed"`

Each card shows:
- Epic label (color-coded)
- Story title
- Agent assignment
- Real-time progress bar

### Story Detail Modal
Opened by clicking any story card:
- Desired outcome (from `description`)
- Status completion bar
- All subtasks (clickable to toggle status)
- Definition of Done
- Agent, duration, epic, priority

### Activity Log
Shows recent activities from:
- `orchestration.log` file
- Agent status changes
- Story status updates
- System events

## Common Patterns

### Pattern 1: Starting an Epic

```javascript
// 1. Load data
const data = JSON.parse(fs.readFileSync('/monitoring/dashboard/data/tasks.json'));

// 2. Add all stories
const epicStories = generateStoriesForEpic('Epic 005: Backend Services');
data.phases['active-development'].tasks.push(...epicStories);

// 3. Save
fs.writeFileSync('/monitoring/dashboard/data/tasks.json', JSON.stringify(data, null, 2));

// 4. Mark first story as active
epicStories[0].status = 'in_progress';
epicStories[0].started_at = new Date().toISOString();

// 5. Save again
fs.writeFileSync('/monitoring/dashboard/data/tasks.json', JSON.stringify(data, null, 2));
```

### Pattern 2: Agent Completing a Subtask

```javascript
// 1. Load data
const data = JSON.parse(fs.readFileSync('/monitoring/dashboard/data/tasks.json'));

// 2. Find story
const story = data.phases['active-development'].tasks.find(t => t.story_id === 'US-501');

// 3. Update subtask
story.subtasks[0].status = 'completed';

// 4. Recalculate progress
const completed = story.subtasks.filter(st => st.status === 'completed').length;
story.progress_percent = Math.round((completed / story.subtasks.length) * 100);

// 5. Save
fs.writeFileSync('/monitoring/dashboard/data/tasks.json', JSON.stringify(data, null, 2));

// 6. Log activity
const log = `[${new Date().toISOString()}] [backend-api-builder] Completed: ${story.subtasks[0].description}\n`;
fs.appendFileSync('/monitoring/dashboard/data/orchestration.log', log);
```

### Pattern 3: Coordinating Multiple Agents

```javascript
// Create work streams with assigned agents
const workStreamA = stories.slice(0, 10).map(s => ({ ...s, agent: 'backend-api-builder' }));
const workStreamB = stories.slice(10, 20).map(s => ({ ...s, agent: 'database-schema-architect' }));
const workStreamC = stories.slice(20, 30).map(s => ({ ...s, agent: 'test-automation-engineer' }));

// Mark first story in each stream as active
workStreamA[0].status = 'in_progress';
workStreamB[0].status = 'in_progress';
workStreamC[0].status = 'in_progress';

// All will appear in "Active Agents" section
```

## Troubleshooting

### Stories Not Appearing on Dashboard

**Check:**
1. ✅ Story has `type: "story"` (not "task" or other)
2. ✅ Story is in `phases.active-development.tasks` array
3. ✅ Story has valid `status` field
4. ✅ File was saved correctly (check JSON syntax)
5. ✅ Dashboard server is running (check http://localhost:3001)
6. ✅ Browser is not caching old version (hard refresh: Cmd+Shift+R)

### Agent Not Showing as Active

**Check:**
1. ✅ Story has `status: "in_progress"` or `"testing"`
2. ✅ Story has `agent` field set
3. ✅ Agent name matches exactly (case-sensitive)

### Progress Not Updating

**Check:**
1. ✅ Story has `subtasks` array
2. ✅ Subtasks have `status` field being updated
3. ✅ `progress_percent` is being recalculated
4. ✅ File is being saved after updates

### Real-Time Updates Not Working

**Check:**
1. ✅ Dashboard server is running
2. ✅ Browser has active Socket.IO connection (check browser console)
3. ✅ Files are being written correctly (not just in-memory changes)
4. ✅ Chokidar is watching the files (check server logs)

## Best Practices

### 1. Always Use Transactions
When updating multiple related fields, read-modify-write atomically:

```javascript
const data = JSON.parse(fs.readFileSync(TASKS_FILE));
// ... make all changes ...
fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2));
```

### 2. Maintain Epic Labels Consistently
Use exact format: `Epic XXX: Name` where XXX is a 3-digit number.

### 3. Order Subtasks Logically
Subtasks should follow the actual implementation order of operations.

### 4. Update Progress Automatically
Always recalculate `progress_percent` when subtask status changes.

### 5. Log Everything
Write to `orchestration.log` for every significant event to populate the Activity Log.

### 6. Set Timestamps
Always set `started_at` when status changes to `in_progress` and `completed_at` when status changes to `completed`.

## File Locations Reference

```
/Users/fp/Desktop/Sovren/monitoring/dashboard/
├── server.js                    # Dashboard server (runs on port 3001)
├── public/
│   ├── index.html              # Dashboard UI
│   ├── app.js                  # Client-side logic
│   └── styles.css              # Styling
└── data/
    ├── tasks.json              # ← UPDATE THIS for stories/subtasks
    ├── agents.json             # ← UPDATE THIS for agent status
    ├── metrics.json            # ← UPDATE THIS for metrics
    └── orchestration.log       # ← APPEND to this for activity log
```

## Example: Complete Epic Integration

```javascript
const fs = require('fs');
const path = require('path');

// File paths
const TASKS_FILE = '/Users/fp/Desktop/Sovren/monitoring/dashboard/data/tasks.json';
const AGENTS_FILE = '/Users/fp/Desktop/Sovren/monitoring/dashboard/data/agents.json';
const LOG_FILE = '/Users/fp/Desktop/Sovren/monitoring/dashboard/data/orchestration.log';

// Epic 005: Backend Services
const epic005Stories = [
  {
    id: 'story-us-501',
    type: 'story',
    story_id: 'US-501',
    name: 'US-501: Database Schema Design',
    description: 'As a backend engineer, I want a well-designed database schema so that data is properly structured',
    agent: 'database-schema-architect',
    agent_type: 'backend',
    status: 'pending',
    priority: 'P0',
    epic_label: 'Epic 005: Backend Services',
    progress_percent: 0,
    started_at: null,
    completed_at: null,
    subtasks: [
      { order: 1, description: 'Analyze PRD for data requirements', status: 'pending' },
      { order: 2, description: 'Create entity relationship diagram', status: 'pending' },
      { order: 3, description: 'Design database migration files', status: 'pending' },
      { order: 4, description: 'Review schema with team', status: 'pending' },
      { order: 5, description: 'Update documentation', status: 'pending' }
    ],
    definition_of_done: [
      'ERD diagram created and reviewed',
      'Migration files implemented',
      'Schema documentation complete',
      'Peer review approved'
    ]
  }
  // ... more stories
];

// Add to dashboard
function addEpicToDashboard() {
  // 1. Load current data
  const data = JSON.parse(fs.readFileSync(TASKS_FILE));

  // 2. Add stories
  data.phases['active-development'].tasks.push(...epic005Stories);

  // 3. Save
  fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2));

  // 4. Log activity
  const log = `[${new Date().toISOString()}] [project-orchestrator] Added Epic 005 with ${epic005Stories.length} stories\n`;
  fs.appendFileSync(LOG_FILE, log);

  console.log('✅ Epic 005 added to dashboard');
}

// Start working on first story
function startFirstStory() {
  const data = JSON.parse(fs.readFileSync(TASKS_FILE));

  // Find US-501
  const story = data.phases['active-development'].tasks.find(t => t.story_id === 'US-501');

  // Update status
  story.status = 'in_progress';
  story.started_at = new Date().toISOString();

  // Save
  fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2));

  // Log
  const log = `[${new Date().toISOString()}] [database-schema-architect] Started working on US-501\n`;
  fs.appendFileSync(LOG_FILE, log);

  console.log('✅ US-501 marked as in progress');
}

// Execute
addEpicToDashboard();
startFirstStory();
```

## Summary

For the project-orchestrator agent to ensure all items appear on the dashboard:

1. ✅ Add all stories to `/monitoring/dashboard/data/tasks.json` with `type: "story"`
2. ✅ Assign an `agent` to each story
3. ✅ Create `subtasks` array for each story in order of operations
4. ✅ Set `epic_label` in format `Epic XXX: Name`
5. ✅ Update `status` to control Kanban lane placement
6. ✅ Mark stories `in_progress` to show in Active Agents section
7. ✅ Recalculate `progress_percent` when subtasks complete
8. ✅ Write to `orchestration.log` for activity tracking
9. ✅ Save files after each update (triggers real-time broadcast)

The dashboard has **no filters** that hide content. All stories will appear regardless of status or epic.
