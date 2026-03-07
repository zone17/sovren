# Custom Agent: Dashboard Orchestrator

This directory contains a custom agent specification for automatically setting up the Sovren Agent Orchestration Dashboard on any new Claude Code project.

## Quick Start

### How to Invoke the Agent

In any Claude Code session, after completing your PRD and epic/story decomposition:

```
"Set up the agent orchestration dashboard for this project"
```

Or more explicitly:

```
"I need you to create the same real-time monitoring dashboard we have in Sovren.
Use the dashboard-orchestrator agent to set up:
- Kanban board with epic tracking
- Real-time progress visualization
- Subtask management
- Socket.IO live updates
Copy the exact implementation from /Users/fp/Desktop/Sovren/monitoring/dashboard/"
```

### What the Agent Will Do

The agent will autonomously:

1. **Discover** your project structure, PRD, and user stories
2. **Create** the complete `/monitoring/dashboard/` directory structure
3. **Generate** initial `tasks.json` from your PRD
4. **Implement** all frontend and backend code (4000+ lines)
5. **Configure** real-time updates via Socket.IO
6. **Document** setup, maintenance, and troubleshooting
7. **Test** that everything works correctly
8. **Report** completion with next steps

**Estimated Time**: 15-25 minutes (fully autonomous)

## Features Provided

✅ **Real-time Kanban Board** - 4 swimlanes (Pending, In Progress, Testing, Complete)
✅ **Epic Tracking** - Automatic discovery and progress calculation
✅ **Subtask Management** - Detailed task breakdown with completion %
✅ **Color-Coded Epics** - 5 unique gradients for visual organization
✅ **Story Modals** - Full Definition of Done display
✅ **Live Updates** - Socket.IO + file watching for real-time refresh
✅ **Mobile Responsive** - Optimized for all screen sizes
✅ **Export Reports** - JSON export for stakeholder reporting

## File Structure

After the agent completes, you'll have:

```
monitoring/
└── dashboard/
    ├── server.js                   # Express + Socket.IO server
    ├── package.json                # npm dependencies
    ├── data/
    │   └── tasks.json             # Real-time task data
    ├── scripts/
    │   ├── generate-initial-tasks.js
    │   └── add-subtasks-to-stories.js
    ├── public/
    │   ├── index.html             # Dashboard UI
    │   ├── app.js                 # Client JavaScript
    │   ├── styles.css             # Responsive styling
    │   └── epic-functions.js      # Epic logic
    ├── logs/
    │   └── server.log
    └── docs/
        ├── README.md
        ├── SETUP.md
        ├── MAINTENANCE.md
        └── TROUBLESHOOTING.md
```

## Usage After Setup

```bash
# Navigate to dashboard
cd monitoring/dashboard

# Install dependencies (usually auto-installed)
npm install

# Start the dashboard server
npm start

# Open in browser
open http://localhost:3001
```

## Agent Specification

Full agent specification: [`dashboard-orchestrator-agent.md`](./dashboard-orchestrator-agent.md)

### Key Sections:

- **Overview**: What the agent does
- **Workflow**: Step-by-step execution phases
- **Data Structure**: tasks.json schema
- **Algorithms**: Epic discovery, progress calculation
- **Customization**: Project-specific prompts
- **Success Criteria**: What "done" looks like

## Templates

Reference templates in [`templates/`](./templates/):

- `generate-initial-tasks.js` - Extract tasks from PRD
- Additional scripts as needed

## Source Files

The agent copies and adapts these Sovren files:

| Source                                          | Purpose                          |
| ----------------------------------------------- | -------------------------------- |
| `monitoring/dashboard/server.js`                | Express + Socket.IO server       |
| `monitoring/dashboard/public/index.html`        | Dashboard UI                     |
| `monitoring/dashboard/public/app.js`            | Client-side logic (2700+ lines)  |
| `monitoring/dashboard/public/styles.css`        | Responsive styling (3200+ lines) |
| `monitoring/dashboard/public/epic-functions.js` | Epic operations                  |

## Example Invocation

**Scenario**: You've just finished decomposing your PRD into epics and user stories.

**User**: "We now have 5 epics with 87 user stories. I need the dashboard setup."

**Claude**: "I'll use the dashboard-orchestrator agent to create your monitoring infrastructure."

_Agent runs autonomously for 15-20 minutes_

**Result**:

```
✅ Dashboard Orchestration Complete

Project: Your Project Name
Dashboard URL: http://localhost:3001

Statistics:
- Epics Created: 5 epic parent tasks
- User Stories: 87 stories across 5 epics
- Subtasks Defined: 450+ subtasks
- Overall Progress: 0% (just started)

Files Created:
- server.js (182 lines)
- data/tasks.json (3500+ lines)
- public/index.html (530 lines)
- public/app.js (2700+ lines)
- public/styles.css (3200+ lines)
- docs/* (1000+ lines documentation)

Next Steps:
1. cd monitoring/dashboard && npm start
2. Open http://localhost:3001
3. Review task assignments
4. Begin development!
```

## Customization

The agent will prompt for:

1. **Project Name** - For branding and logs
2. **PRD Location** - Path to your requirements doc
3. **Port Number** - Default 3001
4. **Epic Ranges** - Confirm US-XXX to Epic mappings
5. **Agent Types** - Custom agent names

## Requirements

- **Node.js**: v16+ (for ES modules, async/await)
- **npm**: v7+ (for workspaces)
- **PRD**: Must have epics and user stories
- **Format**: Markdown with `## Epic XXX:` and `- [ ] US-XXX:` patterns

## Troubleshooting

### Agent Doesn't Find PRD

Ensure your PRD file contains:

```markdown
## Epic 001: Your Epic Name

- [ ] US-101: First user story
- [ ] US-102: Second user story
```

### Port Already in Use

The agent will detect and suggest an alternative port.

### Missing Dependencies

The agent auto-runs `npm install` during setup.

## Support

**Documentation**: See generated `docs/` folder after setup

**Issues**: The agent creates a `TROUBLESHOOTING.md` file

**Updates**: The dashboard auto-updates from `tasks.json` file changes

## Advanced Usage

### Manual Task Updates

Edit `data/tasks.json` directly:

```json
{
  "story_id": "US-309",
  "status": "completed",
  "progress_percent": 100
}
```

Dashboard auto-refreshes via file watching.

### Adding Subtasks

Use the generated script:

```bash
node scripts/add-subtasks-to-stories.js
```

### Exporting Reports

Click "Export Epic Report" in dashboard UI.

## Version History

- **v1.0.0** (2025-10-26): Initial release
  - Based on Sovren dashboard v3.6
  - Fully autonomous setup
  - Complete documentation
  - Production-ready templates

## License

MIT License - Feel free to customize for your projects

## Attribution

Based on Sovren Agent Orchestration Dashboard
Created for Claude Code project orchestration
Maintained by: Sovren Engineering Team

---

**Ready to use!** Simply invoke the agent in your next Claude Code session after planning phase.
