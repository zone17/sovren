# Agent Tracking System Documentation

## Overview

The Sovren Monitoring Dashboard now includes a comprehensive real-time agent activity tracking system that provides visibility into all AI agents working on the project.

## Features

### 1. Active Agents Panel
- **Live Agent Cards**: Real-time display of all active agents
- **Status Indicators**: Visual indicators showing agent status (active/idle)
- **Current Tasks**: Shows what each agent is working on with progress bars
- **Performance Metrics**: Display completion rate, average task time, and success rate
- **Sub-Agent Hierarchy**: Visual representation of parent-child agent relationships

### 2. Agent Thinking Modal
- **Live Thinking Stream**: Real-time display of agent thought processes
- **Thought Types**: Categorized thoughts (analysis, discovery, action, implementation, testing)
- **Auto-Scroll**: Automatic scrolling to latest thoughts
- **Export Capability**: Export thinking logs as JSON for analysis

### 3. Real-Time Updates
- **WebSocket Integration**: Live updates via Socket.IO
- **Automatic Refresh**: Agent data refreshes every 2-3 seconds
- **Zero Latency**: Instant UI updates when agent status changes

## Technical Implementation

### Backend Architecture

#### Server Enhancements (server.js)
```javascript
// File watching for agents.json
const FILES = {
  tasks: path.join(DATA_DIR, 'tasks.json'),
  logs: path.join(DATA_DIR, 'orchestration.log'),
  metrics: path.join(DATA_DIR, 'metrics.json'),
  agents: path.join(DATA_DIR, 'agents.json')  // NEW
};

// API Endpoints
app.get('/api/agents', (req, res) => {
  res.json(currentData.agents || getDefaultAgents());
});

app.get('/api/agents/:id/thinking', (req, res) => {
  const agentData = currentData.agents || getDefaultAgents();
  const agent = agentData.agents?.find(a => a.id === req.params.id);
  res.json(agent ? agent.thinking : []);
});

// Socket.IO Event
socket.on('agents-update', (data) => {
  // Broadcasts agent updates to all connected clients
});
```

#### Data Structure (agents.json)
```json
{
  "timestamp": "2025-10-24T06:40:00Z",
  "agents": [
    {
      "id": "agent-001",
      "name": "project-orchestrator",
      "type": "orchestrator",
      "status": "active",
      "parent_agent": null,
      "sub_agents": ["agent-002", "agent-003"],
      "current_task": {
        "id": "task-001",
        "name": "Implement type safety",
        "progress": 45
      },
      "started_at": "2025-10-24T06:30:00Z",
      "last_activity": "2025-10-24T06:39:58Z",
      "thinking": [
        {
          "timestamp": "2025-10-24T06:39:45Z",
          "thought": "Analyzing payment service...",
          "type": "analysis"
        }
      ],
      "metrics": {
        "tasks_completed": 3,
        "tasks_in_progress": 1,
        "average_task_time": "18m 30s",
        "success_rate": 100
      }
    }
  ],
  "summary": {
    "total_agents": 3,
    "active_agents": 2,
    "idle_agents": 1,
    "total_tasks_completed": 23,
    "total_tasks_in_progress": 2
  }
}
```

### Frontend Architecture

#### HTML Structure (index.html)
- Agent section added between tasks and logs sections
- Agent thinking modal for detailed view
- Responsive grid layout for agent cards

#### JavaScript Implementation (app.js)
- `updateAgentsPanel()`: Renders agent cards in the grid
- `createAgentCard()`: Generates HTML for individual agent cards
- `showAgentThinkingModal()`: Opens detailed agent view
- `renderThinkingTimeline()`: Displays agent thoughts chronologically
- `updateAgentThinkingModal()`: Real-time modal updates

#### CSS Styling (styles.css)
- `.agents-section`: Main container styling
- `.agent-card`: Individual agent card styling
- `.agent-thinking-preview`: Live thought display
- `.thinking-timeline`: Scrollable thought history
- `.thought-entry`: Individual thought styling with type-based colors

## API Reference

### GET /api/agents
Returns all agent data including current status, tasks, and metrics.

**Response:**
```json
{
  "timestamp": "ISO 8601 timestamp",
  "agents": [/* array of agent objects */],
  "summary": {/* aggregate statistics */}
}
```

### GET /api/agents/:id/thinking
Returns the thinking log for a specific agent.

**Parameters:**
- `id`: Agent ID (e.g., "agent-001")

**Response:**
```json
[
  {
    "timestamp": "ISO 8601 timestamp",
    "thought": "Thought text",
    "type": "analysis|discovery|action|implementation|testing|thinking|idle"
  }
]
```

## Usage Guide

### Viewing Active Agents
1. Navigate to the dashboard at `http://localhost:3000`
2. The Active Agents section displays all currently running agents
3. Each card shows:
   - Agent name and type
   - Current task with progress
   - Latest thought
   - Performance metrics

### Viewing Agent Details
1. Click on any agent card
2. The thinking modal opens showing:
   - Full agent statistics
   - Current task details
   - Live thinking stream
   - Sub-agents (if applicable)
3. Use auto-scroll toggle to follow live updates
4. Click "Export Thinking Log" to download JSON

### Starting Test Data
```bash
# Generate sample agent data
node test-data-generator.js

# Start the server
npm start

# Open browser to http://localhost:3000
```

## Testing

### Unit Testing
```bash
# Test agent data generation
node test-data-generator.js

# Verify API endpoints
curl http://localhost:3000/api/agents
curl http://localhost:3000/api/agents/agent-001/thinking
```

### Integration Testing
1. Start server and test data generator
2. Open dashboard in browser
3. Verify:
   - Agent cards appear and update
   - Click interaction opens modal
   - Thinking stream updates in real-time
   - Export functionality works

## Configuration

### Customizing Agent Types
Edit `app.js` to modify agent type icons:
```javascript
function getAgentIcon(type) {
  const icons = {
    orchestrator: '🎯',
    backend: '🔧',
    frontend: '🎨',
    testing: '🧪',
    // Add custom types here
  };
  return icons[type] || '🤖';
}
```

### Adjusting Update Frequency
Modify test-data-generator.js:
```javascript
// Change interval between updates (milliseconds)
const interval = setInterval(async () => {
  // Update logic
}, randomInt(2000, 3000)); // 2-3 seconds
```

## Troubleshooting

### Agents Not Appearing
1. Check if `agents.json` exists in `/data` directory
2. Verify server is watching the file
3. Check browser console for errors

### Modal Not Opening
1. Verify agent cards have proper data-agent-id attributes
2. Check if agentModal element exists in DOM
3. Review browser console for JavaScript errors

### Real-time Updates Not Working
1. Verify Socket.IO connection is established
2. Check server logs for "agents-update" events
3. Ensure agents.json is being updated by test generator

## Future Enhancements

### Planned Features
- Agent communication visualization
- Task dependency graph
- Performance trending charts
- Agent health monitoring
- Automated agent restart capability
- Historical thinking log search
- Agent collaboration patterns

### Performance Optimizations
- Virtual scrolling for large thinking logs
- Debounced updates for high-frequency changes
- Lazy loading of agent details
- Client-side caching of agent data

## Contributing

When adding new agent types or features:
1. Update the agent data structure in test-data-generator.js
2. Add corresponding UI components in app.js
3. Update styling in styles.css
4. Document changes in this file

## License

Part of the Sovren Monitoring Dashboard
Elite Engineering Standards Applied