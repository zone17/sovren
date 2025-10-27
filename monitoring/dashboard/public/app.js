/**
 * Sovren Agent Orchestration Dashboard v4.0 - Simplified
 * Real-time monitoring of all active work in the SOVREN project
 */

// ============================================================================
// State Management
// ============================================================================
const state = {
  data: null,
  activeAgents: [],
  activities: [],
  socket: null
};

// ============================================================================
// Socket.IO Connection
// ============================================================================
function initializeSocket() {
  state.socket = io();

  state.socket.on('connect', () => {
    console.log('✅ Connected to dashboard server');
    addActivity('🔌 Connected to dashboard', 'System');
  });

  state.socket.on('disconnect', () => {
    console.log('❌ Disconnected from server');
    addActivity('🔌 Disconnected from server', 'System');
  });

  state.socket.on('data-update', (data) => {
    console.log('📡 Received data update');
    state.data = data;
    renderDashboard();
    addActivity('🔄 Dashboard data updated', 'System');
  });

  state.socket.on('agent-update', (agentData) => {
    console.log('🤖 Agent update:', agentData);
    updateAgent(agentData);
    addActivity(`🤖 ${agentData.name} ${agentData.status}`, 'Agent');
  });

  // Request initial data
  state.socket.emit('get-tasks');
}

// ============================================================================
// Dashboard Rendering
// ============================================================================
function renderDashboard() {
  if (!state.data) return;

  updateMetrics();
  updateKanbanBoard();
  updateActiveAgents();
  updateLastUpdateTime();
}

// ============================================================================
// Metrics Tiles
// ============================================================================
function updateMetrics() {
  const tasks = getAllTasks();

  // Count epics
  const epics = new Set();
  tasks.forEach(task => {
    if (task.epic_label) {
      epics.add(task.epic_label);
    }
  });

  // Count stories by status
  const totalStories = tasks.length;
  const activeStories = tasks.filter(t =>
    t.status === 'in_progress' || t.status === 'testing'
  ).length;
  const completedStories = tasks.filter(t =>
    t.status === 'completed'
  ).length;

  // Update DOM
  document.getElementById('metric-epics').textContent = epics.size;
  document.getElementById('metric-stories').textContent = totalStories;
  document.getElementById('metric-active').textContent = activeStories;
  document.getElementById('metric-completed').textContent = completedStories;
}

// ============================================================================
// Kanban Board
// ============================================================================
function updateKanbanBoard() {
  const tasks = getAllTasks();

  // Group tasks by status
  const todoTasks = tasks.filter(t => t.status === 'pending' || t.status === 'queued');
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress' || t.status === 'testing');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  // Render each lane
  renderLane('todo-lane', todoTasks, 'todo-count');
  renderLane('inprogress-lane', inProgressTasks, 'inprogress-count');
  renderLane('complete-lane', completedTasks, 'complete-count');
}

function renderLane(laneId, tasks, countId) {
  const lane = document.getElementById(laneId);
  const count = document.getElementById(countId);

  count.textContent = tasks.length;

  if (tasks.length === 0) {
    lane.innerHTML = '<div class="no-tasks">No tasks</div>';
    return;
  }

  lane.innerHTML = tasks.map(task => createKanbanCard(task)).join('');
}

function createKanbanCard(task) {
  const epicNumber = extractEpicNumber(task.epic_label || task.name);
  const progress = task.progress_percent || 0;

  return `
    <div class="kanban-card" data-task-id="${task.id}" onclick="openStoryModal('${task.id}')">
      <div class="kanban-card-epic" data-epic="${epicNumber}">${task.epic_label || 'No Epic'}</div>
      <div class="kanban-card-title">${task.name}</div>
      <div class="kanban-card-agent">🤖 ${task.agent || 'Unassigned'}</div>
      <div class="kanban-card-progress">
        <div class="progress-bar-container">
          <div class="progress-bar-fill" style="width: ${progress}%"></div>
        </div>
        <span class="progress-text">${progress}% complete</span>
      </div>
    </div>
  `;
}

function extractEpicNumber(text) {
  if (!text) return '000';
  const match = text.match(/Epic\s*(\d+)/i);
  return match ? match[1] : '000';
}

// ============================================================================
// Active Agents
// ============================================================================
function updateActiveAgents() {
  const tasks = getAllTasks();
  const activeAgents = new Map();

  // Find all tasks currently being worked on
  tasks.forEach(task => {
    if (task.status === 'in_progress' || task.status === 'testing') {
      const agentName = task.agent || 'unknown';

      if (!activeAgents.has(agentName)) {
        activeAgents.set(agentName, {
          name: agentName,
          tasks: [],
          status: 'active'
        });
      }

      activeAgents.get(agentName).tasks.push(task);
    }
  });

  // Render active agents
  renderActiveAgents(Array.from(activeAgents.values()));
}

function renderActiveAgents(agents) {
  const container = document.getElementById('active-agents-container');

  if (agents.length === 0) {
    container.innerHTML = '<div class="no-active-agents">No agents currently active</div>';
    return;
  }

  container.innerHTML = agents.map(agent => createAgentCard(agent)).join('');
}

function createAgentCard(agent) {
  const task = agent.tasks[0]; // Show first task

  return `
    <div class="agent-card" onclick="openAgentModal('${agent.name}')">
      <div class="agent-card-header">
        <span class="agent-icon">🤖</span>
        <span class="agent-name">${agent.name}</span>
      </div>
      <div class="agent-status">Active</div>
      <div class="agent-story">
        Working on: ${task.name}
        <div style="margin-top: 0.5rem; font-size: 0.85rem;">
          Progress: ${task.progress_percent || 0}%
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// Activity Log
// ============================================================================
function addActivity(message, source = 'System') {
  const timestamp = new Date();

  state.activities.unshift({
    message,
    source,
    timestamp,
    id: Date.now()
  });

  // Keep only last 100 activities
  if (state.activities.length > 100) {
    state.activities = state.activities.slice(0, 100);
  }

  renderActivityLog();
}

function renderActivityLog() {
  const container = document.getElementById('activity-log-container');

  if (state.activities.length === 0) {
    container.innerHTML = '<div class="no-activities">No activities yet</div>';
    return;
  }

  container.innerHTML = state.activities.map(activity => `
    <div class="activity-log-item">
      <span class="activity-icon">${getActivityIcon(activity.source)}</span>
      <div class="activity-content">
        <div class="activity-message">${activity.message}</div>
        <div class="activity-time">${formatTime(activity.timestamp)}</div>
      </div>
    </div>
  `).join('');
}

function getActivityIcon(source) {
  const icons = {
    'System': '⚙️',
    'Agent': '🤖',
    'Story': '📋',
    'Epic': '📚'
  };
  return icons[source] || '📌';
}

function formatTime(date) {
  const now = new Date();
  const diff = Math.floor((now - date) / 1000); // seconds

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleString();
}

// ============================================================================
// Story Modal
// ============================================================================
function openStoryModal(taskId) {
  const task = findTaskById(taskId);
  if (!task) return;

  const modal = document.getElementById('story-modal');

  // Populate modal
  document.getElementById('modal-story-title').textContent = task.name;
  document.getElementById('modal-desired-outcome').textContent = task.description || 'No description available';
  document.getElementById('modal-agent').textContent = task.agent || 'Unassigned';
  document.getElementById('modal-epic').textContent = task.epic_label || 'No epic';
  document.getElementById('modal-priority').textContent = task.priority || 'N/A';
  document.getElementById('modal-duration').textContent = calculateDuration(task);

  // Progress bar
  const progress = task.progress_percent || 0;
  document.getElementById('modal-status-bar').style.width = `${progress}%`;
  document.getElementById('modal-status-text').textContent = `${progress}%`;

  // Subtasks
  renderModalSubtasks(task);

  // Definition of Done
  renderModalDoD(task);

  modal.classList.add('show');
  addActivity(`📖 Viewed story: ${task.name}`, 'Story');
}

function closeStoryModal() {
  document.getElementById('story-modal').classList.remove('show');
}

function renderModalSubtasks(task) {
  const container = document.getElementById('modal-subtasks-container');
  const countBadge = document.getElementById('modal-subtask-count');

  if (!task.subtasks || task.subtasks.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted)">No subtasks defined</p>';
    countBadge.textContent = '';
    return;
  }

  const completed = task.subtasks.filter(st => st.status === 'completed').length;
  const total = task.subtasks.length;
  countBadge.textContent = `${completed}/${total}`;

  container.innerHTML = task.subtasks
    .sort((a, b) => a.order - b.order)
    .map(subtask => `
      <div class="subtask-item ${subtask.status}"
           onclick="toggleSubtask('${task.id}', ${subtask.order})">
        ${getSubtaskIcon(subtask.status)} ${subtask.description}
      </div>
    `).join('');
}

function getSubtaskIcon(status) {
  const icons = {
    'completed': '✅',
    'in_progress': '⏳',
    'pending': '○'
  };
  return icons[status] || '○';
}

function toggleSubtask(taskId, subtaskOrder) {
  const task = findTaskById(taskId);
  const subtask = task.subtasks.find(st => st.order === subtaskOrder);

  if (!subtask) return;

  // Cycle status: pending → in_progress → completed → pending
  const statusCycle = {
    'pending': 'in_progress',
    'in_progress': 'completed',
    'completed': 'pending'
  };

  subtask.status = statusCycle[subtask.status] || 'pending';

  // Recalculate progress
  const completed = task.subtasks.filter(st => st.status === 'completed').length;
  task.progress_percent = Math.round((completed / task.subtasks.length) * 100);

  // Save and update
  saveData();
  renderModalSubtasks(task);
  renderDashboard();

  addActivity(`✅ Updated subtask in ${task.story_id}`, 'Story');
}

function renderModalDoD(task) {
  const container = document.getElementById('modal-dod-container');

  if (!task.definition_of_done || task.definition_of_done.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted)">No DoD defined</p>';
    return;
  }

  container.innerHTML = '<ul style="padding-left: 1.5rem;">' +
    task.definition_of_done.map(item => `<li>${item}</li>`).join('') +
    '</ul>';
}

function calculateDuration(task) {
  if (!task.started_at) return 'Not started';

  const start = new Date(task.started_at);
  const end = task.completed_at ? new Date(task.completed_at) : new Date();
  const diff = Math.floor((end - start) / 1000 / 60); // minutes

  if (diff < 60) return `${diff} minutes`;
  if (diff < 1440) return `${Math.floor(diff / 60)} hours`;
  return `${Math.floor(diff / 1440)} days`;
}

// ============================================================================
// Agent Modal
// ============================================================================
function openAgentModal(agentName) {
  const tasks = getAllTasks().filter(t => t.agent === agentName &&
    (t.status === 'in_progress' || t.status === 'testing'));

  if (tasks.length === 0) return;

  const modal = document.getElementById('agent-modal');
  const currentTask = tasks[0];

  document.getElementById('agent-modal-title').textContent = agentName;
  document.getElementById('agent-current-story').textContent = currentTask.name;

  // Current tasks
  const tasksHtml = tasks.map(t => `
    <div style="padding: 0.5rem; background: var(--bg-hover); border-radius: 6px; margin-bottom: 0.5rem;">
      ${t.name} (${t.progress_percent || 0}%)
    </div>
  `).join('');
  document.getElementById('agent-current-tasks').innerHTML = tasksHtml;

  // Thought stream (placeholder for now)
  document.getElementById('agent-thought-stream').innerHTML = `
    <div class="thought-stream-loading">
      Real-time thought stream will appear here when agent is active...
      <br><br>
      <em>Note: This requires integration with Claude Code agent monitoring</em>
    </div>
  `;

  // Outcome
  if (currentTask.status === 'completed') {
    document.getElementById('agent-outcome').innerHTML = `
      <div style="padding: 1rem; background: var(--bg-card); border-radius: 6px; border-left: 3px solid var(--accent-green);">
        ✅ Task completed successfully
      </div>
    `;
  } else {
    document.getElementById('agent-outcome').innerHTML = `<em>Work in progress...</em>`;
  }

  modal.classList.add('show');
  addActivity(`🤖 Viewed agent: ${agentName}`, 'Agent');
}

function closeAgentModal() {
  document.getElementById('agent-modal').classList.remove('show');
}

// ============================================================================
// Utility Functions
// ============================================================================
function getAllTasks() {
  if (!state.data || !state.data.phases) return [];

  const tasks = [];
  Object.values(state.data.phases).forEach(phase => {
    if (phase.tasks && Array.isArray(phase.tasks)) {
      phase.tasks.forEach(task => {
        if (task.type === 'story') {
          tasks.push(task);
        }
      });
    }
  });

  return tasks;
}

function findTaskById(taskId) {
  const tasks = getAllTasks();
  return tasks.find(t => t.id === taskId);
}

function saveData() {
  if (state.socket && state.socket.connected) {
    state.socket.emit('save-task-data', state.data);
  }
}

function updateLastUpdateTime() {
  const now = new Date();
  document.getElementById('last-update-time').textContent = now.toLocaleTimeString();
}

function updateAgent(agentData) {
  // Find or create agent
  let agent = state.activeAgents.find(a => a.name === agentData.name);

  if (!agent) {
    agent = { name: agentData.name, tasks: [], status: 'active' };
    state.activeAgents.push(agent);
  }

  agent.status = agentData.status;
  agent.currentTask = agentData.currentTask;
  agent.thoughts = agentData.thoughts || [];

  renderActiveAgents(state.activeAgents);
}

// ============================================================================
// Event Listeners
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Sovren Agent Orchestration Dashboard v4.0 initializing...');

  initializeSocket();

  // Add initial activity
  addActivity('🚀 Dashboard started', 'System');

  // Close modals on click outside
  document.getElementById('story-modal').addEventListener('click', (e) => {
    if (e.target.id === 'story-modal') {
      closeStoryModal();
    }
  });

  document.getElementById('agent-modal').addEventListener('click', (e) => {
    if (e.target.id === 'agent-modal') {
      closeAgentModal();
    }
  });

  // ESC key to close modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeStoryModal();
      closeAgentModal();
    }
  });

  console.log('✅ Dashboard initialized');
});

// ============================================================================
// Auto-refresh every 30 seconds
// ============================================================================
setInterval(() => {
  if (state.socket && state.socket.connected) {
    state.socket.emit('get-tasks');
  }
}, 30000);
