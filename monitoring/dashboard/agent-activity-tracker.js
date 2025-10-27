/**
 * Real Agent Activity Tracker
 *
 * Monitors actual Claude agent activity and updates the dashboard
 * with real-time information about tool usage, tasks, and progress.
 */

const fs = require('fs').promises;
const path = require('path');

class AgentActivityTracker {
  constructor(dataDir = './data') {
    this.dataDir = dataDir;
    this.currentSession = {
      project_id: 'sovren-monitoring-dashboard',
      started_at: new Date().toISOString(),
      current_phase: 'development',
      phases: {
        development: {
          status: 'in_progress',
          started_at: new Date().toISOString(),
          tasks: [],
        },
      },
      summary: {
        total_tasks: 0,
        completed: 0,
        in_progress: 0,
        blocked: 0,
        queued: 0,
        completion_percent: 0,
      },
    };

    this.metrics = {
      uptime_seconds: 0,
      agents_active: 1,
      tasks_completed_per_hour: 0,
      average_task_duration_minutes: 0,
      last_updated: new Date().toISOString(),
    };

    this.startTime = Date.now();
    this.taskCounter = 0;
    this.completedTasks = 0;
  }

  async initialize() {
    // Ensure data directory exists
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Initialize with current session
    await this.updateTasksFile();
    await this.updateMetrics();
    await this.logActivity('INFO', 'CLAUDE-AGENT', 'Agent activity tracker initialized');

    console.log('🤖 Real agent activity tracker initialized');
    console.log('📊 Dashboard will now show actual Claude agent work');
  }

  async logActivity(level, agent, message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] [${agent}] ${message}\n`;

    const logFile = path.join(this.dataDir, 'orchestration.log');
    await fs.appendFile(logFile, logEntry);
  }

  async addTask(name, agent = 'CLAUDE-AGENT') {
    this.taskCounter++;
    const task = {
      id: `TASK-${String(this.taskCounter).padStart(3, '0')}`,
      name: name,
      agent: agent,
      status: 'in_progress',
      started_at: new Date().toISOString(),
      current_step: 'Analyzing requirements',
      progress_percent: 0,
    };

    this.currentSession.phases.development.tasks.push(task);
    this.currentSession.summary.total_tasks++;
    this.currentSession.summary.in_progress++;

    await this.updateTasksFile();
    await this.logActivity('INFO', agent, `Started task: ${name}`);

    return task.id;
  }

  async updateTaskProgress(taskId, progress, currentStep) {
    const task = this.findTask(taskId);
    if (task) {
      task.progress_percent = progress;
      task.current_step = currentStep;

      await this.updateTasksFile();
      await this.logActivity('INFO', task.agent, `Progress update: ${task.name} - ${progress}%`);
    }
  }

  async completeTask(taskId, prUrl = null) {
    const task = this.findTask(taskId);
    if (task && task.status === 'in_progress') {
      task.status = 'complete';
      task.progress_percent = 100;
      task.completed_at = new Date().toISOString();
      if (prUrl) task.pr_url = prUrl;

      this.currentSession.summary.in_progress--;
      this.currentSession.summary.completed++;
      this.completedTasks++;

      // Update completion percentage
      this.currentSession.summary.completion_percent = Math.round(
        (this.currentSession.summary.completed / this.currentSession.summary.total_tasks) * 100
      );

      await this.updateTasksFile();
      await this.logActivity('SUCCESS', task.agent, `Completed task: ${task.name}`);
    }
  }

  async logToolUsage(toolName, purpose) {
    await this.logActivity('INFO', 'CLAUDE-AGENT', `Using tool: ${toolName} - ${purpose}`);
  }

  async logError(error) {
    await this.logActivity('ERROR', 'CLAUDE-AGENT', `Error: ${error}`);
  }

  async logSuccess(message) {
    await this.logActivity('SUCCESS', 'CLAUDE-AGENT', message);
  }

  findTask(taskId) {
    for (const phase of Object.values(this.currentSession.phases)) {
      const task = phase.tasks.find((t) => t.id === taskId);
      if (task) return task;
    }
    return null;
  }

  async updateTasksFile() {
    const tasksFile = path.join(this.dataDir, 'tasks.json');
    await fs.writeFile(tasksFile, JSON.stringify(this.currentSession, null, 2));
  }

  async updateMetrics() {
    const now = Date.now();
    this.metrics.uptime_seconds = Math.floor((now - this.startTime) / 1000);
    this.metrics.last_updated = new Date().toISOString();

    // Calculate tasks per hour
    const hoursRunning = this.metrics.uptime_seconds / 3600;
    if (hoursRunning > 0) {
      this.metrics.tasks_completed_per_hour = Math.round(this.completedTasks / hoursRunning);
    }

    const metricsFile = path.join(this.dataDir, 'metrics.json');
    await fs.writeFile(metricsFile, JSON.stringify(this.metrics, null, 2));
  }

  // Start periodic metrics updates
  startMetricsUpdater() {
    setInterval(async () => {
      await this.updateMetrics();
    }, 30000); // Update every 30 seconds
  }
}

module.exports = AgentActivityTracker;

// If run directly, initialize the tracker
if (require.main === module) {
  const tracker = new AgentActivityTracker();
  tracker.initialize().then(() => {
    tracker.startMetricsUpdater();
    console.log('🚀 Agent activity tracker running...');
    console.log('📝 Monitoring real Claude agent activity');
    console.log('🔄 Metrics updating every 30 seconds');

    // Keep the process running
    process.on('SIGINT', () => {
      console.log('\n👋 Agent activity tracker stopped');
      process.exit(0);
    });
  });
}
