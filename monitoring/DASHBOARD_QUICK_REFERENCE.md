# Dashboard Quick Reference Card

## 🎯 For Project-Orchestrator Agent

### Critical Files to Update

```
/monitoring/dashboard/data/tasks.json      ← All user stories & subtasks
/monitoring/dashboard/data/agents.json     ← Agent status (optional)
/monitoring/dashboard/data/orchestration.log  ← Activity log
```

### Minimum Required Story Fields

```json
{
  "id": "story-us-XXX",
  "type": "story",                    // MUST be "story"
  "story_id": "US-XXX",
  "name": "US-XXX: Title",
  "agent": "agent-name",              // REQUIRED for Active Agents
  "status": "pending|in_progress|testing|completed",
  "epic_label": "Epic 00X: Name",
  "subtasks": [...]                   // REQUIRED for progress
}
```

### Status → Kanban Lane Mapping

- `"pending"` or `"queued"` → **To Do**
- `"in_progress"` or `"testing"` → **In Progress**
- `"completed"` → **Complete**

### Subtask Progress Pattern

```javascript
// Mark subtask complete
story.subtasks[0].status = 'completed';

// Auto-calculate progress
const done = story.subtasks.filter(st => st.status === 'completed').length;
story.progress_percent = Math.round((done / story.subtasks.length) * 100);

// Save triggers real-time update
fs.writeFileSync('tasks.json', JSON.stringify(data, null, 2));
```

### Epic Color Codes

- Epic 003 → Purple
- Epic 004 → Blue
- Epic 005 → Green
- Epic 006 → Amber
- Epic 007 → Red

### Quick Checklist for Visibility

- [ ] Story in `tasks.json`
- [ ] `type: "story"`
- [ ] Has `agent` field
- [ ] Has `epic_label`
- [ ] Has `subtasks` array
- [ ] Status is set
- [ ] File saved correctly

### Dashboard URL

**http://localhost:3001**

Auto-refreshes every 30 seconds + real-time Socket.IO updates
