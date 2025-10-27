# Automatic Epic and Story Tracking System

## Overview

The Sovren Agent Orchestration Dashboard now features **fully automatic epic and story discovery** with **intelligent display filtering** and **epic-specific color coding**. No manual epic addition is required - the system automatically discovers and displays work as agents begin execution.

**Last Updated**: 2025-10-26
**Version**: 3.5

---

## Key Features

### 1. Automatic Discovery

The dashboard automatically discovers:
- ✅ **Epics** from documentation (docs/refactoring/epic-*/,  docs/epic-*.md)
- ✅ **User Stories** from markdown files (US-XXX format)
- ✅ **Story Metadata** (titles, descriptions, priorities, agent types)
- ✅ **Epic Associations** (automatic US-XXX → Epic mapping)

### 2. Intelligent Display Filtering

**Only show epics with active work:**
- Epics appear ONLY when an agent starts working on a story from that epic
- Pending-only epics remain hidden until work begins
- Stories from inactive epics are filtered from the Kanban board

### 3. Epic Color Coding

Each epic has a unique color scheme:
- **Epic 003 (NOSTR)**: Purple (#8b5cf6)
- **Epic 004 (State Management)**: Blue (#3b82f6)
- **Epic 005 (Backend Services)**: Green (#10b981)
- **Epic 006+**: Amber, Red, Cyan, Pink (future epics)

---

## How It Works

### Automatic Discovery Process

```
1. Scan Documentation
   └── Find all epic directories (docs/refactoring/epic-*/)
   └── Read epic metadata files (README.md, INDEX.md)
   └── Parse epic numbers, names, story counts

2. Extract User Stories
   └── Find STORY_BREAKDOWN.md files
   └── Parse US-XXX story IDs
   └── Extract titles, descriptions, priorities
   └── Map stories to epics

3. Infer Story Metadata
   └── Agent type (backend, frontend, testing, etc.)
   └── Priority (P0, P1, P2)
   └── Epic association (US-4XX → Epic 004)

4. Merge with Existing Data
   └── Load current tasks.json
   └── Add new stories (preserve existing status/progress)
   └── Update epic parent tasks
   └── Save merged data
```

### Display Filtering Logic

```javascript
// Dashboard only shows epics with active work
const activeEpics = new Set();

allTasks.forEach(task => {
  // Epic is "active" if it has stories with status !== 'pending'
  if (task.status !== 'pending' && task.status !== 'queued') {
    activeEpics.add(task.epic_label);
  }
});

// Filter tasks: only display stories from active epics
const displayTasks = allTasks.filter(task => {
  const epicLabel = task.epic_label || extractEpicFromName(task.name);
  return activeEpics.has(epicLabel);
});
```

**Result**:
- Epic 003 appears immediately (has completed/in-progress stories)
- Epic 004 and 005 remain hidden until an agent starts work
- As soon as ANY story moves to "in_progress", that epic becomes visible

---

## Story ID → Epic Mapping

The system automatically maps story IDs to epics:

```javascript
US-3XX → Epic 003: NOSTR Consolidation
  US-301 to US-326 (26 stories)

US-4XX → Epic 004: State Management
  US-401 to US-425 (25 stories)

US-5XX → Epic 005: Backend Services
  US-501 to US-542 (42 stories)

US-6XX → Epic 006: [Future Epic]
  US-601 to US-699

US-7XX → Epic 007: [Future Epic]
  US-701 to US-799
```

**Automatic Pattern Recognition**:
- Extracts numeric prefix from story ID
- Maps to corresponding epic
- Assigns epic label automatically
- No manual configuration needed

---

## Epic Color Coding

### CSS Variables

```css
:root {
  /* Epic 003 - Purple (NOSTR) */
  --epic-003-color: #8b5cf6;
  --epic-003-bg: rgba(139, 92, 246, 0.1);
  --epic-003-border: rgba(139, 92, 246, 0.3);

  /* Epic 004 - Blue (State Management) */
  --epic-004-color: #3b82f6;
  --epic-004-bg: rgba(59, 130, 246, 0.1);
  --epic-004-border: rgba(59, 130, 246, 0.3);

  /* Epic 005 - Green (Backend Services) */
  --epic-005-color: #10b981;
  --epic-005-bg: rgba(16, 185, 129, 0.1);
  --epic-005-border: rgba(16, 185, 129, 0.3);

  /* ... more epic colors ... */
}
```

### Applied Styling

```html
<!-- Epic label with data attribute for color coding -->
<div class="kanban-card-epic" data-epic="003">Epic 003: NOSTR</div>
<div class="kanban-card-epic" data-epic="004">Epic 004: State Management</div>
<div class="kanban-card-epic" data-epic="005">Epic 005: Backend Services</div>
```

```css
/* Epic-specific styles applied via data attribute */
.kanban-card-epic[data-epic="003"] {
  background: linear-gradient(135deg, var(--epic-003-bg), var(--epic-003-bg));
  border-color: var(--epic-003-border);
  color: var(--epic-003-color);
}
```

---

## File Structure

### Core Files

```
monitoring/dashboard/
├── auto-discovery.js          # NEW: Automatic epic/story discovery
├── server.js                   # Dashboard backend (file watching)
├── data/
│   └── tasks.json              # Auto-populated with discovered stories
├── public/
│   ├── index.html (v3.5)      # Dashboard UI
│   ├── app.js (v3.5)          # Updated: Epic filtering logic
│   └── styles.css (v3.5)      # Updated: Epic color coding
├── scripts/
│   └── add-epic-004-005-stories.js  # Legacy: Manual story addition
└── docs/
    ├── AUTOMATIC_EPIC_TRACKING.md    # This document
    └── EPIC_TRACKING_STANDARDS.md    # Epic data standards
```

### Discovery Patterns

The auto-discovery system scans these locations:

```javascript
patterns: {
  epics: [
    '**/epic-*/README.md',
    '**/epic-*/INDEX.md',
    '**/EPIC-*.md',
    '**/epic-*.md'
  ],
  stories: [
    '**/US-*.md',
    '**/user-stories/*.md',
    '**/epic-*/stories/*.md',
    '**/refactoring/epic-*/STORY_BREAKDOWN.md'
  ]
}
```

---

## Running Auto-Discovery

### Manual Discovery Run

```bash
cd /Users/fp/Desktop/Sovren/monitoring/dashboard
node auto-discovery.js
```

**Output**:
```
🔍 Starting automatic epic and story discovery...

✅ Found 3 epic directories

📖 Discovering stories for Epic 003: NOSTR Consolidation...
   Found 26 stories

📖 Discovering stories for Epic 004: State Management...
   Found 25 stories

📖 Discovering stories for Epic 005: Backend Services...
   Found 42 stories

✅ Scanned 93 story IDs from codebase

✅ Merged data: Added 67 new stories
📊 Total tasks: 98

💾 Saved to /Users/fp/Desktop/Sovren/monitoring/dashboard/data/tasks.json

✅ Auto-discovery complete!
```

### Automatic Scheduled Discovery

**Future Enhancement**: Set up a cron job or file watcher to run discovery automatically:

```bash
# Run discovery every hour
0 * * * * cd /path/to/dashboard && node auto-discovery.js

# OR: Watch for changes in docs/
node --watch auto-discovery.js docs/**/*.md
```

---

## Epic Lifecycle Example

### Scenario: Starting Work on Epic 004

**Initial State**:
```
Dashboard shows:
- Epic 003: NOSTR (7 complete, 5 in progress, 14 pending)
- Epic 004: Hidden (all 25 stories are pending)
- Epic 005: Hidden (all 42 stories are pending)
```

**Agent Starts Work**:
```javascript
// Agent begins work on US-401
story.status = 'in_progress';
story.agent = 'backend-api-builder';
story.started_at = new Date().toISOString();
```

**Dashboard Updates**:
```
Dashboard now shows:
- Epic 003: NOSTR (7 complete, 5 in progress, 14 pending)
- Epic 004: State Management (0 complete, 1 in progress, 24 pending) ← NOW VISIBLE
- Epic 005: Still hidden (all pending)
```

**Visual Result**:
- Epic 004 stories appear on Kanban board
- Epic label shows in BLUE (#3b82f6)
- US-401 card shows in "In Progress" lane
- 24 pending Epic 004 stories show in "To Do" lane

---

## Adding a New Epic

### Automatic Process

**No manual code changes required!** Just create documentation:

1. **Create Epic Directory**:
   ```bash
   mkdir -p docs/refactoring/epic-006-ui-component-library
   ```

2. **Create README.md or INDEX.md**:
   ```markdown
   # Epic 006: UI Component Library

   ## Total Stories: 30

   ### User Stories
   - US-601: Create Design System Foundation
   - US-602: Implement Button Component
   - US-603: Implement Form Components
   ...
   ```

3. **Optional: Create STORY_BREAKDOWN.md**:
   ```markdown
   ### Story #001: US-601 - Design System Foundation

   **As a** frontend developer
   **I want** a comprehensive design system...
   ```

4. **Run Auto-Discovery**:
   ```bash
   node auto-discovery.js
   ```

5. **Result**:
   - Epic 006 stories auto-discovered
   - Mapped to US-6XX range
   - Color-coded in Amber (#f59e0b)
   - Hidden until work begins

### Adding Epic Color

If you want to customize the epic color (optional):

**Edit `styles.css`**:
```css
/* Epic 006 - Custom color */
--epic-006-color: #22c55e;    /* Emerald green */
--epic-006-bg: rgba(34, 197, 94, 0.1);
--epic-006-border: rgba(34, 197, 94, 0.3);
```

---

## Story Metadata Inference

The system intelligently infers story metadata from text:

### Agent Type Inference

```javascript
inferAgentType(text) {
  if (text.includes('api', 'service', 'backend')) return 'backend';
  if (text.includes('ui', 'component', 'react')) return 'frontend';
  if (text.includes('test', 'testing', 'e2e')) return 'testing';
  if (text.includes('doc', 'diagram', 'guide')) return 'documentation';
  if (text.includes('monitor', 'metric', 'alert')) return 'monitoring';
  if (text.includes('ci', 'pipeline', 'deploy')) return 'cicd';
  if (text.includes('architect', 'design', 'pattern')) return 'tech-architecture';

  return 'backend'; // Default
}
```

**Examples**:
- "US-401: Audit Redux Store Structure" → `agent_type: 'backend'`
- "US-502: ContentPublishingService Extraction" → `agent_type: 'backend'`
- "US-418: Write React Query Hook Tests" → `agent_type: 'testing'`
- "US-423: Developer Documentation" → `agent_type: 'documentation'`

### Priority Inference

```javascript
inferPriority(content) {
  if (content.includes('critical', 'p0', 'blocking')) return 'P0';
  if (content.includes('p2', 'nice-to-have', 'optional')) return 'P2';

  return 'P1'; // Default
}
```

---

## Demo Script Removal

### Why Removed

The `claude-code-bridge.js --demo` script was causing data corruption by:
- Periodically overwriting real epic data with demo data
- Replacing story statuses with simulated values
- Losing agent assignments and duration information
- Creating confusion between real and simulated work

### What Was Removed

**Deleted**:
- ❌ `claude-code-bridge.js` (demo script file)
- ❌ `--demo` flag functionality
- ❌ Simulated task generation

**Kept**:
- ✅ `server.js` (real-time dashboard backend)
- ✅ `auto-discovery.js` (automatic epic/story discovery)
- ✅ File watching and Socket.IO updates
- ✅ Real agent tracking (when implemented)

### Migration Impact

**Before**:
```bash
# Had to manually add epics
node scripts/add-epic-004-005-stories.js

# Demo mode would overwrite data
node claude-code-bridge.js --demo  # DON'T DO THIS
```

**After**:
```bash
# Automatic discovery - no manual work
node auto-discovery.js

# Or just let agents work - epics appear automatically
# No demo mode to accidentally run
```

---

## Testing the System

### Test 1: Verify Auto-Discovery

```bash
cd /Users/fp/Desktop/Sovren/monitoring/dashboard
node auto-discovery.js
```

**Expected Output**:
```
✅ Found 3 epic directories
✅ Discovered 93 stories
✅ Added X new stories
```

### Test 2: Verify Epic Filtering

1. Check current tasks.json:
   ```bash
   cat data/tasks.json | grep -c "in_progress"
   ```

2. Open dashboard: `http://localhost:3001`

3. Verify:
   - ✅ Epic 003 is visible (has active work)
   - ✅ Epic 004/005 hidden if all stories pending
   - ✅ Only active epics show on Kanban board

### Test 3: Verify Epic Colors

1. Inspect epic labels in browser DevTools
2. Check `data-epic` attribute:
   ```html
   <div class="kanban-card-epic" data-epic="003">Epic 003: NOSTR</div>
   ```
3. Verify CSS variables applied:
   - Epic 003: Purple background
   - Epic 004: Blue background (if visible)
   - Epic 005: Green background (if visible)

### Test 4: Start Work on New Epic

1. Update a story status:
   ```javascript
   // Edit data/tasks.json
   {
     "story_id": "US-401",
     "status": "in_progress",  // Change from "pending"
     "agent": "backend-api-builder"
   }
   ```

2. Refresh dashboard (`Cmd+Shift+R`)

3. Verify:
   - ✅ Epic 004 now appears on board
   - ✅ Epic 004 label shows in blue
   - ✅ US-401 appears in "In Progress" lane
   - ✅ Other Epic 004 stories appear in "To Do" lane

---

## Troubleshooting

### Epic Not Appearing

**Problem**: Epic exists but doesn't show on dashboard

**Diagnosis**:
```bash
# Check if epic has any active stories
cat data/tasks.json | grep -A 5 "Epic 004" | grep "status"
```

**Solution**:
- Epic only appears when at least one story has `status !== 'pending'`
- Start work on a story to make epic visible

### Wrong Epic Color

**Problem**: Epic shows default purple instead of specific color

**Diagnosis**:
```bash
# Check if data-epic attribute is present
curl http://localhost:3001 | grep 'data-epic'
```

**Solution**:
- Ensure `data-epic` attribute is present on epic labels
- Clear browser cache (`Cmd+Shift+R`)
- Check CSS variables in `styles.css`

### Stories Not Discovered

**Problem**: Auto-discovery doesn't find stories

**Diagnosis**:
```bash
# Run discovery with verbose output
node auto-discovery.js
```

**Solution**:
- Check story files exist in `docs/refactoring/epic-*/`
- Verify story ID format is `US-XXX`
- Ensure STORY_BREAKDOWN.md or individual story files present

---

## Performance Considerations

### Discovery Performance

**Current**:
- Scans ~100 markdown files
- Parses ~95 user stories
- Completes in <2 seconds

**Optimization**:
- File watching to detect changes
- Incremental discovery (only scan changed files)
- Caching of epic metadata

### Display Performance

**Current**:
- Filters stories by active epics (O(n) complexity)
- Renders ~30-50 cards on Kanban board
- Sub-100ms render time

**No optimization needed** for current scale (100 stories).

---

## Future Enhancements

### Planned Features

1. **Real-Time Agent Monitoring**:
   - Detect when Claude Code launches agents
   - Automatically update story status
   - Track agent activity in real-time

2. **Smart Epic Suggestions**:
   - Suggest next epic to work on
   - Show epic dependencies
   - Recommend story prioritization

3. **Epic Progress Tracking**:
   - Show epic completion percentage
   - Estimate epic completion time
   - Track epic velocity

4. **Advanced Filtering**:
   - Filter by agent type
   - Filter by priority
   - Filter by epic
   - Search stories

5. **Epic Analytics**:
   - Average story duration per epic
   - Agent distribution per epic
   - Epic burndown charts

---

## Summary

### What Changed

**Removed**:
- ❌ Demo script (`claude-code-bridge.js`)
- ❌ Manual epic addition requirement
- ❌ Data corruption risk from demo mode

**Added**:
- ✅ Automatic epic discovery (`auto-discovery.js`)
- ✅ Intelligent epic filtering (only show active epics)
- ✅ Epic-specific color coding (7 unique colors)
- ✅ Smart story metadata inference

**Improved**:
- ✅ Zero manual epic management
- ✅ Epics appear as work begins
- ✅ Visual epic differentiation
- ✅ Data integrity protection

### Result

**Before**:
```
1. Manually add each epic with script
2. All epics always visible
3. Same color for all epics
4. Demo mode could corrupt data
```

**After**:
```
1. Epics auto-discovered from docs
2. Epics appear when work starts
3. Each epic has unique color
4. Demo mode removed - data safe
```

---

**Maintained By**: Sovren Engineering Team
**Version**: 3.5
**Last Updated**: 2025-10-26
