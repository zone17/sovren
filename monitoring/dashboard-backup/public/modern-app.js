/**
 * Modern Sovren Agent Dashboard Client
 * Interactive UI with detailed task views and real-time updates
 */

// Initialize Socket.IO connection
const socket = io();

// State management
let dashboardState = {
  startTime: null,
  uptimeInterval: null,
  autoScroll: true,
  currentData: null,
  previousStats: { completed: 0, active: 0, blocked: 0, total: 0 },
};

// DOM Elements
const elements = {
  // Header
  projectId: document.getElementById('projectId'),
  phaseBadge: document.getElementById('phaseBadge'),
  uptime: document.getElementById('uptime'),
  refreshBtn: document.getElementById('refreshBtn'),
  connectionStatus: document.getElementById('connectionStatus'),

  // Stats
  statCompleted: document.getElementById('statCompleted'),
  statActive: document.getElementById('statActive'),
  statBlocked: document.getElementById('statBlocked'),
  statTotal: document.getElementById('statTotal'),

  // Stat changes
  completedChange: document.getElementById('completedChange'),
  activeChange: document.getElementById('activeChange'),
  blockedChange: document.getElementById('blockedChange'),
  totalChange: document.getElementById('totalChange'),

  // Progress
  progressPercentage: document.getElementById('progressPercentage'),
  progressBar: document.getElementById('progressBar'),

  // Tasks
  activeTaskCount: document.getElementById('activeTaskCount'),
  blockedTaskCount: document.getElementById('blockedTaskCount'),
  activeTaskList: document.getElementById('activeTaskList'),
  blockedTaskList: document.getElementById('blockedTaskList'),

  // Logs
  logsContainer: document.getElementById('logsContainer'),
  autoScrollCheckbox: document.getElementById('autoScrollCheckbox'),
  clearLogsBtn: document.getElementById('clearLogsBtn'),

  // Modal
  taskModal: document.getElementById('taskModal'),
  modalTitle: document.getElementById('modalTitle'),
  modalBody: document.getElementById('modalBody'),
  modalClose: document.getElementById('modalClose'),

  // Footer
  lastUpdated: document.getElementById('lastUpdated'),
};

/**
 * Initialize the dashboard
 */
function initializeDashboard() {
  console.log('🚀 Initializing Modern Sovren Agent Dashboard');

  // Set up event listeners
  setupEventListeners();

  // Start uptime counter
  startUptimeCounter();

  // Initial connection status
  updateConnectionStatus('connecting', 'Connecting to server...');
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
  // Refresh button
  elements.refreshBtn.addEventListener('click', () => {
    refreshData();
    animateButton(elements.refreshBtn);
  });

  // Auto-scroll toggle
  elements.autoScrollCheckbox.addEventListener('change', (e) => {
    dashboardState.autoScroll = e.target.checked;
  });

  // Clear logs button
  elements.clearLogsBtn.addEventListener('click', () => {
    clearLogs();
    animateButton(elements.clearLogsBtn);
  });

  // Modal close handlers
  elements.modalClose.addEventListener('click', closeModal);
  elements.taskModal.addEventListener('click', (e) => {
    if (e.target === elements.taskModal) closeModal();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
    if (e.key === 'r' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      refreshData();
    }
  });

  // Stat card click handlers
  document.querySelectorAll('.stat-card').forEach((card) => {
    card.addEventListener('click', () => {
      const category = card.dataset.category;
      showTaskDetails(category);
      animateCard(card);
    });
  });
}

/**
 * Socket.IO Event Handlers
 */

// Connection established
socket.on('connect', () => {
  console.log('✅ Connected to server');
  updateConnectionStatus('connected', 'Connected');
  refreshData();
});

// Connection lost
socket.on('disconnect', () => {
  console.log('❌ Disconnected from server');
  updateConnectionStatus('disconnected', 'Disconnected');
});

// Data updates
socket.on('dataUpdate', (data) => {
  console.log('📊 Received data update');
  updateDashboard(data);
});

// New log entry
socket.on('newLogEntry', (logEntry) => {
  addLogEntry(logEntry);
});

/**
 * Update dashboard with new data
 */
function updateDashboard(data) {
  if (!data) return;

  dashboardState.currentData = data;

  // Update project info
  updateProjectInfo(data);

  // Update stats with animations
  updateStats(data.summary);

  // Update progress
  updateProgress(data.summary.completion_percent);

  // Update task lists
  updateTaskLists(data);

  // Update timestamp
  elements.lastUpdated.textContent = new Date().toLocaleTimeString();

  // Add fade-in animation to updated elements
  document.querySelectorAll('.stat-value, .progress-percentage').forEach((el) => {
    el.classList.add('fade-in');
    setTimeout(() => el.classList.remove('fade-in'), 300);
  });
}

/**
 * Update project information
 */
function updateProjectInfo(data) {
  elements.projectId.textContent = data.project_id || 'Unknown Project';

  const phase = data.current_phase || 'unknown';
  elements.phaseBadge.textContent = phase.replace(/-/g, ' ').toUpperCase();
  elements.phaseBadge.className = `phase-badge phase-${phase}`;
}

/**
 * Update statistics with change indicators
 */
function updateStats(summary) {
  const stats = {
    completed: summary.completed || 0,
    active: summary.in_progress || 0,
    blocked: summary.blocked || 0,
    total: summary.total_tasks || 0,
  };

  // Calculate changes
  const changes = {
    completed: stats.completed - dashboardState.previousStats.completed,
    active: stats.active - dashboardState.previousStats.active,
    blocked: stats.blocked - dashboardState.previousStats.blocked,
    total: stats.total - dashboardState.previousStats.total,
  };

  // Update values with animations
  animateValue(elements.statCompleted, dashboardState.previousStats.completed, stats.completed);
  animateValue(elements.statActive, dashboardState.previousStats.active, stats.active);
  animateValue(elements.statBlocked, dashboardState.previousStats.blocked, stats.blocked);
  animateValue(elements.statTotal, dashboardState.previousStats.total, stats.total);

  // Update change indicators
  updateChangeIndicator(elements.completedChange, changes.completed);
  updateChangeIndicator(elements.activeChange, changes.active);
  updateChangeIndicator(elements.blockedChange, changes.blocked);
  updateChangeIndicator(elements.totalChange, changes.total);

  // Store previous stats
  dashboardState.previousStats = { ...stats };
}

/**
 * Animate value changes
 */
function animateValue(element, start, end, duration = 1000) {
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing function
    const easeOutQuart = 1 - Math.pow(1 - progress, 4);
    const current = Math.round(start + (end - start) * easeOutQuart);

    element.textContent = current;

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

/**
 * Update change indicator
 */
function updateChangeIndicator(element, change) {
  if (change === 0) {
    element.textContent = '±0';
    element.className = 'stat-change';
  } else if (change > 0) {
    element.textContent = `+${change}`;
    element.className = 'stat-change positive';
  } else {
    element.textContent = change.toString();
    element.className = 'stat-change negative';
  }
}

/**
 * Update progress bar
 */
function updateProgress(percentage) {
  const progress = Math.max(0, Math.min(100, percentage || 0));

  elements.progressPercentage.textContent = `${progress}%`;
  elements.progressBar.style.width = `${progress}%`;

  // Add glow effect for high progress
  if (progress > 80) {
    elements.progressBar.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.5)';
  } else {
    elements.progressBar.style.boxShadow = 'none';
  }
}

/**
 * Update task lists
 */
function updateTaskLists(data) {
  const activeTasks = [];
  const blockedTasks = [];

  // Get tasks from data.tasks.tasks array (new structure)
  const allTasks = data.tasks?.tasks || [];

  allTasks.forEach((task) => {
    if (task.status === 'in_progress') {
      activeTasks.push(task);
    } else if (task.status === 'blocked') {
      blockedTasks.push(task);
    }
  });

  // Update counts
  elements.activeTaskCount.textContent = activeTasks.length;
  elements.blockedTaskCount.textContent = blockedTasks.length;

  // Render task lists
  renderTaskList(elements.activeTaskList, activeTasks, 'active');
  renderTaskList(elements.blockedTaskList, blockedTasks, 'blocked');
}

/**
 * Render a task list
 */
function renderTaskList(container, tasks, type) {
  if (tasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${type === 'active' ? '💤' : '✨'}</div>
        <p>No ${type} tasks</p>
      </div>
    `;
    return;
  }

  container.innerHTML = tasks
    .map(
      (task) => `
    <div class="task-item" data-task-id="${task.id}" onclick="showTaskDetail('${task.id}')">
      <div class="task-header">
        <div class="task-name">${escapeHtml(task.name)}</div>
        <div class="task-status ${task.status}">${task.status.replace('_', ' ')}</div>
      </div>
      <div class="task-meta">
        <div class="task-agent">${escapeHtml(task.agent || 'Unknown Agent')}</div>
        ${task.current_step ? `<div class="task-step">${escapeHtml(task.current_step)}</div>` : ''}
      </div>
      ${
        task.progress !== undefined
          ? `
        <div class="task-progress">
          <div class="task-progress-bar">
            <div class="task-progress-fill" style="width: ${task.progress}%"></div>
          </div>
          <div class="task-progress-text">${task.progress}%</div>
        </div>
      `
          : ''
      }
    </div>
  `
    )
    .join('');
}

/**
 * Show task details in modal
 */
function showTaskDetail(taskId) {
  if (!dashboardState.currentData) return;

  const task = findTaskById(taskId);
  if (!task) return;

  elements.modalTitle.textContent = task.name;
  elements.modalBody.innerHTML = generateTaskDetailHTML(task);

  elements.taskModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

/**
 * Show tasks by category
 */
function showTaskDetails(category) {
  if (!dashboardState.currentData) return;

  const tasks = getTasksByCategory(category);

  elements.modalTitle.textContent = `${category.charAt(0).toUpperCase() + category.slice(1)} Tasks`;
  elements.modalBody.innerHTML = generateTaskListHTML(tasks, category);

  elements.taskModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

/**
 * Generate task detail HTML
 */
function generateTaskDetailHTML(task) {
  return `
    <div class="task-detail">
      <div class="task-detail-section">
        <h4>Overview</h4>
        <div class="task-detail-grid">
          <div class="task-detail-item">
            <label>Status</label>
            <span class="task-status ${task.status}">${task.status.replace('_', ' ')}</span>
          </div>
          <div class="task-detail-item">
            <label>Agent</label>
            <span class="task-agent">${escapeHtml(task.agent || 'Unknown')}</span>
          </div>
          <div class="task-detail-item">
            <label>Priority</label>
            <span class="task-priority ${task.priority?.toLowerCase()}">${task.priority || 'Normal'}</span>
          </div>
          <div class="task-detail-item">
            <label>Progress</label>
            <span>${task.progress || 0}%</span>
          </div>
        </div>
      </div>

      ${
        task.current_step
          ? `
        <div class="task-detail-section">
          <h4>Current Step</h4>
          <p>${escapeHtml(task.current_step)}</p>
        </div>
      `
          : ''
      }

      ${
        task.file_path
          ? `
        <div class="task-detail-section">
          <h4>File Path</h4>
          <code>${escapeHtml(task.file_path)}</code>
        </div>
      `
          : ''
      }

      ${
        task.estimated_hours
          ? `
        <div class="task-detail-section">
          <h4>Estimated Duration</h4>
          <p>${escapeHtml(task.estimated_hours)}</p>
        </div>
      `
          : ''
      }

      ${
        task.blocked_by?.length
          ? `
        <div class="task-detail-section">
          <h4>Blocked By</h4>
          <ul>
            ${task.blocked_by.map((id) => `<li><code>${escapeHtml(id)}</code></li>`).join('')}
          </ul>
        </div>
      `
          : ''
      }

      ${
        task.pr_url
          ? `
        <div class="task-detail-section">
          <h4>Pull Request</h4>
          <a href="${escapeHtml(task.pr_url)}" target="_blank" rel="noopener">View PR</a>
        </div>
      `
          : ''
      }

      <div class="task-detail-section">
        <h4>Timeline</h4>
        <div class="task-timeline">
          ${task.started_at ? `<div>Started: ${new Date(task.started_at).toLocaleString()}</div>` : ''}
          ${task.completed_at ? `<div>Completed: ${new Date(task.completed_at).toLocaleString()}</div>` : ''}
        </div>
      </div>
    </div>
  `;
}

/**
 * Generate task list HTML for modal
 */
function generateTaskListHTML(tasks, category) {
  if (tasks.length === 0) {
    return `<div class="empty-state"><p>No ${category} tasks found</p></div>`;
  }

  return `
    <div class="task-list-modal">
      ${tasks
        .map(
          (task) => `
        <div class="task-item-modal" onclick="showTaskDetail('${task.id}')">
          <div class="task-header">
            <div class="task-name">${escapeHtml(task.name)}</div>
            <div class="task-status ${task.status}">${task.status.replace('_', ' ')}</div>
          </div>
          <div class="task-meta">
            <span class="task-agent">${escapeHtml(task.agent || 'Unknown Agent')}</span>
            ${task.progress_percent !== undefined ? `<span>${task.progress_percent}%</span>` : ''}
          </div>
        </div>
      `
        )
        .join('')}
    </div>
  `;
}

/**
 * Close modal
 */
function closeModal() {
  elements.taskModal.classList.remove('active');
  document.body.style.overflow = '';
}

/**
 * Find task by ID
 */
function findTaskById(taskId) {
  if (!dashboardState.currentData?.tasks?.tasks) return null;

  const task = dashboardState.currentData.tasks.tasks.find((t) => t.id === taskId);
  return task || null;
}

/**
 * Get tasks by category
 */
function getTasksByCategory(category) {
  if (!dashboardState.currentData?.tasks?.tasks) return [];

  const allTasks = dashboardState.currentData.tasks.tasks;

  switch (category) {
    case 'completed':
      return allTasks.filter((t) => t.status === 'completed');
    case 'active':
      return allTasks.filter((t) => t.status === 'in_progress');
    case 'blocked':
      return allTasks.filter((t) => t.status === 'blocked');
    case 'all':
    default:
      return allTasks;
  }
}

/**
 * Add log entry
 */
function addLogEntry(logData) {
  const logEntry = document.createElement('div');
  logEntry.className = 'log-entry fade-in';

  const timestamp = logData.timestamp || new Date().toISOString();
  const level = logData.level || 'INFO';
  const agent = logData.agent || 'SYSTEM';
  const message = logData.message || '';

  logEntry.innerHTML = `
    <span class="log-timestamp">[${timestamp}]</span>
    <span class="log-level ${level}">[${level}]</span>
    <span class="log-agent">[${escapeHtml(agent)}]</span>
    <span class="log-message">${escapeHtml(message)}</span>
  `;

  elements.logsContainer.appendChild(logEntry);

  // Auto-scroll if enabled
  if (dashboardState.autoScroll) {
    elements.logsContainer.scrollTop = elements.logsContainer.scrollHeight;
  }

  // Limit log entries to prevent memory issues
  const logEntries = elements.logsContainer.querySelectorAll('.log-entry');
  if (logEntries.length > 100) {
    logEntries[0].remove();
  }
}

/**
 * Utility functions
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function animateButton(button) {
  button.style.transform = 'scale(0.95)';
  setTimeout(() => {
    button.style.transform = '';
  }, 150);
}

function animateCard(card) {
  card.style.transform = 'scale(0.98)';
  setTimeout(() => {
    card.style.transform = '';
  }, 200);
}

function refreshData() {
  socket.emit('requestUpdate');
}

function clearLogs() {
  elements.logsContainer.innerHTML = '';
}

function updateConnectionStatus(status, message) {
  const statusElement = elements.connectionStatus;
  const dot = statusElement.querySelector('.status-dot');
  const text = statusElement.querySelector('.status-text');

  statusElement.className = `connection-status ${status}`;
  text.textContent = message;

  // Update dot color based on status
  switch (status) {
    case 'connected':
      dot.style.background = 'var(--accent-success)';
      break;
    case 'connecting':
      dot.style.background = 'var(--accent-warning)';
      break;
    case 'disconnected':
      dot.style.background = 'var(--accent-error)';
      break;
  }
}

function startUptimeCounter() {
  dashboardState.startTime = Date.now();

  dashboardState.uptimeInterval = setInterval(() => {
    const uptime = Date.now() - dashboardState.startTime;
    const hours = Math.floor(uptime / 3600000);
    const minutes = Math.floor((uptime % 3600000) / 60000);
    const seconds = Math.floor((uptime % 60000) / 1000);

    elements.uptime.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, 1000);
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeDashboard);

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && socket.connected) {
    refreshData();
  }
});

console.log('🎯 Modern Sovren Agent Dashboard loaded');
