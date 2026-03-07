# Dashboard Orchestrator Agent

**Agent Type**: `dashboard-orchestrator`
**Version**: 1.0.0
**Purpose**: Autonomously create a comprehensive real-time monitoring dashboard for any Claude Code project

---

## Overview

This custom agent replicates the exact Sovren Agent Orchestration Dashboard functionality for any new project. It creates a complete monitoring infrastructure with real-time Kanban boards, epic tracking, subtask management, and live progress visualization.

## Features Provided

✅ Real-time Kanban board with 4 swimlanes (Pending, In Progress, Testing, Complete)
✅ Automatic epic discovery and progress calculation
✅ User story cards with subtask breakdown and completion percentages
✅ Color-coded epic labels (5 unique gradients)
✅ Story detail modals with full Definition of Done display
✅ File watching for automatic data refresh
✅ Socket.IO real-time updates
✅ Responsive mobile-optimized design
✅ Export functionality for completion reports
✅ Uptime counter and activity logging

## When to Invoke

**Trigger this agent when**:

- Starting a new multi-epic project after PRD creation
- Need visibility into parallel agent execution
- Managing backlogs through Kanban workflow
- Stakeholders require real-time progress monitoring

**Example Invocations**:

```
"Set up the agent orchestration dashboard for this project"
"Create a live Kanban board to track epic and story progress"
"I need the same dashboard monitoring we have in Sovren"
```

---

## Agent Workflow

### Phase 1: Discovery (2-3 minutes)

1. Locate and analyze PRD/backlog files
2. Extract all epics and user stories
3. Identify epic ID ranges (e.g., US-301-326 = Epic 003)
4. Map agent types to stories
5. Generate initial task data structure

### Phase 2: Infrastructure Setup (3-5 minutes)

1. Create `/monitoring/dashboard/` directory structure
2. Generate `package.json` with dependencies
3. Create Node.js server with Express + Socket.IO
4. Configure Chokidar file watching
5. Set up Winston logging

### Phase 3: Frontend Implementation (5-10 minutes)

1. Create HTML structure with modals and Kanban board
2. Implement comprehensive CSS (3200+ lines)
3. Build JavaScript application logic (2700+ lines)
4. Add epic color coding system
5. Implement subtask tracking and progress calculation

### Phase 4: Real-Time Features (2-3 minutes)

1. Configure Socket.IO events
2. Implement file watching triggers
3. Add connection status indicators
4. Create uptime counter
5. Build export functionality

### Phase 5: Documentation & Testing (3-5 minutes)

1. Generate comprehensive README
2. Create setup and troubleshooting guides
3. Write maintenance documentation
4. Test all functionality
5. Create demo data scripts

**Total Estimated Time**: 15-25 minutes (fully autonomous)

---

## Directory Structure Created

```
monitoring/
└── dashboard/
    ├── server.js                      # Express + Socket.IO server (180 lines)
    ├── package.json                   # npm dependencies
    ├── data/
    │   └── tasks.json                 # Real-time task tracking data
    ├── scripts/
    │   ├── generate-initial-tasks.js  # Extract tasks from PRD
    │   ├── add-subtasks-to-stories.js # Add detailed subtasks
    │   └── complete-story.js          # Mark stories complete
    ├── public/
    │   ├── index.html                 # Dashboard UI (530 lines)
    │   ├── app.js                     # Client JavaScript (2700 lines)
    │   ├── styles.css                 # Complete styling (3200 lines)
    │   └── epic-functions.js          # Epic-specific logic (200 lines)
    ├── logs/
    │   └── server.log                 # Server activity logs
    ├── docs/
    │   ├── README.md                  # Dashboard documentation
    │   ├── SETUP.md                   # Setup instructions
    │   ├── MAINTENANCE.md             # How to maintain
    │   └── TROUBLESHOOTING.md         # Common issues
    └── .gitignore
```

---

## Core Data Structure

### tasks.json Schema

```json
{
  "project_name": "Your Project Name",
  "started_at": "2025-10-24T14:53:30.578Z",
  "current_phase": "active-development",
  "phases": {
    "active-development": {
      "status": "in_progress",
      "started_at": "2025-10-24T14:53:30.578Z",
      "tasks": [
        {
          "id": "epic-003-parent",
          "type": "epic",
          "name": "Epic 003: NOSTR Consolidation - 12/26 complete",
          "agent": "project-orchestrator",
          "status": "in_progress",
          "progress_percent": 46,
          "started_at": "2025-10-24T14:53:30.578Z",
          "completed_at": null
        },
        {
          "id": "story-us-309",
          "type": "story",
          "story_id": "US-309",
          "name": "US-309: Remove Hardcoded Relay URLs",
          "agent": "backend-api-builder",
          "agent_type": "backend",
          "status": "in_progress",
          "progress_percent": 25,
          "epic_label": "Epic 003: NOSTR",
          "priority": "P1",
          "subtasks": [
            {
              "order": 1,
              "description": "Audit codebase for all hardcoded relay URLs",
              "status": "completed"
            },
            {
              "order": 2,
              "description": "Create centralized relay configuration file",
              "status": "in_progress"
            },
            {
              "order": 3,
              "description": "Implement environment variable support",
              "status": "pending"
            }
          ]
        }
      ]
    }
  },
  "summary": {
    "total_tasks": 124,
    "completed": 35,
    "in_progress": 12,
    "completion_percent": 28
  }
}
```

### Field Definitions

**Task Types**:

- `epic`: High-level initiative (auto-generated parent)
- `story`: User story with detailed requirements
- `task`: Individual work item

**Statuses**:

- `pending`: Not started
- `in_progress`: Currently being worked on
- `testing`: Implementation complete, in QA
- `completed`: Fully done and verified
- `blocked`: Waiting on dependency

**Subtask Structure**:

- `order`: Sequential number (1-N)
- `description`: Clear, actionable task
- `status`: `pending` | `in_progress` | `completed`

---

## Key Algorithms

### 1. Automatic Epic Discovery

```javascript
function discoverEpics(tasks) {
  const epicMap = new Map();

  tasks.forEach((task) => {
    if (task.epic_label) {
      const epicNum = task.epic_label.match(/\d+/)?.[0];
      if (!epicMap.has(epicNum)) {
        epicMap.set(epicNum, {
          label: task.epic_label,
          stories: [],
          completed: 0,
        });
      }

      epicMap.get(epicNum).stories.push(task);
      if (task.status === 'completed') {
        epicMap.get(epicNum).completed++;
      }
    }
  });

  // Create epic parent tasks
  const epicParents = [];
  epicMap.forEach((data, epicNum) => {
    const total = data.stories.length;
    const completed = data.completed;
    const progress = Math.round((completed / total) * 100);

    epicParents.push({
      id: `epic-${epicNum}-parent`,
      type: 'epic',
      name: `${data.label} - ${completed}/${total} complete`,
      status: completed === total ? 'completed' : 'in_progress',
      progress_percent: progress,
    });
  });

  return epicParents;
}
```

### 2. Subtask Progress Calculation

```javascript
function calculateProgress(task) {
  if (!task.subtasks || task.subtasks.length === 0) {
    return task.progress_percent || 0;
  }

  const total = task.subtasks.length;
  const completed = task.subtasks.filter((st) => st.status === 'completed').length;
  const progress = Math.round((completed / total) * 100);

  // Update task status based on progress
  if (completed === 0) {
    task.status = 'pending';
  } else if (completed === total) {
    task.status = 'testing';
  } else {
    task.status = 'in_progress';
  }

  return progress;
}
```

### 3. Kanban Swimlane Assignment

```javascript
function assignToSwimlane(task) {
  switch (task.status) {
    case 'completed':
      return 'complete';
    case 'testing':
      return 'testing';
    case 'in_progress':
      return 'in-progress';
    case 'pending':
    default:
      return 'pending';
  }
}
```

---

## Epic Color Coding

```css
/* Epic 001: Purple Gradient */
[data-epic='001'] {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* Epic 002: Pink Gradient */
[data-epic='002'] {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

/* Epic 003: Blue Gradient */
[data-epic='003'] {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

/* Epic 004: Green Gradient */
[data-epic='004'] {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

/* Epic 005: Orange Gradient */
[data-epic='005'] {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
}
```

---

## Agent Execution Checklist

When invoked, the agent must complete:

**Discovery Phase**:

- [ ] Locate PRD file (SOVREN_PRD.md, README.md, etc.)
- [ ] Parse all epics and extract epic numbers
- [ ] Parse all user stories (US-XXX format)
- [ ] Identify epic-to-story mappings
- [ ] Determine agent types for each story

**Setup Phase**:

- [ ] Create directory structure
- [ ] Generate package.json with correct dependencies
- [ ] Install npm packages (express, socket.io, chokidar, winston)
- [ ] Create .gitignore file

**Server Implementation**:

- [ ] Create server.js with Express setup
- [ ] Configure Socket.IO for real-time updates
- [ ] Set up Chokidar file watching
- [ ] Implement Winston logging
- [ ] Add graceful shutdown handlers

**Data Generation**:

- [ ] Generate initial tasks.json from PRD
- [ ] Create epic parent tasks
- [ ] Add all user stories with metadata
- [ ] Set initial statuses and progress
- [ ] Calculate summary statistics

**Frontend Implementation**:

- [ ] Create index.html with complete structure
- [ ] Implement app.js with all dashboard logic
- [ ] Create styles.css with responsive design
- [ ] Add epic-functions.js for epic-specific operations
- [ ] Include Socket.IO client library

**Scripts**:

- [ ] Create generate-initial-tasks.js
- [ ] Create add-subtasks-to-stories.js
- [ ] Create complete-story.js helper
- [ ] Add README with script documentation

**Documentation**:

- [ ] Generate comprehensive README.md
- [ ] Create SETUP.md with installation steps
- [ ] Write MAINTENANCE.md for ongoing updates
- [ ] Create TROUBLESHOOTING.md for common issues

**Testing & Validation**:

- [ ] Start server and verify no errors
- [ ] Open dashboard in browser
- [ ] Verify all epics display correctly
- [ ] Test story modal functionality
- [ ] Verify file watching triggers refresh
- [ ] Test Socket.IO real-time updates
- [ ] Validate responsive design on mobile

---

## Required npm Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.6.1",
    "chokidar": "^3.5.3",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  },
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "generate-tasks": "node scripts/generate-initial-tasks.js",
    "add-subtasks": "node scripts/add-subtasks-to-stories.js"
  }
}
```

---

## Customization Prompts

The agent should ask the user for:

1. **Project Name**: "What is your project name?" (default: extract from package.json)
2. **PRD Location**: "Where is your PRD file?" (default: ./SOVREN_PRD.md, ./README.md)
3. **Port Number**: "What port should the dashboard use?" (default: 3001)
4. **Epic Ranges**: "Confirm epic-to-story ID mappings" (auto-detected, user confirms)
5. **Agent Types**: "What custom agent types are you using?" (default: backend, frontend, testing)

---

## Success Criteria

Dashboard deployment is successful when:

✅ Server starts on http://localhost:3001 without errors
✅ Dashboard displays all epics with correct progress percentages
✅ User stories organized in 4 Kanban swimlanes
✅ Story cards show subtasks and completion percentages
✅ Epic color coding applied correctly (5 unique gradients)
✅ Story detail modal opens with full DoD display
✅ File watching triggers automatic UI refresh
✅ Socket.IO connection status indicator shows "Connected"
✅ Responsive design works on mobile (viewport < 768px)
✅ All 9 stories have proper subtask breakdowns

---

## Source Templates

The agent should copy and adapt these files from Sovren:

| Source File                                                              | Destination                                       | Modifications                |
| ------------------------------------------------------------------------ | ------------------------------------------------- | ---------------------------- |
| `/Users/fp/Desktop/Sovren/monitoring/dashboard/server.js`                | `./monitoring/dashboard/server.js`                | Update project name, port    |
| `/Users/fp/Desktop/Sovren/monitoring/dashboard/public/index.html`        | `./monitoring/dashboard/public/index.html`        | Update title, branding       |
| `/Users/fp/Desktop/Sovren/monitoring/dashboard/public/app.js`            | `./monitoring/dashboard/public/app.js`            | Use as-is                    |
| `/Users/fp/Desktop/Sovren/monitoring/dashboard/public/styles.css`        | `./monitoring/dashboard/public/styles.css`        | Optional color customization |
| `/Users/fp/Desktop/Sovren/monitoring/dashboard/public/epic-functions.js` | `./monitoring/dashboard/public/epic-functions.js` | Use as-is                    |

---

## Post-Installation Instructions

After setup, provide user with:

```bash
# Navigate to dashboard
cd monitoring/dashboard

# Install dependencies (if not auto-installed)
npm install

# Generate initial task data from PRD
npm run generate-tasks

# Start the dashboard server
npm start

# In another terminal, add subtasks to stories
npm run add-subtasks

# Open dashboard in browser
open http://localhost:3001
```

**Expected Terminal Output**:

```
╔═══════════════════════════════════════════════════════╗
║   Agent Orchestration Dashboard v1.0.0               ║
║   Elite Engineering Monitoring System                 ║
║                                                       ║
║   Server: http://localhost:3001                      ║
║   Status: ✓ Running                                  ║
║   Watching: data/tasks.json                          ║
╚═══════════════════════════════════════════════════════╝

[INFO] Client connected: abc123
[INFO] Initial data sent to client abc123
```

---

## Completion Report Template

```markdown
# 🎯 Dashboard Orchestration Complete

**Project**: [Project Name]
**Deployment Date**: [Date]
**Dashboard URL**: http://localhost:3001
**Status**: ✅ Production Ready

## 📊 Statistics

- **Epics Created**: X epic parent tasks
- **User Stories**: Y stories across Z epics
- **Subtasks Defined**: N subtasks across M stories
- **Overall Progress**: P% complete

## 📁 Files Created

| File                       | Lines | Purpose                    |
| -------------------------- | ----- | -------------------------- |
| `server.js`                | 182   | Express + Socket.IO server |
| `data/tasks.json`          | 2500+ | Task tracking data         |
| `public/index.html`        | 530   | Dashboard UI               |
| `public/app.js`            | 2700+ | Client-side logic          |
| `public/styles.css`        | 3200+ | Responsive styling         |
| `public/epic-functions.js` | 200+  | Epic operations            |
| `docs/README.md`           | 400+  | Documentation              |

## ✅ Features Enabled

- [x] Real-time Kanban board with 4 swimlanes
- [x] Automatic epic discovery and progress tracking
- [x] Subtask management with completion percentages
- [x] Color-coded epic labels (5 gradients)
- [x] Story detail modals with DoD display
- [x] File watching for automatic refresh
- [x] Socket.IO live updates
- [x] Responsive mobile design
- [x] Export functionality
- [x] Comprehensive documentation

## 🚀 Next Steps

1. Review `data/tasks.json` for accuracy
2. Add subtasks to remaining stories via `npm run add-subtasks`
3. Customize epic colors in `public/styles.css` (optional)
4. Share http://localhost:3001 with team
5. Integrate with CI/CD for automatic story completion

## 📚 Documentation

- **Setup Guide**: `docs/SETUP.md`
- **Maintenance**: `docs/MAINTENANCE.md`
- **Troubleshooting**: `docs/TROUBLESHOOTING.md`
- **Full Documentation**: `docs/README.md`

## 🆘 Support

If you encounter issues:

1. Check server logs in `logs/server.log`
2. Verify `tasks.json` is valid JSON
3. Ensure port 3001 is available
4. Review `docs/TROUBLESHOOTING.md`

---

**Dashboard Status**: ✅ Online and Monitoring
**Real-time Updates**: ✅ Active
**File Watching**: ✅ Enabled
```

---

## Error Handling

The agent must handle these scenarios:

| Error                | Detection                        | Resolution                      |
| -------------------- | -------------------------------- | ------------------------------- |
| Missing PRD          | File not found at expected paths | Prompt user for PRD location    |
| Invalid JSON         | JSON parse error                 | Auto-fix or ask user to correct |
| Port in use          | EADDRINUSE error                 | Suggest alternative port        |
| Permission denied    | EACCES error                     | Provide sudo instructions       |
| Missing dependencies | Module not found                 | Auto-run `npm install`          |

---

## Maintenance Guide

Include in `docs/MAINTENANCE.md`:

### Adding New Epics

1. Open `data/tasks.json`
2. Add stories with `epic_label` field
3. Dashboard auto-discovers epic on refresh

### Adding New Stories

```javascript
{
  "id": "story-us-XXX",
  "type": "story",
  "story_id": "US-XXX",
  "name": "US-XXX: Story Title",
  "epic_label": "Epic 003: NOSTR",
  "status": "pending",
  "progress_percent": 0,
  "subtasks": []
}
```

### Updating Story Status

- Manual: Edit `data/tasks.json`
- Automatic: Dashboard watches file and refreshes
- Script: Use `scripts/complete-story.js US-XXX`

### Exporting Reports

- Click "Export Epic Report" button in dashboard
- Downloads JSON file with all epic/story data
- Import into spreadsheet for stakeholder reporting

---

## Version History

- **v1.0.0** (2025-10-26): Initial release
  - Real-time Kanban board with 4 swimlanes
  - Automatic epic discovery from task labels
  - Subtask tracking with progress calculation
  - Socket.IO live updates
  - File watching for automatic refresh
  - Comprehensive documentation
  - Mobile-responsive design

---

## Agent Metadata

**Classification**: Infrastructure / Monitoring
**Complexity**: High (1000+ lines of code across 10+ files)
**Estimated Runtime**: 15-25 minutes (fully autonomous)
**Prerequisites**: PRD with epics and user stories
**Output**: Complete real-time monitoring dashboard
**Quality Gates**: Server starts, dashboard renders, real-time updates work
**Maintenance**: Low (dashboard auto-updates from `tasks.json`)

---

## License & Attribution

Based on Sovren Agent Orchestration Dashboard v3.6
Created for Claude Code project orchestration
Maintained by: [Your Team Name]

---

**Status**: ✅ Ready for Production Deployment

This agent specification provides everything needed to replicate the exact Sovren dashboard functionality for any new Claude Code project. Simply invoke the agent after completing your planning phase, and it will autonomously set up the entire monitoring infrastructure.
