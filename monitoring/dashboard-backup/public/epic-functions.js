/**
 * Epic drill-down functions for hierarchical task display
 */

/**
 * Create detailed epic card with story drill-down
 */
function createEpicDetailCard(epic) {
  const name = escapeHtml(epic.description || epic.name);
  const agent = escapeHtml(epic.agent || 'Unknown Agent');
  const status = epic.status || 'unknown';
  const progress = epic.progress_percent || 0;
  const statusIcon = getTaskStatusIcon(status);

  const badgeClass = status === 'completed' ? 'badge-success' : 'badge-in_progress';
  const startedAt = epic.started_at ? formatFullTimestamp(epic.started_at) : 'Not started';
  const completedAt = epic.completed_at ? formatFullTimestamp(epic.completed_at) : null;
  const duration = calculateDuration(epic.started_at, epic.completed_at);

  const statusText = status.replace('_', ' ');

  return `
    <div class="modal-task-card epic-detail-card" data-task-type="epic" data-epic-id="${epic.id}">
      <div class="epic-card-header">
        <div class="epic-title-row">
          <h3 class="task-title">${statusIcon} ${name}</h3>
          <button class="epic-expand-btn" aria-label="Toggle stories">
            <span class="expand-icon">▼</span>
          </button>
        </div>
        <div class="epic-meta-row">
          <span class="epic-badge">Epic ${epic.epic_number} Stream ${epic.stream}</span>
          <span class="task-agent-badge">Agent: ${agent}</span>
          <span class="badge ${badgeClass}">${statusText}</span>
        </div>
      </div>

      <div class="epic-summary">
        <div class="epic-stats">
          <div class="stat-item">
            <span class="stat-label">Stories</span>
            <span class="stat-value">${epic.story_count}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Progress</span>
            <span class="stat-value">${progress}%</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Started</span>
            <span class="stat-value">${startedAt}</span>
          </div>
          ${completedAt ? `
          <div class="stat-item">
            <span class="stat-label">Completed</span>
            <span class="stat-value">${completedAt}</span>
          </div>
          ` : ''}
          ${duration ? `
          <div class="stat-item">
            <span class="stat-label">Duration</span>
            <span class="stat-value">${duration}</span>
          </div>
          ` : ''}
        </div>
      </div>

      <div class="epic-stories-container" style="display: block;">
        <div class="epic-stories-header">
          <h4>📋 Stories in Epic ${epic.epic_number} Stream ${epic.stream}</h4>
          <p class="stories-subtitle">${epic.story_count} total stories</p>
        </div>
        <div class="epic-stories-list">
          ${epic.stories && epic.stories.length > 0 ?
            epic.stories.map(story => createStoryDetailCard(story)).join('') :
            `<div class="story-placeholder">
              <div class="placeholder-content">
                <span class="placeholder-icon">📝</span>
                <h4>Stories Not Yet Tracked Individually</h4>
                <p>The other Claude Code instance is tracking this Epic as a whole (${epic.story_count} stories total).</p>
                <p>To see individual story details, the other instance should use TodoWrite with items like:</p>
                <div class="code-example">
                  <code>TS-001: Fix event handler types in Login.tsx</code><br>
                  <code>TS-002: Create API response type definitions</code><br>
                  <code>TS-003: Add validation middleware types</code>
                </div>
                <p class="hint">The telemetry will automatically capture and display them here! ✨</p>
              </div>
            </div>`
          }
        </div>
      </div>
    </div>
  `;
}

/**
 * Create story detail card
 */
function createStoryDetailCard(story) {
  const statusIcon = getTaskStatusIcon(story.status);
  const statusClass = story.status || 'unknown';
  const badgeClass = statusClass === 'completed' ? 'badge-success' : 'badge-in_progress';
  const timeAgo = story.completed_at ? formatTimeAgo(new Date(story.completed_at)) : formatTimeAgo(new Date());

  return `
    <div class="story-detail-card status-${statusClass}">
      <div class="story-header">
        <span class="story-status-icon">${statusIcon}</span>
        <div class="story-title-group">
          <span class="story-id-badge">${escapeHtml(story.story_id)}</span>
          <h5 class="story-title">${escapeHtml(story.description)}</h5>
        </div>
        <span class="badge ${badgeClass}">${statusClass}</span>
      </div>
      <div class="story-meta">
        <span class="meta-item">👤 ${escapeHtml(story.agent)}</span>
        <span class="meta-item">⏱️ ${timeAgo}</span>
        ${story.files_modified && story.files_modified.length > 0 ?
          `<span class="meta-item">📁 ${story.files_modified.length} files modified</span>` : ''}
        ${story.test_coverage ?
          `<span class="meta-item">✅ ${story.test_coverage}% test coverage</span>` : ''}
      </div>
    </div>
  `;
}

/**
 * Toggle epic stories visibility
 */
function toggleEpicStories(epicCard) {
  const storiesContainer = epicCard.querySelector('.epic-stories-container');
  const expandIcon = epicCard.querySelector('.expand-icon');

  if (storiesContainer.style.display === 'none') {
    storiesContainer.style.display = 'block';
    expandIcon.textContent = '▼';
  } else {
    storiesContainer.style.display = 'none';
    expandIcon.textContent = '▶';
  }
}

/**
 * Get task status icon
 */
function getTaskStatusIcon(status) {
  switch (status) {
    case 'completed': return '✅';
    case 'in_progress': return '🔄';
    case 'blocked': return '🚧';
    case 'pending': return '⏳';
    default: return '📋';
  }
}
