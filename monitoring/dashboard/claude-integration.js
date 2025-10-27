/**
 * Claude Agent Integration
 *
 * Tracks actual Claude agent activity in real-time
 */

const AgentActivityTracker = require('./agent-activity-tracker');

class ClaudeIntegration {
  constructor() {
    this.tracker = new AgentActivityTracker();
    this.currentTasks = new Map();
    this.sessionStarted = false;
  }

  async initialize() {
    if (!this.sessionStarted) {
      await this.tracker.initialize();
      this.tracker.startMetricsUpdater();

      // Log the current session start
      await this.tracker.logActivity('INFO', 'CLAUDE-AGENT', 'New conversation session started');
      await this.tracker.logActivity('INFO', 'SYSTEM', 'Monitoring dashboard integration active');

      this.sessionStarted = true;
      console.log('🤖 Claude integration initialized - tracking real agent activity');
    }
  }

  async startTask(taskName) {
    await this.initialize();
    const taskId = await this.tracker.addTask(taskName);
    this.currentTasks.set(taskName, taskId);
    return taskId;
  }

  async updateProgress(taskName, progress, step) {
    const taskId = this.currentTasks.get(taskName);
    if (taskId) {
      await this.tracker.updateTaskProgress(taskId, progress, step);
    }
  }

  async completeTask(taskName, prUrl = null) {
    const taskId = this.currentTasks.get(taskName);
    if (taskId) {
      await this.tracker.completeTask(taskId, prUrl);
      this.currentTasks.delete(taskName);
    }
  }

  async logTool(toolName, purpose) {
    await this.initialize();
    await this.tracker.logToolUsage(toolName, purpose);
  }

  async logSuccess(message) {
    await this.initialize();
    await this.tracker.logSuccess(message);
  }

  async logError(error) {
    await this.initialize();
    await this.tracker.logError(error);
  }

  async logInfo(message) {
    await this.initialize();
    await this.tracker.logActivity('INFO', 'CLAUDE-AGENT', message);
  }
}

// Create global instance
const claude = new ClaudeIntegration();

module.exports = claude;
