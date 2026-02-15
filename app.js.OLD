/**
 * Sovren Agent Orchestration Dashboard - Client Application
 * Real-time monitoring with Socket.IO and beautiful UI
 *
 * Features:
 * - Real-time updates via Socket.IO
 * - Beautiful animations and transitions
 * - Responsive design
 * - Auto-scroll logs
 * - Connection status monitoring
 * - Uptime tracking
 */

// ============================================
// INITIALIZATION
// ============================================

// Initialize Socket.IO connection
const socket = io();

// Application state
let state = {
  autoScroll: true,
  startTime: null,
  uptimeInterval: null,
  currentData: null,
  agentsData: { agents: [], summary: {} },
  selectedAgentId: null
};

// DOM Elements cache
const elements = {
  // Header
  projectName: document.getElementById('project-name'),
  currentPhase: document.getElementById('current-phase'),
  uptimeValue: document.getElementById('uptime-value'),
  connectionStatus: document.getElementById('connection-status'),

  // Stats
  statCompleted: document.getElementById('stat-completed'),
  statActive: document.getElementById('stat-active'),
  statBlocked: document.getElementById('stat-blocked'),
  statTotal: document.getElementById('stat-total'),

  // Progress
  progressPercent: document.getElementById('progress-percent'),
  progressBar: document.getElementById('progress-bar'),

  // Tasks
  activeCount: document.getElementById('active-count'),
  blockedCount: document.getElementById('blocked-count'),
  activeTasks: document.getElementById('active-tasks'),
  blockedTasks: document.getElementById('blocked-tasks'),

  // Agents
  activeAgentCount: document.getElementById('active-agent-count'),
  agentsGrid: document.getElementById('agents-grid'),
  agentsEmptyState: document.getElementById('agents-empty-state'),
  refreshAgentsBtn: document.getElementById('refresh-agents'),
  toggleHierarchyBtn: document.getElementById('toggle-agent-hierarchy'),

  // Active Agents Tile
  activeAgentsCount: document.getElementById('active-agents-count'),
  activeAgentsList: document.getElementById('active-agents-list'),
  agentsEmptyStateTile: document.getElementById('agents-empty-state-tile'),
  refreshAgentsBtnTile: document.getElementById('refresh-agents-btn-tile'),

  // Agent Modal
  agentModal: document.getElementById('agent-thinking-modal'),
  agentModalTitle: document.getElementById('agent-modal-title'),
  agentTasksCompleted: document.getElementById('agent-tasks-completed'),
  agentSuccessRate: document.getElementById('agent-success-rate'),
  agentAvgTime: document.getElementById('agent-avg-time'),
  agentActiveSince: document.getElementById('agent-active-since'),
  agentTaskName: document.getElementById('agent-task-name'),
  agentTaskProgress: document.getElementById('agent-task-progress'),
  agentTaskProgressText: document.getElementById('agent-task-progress-text'),
  agentThinkingTimeline: document.getElementById('agent-thinking-timeline'),
  agentAutoScroll: document.getElementById('agent-auto-scroll'),
  agentSubAgentsSection: document.getElementById('agent-sub-agents-section'),
  subAgentsCount: document.getElementById('sub-agents-count'),
  subAgentsList: document.getElementById('sub-agents-list'),
  agentCurrentTaskCard: document.getElementById('agent-current-task-card'),

  // Logs
  logsContainer: document.getElementById('logs-container'),
  autoScrollCheckbox: document.getElementById('auto-scroll-checkbox'),
  clearLogsBtn: document.getElementById('clear-logs-btn'),

  // Controls
  refreshBtn: document.getElementById('refresh-btn'),

  // Footer
  lastUpdate: document.getElementById('last-update'),

  // Modal
  modal: document.getElementById('status-modal'),
  modalTitle: null, // Will be set after DOM loads
  modalTitleText: null,
  modalCount: null,
  modalIcon: null,
  modalTaskList: null,
  modalEmptyState: null,
  modalClose: null,
  modalCloseFooter: null,
  modalExport: null
};

// ============================================
// SOCKET.IO EVENT HANDLERS
// ============================================

/**
 * Handle successful connection to server
 */
socket.on('connect', () => {
  console.log('Connected to server');
  updateConnectionStatus(true);

  // Request initial data (server sends this automatically on connection)
  // socket.emit('request-refresh'); // Optional: request fresh data
});

/**
 * Handle disconnection from server
 */
socket.on('disconnect', () => {
  console.log('Disconnected from server');
  updateConnectionStatus(false);
});

/**
 * Handle initial data load
 */
socket.on('initial-data', (data) => {
  console.log('Received initial data:', data);

  // Server sends: { tasks: {...}, logs: string, metrics: {...} }
  // We need to extract the tasks data
  if (data.tasks) {
    updateDashboard(data.tasks);
  }

  // Handle logs if provided
  if (data.logs) {
    parseLogs(data.logs);
  }

  // Handle metrics if provided separately
  if (data.metrics && data.tasks) {
    // Metrics are usually part of tasks.summary, so we don't need to do anything extra
  }

  // Handle agents if provided
  if (data.agents) {
    console.log('Agents:', data.agents);
    state.agentsData = data.agents;
    updateAgentsPanel(data.agents);
    updateActiveAgentsTile(data.agents);
  }
});

/**
 * Handle real-time task updates
 */
socket.on('tasks-update', (data) => {
  console.log('Received tasks update');
  updateDashboard(data);
});

/**
 * Handle data updates (from subtask changes, etc.)
 */
socket.on('data-update', (data) => {
  console.log('📡 Received data update');
  updateDashboard(data);
});

/**
 * Handle real-time log updates
 */
socket.on('logs-update', (logs) => {
  console.log('Received logs update');
  if (typeof logs === 'string') {
    // Server sends logs as a string
    parseLogs(logs);
  } else if (Array.isArray(logs)) {
    // Fallback: handle array format
    elements.logsContainer.innerHTML = '';
    logs.forEach(log => addLogEntry(log));
  }
});

/**
 * Handle real-time agent updates
 */
socket.on('agents-update', (data) => {
  console.log('Received agents update:', data);
  state.agentsData = data;
  updateAgentsPanel(data);
  updateActiveAgentsTile(data);

  // Update thinking modal if open
  if (state.selectedAgentId) {
    updateAgentThinkingModal(state.selectedAgentId);
  }
});

/**
 * Handle metrics updates
 */
socket.on('metrics-update', (metrics) => {
  console.log('Received metrics update');
  // Metrics are usually redundant with tasks.summary
  // But we can use them if needed
  if (metrics && state.currentData) {
    // Update only if we have current data to merge with
    console.log('Metrics:', metrics);
  }
});

// ============================================
// EVENT LISTENERS
// ============================================

/**
 * Initialize event listeners
 */
function initializeEventListeners() {
  // Refresh button
  elements.refreshBtn.addEventListener('click', () => {
    refreshDashboard();
  });

  // Auto-scroll toggle
  elements.autoScrollCheckbox.addEventListener('change', (e) => {
    state.autoScroll = e.target.checked;
  });

  // Clear logs button
  elements.clearLogsBtn.addEventListener('click', () => {
    clearLogs();
  });

  // Agent refresh button
  if (elements.refreshAgentsBtn) {
    elements.refreshAgentsBtn.addEventListener('click', () => {
      console.log('Refreshing agents...');
      socket.emit('request-refresh');
    });
  }

  // Export epic report button
  const exportEpicReportBtn = document.getElementById('export-epic-report-btn');
  if (exportEpicReportBtn) {
    exportEpicReportBtn.addEventListener('click', () => {
      console.log('Exporting epic completion report...');
      exportEpicReport();
    });
  }

  // Kanban card click handlers (event delegation)
  document.addEventListener('click', (e) => {
    const kanbanCard = e.target.closest('.kanban-card');
    if (kanbanCard) {
      const taskId = kanbanCard.dataset.taskId;
      const storyId = kanbanCard.dataset.storyId;
      console.log('Kanban card clicked:', { taskId, storyId });

      if (state.currentData && state.currentData.phases) {
        const task = findTaskById(taskId, state.currentData.phases);
        if (task) {
          console.log('Task details:', task);
          showStoryDetailModal(task);
        } else {
          console.warn('Task not found for ID:', taskId);
        }
      } else {
        console.warn('No current data available');
      }
    }
  });

  // Subtask click handlers (event delegation)
  document.addEventListener('click', (e) => {
    const subtaskItem = e.target.closest('.subtask-item');
    if (subtaskItem) {
      const taskId = subtaskItem.dataset.taskId;
      const storyId = subtaskItem.dataset.storyId;
      const subtaskOrder = subtaskItem.dataset.subtaskOrder;

      console.log('Subtask clicked:', { taskId, storyId, subtaskOrder });

      // Prevent triggering modal close
      e.stopPropagation();

      // Update subtask status
      updateSubtaskStatus(taskId, storyId, subtaskOrder);
    }
  });

  // Story detail modal close handlers
  const storyModal = document.getElementById('story-detail-modal');
  const storyCloseBtn = document.getElementById('story-close-btn');

  if (storyCloseBtn) {
    storyCloseBtn.addEventListener('click', () => {
      storyModal.classList.remove('active');
      document.body.style.overflow = '';
    });
  }

  // Close modal on background click
  if (storyModal) {
    storyModal.addEventListener('click', (e) => {
      if (e.target === storyModal) {
        storyModal.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  }

  // Close modal on ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && storyModal && storyModal.classList.contains('active')) {
      storyModal.classList.remove('active');
      document.body.style.overflow = '';
    }
  });

  // Active Agents Tile refresh button
  if (elements.refreshAgentsBtnTile) {
    elements.refreshAgentsBtnTile.addEventListener('click', () => {
      console.log('Refreshing active agents tile...');
      socket.emit('request-refresh');
    });
  }

  // Agent modal close button
  if (elements.agentModal) {
    const closeButtons = elements.agentModal.querySelectorAll('.modal-close, [data-action="close"]');
    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        elements.agentModal.classList.remove('active');
        document.body.style.overflow = '';
        state.selectedAgentId = null;
      });
    });

    // Export thinking log button
    const exportBtn = elements.agentModal.querySelector('[data-action="export-thinking"]');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const agent = state.agentsData.agents?.find(a => a.id === state.selectedAgentId);
        if (agent) {
          const data = {
            agent: agent.name,
            type: agent.type,
            thinking: agent.thinking,
            exported: new Date().toISOString()
          };
          downloadJSON(data, `agent-thinking-${agent.name}-${Date.now()}.json`);
        }
      });
    }

    // Close on ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && elements.agentModal.classList.contains('active')) {
        elements.agentModal.classList.remove('active');
        document.body.style.overflow = '';
        state.selectedAgentId = null;
      }
    });
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + R to refresh
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
      e.preventDefault();
      refreshDashboard();
    }

    // Escape to close modal or clear focus
    if (e.key === 'Escape') {
      if (elements.modal.classList.contains('active')) {
        closeModal();
      } else {
        document.activeElement.blur();
      }
    }
  });

  // Initialize modal
  initializeModal();

  // Initialize stat box click handlers
  initializeStatusBoxes();
}

// ============================================
// DASHBOARD UPDATE FUNCTIONS
// ============================================

/**
 * Update entire dashboard with new data
 */
function updateDashboard(data) {
  if (!data) return;

  state.currentData = data;

  // Update header info
  if (data.project_id) {
    elements.projectName.textContent = data.project_id;
  }

  if (data.current_phase) {
    elements.currentPhase.textContent = `Phase: ${data.current_phase}`;
  }

  // Update stats
  if (data.summary) {
    updateStats(data.summary);
    updateProgress(data.summary.completion_percent || 0);
  }

  // Update task lists
  if (data.phases) {
    updateTaskLists(data.phases);
  }

  // Update timestamp
  updateLastUpdateTime();
}

/**
 * Update statistics cards
 */
function updateStats(summary) {
  const completed = summary.completed || 0;
  const active = summary.in_progress || 0;
  const blocked = summary.blocked || 0;
  const total = summary.total_tasks || 0;

  // Animate value updates
  animateValue(elements.statCompleted, completed);
  animateValue(elements.statActive, active);
  animateValue(elements.statBlocked, blocked);
  animateValue(elements.statTotal, total);
}

/**
 * Update progress bar
 */
function updateProgress(percentage) {
  const progress = Math.max(0, Math.min(100, Math.round(percentage)));

  elements.progressPercent.textContent = `${progress}%`;
  elements.progressBar.style.width = `${progress}%`;

  // Update ARIA attributes
  const progressBarContainer = elements.progressBar.parentElement;
  progressBarContainer.setAttribute('aria-valuenow', progress);
}

/**
 * Update Kanban board with tasks
 */
function updateTaskLists(phases) {
  const todoTasks = [];
  const inProgressTasks = [];
  const testingTasks = [];
  const completedTasks = [];

  // First, collect all tasks and identify active epics
  const activeEpics = new Set();
  const allTasks = [];

  Object.values(phases).forEach(phase => {
    if (phase.tasks && Array.isArray(phase.tasks)) {
      phase.tasks.forEach(task => {
        if (task.type === 'story') {
          allTasks.push(task);

          // An epic is "active" if it has stories that are NOT pending
          if (task.status && task.status !== 'pending' && task.status !== 'queued') {
            const epicLabel = task.epic_label || extractEpicFromName(task.name);
            if (epicLabel) {
              activeEpics.add(epicLabel);
            }
          }
        }
      });
    }
  });

  // Now filter tasks: only show stories from active epics
  allTasks.forEach(task => {
    const epicLabel = task.epic_label || extractEpicFromName(task.name);
    const isEpicActive = epicLabel ? activeEpics.has(epicLabel) : true;

    // Only display stories from epics that have started work
    if (isEpicActive) {
      switch (task.status) {
        case 'pending':
        case 'queued':
          todoTasks.push(task);
          break;
        case 'in_progress':
        case 'active':
          inProgressTasks.push(task);
          break;
        case 'testing':
        case 'review':
          testingTasks.push(task);
          break;
        case 'completed':
        case 'done':
          completedTasks.push(task);
          break;
      }
    }
  });

  // Update counts
  const todoCount = document.getElementById('todo-count');
  const inProgressCount = document.getElementById('inprogress-count');
  const testingCount = document.getElementById('testing-count');
  const completeCount = document.getElementById('complete-count');

  if (todoCount) todoCount.textContent = todoTasks.length;
  if (inProgressCount) inProgressCount.textContent = inProgressTasks.length;
  if (testingCount) testingCount.textContent = testingTasks.length;
  if (completeCount) completeCount.textContent = completedTasks.length;

  // Render Kanban lanes
  renderKanbanLane('todo-tasks', todoTasks, 'To Do');
  renderKanbanLane('inprogress-tasks', inProgressTasks, 'In Progress');
  renderKanbanLane('testing-tasks', testingTasks, 'Testing');
  renderKanbanLane('complete-tasks', completedTasks, 'Complete');
}

/**
 * Render Kanban lane with cards
 */
function renderKanbanLane(laneId, tasks, laneName) {
  const lane = document.getElementById(laneId);
  if (!lane) return;

  if (!tasks || tasks.length === 0) {
    const emptyIcons = {
      'To Do': '✨',
      'In Progress': '⏳',
      'Testing': '🔬',
      'Complete': '🎉'
    };
    lane.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">${emptyIcons[laneName] || '📝'}</span>
        <p>No ${laneName.toLowerCase()} tasks</p>
      </div>
    `;
    return;
  }

  lane.innerHTML = tasks.map(task => createKanbanCard(task)).join('');
}

/**
 * Create Kanban card HTML
 */
function createKanbanCard(task) {
  const name = escapeHtml(task.name || 'Unnamed Task');
  const storyId = task.story_id || '';
  const agent = task.agent || 'unassigned';
  const agentType = task.agent_type || 'unknown';
  const progress = task.progress_percent || 0;
  const status = task.status || 'unknown';
  const epicLabel = task.epic_label || extractEpicFromName(task.name);

  // Extract epic number for color coding (e.g., "Epic 003" -> "003")
  const epicNumber = epicLabel ? epicLabel.match(/\d+/) ? epicLabel.match(/\d+/)[0] : '' : '';

  // Get agent icon
  const agentIcon = getAgentIconForType(agentType);

  // Format duration
  const duration = task.started_at ? calculateDuration(task.started_at) : '';

  return `
    <div class="kanban-card" data-task-id="${task.id || ''}" data-story-id="${storyId}" role="button" tabindex="0">
      ${epicLabel ? `<div class="kanban-card-epic" data-epic="${epicNumber}">${escapeHtml(epicLabel)}</div>` : ''}

      <div class="kanban-card-header">
        <h4 class="kanban-card-title">${name}</h4>
        ${storyId ? `<span class="kanban-card-id">${storyId}</span>` : ''}
      </div>

      ${agent !== 'unassigned' ? `
        <div class="kanban-card-agent agent-${agentType}">
          <span class="agent-icon">${agentIcon}</span>
          <span class="agent-label">${agent}</span>
        </div>
      ` : ''}

      ${task.subtasks && task.subtasks.length > 0 ? `
        <div class="kanban-card-progress">
          <div class="kanban-card-progress-bar">
            <div class="kanban-card-progress-fill" style="width: ${progress}%"></div>
          </div>
          <div class="kanban-card-progress-text">${progress}% complete</div>
        </div>
      ` : (status === 'in_progress' || status === 'active') && progress > 0 ? `
        <div class="kanban-card-progress">
          <div class="kanban-card-progress-bar">
            <div class="kanban-card-progress-fill" style="width: ${progress}%"></div>
          </div>
        </div>
      ` : ''}

      <div class="kanban-card-footer">
        <div class="kanban-card-meta">
          ${duration ? `<span>⏱️ ${duration}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

/**
 * Extract epic name from task name
 */
function extractEpicFromName(name) {
  if (!name) return '';

  // Pattern: "Epic 003: NOSTR Consolidation" or "US-308: NOSTR Types..." -> "Epic 003"
  const epicMatch = name.match(/Epic\s+(\d+)/i);
  if (epicMatch) {
    return `Epic ${epicMatch[1]}`;
  }

  // Try to infer from US- prefix (US-308 might belong to Epic 003)
  const usMatch = name.match(/US-(\d+)/);
  if (usMatch) {
    const usNum = parseInt(usMatch[1]);
    // US-301 to US-326 = Epic 003 (NOSTR Consolidation)
    if (usNum >= 301 && usNum <= 326) return 'Epic 003: NOSTR';
    // US-401 to US-425 = Epic 004 (State Management)
    if (usNum >= 401 && usNum <= 425) return 'Epic 004: State Management';
    // US-501 to US-542 = Epic 005 (Backend Services)
    if (usNum >= 501 && usNum <= 599) return 'Epic 005: Backend Services';
    // US-201 to US-218 = Epic 002 (Payment Processing)
    if (usNum >= 201 && usNum <= 218) return 'Epic 002: Payment';
    // US-101 to US-112 = Epic 001 (Type Safety)
    if (usNum >= 101 && usNum <= 112) return 'Epic 001: Type Safety';
  }

  return '';
}

/**
 * Render task list in container (legacy - kept for compatibility)
 */
function renderTaskList(container, tasks, type) {
  if (!tasks || tasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">${type === 'active' ? '⏳' : '✨'}</span>
        <p>No ${type} tasks</p>
      </div>
    `;
    return;
  }

  container.innerHTML = tasks.map(task => createTaskCard(task)).join('');
}

/**
 * Create HTML for a task card
 */
function createTaskCard(task) {
  const progress = task.progress_percent || 0;
  const status = task.status || 'unknown';
  const name = escapeHtml(task.name || 'Unnamed Task');
  const agent = escapeHtml(task.agent || 'Unknown Agent');
  const agentType = task.agent_type || 'unknown';
  const step = task.current_step ? escapeHtml(task.current_step) : '';
  const taskId = task.id ? `#${task.id}` : '';
  const startedAt = task.started_at ? formatTime(new Date(task.started_at)) : '';
  const duration = task.started_at ? calculateDuration(task.started_at) : '';

  // Debug log
  if (status === 'in_progress' && task.type === 'story') {
    console.log('Task Card Debug:', { name: task.name, agent, agentType, progress, status });
  }

  // Agent icon based on type
  const agentIcon = getAgentIconForType(agentType);

  return `
    <div class="task-card status-${status}" data-task-id="${task.id || ''}" role="button" tabindex="0">
      <div class="task-card-header">
        <h3 class="task-name">${name}</h3>
        ${taskId ? `<span class="task-id">${taskId}</span>` : ''}
      </div>

      <div class="task-card-body">
        <div class="task-meta-row">
          <span class="task-agent agent-type-${agentType}">
            <span class="agent-icon">${agentIcon}</span>
            <span class="agent-name-label">${agent}</span>
          </span>
          <span class="task-status-badge status-${status}">
            ${formatStatus(status)}
          </span>
        </div>

        ${step ? `
          <div class="task-current-step">
            <span class="step-label">Current step:</span>
            <span class="step-text">${step}</span>
          </div>
        ` : ''}

        ${status === 'in_progress' || status === 'active' ? `
          <div class="task-progress">
            <div class="task-progress-bar">
              <div class="task-progress-fill" style="width: ${progress}%">
                <span class="task-progress-text">${progress}%</span>
              </div>
            </div>
          </div>
        ` : ''}
      </div>

      ${startedAt ? `
        <div class="task-card-footer">
          <span class="task-started">Started: ${startedAt}</span>
          ${duration ? `<span class="task-duration">Running: ${duration}</span>` : ''}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Format status for display
 */
function formatStatus(status) {
  const statusMap = {
    'in_progress': 'In Progress',
    'active': 'Active',
    'completed': 'Completed',
    'blocked': 'Blocked',
    'queued': 'Queued'
  };
  return statusMap[status] || status;
}

/**
 * Parse logs string and display all entries
 */
function parseLogs(logsString) {
  if (typeof logsString !== 'string' || !logsString.trim()) return;

  // Clear existing logs
  elements.logsContainer.innerHTML = '';

  // Split by newlines and process each line
  const lines = logsString.split('\n').filter(line => line.trim());

  // Show last 100 lines
  const recentLines = lines.slice(-100);

  recentLines.forEach(line => {
    addLogEntry(line);
  });

  // Auto-scroll to bottom
  if (state.autoScroll) {
    scrollLogsToBottom();
  }
}

/**
 * Add a log entry to the logs container
 */
function addLogEntry(logData) {
  // Parse log data
  let timestamp, level, agent, message;

  if (typeof logData === 'string') {
    // Parse log string format: [timestamp] [LEVEL] [AGENT] message
    const logMatch = logData.match(/\[([^\]]+)\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]\s*(.*)/);
    if (logMatch) {
      [, timestamp, level, agent, message] = logMatch;
    } else {
      // Fallback parsing
      timestamp = new Date().toISOString();
      level = 'INFO';
      agent = 'SYSTEM';
      message = logData;
    }
  } else if (typeof logData === 'object') {
    // Object format
    timestamp = logData.timestamp || new Date().toISOString();
    level = logData.level || 'INFO';
    agent = logData.agent || 'SYSTEM';
    message = logData.message || '';
  } else {
    return; // Invalid log data
  }

  // Format timestamp
  const formattedTime = formatTimestamp(timestamp);

  // Create log entry element
  const logEntry = document.createElement('div');
  logEntry.className = 'log-entry fade-in';
  logEntry.innerHTML = `
    <span class="log-timestamp">[${formattedTime}]</span>
    <span class="log-level ${level}">[${level}]</span>
    <span class="log-agent">[${escapeHtml(agent)}]</span>
    <span class="log-message">${escapeHtml(message)}</span>
  `;

  // Remove empty state if present
  const emptyState = elements.logsContainer.querySelector('.empty-state');
  if (emptyState) {
    emptyState.remove();
  }

  // Add to container
  elements.logsContainer.appendChild(logEntry);

  // Auto-scroll if enabled
  if (state.autoScroll) {
    scrollLogsToBottom();
  }

  // Limit log entries to prevent memory issues (keep last 100)
  const logEntries = elements.logsContainer.querySelectorAll('.log-entry');
  if (logEntries.length > 100) {
    logEntries[0].remove();
  }
}

// ============================================
// MODAL FUNCTIONALITY
// ============================================

/**
 * Initialize modal elements and event listeners
 */
function initializeModal() {
  // Cache modal elements
  elements.modalTitle = elements.modal.querySelector('.modal-title');
  elements.modalTitleText = elements.modal.querySelector('.modal-title-text');
  elements.modalCount = elements.modal.querySelector('.modal-count');
  elements.modalIcon = elements.modal.querySelector('.modal-icon');
  elements.modalTaskList = document.getElementById('modal-task-list');
  elements.modalEmptyState = elements.modal.querySelector('.modal-empty-state');
  elements.modalClose = elements.modal.querySelector('.modal-close');
  elements.modalCloseFooter = elements.modal.querySelector('[data-action="close"]');
  elements.modalExport = elements.modal.querySelector('[data-action="export"]');

  // Close button handlers
  if (elements.modalClose) {
    elements.modalClose.addEventListener('click', closeModal);
  }

  if (elements.modalCloseFooter) {
    elements.modalCloseFooter.addEventListener('click', closeModal);
  }

  // Export button handler
  if (elements.modalExport) {
    elements.modalExport.addEventListener('click', exportTaskData);
  }

  // Click outside to close
  elements.modal.addEventListener('click', (e) => {
    if (e.target === elements.modal) {
      closeModal();
    }
  });
}

/**
 * Initialize status box click handlers
 */
function initializeStatusBoxes() {
  const statCards = document.querySelectorAll('.stat-card[data-status]');

  statCards.forEach(card => {
    // Click handler
    card.addEventListener('click', () => {
      const status = card.dataset.status;
      showStatusModal(status);
    });

    // Keyboard handler (Enter or Space)
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const status = card.dataset.status;
        showStatusModal(status);
      }
    });
  });
}

/**
 * Show modal with filtered tasks
 */
function showStatusModal(status) {
  if (!state.currentData) return;

  // Get tasks by status
  const tasks = getTasksByStatus(status);

  // Update modal title
  const statusConfig = {
    completed: { icon: '✅', label: 'Completed Tasks' },
    active: { icon: '⚡', label: 'Active Tasks' },
    blocked: { icon: '🚧', label: 'Blocked Tasks' },
    total: { icon: '📊', label: 'All Tasks' }
  };

  const config = statusConfig[status] || statusConfig.total;

  elements.modalIcon.textContent = config.icon;
  elements.modalTitleText.textContent = config.label;
  elements.modalCount.textContent = `${tasks.length} items`;

  // Store current status for export
  elements.modal.dataset.currentStatus = status;

  // Render tasks
  if (tasks.length === 0) {
    elements.modalTaskList.style.display = 'none';
    elements.modalEmptyState.style.display = 'flex';
  } else {
    elements.modalTaskList.style.display = 'flex';
    elements.modalEmptyState.style.display = 'none';
    renderModalTasks(tasks);
  }

  // Show modal
  elements.modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Focus trap - focus close button
  setTimeout(() => {
    elements.modalClose.focus();
  }, 100);
}

/**
 * Close modal
 */
function closeModal() {
  elements.modal.classList.remove('active');
  document.body.style.overflow = '';
}

/**
 * Get tasks by status
 */
function getTasksByStatus(status) {
  if (!state.currentData || !state.currentData.phases) return [];

  const allTasks = [];

  // Collect all tasks from all phases
  Object.values(state.currentData.phases).forEach(phase => {
    if (phase.tasks && Array.isArray(phase.tasks)) {
      phase.tasks.forEach(task => {
        allTasks.push(task);
      });
    }
  });

  // Filter by status
  if (status === 'total') {
    return allTasks;
  } else if (status === 'active') {
    return allTasks.filter(task => task.status === 'in_progress');
  } else if (status === 'completed') {
    return allTasks.filter(task => task.status === 'completed');
  } else if (status === 'blocked') {
    return allTasks.filter(task => task.status === 'blocked');
  }

  return allTasks;
}

/**
 * Render tasks in modal
 */
function renderModalTasks(tasks) {
  elements.modalTaskList.innerHTML = tasks.map(task => createDetailedTaskCard(task)).join('');

  // Add click handlers for expandable epics
  const epicCards = elements.modalTaskList.querySelectorAll('[data-task-type="epic"]');
  epicCards.forEach(card => {
    const expandBtn = card.querySelector('.epic-expand-btn');
    if (expandBtn) {
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleEpicStories(card);
      });
    }
  });
}

/**
 * Create detailed task card for modal
 */
function createDetailedTaskCard(task) {
  const name = escapeHtml(task.name || 'Unnamed Task');
  const agent = escapeHtml(task.agent || 'Unknown Agent');
  const agentType = task.agent_type || 'unknown';
  const description = escapeHtml(task.description || task.current_step || 'No description available');
  const status = task.status || 'unknown';
  const progress = task.progress_percent || 0;

  // Agent icon based on type
  const agentIcon = getAgentIconForType(agentType);

  // Check if this is an epic with stories
  if (task.type === 'epic' && task.story_count) {
    return createEpicDetailCard(task);
  }

  // Generate history timeline
  const history = generateTaskHistory(task);
  const timelineHtml = history.map(event => `
    <div class="timeline-item ${event.completed ? 'completed' : ''}">
      <span class="timeline-time">${event.time}</span>
      <span class="timeline-event">${escapeHtml(event.event)}</span>
    </div>
  `).join('');

  // Calculate duration
  const duration = calculateDuration(task.started_at, task.completed_at);

  // Format dates
  const startedAt = task.started_at ? formatFullTimestamp(task.started_at) : 'Not started';
  const completedAt = task.completed_at ? formatFullTimestamp(task.completed_at) : null;

  // Status badge class
  const badgeClass = status === 'completed' ? 'badge-success' :
                     status === 'in_progress' ? 'badge-in_progress' :
                     status === 'blocked' ? 'badge-blocked' :
                     'badge-active';

  return `
    <div class="modal-task-card">
      <div class="task-card-header">
        <h3 class="task-title">${name}</h3>
        <span class="task-agent-badge agent-type-${agentType}">
          <span class="agent-icon">${agentIcon}</span>
          <span class="agent-label">Agent:</span> ${agent}
        </span>
      </div>

      <div class="task-description">
        <p>${description}</p>
      </div>

      ${status === 'in_progress' || status === 'active' ? `
        <div class="task-progress" style="margin: 1rem 0;">
          <div class="task-progress-bar">
            <div class="task-progress-fill" style="width: ${progress}%">
              <span class="task-progress-text">${progress}%</span>
            </div>
          </div>
        </div>
      ` : ''}

      <div class="task-timeline">
        <h4>History Timeline</h4>
        <div class="timeline">
          ${timelineHtml}
        </div>
      </div>

      <div class="task-meta">
        <span class="meta-item">
          <strong>Started:</strong> ${startedAt}
        </span>
        ${duration ? `<span class="meta-item"><strong>Duration:</strong> ${duration}</span>` : ''}
        ${completedAt ? `<span class="meta-item"><strong>Completed:</strong> ${completedAt}</span>` : ''}
        <span class="meta-item">
          <strong>Status:</strong> <span class="badge ${badgeClass}">${status.replace('_', ' ')}</span>
        </span>
        ${status === 'in_progress' || status === 'active' ? `
          <span class="meta-item">
            <strong>Progress:</strong> ${progress}%
          </span>
        ` : ''}
        ${task.pr_url ? `<span class="meta-item"><a href="${escapeHtml(task.pr_url)}" target="_blank" rel="noopener noreferrer">View PR →</a></span>` : ''}
      </div>
    </div>
  `;
}

/**
 * Generate task history timeline
 */
function generateTaskHistory(task) {
  const history = [];

  // Task started
  if (task.started_at) {
    history.push({
      time: formatTimestamp(task.started_at),
      event: 'Task started',
      completed: false
    });
  }

  // Progress milestones (simulated based on progress_percent)
  const progress = task.progress_percent || 0;
  if (progress >= 25 && task.started_at) {
    history.push({
      time: formatTimestamp(task.started_at, 300), // +5 minutes
      event: 'Progress: 25%',
      completed: false
    });
  }
  if (progress >= 50 && task.started_at) {
    history.push({
      time: formatTimestamp(task.started_at, 600), // +10 minutes
      event: 'Progress: 50%',
      completed: false
    });
  }
  if (progress >= 75 && task.started_at) {
    history.push({
      time: formatTimestamp(task.started_at, 900), // +15 minutes
      event: 'Progress: 75%',
      completed: false
    });
  }

  // Task completed
  if (task.status === 'completed' && task.completed_at) {
    history.push({
      time: formatTimestamp(task.completed_at),
      event: 'Completed ✓',
      completed: true
    });
  } else if (task.status === 'blocked') {
    history.push({
      time: formatTimestamp(new Date().toISOString()),
      event: 'Task blocked 🚧',
      completed: false
    });
  }

  return history;
}

/**
 * Calculate duration between two timestamps
 */
function calculateDuration(startTime, endTime) {
  if (!startTime) return null;

  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : new Date();

  const durationMs = end - start;
  const hours = Math.floor(durationMs / 3600000);
  const minutes = Math.floor((durationMs % 3600000) / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Format full timestamp with date and time
 */
function formatFullTimestamp(timestamp) {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  } catch (e) {
    return timestamp;
  }
}

/**
 * Export task data as JSON
 */
function exportTaskData() {
  const status = elements.modal.dataset.currentStatus || 'all';
  const tasks = getTasksByStatus(status);

  const exportData = {
    status: status,
    timestamp: new Date().toISOString(),
    count: tasks.length,
    tasks: tasks.map(task => ({
      name: task.name,
      agent: task.agent,
      status: task.status,
      progress: task.progress_percent,
      description: task.description || task.current_step,
      started_at: task.started_at,
      completed_at: task.completed_at,
      pr_url: task.pr_url
    }))
  };

  const dataStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sovren-tasks-${status}-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  // Show feedback
  const originalText = elements.modalExport.innerHTML;
  elements.modalExport.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
    Exported!
  `;
  elements.modalExport.disabled = true;

  setTimeout(() => {
    elements.modalExport.innerHTML = originalText;
    elements.modalExport.disabled = false;
  }, 2000);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Update connection status indicator
 */
function updateConnectionStatus(connected) {
  const statusElement = elements.connectionStatus;
  const dot = statusElement.querySelector('.connection-dot');
  const text = statusElement.querySelector('.connection-text');

  if (connected) {
    statusElement.classList.add('connected');
    statusElement.classList.remove('disconnected');
    text.textContent = 'Connected';
    statusElement.title = 'Connected to server';
  } else {
    statusElement.classList.add('disconnected');
    statusElement.classList.remove('connected');
    text.textContent = 'Disconnected';
    statusElement.title = 'Disconnected from server';
  }
}

/**
 * Animate a numeric value change
 */
function animateValue(element, endValue, duration = 1000) {
  const startValue = parseInt(element.textContent) || 0;
  if (startValue === endValue) return;

  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing function (ease-out-cubic)
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const currentValue = Math.round(startValue + (endValue - startValue) * easeOut);

    element.textContent = currentValue;

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = endValue;
    }
  }

  requestAnimationFrame(update);
}

/**
 * Scroll logs container to bottom
 */
function scrollLogsToBottom() {
  elements.logsContainer.scrollTop = elements.logsContainer.scrollHeight;
}

/**
 * Clear all logs
 */
function clearLogs() {
  elements.logsContainer.innerHTML = `
    <div class="empty-state">
      <span class="empty-icon">📋</span>
      <p>Logs cleared</p>
    </div>
  `;
}

/**
 * Refresh dashboard data
 */
function refreshDashboard() {
  // Animate refresh button
  const icon = elements.refreshBtn.querySelector('.refresh-icon');
  if (icon) {
    icon.style.animation = 'none';
    setTimeout(() => {
      icon.style.animation = 'spin 0.6s ease-in-out';
    }, 10);
  }

  // Request fresh data from server
  socket.emit('request-refresh');
}

/**
 * Update last update timestamp
 */
function updateLastUpdateTime() {
  const now = new Date();
  elements.lastUpdate.textContent = now.toLocaleTimeString();
}

/**
 * Start uptime counter
 */
function startUptimeCounter() {
  state.startTime = Date.now();

  state.uptimeInterval = setInterval(() => {
    const uptime = Date.now() - state.startTime;
    const hours = Math.floor(uptime / 3600000);
    const minutes = Math.floor((uptime % 3600000) / 60000);
    const seconds = Math.floor((uptime % 60000) / 1000);

    elements.uptimeValue.textContent =
      `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }, 1000);
}

/**
 * Pad number with leading zero
 */
function pad(num) {
  return num.toString().padStart(2, '0');
}

/**
 * Format timestamp for display
 * @param {string|Date} timestamp - The timestamp to format
 * @param {number} offsetSeconds - Optional offset in seconds to add to the timestamp
 */
function formatTimestamp(timestamp, offsetSeconds = 0) {
  try {
    const date = new Date(timestamp);
    if (offsetSeconds > 0) {
      date.setSeconds(date.getSeconds() + offsetSeconds);
    }
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (e) {
    return timestamp;
  }
}

/**
 * Escape HTML to prevent XSS attacks
 */
function escapeHtml(text) {
  if (typeof text !== 'string') return '';

  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Handle visibility change (page hidden/visible)
 */
function handleVisibilityChange() {
  if (!document.hidden && socket.connected) {
    // Page became visible and socket is connected - refresh data
    refreshDashboard();
  }
}

/**
 * Download JSON data as a file
 */
function downloadJSON(data, filename) {
  const dataStr = JSON.stringify(data, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================
// INITIALIZATION ON PAGE LOAD
// ============================================

// ============================================
// AGENT MANAGEMENT FUNCTIONS
// ============================================

/**
 * Update agents panel with new data
 */
function updateAgentsPanel(data) {
  if (!elements.agentsGrid || !elements.agentsEmptyState) return;

  const countBadge = elements.activeAgentCount;
  if (countBadge) {
    countBadge.textContent = data.summary?.active_agents || 0;
  }

  if (!data.agents || data.agents.length === 0) {
    elements.agentsGrid.style.display = 'none';
    elements.agentsEmptyState.style.display = 'flex';
    return;
  }

  elements.agentsGrid.style.display = 'grid';
  elements.agentsEmptyState.style.display = 'none';

  // Render agent cards
  elements.agentsGrid.innerHTML = data.agents.map(agent => createAgentCard(agent)).join('');

  // Add click handlers
  elements.agentsGrid.querySelectorAll('.agent-card').forEach(card => {
    card.addEventListener('click', () => {
      showAgentThinkingModal(card.dataset.agentId);
    });

    // Keyboard support
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showAgentThinkingModal(card.dataset.agentId);
      }
    });
  });
}

/**
 * Update active agents tile
 */
function updateActiveAgentsTile(agentsData) {
  if (!elements.activeAgentsList || !elements.agentsEmptyStateTile) return;

  // Filter only active agents with current tasks
  const activeAgents = agentsData.agents ? agentsData.agents.filter(a =>
    a.status === 'active' && a.current_task
  ) : [];

  // Update count badge
  if (elements.activeAgentsCount) {
    elements.activeAgentsCount.textContent = activeAgents.length;
  }

  if (activeAgents.length === 0) {
    elements.activeAgentsList.style.display = 'none';
    elements.agentsEmptyStateTile.style.display = 'flex';
    return;
  }

  elements.activeAgentsList.style.display = 'flex';
  elements.agentsEmptyStateTile.style.display = 'none';

  // Render agent items
  elements.activeAgentsList.innerHTML = activeAgents.map(agent => createAgentItem(agent)).join('');

  // Add click handlers to agent items
  elements.activeAgentsList.querySelectorAll('.agent-item').forEach(item => {
    item.addEventListener('click', () => {
      showAgentThinkingModal(item.dataset.agentId);
    });

    // Keyboard support
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showAgentThinkingModal(item.dataset.agentId);
      }
    });
  });
}

/**
 * Create agent item HTML for active agents tile
 */
function createAgentItem(agent) {
  const progress = agent.current_task?.progress || 0;
  const lastActivity = agent.last_activity ? formatTimeAgo(new Date(agent.last_activity)) : formatTimeAgo(new Date());
  const agentIcon = getAgentIcon(agent.type);

  return `
    <div class="agent-item" data-agent-id="${agent.id}" role="button" tabindex="0">
      <div class="agent-item-left">
        <div class="agent-avatar-small">
          <span class="agent-type-icon">${agentIcon}</span>
          <span class="agent-pulse"></span>
        </div>
        <div class="agent-item-info">
          <div class="agent-item-name">${escapeHtml(agent.name)}</div>
          <div class="agent-item-task">${escapeHtml(agent.current_task.name)}</div>
        </div>
      </div>

      <div class="agent-item-right">
        <div class="agent-progress-mini">
          <div class="progress-circle" data-progress="${progress}">
            <svg viewBox="0 0 36 36">
              <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path class="circle-progress" stroke-dasharray="${progress}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
            <div class="progress-text">${progress}%</div>
          </div>
        </div>
        <div class="agent-time">${lastActivity}</div>
      </div>
    </div>
  `;
}

/**
 * Create HTML for an agent card
 */
function createAgentCard(agent) {
  const statusClass = agent.status === 'active' ? 'status-active' : 'status-idle';
  const latestThought = agent.thinking?.[agent.thinking.length - 1];
  const timeAgo = latestThought ? formatTimeAgo(new Date(latestThought.timestamp)) : '';

  return `
    <div class="agent-card ${statusClass}" data-agent-id="${agent.id}" role="button" tabindex="0">
      <div class="agent-card-header">
        <div class="agent-avatar">
          <span class="agent-icon">${getAgentIcon(agent.type)}</span>
          <span class="agent-status-dot ${statusClass}"></span>
        </div>
        <div class="agent-info">
          <h3 class="agent-name">${escapeHtml(agent.name)}</h3>
          <span class="agent-type-badge">${escapeHtml(agent.type)}</span>
        </div>
      </div>

      <div class="agent-card-body">
        ${agent.current_task ? `
          <div class="agent-task">
            <div class="task-label">Current Task:</div>
            <div class="task-name">${escapeHtml(agent.current_task.name)}</div>
            <div class="task-progress">
              <div class="progress-bar-mini" style="width: ${agent.current_task.progress}%"></div>
              <span class="progress-text">${agent.current_task.progress}%</span>
            </div>
          </div>
        ` : '<div class="agent-task"><div class="task-label">No active task</div></div>'}

        ${latestThought ? `
          <div class="agent-thinking-preview">
            <div class="thinking-icon">💭</div>
            <div class="thinking-text">${escapeHtml(latestThought.thought)}</div>
            <div class="thinking-time">${timeAgo}</div>
          </div>
        ` : ''}

        ${agent.sub_agents && agent.sub_agents.length > 0 ? `
          <div class="agent-sub-agents">
            <span class="sub-agents-label">Managing ${agent.sub_agents.length} sub-agents</span>
          </div>
        ` : ''}
      </div>

      <div class="agent-card-footer">
        <span class="agent-metric">
          <span class="metric-value">${agent.metrics?.tasks_completed || 0}</span> completed
        </span>
        <span class="agent-metric">
          <span class="metric-value">${agent.metrics?.average_task_time || '0m'}</span> avg
        </span>
        <span class="agent-metric success">
          <span class="metric-value">${agent.metrics?.success_rate || 0}%</span> success
        </span>
      </div>
    </div>
  `;
}

/**
 * Find task by ID in phases
 */
function findTaskById(taskId, phases) {
  if (!phases || !taskId) return null;

  for (const phase of Object.values(phases)) {
    if (phase.tasks && Array.isArray(phase.tasks)) {
      const task = phase.tasks.find(t => t.id === taskId);
      if (task) return task;
    }
  }
  return null;
}

/**
 * Show story detail modal
 */
function showStoryDetailModal(task) {
  const modal = document.getElementById('story-detail-modal');
  if (!modal) return;

  const storyId = task.story_id || 'UNKNOWN';
  const epicLabel = task.epic_label || extractEpicFromName(task.name);
  const agent = task.agent || 'Unassigned';
  const agentType = task.agent_type || 'unknown';
  const agentIcon = getAgentIconForType(agentType);

  // Get user story details (mock data - replace with real data from task)
  const storyDetails = getStoryDetails(storyId, task);

  // Update modal content
  document.getElementById('story-epic-label').textContent = epicLabel;
  document.getElementById('story-title').textContent = task.name || 'Unnamed Story';
  document.getElementById('story-id-badge').textContent = storyId;
  document.getElementById('story-description').textContent = storyDetails.description;
  document.getElementById('story-outcome').textContent = storyDetails.outcome;

  // Populate Definition of Done (mark as checked if story is completed)
  const dodList = document.getElementById('story-dod');
  const isCompleted = task.status === 'completed' || task.status === 'done';
  dodList.innerHTML = storyDetails.definitionOfDone.map(item =>
    `<li class="story-detail-dod-item ${isCompleted ? 'completed' : ''}">
      ${escapeHtml(item)}
    </li>`
  ).join('');

  // Update meta information
  const agentBadge = `
    <div class="story-detail-agent-badge agent-${agentType}" style="
      background: ${getAgentColor(agentType, 0.1)};
      color: ${getAgentColor(agentType, 1)};
      border-color: ${getAgentColor(agentType, 0.3)};
    ">
      <span class="agent-icon">${agentIcon}</span>
      <span>${agent}</span>
    </div>
  `;

  document.getElementById('story-agent').innerHTML = agentBadge;
  document.getElementById('story-status').textContent = formatStatus(task.status);
  document.getElementById('story-progress').textContent = `${task.progress_percent || 0}%`;
  document.getElementById('story-duration').textContent = task.started_at ?
    calculateDuration(task.started_at, task.completed_at) : 'Not started';

  // Render subtasks (NEW)
  renderSubtasks(task);

  // Show modal
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

/**
 * Render subtasks in the story detail modal
 */
function renderSubtasks(task) {
  const subtasksSection = document.getElementById('story-subtasks-section');
  const subtasksList = document.getElementById('story-subtasks');
  const progressBadge = document.getElementById('subtask-progress-badge');

  // Check if task has subtasks
  if (!task.subtasks || task.subtasks.length === 0) {
    if (subtasksSection) {
      subtasksSection.style.display = 'none';
    }
    return;
  }

  if (subtasksSection) {
    subtasksSection.style.display = 'block';
  }

  // Calculate progress
  const total = task.subtasks.length;
  const completed = task.subtasks.filter(st => st.status === 'completed').length;
  const inProgress = task.subtasks.filter(st => st.status === 'in_progress').length;
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Update progress badge
  if (progressBadge) {
    progressBadge.textContent = `${completed}/${total} completed (${progressPercent}%)`;
  }

  // Render each subtask
  if (subtasksList) {
    subtasksList.innerHTML = task.subtasks
      .sort((a, b) => a.order - b.order)
      .map(subtask => {
        const statusLabel = subtask.status === 'completed' ? '✓ Completed' :
                           subtask.status === 'in_progress' ? '⏳ In Progress' :
                           '○ Pending';

        return `
          <div class="subtask-item ${subtask.status}"
               data-task-id="${task.id}"
               data-story-id="${task.story_id}"
               data-subtask-order="${subtask.order}"
               role="button"
               tabindex="0">
            <div class="subtask-order">${subtask.order}</div>
            <div class="subtask-content">
              <div class="subtask-description">${escapeHtml(subtask.description)}</div>
              <span class="subtask-status ${subtask.status}">
                ${statusLabel}
              </span>
            </div>
          </div>
        `;
      })
      .join('');
  }
}

/**
 * Update subtask status (cycles through: pending -> in_progress -> completed)
 */
function updateSubtaskStatus(taskId, storyId, subtaskOrder) {
  console.log('Updating subtask:', { taskId, storyId, subtaskOrder });

  if (!state.currentData || !state.currentData.phases) {
    console.error('No current data available');
    return;
  }

  // Find the task
  const task = findTaskById(taskId, state.currentData.phases);
  if (!task) {
    console.error('Task not found:', taskId);
    return;
  }

  // Find the subtask
  const subtask = task.subtasks?.find(st => st.order === parseInt(subtaskOrder));
  if (!subtask) {
    console.error('Subtask not found:', subtaskOrder);
    return;
  }

  // Cycle status: pending -> in_progress -> completed -> pending
  const statusCycle = {
    'pending': 'in_progress',
    'in_progress': 'completed',
    'completed': 'pending'
  };

  const oldStatus = subtask.status;
  subtask.status = statusCycle[subtask.status] || 'pending';
  console.log(`Subtask ${subtaskOrder}: ${oldStatus} -> ${subtask.status}`);

  // Recalculate task progress
  const total = task.subtasks.length;
  const completed = task.subtasks.filter(st => st.status === 'completed').length;
  const inProgress = task.subtasks.filter(st => st.status === 'in_progress').length;
  task.progress_percent = Math.round((completed / total) * 100);

  // Update task status based on subtasks
  if (completed === 0 && inProgress === 0) {
    task.status = 'pending';
  } else if (completed === total) {
    task.status = 'testing'; // Ready for testing when all subtasks complete
  } else {
    task.status = 'in_progress';
  }

  console.log(`Task progress updated: ${task.progress_percent}% (${completed}/${total} complete)`);

  // Save to tasks.json via server
  saveTaskData(state.currentData);

  // Update UI immediately (optimistic update)
  renderSubtasks(task);

  // Also update the progress display in the modal
  const progressElement = document.getElementById('story-progress');
  if (progressElement) {
    progressElement.textContent = `${task.progress_percent}%`;
  }

  // Update the status display in the modal
  const statusElement = document.getElementById('story-status');
  if (statusElement) {
    statusElement.textContent = formatStatus(task.status);
  }
}

/**
 * Save task data to server
 */
function saveTaskData(data) {
  // Send to server via Socket.IO
  if (socket && socket.connected) {
    socket.emit('save-task-data', data);
    console.log('Saved task data to server via Socket.IO');
  } else {
    console.warn('Socket not connected, cannot save task data');
  }
}

/**
 * Get user story details (mock implementation - replace with real data)
 */
function getStoryDetails(storyId, task) {
  // Story templates by ID
  const storyTemplates = {
    'US-308': {
      description: 'As a developer, I need consolidated NOSTR type definitions across the codebase to eliminate duplication and ensure type safety in all NOSTR-related operations.',
      outcome: 'A single source of truth for NOSTR types that can be imported anywhere in the application, reducing bundle size and improving maintainability.',
      definitionOfDone: [
        'All NOSTR types consolidated into packages/shared/src/types/nostr.ts',
        'Duplicate type definitions removed from frontend and backend',
        'All imports updated to use the centralized types',
        'TypeScript compilation passes with no type errors',
        'Bundle size reduced by at least 5KB',
        'All tests pass with 95%+ coverage',
        'CHANGELOG.md updated with breaking changes documentation'
      ]
    },
    'US-302': {
      description: 'As a user, I need a reliable relay pool manager that automatically handles connection failures and switches between relays to ensure uninterrupted NOSTR functionality.',
      outcome: 'A robust relay pool that maintains 3+ active connections and automatically fails over when relays become unavailable.',
      definitionOfDone: [
        'RelayPoolManager class implemented with health monitoring',
        'Automatic failover to backup relays within 2 seconds',
        'Connection pooling with min 3, max 10 concurrent relays',
        'Health check pings every 30 seconds',
        'Graceful degradation when all relays fail',
        'Unit tests with 100% coverage',
        'Integration tests with mock relay servers',
        'Performance benchmarks showing <50ms average latency'
      ]
    },
    'US-323': {
      description: 'As a developer, I need comprehensive architecture diagrams documenting the NOSTR integration to onboard new team members and guide future development.',
      outcome: 'Complete visual documentation of NOSTR architecture using Mermaid diagrams that can be rendered in GitHub and documentation sites.',
      definitionOfDone: [
        'System architecture diagram showing all NOSTR components',
        'Sequence diagrams for key NOSTR workflows (publish, subscribe, DM)',
        'Class diagrams for RelayPoolManager and NostrService',
        'Data flow diagrams showing event propagation',
        'All diagrams created as .mmd files in docs/architecture/diagrams/',
        'Diagrams linked in README.md with visual previews',
        'Architecture Decision Records (ADRs) created for major decisions',
        'Documentation reviewed and approved by tech lead'
      ]
    },
    'US-301': {
      description: 'As a developer, I need updated NOSTR service implementations using the new consolidated types and relay pool manager.',
      outcome: 'All NOSTR services refactored to use centralized types and the new RelayPoolManager, eliminating technical debt.',
      definitionOfDone: [
        'NostrService refactored to use RelayPoolManager',
        'All event publishing updated to use consolidated types',
        'Subscription handling migrated to new architecture',
        'Legacy relay management code removed',
        'All unit tests updated and passing',
        'Integration tests verify end-to-end functionality',
        'Type coverage maintained at 96%+',
        'No runtime errors in development testing'
      ]
    },
    'US-315': {
      description: 'As a user, I need secure NOSTR key management that supports both browser extensions and manual key input.',
      outcome: 'A key management service that securely handles NOSTR private keys with support for Alby, nos2x, and manual entry.',
      definitionOfDone: [
        'KeyManagementService class implemented',
        'Support for NIP-07 browser extensions (Alby, nos2x)',
        'Secure manual key input with validation',
        'Keys never stored in localStorage or sessionStorage',
        'Encrypted key storage in memory only',
        'Key rotation support for advanced users',
        'Security audit passed with no critical vulnerabilities',
        'User guide documentation created'
      ]
    },
    'US-312': {
      description: 'As a developer, I need an event cache to reduce redundant NOSTR relay queries and improve application performance.',
      outcome: 'An LRU cache system that stores recent NOSTR events and reduces relay queries by 70%.',
      definitionOfDone: [
        'EventCache class with LRU eviction strategy',
        'Configurable cache size (default 1000 events)',
        'TTL-based expiration (default 5 minutes)',
        'Cache hit rate of 70%+ in production scenarios',
        'Memory usage under 10MB for typical workloads',
        'Cache invalidation on new events',
        'Performance benchmarks showing 3x faster repeated queries',
        'Unit tests with 95%+ coverage'
      ]
    },
    'US-314': {
      description: 'As a user, I need an intuitive filter builder UI to create custom NOSTR event filters without writing code.',
      outcome: 'A drag-and-drop filter builder that generates valid NOSTR filter objects for event subscriptions.',
      definitionOfDone: [
        'FilterBuilder React component with visual editor',
        'Support for all NOSTR filter properties (kinds, authors, tags, since, until)',
        'Real-time filter validation and preview',
        'Export to JSON for API integration',
        'Import existing filters for editing',
        'Responsive design for mobile and desktop',
        'Accessibility audit passed (WCAG 2.1 AA)',
        'Storybook stories for all component states'
      ]
    },
    'US-303': {
      description: 'As a developer, I need a centralized event publishing service to publish NOSTR events to multiple relays with automatic retry and error handling.',
      outcome: 'A robust event publishing system that ensures all NOSTR events are successfully published to configured relays with 99.9% reliability.',
      definitionOfDone: [
        'EventPublisher class implemented with retry logic',
        'Support for publishing to multiple relays in parallel',
        'Automatic retry on failure (3 attempts with exponential backoff)',
        'Circuit breaker pattern for failing relays',
        'Error logging and monitoring integration',
        'Event queue for offline support',
        'Unit tests with 95%+ coverage',
        'Integration tests with mock relay servers'
      ]
    },
    'US-304': {
      description: 'As a developer, I need consolidated NIP-05 verification services to validate NOSTR identities across the platform.',
      outcome: 'A unified NIP-05 verification service that handles all identity verification with caching and automatic re-verification.',
      definitionOfDone: [
        'Single NIP05Verifier service in shared package',
        'HTTP and DNS verification methods',
        'Result caching with configurable TTL (24 hours default)',
        'Automatic re-verification scheduling',
        'Domain allowlist/blocklist support',
        'Verification status webhooks',
        'Rate limiting to prevent abuse',
        '95%+ test coverage'
      ]
    },
    'US-305': {
      description: 'As a developer, I need unified NOSTR authentication services to handle user login and session management consistently.',
      outcome: 'A single authentication service for both frontend and backend with challenge-response flow and JWT integration.',
      definitionOfDone: [
        'Consolidated AuthService merging nostr-auth.ts and enhanced-nostr-auth.ts',
        'Challenge-response authentication flow (NIP-42)',
        'JWT token generation with NOSTR pubkey claims',
        'Session management with Redis integration',
        'Rate limiting per pubkey',
        'Security event logging',
        'Support for browser extension signing',
        '95%+ test coverage'
      ]
    },
    'US-306': {
      description: 'As a user, I need standardized browser extension integration to sign NOSTR events with my preferred wallet.',
      outcome: 'A unified interface supporting all major NOSTR browser extensions with automatic detection and graceful fallbacks.',
      definitionOfDone: [
        'Support for Alby, nos2x, Flamingo, Nostr Connect',
        'Extension detection and capability checking',
        'Fallback to manual key input if no extension',
        'Permission request handling with user consent',
        'React hook: useNostrExtension() for easy integration',
        'Error recovery and retry logic',
        'Comprehensive browser compatibility testing',
        '90%+ test coverage'
      ]
    },
    'US-307': {
      description: 'As a developer, I need event deduplication to prevent duplicate NOSTR events from being processed and stored.',
      outcome: 'An efficient deduplication system using event IDs and content hashing to eliminate duplicate events.',
      definitionOfDone: [
        'EventDeduplicator class with LRU cache',
        'Deduplication based on event ID (hash of content)',
        'Content-based deduplication for events without IDs',
        'Configurable cache size (default 10,000 events)',
        'TTL-based expiration (default 1 hour)',
        'Performance benchmarks showing <1ms lookup time',
        'Memory usage monitoring and alerts',
        '95%+ test coverage'
      ]
    },
    'US-309': {
      description: 'As a developer, I need to remove all hardcoded relay URLs and replace them with centralized configuration.',
      outcome: 'Zero hardcoded relay URLs in the codebase, with all relays managed through environment variables and config files.',
      definitionOfDone: [
        'All hardcoded relay URLs removed from codebase',
        'Centralized relay configuration in shared/config/relays.ts',
        'Environment variable support for relay URLs',
        'Default relay list for development',
        'Production relay list from environment',
        'Migration script to update existing code',
        'Documentation of relay configuration',
        'Code search verification showing no hardcoded relays'
      ]
    },
    'US-310': {
      description: 'As a developer, I need NIP-19 encoding utilities to convert between hex keys and bech32 encoded NOSTR identifiers.',
      outcome: 'A comprehensive NIP-19 utility library supporting all entity types (npub, nsec, note, nevent, nprofile, naddr).',
      definitionOfDone: [
        'Encoding functions for all NIP-19 entity types',
        'Decoding functions with validation',
        'Type-safe TypeScript interfaces',
        'Error handling for invalid inputs',
        'Support for extended formats (nevent, nprofile, naddr)',
        'Browser and Node.js compatibility',
        'Performance benchmarks',
        '100% test coverage'
      ]
    },
    'US-311': {
      description: 'As a developer, I need unified NOSTR session management to handle multi-device sessions and session lifecycle.',
      outcome: 'Centralized session management supporting multiple active sessions per user with automatic cleanup.',
      definitionOfDone: [
        'SessionManager class with Redis backend',
        'Multi-device session support',
        'Session creation and validation',
        'Session revocation (logout)',
        'Activity tracking and last-seen timestamps',
        'Automatic session cleanup for expired sessions',
        'Session hijacking prevention',
        '95%+ test coverage'
      ]
    },
    'US-313': {
      description: 'As a user, I need encrypted direct messages using NIP-04 to communicate privately with other NOSTR users.',
      outcome: 'Full NIP-04 implementation supporting encrypted DMs with conversation threading and read receipts.',
      definitionOfDone: [
        'NIP-04 encryption/decryption utilities',
        'DM conversation management',
        'Message threading and sorting',
        'Read receipt tracking',
        'Typing indicators',
        'Message deletion',
        'E2E encryption verification',
        '95%+ test coverage with security audit'
      ]
    },
    'US-316': {
      description: 'As an operator, I need comprehensive NOSTR monitoring to track relay health, event throughput, and error rates.',
      outcome: 'Real-time monitoring dashboard showing relay status, event metrics, and alerting for issues.',
      definitionOfDone: [
        'Prometheus metrics for NOSTR operations',
        'Grafana dashboards for relay health',
        'Event throughput monitoring',
        'Error rate tracking per relay',
        'Alert rules for relay failures',
        'SLO monitoring (99.9% uptime target)',
        'Performance metrics (latency, throughput)',
        'Integration with existing monitoring stack'
      ]
    },
    'US-317': {
      description: 'As a developer, I need an intelligent NOSTR caching layer to reduce redundant relay queries and improve performance.',
      outcome: 'Multi-level cache system with IndexedDB persistence and smart invalidation strategies.',
      definitionOfDone: [
        'IndexedDB storage for events and profiles',
        'LRU cache with configurable size limits',
        'Cache invalidation on new events',
        'Offline mode support',
        'Cache warming on application startup',
        'Cache hit rate monitoring',
        'Performance benchmarks showing 3x faster queries',
        '90%+ test coverage'
      ]
    },
    'US-318': {
      description: 'As a developer, I need comprehensive integration tests to verify NOSTR components work together correctly.',
      outcome: 'Full integration test suite covering all NOSTR workflows with >95% coverage.',
      definitionOfDone: [
        'Integration tests for all NOSTR workflows',
        'Mock relay server for testing',
        'Test fixtures for common scenarios',
        'CI/CD integration',
        'Coverage reporting >95%',
        'Performance regression tests',
        'Load testing scenarios',
        'Documentation of test patterns'
      ]
    },
    'US-319': {
      description: 'As a user, I need clear error messages and recovery options when NOSTR operations fail.',
      outcome: 'User-friendly error handling UI with actionable recovery suggestions.',
      definitionOfDone: [
        'ErrorBoundary components for NOSTR features',
        'User-friendly error messages (no technical jargon)',
        'Retry mechanisms with exponential backoff',
        'Fallback UI for degraded functionality',
        'Error tracking with Sentry integration',
        'Recovery action suggestions',
        'Accessibility compliance (WCAG 2.1 AA)',
        'User testing validation'
      ]
    },
    'US-320': {
      description: 'As a developer, I need a robust WebSocket connection manager to handle relay connections with automatic reconnection.',
      outcome: 'Connection manager maintaining stable relay connections with health monitoring and automatic recovery.',
      definitionOfDone: [
        'WebSocketManager class with connection pooling',
        'Automatic reconnection with exponential backoff',
        'Connection health monitoring (ping/pong)',
        'Graceful degradation on connection loss',
        'Connection state synchronization',
        'Event buffering during reconnection',
        'Performance metrics and monitoring',
        '95%+ test coverage'
      ]
    },
    'US-321': {
      description: 'As an operator, I need rate limiting on NOSTR operations to prevent abuse and ensure fair resource usage.',
      outcome: 'Flexible rate limiting system with per-user, per-relay, and global limits.',
      definitionOfDone: [
        'Rate limiter with token bucket algorithm',
        'Per-pubkey rate limits',
        'Event type-specific limits',
        'Relay-specific throttling',
        'Rate limit headers in API responses',
        'Configurable limits per user tier',
        'Redis-backed distributed rate limiting',
        '90%+ test coverage'
      ]
    },
    'US-322': {
      description: 'As an operator, I need backup and recovery systems for NOSTR data to prevent data loss.',
      outcome: 'Automated backup system with point-in-time recovery capabilities.',
      definitionOfDone: [
        'Automated daily backups to S3',
        'Point-in-time recovery support',
        'Backup verification and testing',
        'Disaster recovery runbook',
        'RTO <1 hour, RPO <15 minutes',
        'Backup monitoring and alerting',
        'Encrypted backups at rest',
        'Recovery testing quarterly'
      ]
    },
    'US-324': {
      description: 'As a developer, I need comprehensive developer documentation for all NOSTR components and APIs.',
      outcome: 'Complete API documentation with examples, guides, and best practices.',
      definitionOfDone: [
        'API documentation for all NOSTR services',
        'Code examples for common use cases',
        'Architecture diagrams (updated)',
        'Integration guides',
        'Troubleshooting documentation',
        'Best practices guide',
        'TypeDoc generated API reference',
        'Developer onboarding guide'
      ]
    },
    'US-325': {
      description: 'As a developer, I need migration scripts to safely migrate data to the new consolidated NOSTR architecture.',
      outcome: 'Zero-downtime migration scripts with rollback capabilities.',
      definitionOfDone: [
        'Migration scripts for all data transformations',
        'Rollback scripts for each migration',
        'Data validation before and after migration',
        'Migration progress monitoring',
        'Dry-run mode for testing',
        'Migration documentation',
        'Zero data loss verification',
        'Performance impact < 5%'
      ]
    },
    'US-326': {
      description: 'As a QA engineer, I need end-to-end tests covering all critical NOSTR user journeys.',
      outcome: 'Comprehensive E2E test suite with automated cross-browser testing.',
      definitionOfDone: [
        'E2E tests for all critical user paths',
        'Playwright test suite with visual regression',
        'Cross-browser testing (Chrome, Firefox, Safari)',
        'Mobile responsive testing',
        'CI/CD integration',
        'Test reporting and analytics',
        'Performance testing scenarios',
        '90%+ coverage of user journeys'
      ]
    }
  };

  // Return story details or generic template
  return storyTemplates[storyId] || {
    description: task.description || 'No detailed user story available yet. This story is being refined by the product team.',
    outcome: task.desired_outcome || 'The desired outcome will be documented once requirements are finalized.',
    definitionOfDone: task.definition_of_done || [
      'Feature implementation completed',
      'Unit tests written with 95%+ coverage',
      'Integration tests pass',
      'Code review approved',
      'Documentation updated',
      'CHANGELOG.md entry added',
      'No high-priority bugs remaining'
    ]
  };
}

/**
 * Get agent color with opacity
 */
function getAgentColor(agentType, opacity = 1) {
  const colors = {
    backend: `rgba(16, 185, 129, ${opacity})`,
    frontend: `rgba(59, 130, 246, ${opacity})`,
    testing: `rgba(245, 158, 11, ${opacity})`,
    documentation: `rgba(139, 92, 246, ${opacity})`,
    monitoring: `rgba(6, 182, 212, ${opacity})`,
    orchestrator: `rgba(236, 72, 153, ${opacity})`,
  };
  return colors[agentType] || `rgba(128, 128, 128, ${opacity})`;
}

/**
 * Get icon for agent type
 */
function getAgentIcon(type) {
  const icons = {
    orchestrator: '🎯',
    backend: '🔧',
    frontend: '🎨',
    testing: '🧪',
    documentation: '📝',
    security: '🔒',
    performance: '⚡',
    monitoring: '📊',
    worker: '⚙️'
  };
  return icons[type] || '🤖';
}

// Alias for task card compatibility
function getAgentIconForType(type) {
  return getAgentIcon(type);
}

/**
 * Export detailed epic completion report
 */
function exportEpicReport() {
  if (!state.currentData || !state.currentData.phases) {
    alert('No data available to export. Please wait for data to load.');
    return;
  }

  const tasks = state.currentData.phases['active-development']?.tasks || [];
  const stories = tasks.filter(t => t.type === 'story');

  // Group completed stories by epic
  const completedStories = stories.filter(s => s.status === 'completed' || s.status === 'done');

  if (completedStories.length === 0) {
    alert('No completed stories to export.');
    return;
  }

  // Group by epic
  const epicGroups = {};
  completedStories.forEach(story => {
    const epicLabel = story.epic_label || extractEpicFromName(story.name) || 'Unknown Epic';
    if (!epicGroups[epicLabel]) {
      epicGroups[epicLabel] = [];
    }
    epicGroups[epicLabel].push(story);
  });

  // Generate report
  const report = generateDetailedEpicReport(epicGroups);

  // Export as Markdown
  const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `epic-completion-report-${new Date().toISOString().split('T')[0]}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  // Show success feedback
  const exportBtn = document.getElementById('export-epic-report-btn');
  if (exportBtn) {
    const originalHTML = exportBtn.innerHTML;
    exportBtn.innerHTML = '<span class="export-icon">✅</span><span class="export-label">Exported!</span>';
    exportBtn.disabled = true;

    setTimeout(() => {
      exportBtn.innerHTML = originalHTML;
      exportBtn.disabled = false;
    }, 2000);
  }
}

/**
 * Generate detailed Markdown report for completed stories by epic
 */
function generateDetailedEpicReport(epicGroups) {
  const timestamp = new Date().toISOString();
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let markdown = `# Epic Completion Report\n\n`;
  markdown += `**Generated**: ${date}\n`;
  markdown += `**Report Type**: Detailed Story Completion Analysis\n\n`;
  markdown += `---\n\n`;

  // Summary Statistics
  const totalEpics = Object.keys(epicGroups).length;
  const totalStories = Object.values(epicGroups).reduce((sum, stories) => sum + stories.length, 0);

  markdown += `## Executive Summary\n\n`;
  markdown += `- **Total Epics Completed**: ${totalEpics}\n`;
  markdown += `- **Total Stories Completed**: ${totalStories}\n`;
  markdown += `\n---\n\n`;

  // Iterate through each epic
  Object.keys(epicGroups).sort().forEach(epicLabel => {
    const stories = epicGroups[epicLabel];

    markdown += `## ${epicLabel}\n\n`;
    markdown += `**Stories Completed**: ${stories.length}\n\n`;

    // Agent breakdown
    const agentCounts = {};
    stories.forEach(story => {
      const agent = story.agent || 'Unassigned';
      agentCounts[agent] = (agentCounts[agent] || 0) + 1;
    });

    markdown += `### Agent Breakdown\n\n`;
    Object.entries(agentCounts).forEach(([agent, count]) => {
      const agentType = stories.find(s => s.agent === agent)?.agent_type || 'unknown';
      const icon = getAgentIcon(agentType);
      markdown += `- ${icon} **${agent}**: ${count} ${count === 1 ? 'story' : 'stories'}\n`;
    });
    markdown += `\n`;

    // Detailed story information
    markdown += `### Completed Stories\n\n`;

    stories.forEach((story, index) => {
      const storyId = story.story_id || 'UNKNOWN';
      const name = story.name || 'Unnamed Story';
      const agent = story.agent || 'Unassigned';
      const agentType = story.agent_type || 'unknown';
      const agentIcon = getAgentIcon(agentType);

      // Calculate duration
      const duration = story.started_at && story.completed_at
        ? calculateDuration(story.started_at, story.completed_at)
        : 'Unknown';

      const completedDate = story.completed_at
        ? new Date(story.completed_at).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        : 'Unknown';

      markdown += `#### ${index + 1}. ${storyId}: ${name}\n\n`;
      markdown += `**Completed By**: ${agentIcon} ${agent} (${agentType})\n`;
      markdown += `**Completed On**: ${completedDate}\n`;
      markdown += `**Duration**: ${duration}\n`;
      markdown += `**Progress**: ${story.progress_percent || 100}%\n\n`;

      // Get story details
      const details = getStoryDetails(storyId, story);

      markdown += `**User Story**:\n`;
      markdown += `> ${details.description}\n\n`;

      markdown += `**Desired Outcome**:\n`;
      markdown += `> ${details.outcome}\n\n`;

      markdown += `**Definition of Done**:\n`;
      details.definitionOfDone.forEach((item, idx) => {
        markdown += `${idx + 1}. ✅ ${item}\n`;
      });
      markdown += `\n`;

      // Files modified
      if (story.files_modified && story.files_modified.length > 0) {
        markdown += `**Files Modified** (${story.files_modified.length}):\n`;
        story.files_modified.forEach(file => {
          markdown += `- \`${file}\`\n`;
        });
        markdown += `\n`;
      }

      // Test coverage
      if (story.test_coverage) {
        markdown += `**Test Coverage**: ${story.test_coverage}%\n\n`;
      }

      markdown += `---\n\n`;
    });
  });

  // Footer
  markdown += `## Report Metadata\n\n`;
  markdown += `- **Generated At**: ${timestamp}\n`;
  markdown += `- **Dashboard**: Sovren Agent Orchestration Dashboard\n`;
  markdown += `- **Source**: Real-time task tracking system\n\n`;
  markdown += `---\n\n`;
  markdown += `*This report was automatically generated from the dashboard's task tracking data.*\n`;

  return markdown;
}

/**
 * Find user story that an agent is currently working on
 */
function findUserStoryForAgent(agent) {
  if (!state.currentData || !state.currentData.phases) return null;

  const tasks = state.currentData.phases['active-development']?.tasks || [];

  // Find story where the agent matches and status is in_progress
  const story = tasks.find(task =>
    task.type === 'story' &&
    task.agent === agent.name &&
    (task.status === 'in_progress' || task.status === 'active')
  );

  return story;
}

/**
 * Display user story details in agent modal
 */
function displayUserStoryInModal(story) {
  const modal = elements.agentModal;
  if (!modal) return;

  // Find or create user story section
  let storySection = modal.querySelector('.agent-user-story-section');

  if (!storySection) {
    // Create the section if it doesn't exist
    const currentTaskCard = modal.querySelector('.agent-current-task');
    if (currentTaskCard) {
      storySection = document.createElement('div');
      storySection.className = 'agent-user-story-section';
      currentTaskCard.insertAdjacentElement('afterend', storySection);
    }
  }

  if (!storySection) return;

  const storyId = story.story_id || 'UNKNOWN';
  const storyDetails = getStoryDetails(storyId, story);
  const epicLabel = story.epic_label || extractEpicFromName(story.name) || 'Unknown Epic';

  storySection.innerHTML = `
    <div class="agent-story-header">
      <div class="agent-story-epic">${escapeHtml(epicLabel)}</div>
      <h3 class="agent-story-title">
        <span class="agent-story-id">${escapeHtml(storyId)}</span>
        ${escapeHtml(story.name || 'Unnamed Story')}
      </h3>
    </div>

    <div class="agent-story-content">
      <div class="agent-story-section">
        <div class="agent-story-label">User Story:</div>
        <div class="agent-story-text">${escapeHtml(storyDetails.description)}</div>
      </div>

      <div class="agent-story-section">
        <div class="agent-story-label">Desired Outcome:</div>
        <div class="agent-story-text">${escapeHtml(storyDetails.outcome)}</div>
      </div>

      <div class="agent-story-section">
        <div class="agent-story-label">Definition of Done:</div>
        <ul class="agent-story-dod">
          ${storyDetails.definitionOfDone.slice(0, 5).map(item =>
            `<li class="agent-story-dod-item">${escapeHtml(item)}</li>`
          ).join('')}
          ${storyDetails.definitionOfDone.length > 5 ?
            `<li class="agent-story-dod-more">+ ${storyDetails.definitionOfDone.length - 5} more items</li>`
            : ''}
        </ul>
      </div>
    </div>
  `;

  storySection.style.display = 'block';
}

/**
 * Hide user story section in agent modal
 */
function hideUserStoryInModal() {
  const modal = elements.agentModal;
  if (!modal) return;

  const storySection = modal.querySelector('.agent-user-story-section');
  if (storySection) {
    storySection.style.display = 'none';
  }
}

/**
 * Show agent thinking modal
 */
function showAgentThinkingModal(agentId) {
  state.selectedAgentId = agentId;
  const agent = state.agentsData.agents?.find(a => a.id === agentId);

  if (!agent || !elements.agentModal) return;

  // Update modal header
  elements.agentModalTitle.textContent = agent.name;
  const typeBadge = elements.agentModal.querySelector('.agent-type-badge');
  if (typeBadge) {
    typeBadge.textContent = `${agent.type} Agent`;
  }

  // Update agent icon
  const agentIcon = elements.agentModal.querySelector('.agent-icon');
  if (agentIcon) {
    agentIcon.textContent = getAgentIcon(agent.type);
  }

  // Update status dot
  const statusDot = elements.agentModal.querySelector('.agent-status-dot');
  if (statusDot) {
    statusDot.className = `agent-status-dot ${agent.status === 'active' ? 'status-active' : 'status-idle'}`;
  }

  // Update stats
  elements.agentTasksCompleted.textContent = agent.metrics?.tasks_completed || 0;
  elements.agentSuccessRate.textContent = `${agent.metrics?.success_rate || 0}%`;
  elements.agentAvgTime.textContent = agent.metrics?.average_task_time || '0m';

  const activeSince = agent.started_at ? formatTimeAgo(new Date(agent.started_at)) : 'Unknown';
  elements.agentActiveSince.textContent = activeSince;

  // Update current task and find related user story
  if (agent.current_task) {
    elements.agentCurrentTaskCard.style.display = 'block';
    elements.agentTaskName.textContent = agent.current_task.name;
    elements.agentTaskProgress.style.width = `${agent.current_task.progress}%`;
    elements.agentTaskProgressText.textContent = `${agent.current_task.progress}% complete`;

    // Try to find the user story this agent is working on
    const userStory = findUserStoryForAgent(agent);
    if (userStory) {
      displayUserStoryInModal(userStory);
    } else {
      hideUserStoryInModal();
    }
  } else {
    elements.agentTaskName.textContent = 'No active task';
    elements.agentTaskProgress.style.width = '0%';
    elements.agentTaskProgressText.textContent = '0% complete';
    hideUserStoryInModal();
  }

  // Render thinking timeline
  renderThinkingTimeline(agent.thinking || []);

  // Handle sub-agents
  if (agent.sub_agents && agent.sub_agents.length > 0) {
    elements.agentSubAgentsSection.style.display = 'block';
    elements.subAgentsCount.textContent = agent.sub_agents.length;
    renderSubAgents(agent.sub_agents);
  } else {
    elements.agentSubAgentsSection.style.display = 'none';
  }

  // Show modal
  elements.agentModal.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Auto-scroll to bottom
  if (elements.agentAutoScroll.checked) {
    scrollThinkingToBottom();
  }
}

/**
 * Render thinking timeline
 */
function renderThinkingTimeline(thoughts) {
  const timeline = elements.agentThinkingTimeline;
  if (!timeline) return;

  const typeIcons = {
    analysis: '🔍',
    discovery: '💡',
    action: '⚡',
    implementation: '⚙️',
    testing: '🧪',
    thinking: '🤔',
    idle: '😴'
  };

  timeline.innerHTML = thoughts.map((thought, index) => {
    const isLatest = index === thoughts.length - 1;
    const time = new Date(thought.timestamp);

    return `
      <div class="thought-entry type-${thought.type} ${isLatest ? 'active' : ''}">
        <div class="thought-time">${formatTime(time)}</div>
        <div class="thought-icon">${typeIcons[thought.type] || '💭'}</div>
        <div class="thought-content">
          <div class="thought-type">${thought.type}</div>
          <div class="thought-text">${escapeHtml(thought.thought)}</div>
        </div>
      </div>
    `;
  }).join('');

  if (elements.agentAutoScroll.checked) {
    scrollThinkingToBottom();
  }
}

/**
 * Render sub-agents list
 */
function renderSubAgents(subAgentIds) {
  const list = elements.subAgentsList;
  if (!list) return;

  const subAgents = subAgentIds.map(id =>
    state.agentsData.agents?.find(a => a.id === id)
  ).filter(Boolean);

  list.innerHTML = subAgents.map(agent => `
    <div class="sub-agent-item">
      <span class="agent-icon">${getAgentIcon(agent.type)}</span>
      <span class="agent-name">${escapeHtml(agent.name)}</span>
      <span class="agent-status ${agent.status}">${agent.status}</span>
    </div>
  `).join('');
}

/**
 * Update agent thinking modal with new data
 */
function updateAgentThinkingModal(agentId) {
  if (!elements.agentModal.classList.contains('active')) return;

  const agent = state.agentsData.agents?.find(a => a.id === agentId);
  if (!agent) return;

  // Update only the dynamic content
  renderThinkingTimeline(agent.thinking || []);

  // Update current task progress
  if (agent.current_task) {
    elements.agentTaskProgress.style.width = `${agent.current_task.progress}%`;
    elements.agentTaskProgressText.textContent = `${agent.current_task.progress}% complete`;
  }
}

/**
 * Auto-scroll thinking timeline to bottom
 */
function scrollThinkingToBottom() {
  const timeline = elements.agentThinkingTimeline;
  if (timeline) {
    timeline.scrollTop = timeline.scrollHeight;
  }
}

/**
 * Format time for display
 */
function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Format time ago
 */
function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Initialize dashboard
 */
function initializeDashboard() {
  console.log('Initializing Sovren Agent Orchestration Dashboard');

  // Set up event listeners
  initializeEventListeners();

  // Start uptime counter
  startUptimeCounter();

  // Listen for visibility changes
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Set initial connection status
  updateConnectionStatus(false);

  console.log('Dashboard initialized successfully');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeDashboard);
} else {
  // DOM already loaded
  initializeDashboard();
}

// ============================================
// CONSOLE BANNER
// ============================================

console.log(`
╔═══════════════════════════════════════════════════════╗
║   Sovren Agent Orchestration Dashboard v1.0.0        ║
║   Elite Engineering Monitoring System                 ║
║                                                       ║
║   Socket.IO: ${socket.connected ? 'Connected ✓' : 'Connecting...'}                           ║
╚═══════════════════════════════════════════════════════╝
`);
