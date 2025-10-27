/**
 * Project Orchestrator Progress Tracker
 *
 * Monitors and parses verbose progress output from the Claude Code project-orchestrator agent
 * Displays comprehensive, real-time progress tracking on the dashboard
 */

const fs = require('fs').promises;
const path = require('path');
const chokidar = require('chokidar');

class OrchestratorTracker {
  constructor(dataDir = './data') {
    this.dataDir = dataDir;
    this.projectRoot = path.resolve('../..');

    // Track orchestrator activity
    this.currentPhase = null;
    this.activeAgents = new Map();
    this.completedTasks = [];
    this.queuedTasks = [];
    this.blockers = [];

    // Phase tracking
    this.phases = {
      'PHASE 0': { name: 'DESIGN', status: 'pending', progress: 0, tasks: [] },
      'PHASE 1': { name: 'PLANNING', status: 'pending', progress: 0, tasks: [] },
      'PHASE 2': { name: 'FOUNDATION', status: 'pending', progress: 0, tasks: [] },
      'PHASE 3': { name: 'DEVELOPMENT', status: 'pending', progress: 0, tasks: [] },
      'PHASE 4': { name: 'QUALITY', status: 'pending', progress: 0, tasks: [] },
      'PHASE 5': { name: 'DOCUMENTATION', status: 'pending', progress: 0, tasks: [] },
      'PHASE 6': { name: 'DEPLOYMENT', status: 'pending', progress: 0, tasks: [] },
    };

    this.metrics = {
      uptime_seconds: 0,
      agents_active: 0,
      stories_completed: 0,
      stories_in_progress: 0,
      stories_queued: 0,
      current_phase: 'Not Started',
      last_activity: new Date().toISOString(),
      last_updated: new Date().toISOString(),
    };

    this.startTime = Date.now();

    // Watch for orchestrator output files
    this.watchedFiles = [
      path.join(this.projectRoot, 'docs/progress'),
      path.join(this.projectRoot, 'docs/orchestration'),
      path.join(this.projectRoot, '.claude/progress'),
      path.join(this.projectRoot, 'ORCHESTRATOR_LOG.md'),
      path.join(this.projectRoot, 'PROJECT_STATUS.md'),
    ];
  }

  async initialize() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });

      // Initialize data files
      await this.initializeDataFiles();

      // Start watching for orchestrator output
      await this.startFileWatching();

      // Start metrics updater
      this.startMetricsUpdater();

      // Parse any existing orchestrator logs
      await this.parseExistingLogs();

      console.log('🎯 Project Orchestrator Tracker initialized');
      console.log(`📁 Monitoring: ${this.projectRoot}`);
      console.log(`🔍 Watching for orchestrator progress updates...`);

      await this.logActivity(
        'INFO',
        'ORCHESTRATOR-TRACKER',
        'Monitoring started - waiting for orchestrator agent activity'
      );
    } catch (error) {
      console.error('❌ Failed to initialize Orchestrator Tracker:', error);
      throw error;
    }
  }

  async initializeDataFiles() {
    const initialTasks = {
      tasks: [],
      summary: {
        total_tasks: 0,
        completed: 0,
        in_progress: 0,
        blocked: 0,
        queued: 0,
        completion_percent: 0,
      },
      phases: this.phases,
      agents: [],
      blockers: [],
      last_updated: new Date().toISOString(),
    };

    const initialMetrics = {
      uptime_seconds: 0,
      agents_active: 0,
      stories_completed: 0,
      stories_in_progress: 0,
      stories_queued: 0,
      current_phase: 'Waiting for Orchestrator',
      last_activity: new Date().toISOString(),
      last_updated: new Date().toISOString(),
    };

    await fs.writeFile(
      path.join(this.dataDir, 'tasks.json'),
      JSON.stringify(initialTasks, null, 2)
    );

    await fs.writeFile(
      path.join(this.dataDir, 'metrics.json'),
      JSON.stringify(initialMetrics, null, 2)
    );
  }

  async startFileWatching() {
    // Watch for orchestrator output in multiple locations
    const watchPaths = [
      path.join(this.projectRoot, 'docs/**/*.md'),
      path.join(this.projectRoot, '.claude/**/*.md'),
      path.join(this.projectRoot, 'ORCHESTRATOR_LOG.md'),
      path.join(this.projectRoot, 'PROJECT_STATUS.md'),
      path.join(this.projectRoot, 'CHANGELOG.md'),
    ];

    this.fileWatcher = chokidar.watch(watchPaths, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
    });

    this.fileWatcher.on('change', (filePath) => this.onFileChanged(filePath));
    this.fileWatcher.on('add', (filePath) => this.onFileAdded(filePath));

    console.log('👀 Watching for orchestrator progress updates...');
  }

  async onFileChanged(filePath) {
    const fileName = path.basename(filePath);

    // Check if this is an orchestrator-related file
    if (
      fileName.includes('ORCHESTRATOR') ||
      fileName.includes('PROJECT_STATUS') ||
      fileName.includes('progress') ||
      fileName.includes('CHANGELOG')
    ) {
      console.log(`📄 Orchestrator file updated: ${fileName}`);
      await this.parseOrchestratorFile(filePath);
    }
  }

  async onFileAdded(filePath) {
    const fileName = path.basename(filePath);

    if (
      fileName.includes('ORCHESTRATOR') ||
      fileName.includes('PROJECT_STATUS') ||
      fileName.includes('progress')
    ) {
      console.log(`📄 New orchestrator file detected: ${fileName}`);
      await this.parseOrchestratorFile(filePath);
    }
  }

  async parseExistingLogs() {
    // Check for existing orchestrator logs
    for (const watchPath of this.watchedFiles) {
      try {
        const stats = await fs.stat(watchPath);
        if (stats.isFile()) {
          await this.parseOrchestratorFile(watchPath);
        } else if (stats.isDirectory()) {
          const files = await fs.readdir(watchPath);
          for (const file of files) {
            if (file.endsWith('.md')) {
              await this.parseOrchestratorFile(path.join(watchPath, file));
            }
          }
        }
      } catch (error) {
        // File doesn't exist yet, that's okay
      }
    }
  }

  async parseOrchestratorFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');

      // Parse the orchestrator's verbose output format
      await this.parseProgressBlocks(content);
      await this.parseTaskList(content);
      await this.parsePhaseStatus(content);

      this.metrics.last_activity = new Date().toISOString();
    } catch (error) {
      console.error(`Error parsing orchestrator file ${filePath}:`, error);
    }
  }

  async parseProgressBlocks(content) {
    // Parse the structured progress blocks
    // Format: [TIMESTAMP] [PHASE] [AGENT] [ACTION] [STATUS]
    const progressRegex =
      /\[([^\]]+)\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]\s*\[([^\]]+)\]/g;

    let match;
    while ((match = progressRegex.exec(content)) !== null) {
      const [, timestamp, phase, agent, action, status] = match;

      // Extract details from the block
      const blockStart = match.index;
      const blockEnd = content.indexOf(
        '═══════════════════════════════════════════════════════════',
        blockStart + 1
      );
      const blockContent = blockEnd > blockStart ? content.substring(blockStart, blockEnd) : '';

      const details = this.extractBlockDetails(blockContent);

      await this.processProgressUpdate({
        timestamp,
        phase,
        agent,
        action,
        status,
        ...details,
      });
    }
  }

  extractBlockDetails(blockContent) {
    const details = {
      description: '',
      output: [],
      progress: 0,
      duration: '',
      next: '',
    };

    // Extract Details
    const detailsMatch = blockContent.match(/Details:\s*([^\n]+)/);
    if (detailsMatch) details.description = detailsMatch[1].trim();

    // Extract Output
    const outputMatch = blockContent.match(/Output:([\s\S]*?)(?:Progress:|Duration:|Next:|$)/);
    if (outputMatch) {
      details.output = outputMatch[1]
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && line.startsWith('-'))
        .map((line) => line.substring(1).trim());
    }

    // Extract Progress
    const progressMatch = blockContent.match(/Progress:\s*([^\n]+)/);
    if (progressMatch) {
      const progressText = progressMatch[1];
      const percentMatch = progressText.match(/(\d+)%/);
      if (percentMatch) {
        details.progress = parseInt(percentMatch[1]);
      }
    }

    // Extract Duration
    const durationMatch = blockContent.match(/Duration:\s*([^\n]+)/);
    if (durationMatch) details.duration = durationMatch[1].trim();

    // Extract Next
    const nextMatch = blockContent.match(/Next:\s*([^\n]+)/);
    if (nextMatch) details.next = nextMatch[1].trim();

    return details;
  }

  async processProgressUpdate(update) {
    console.log(`🎯 [${update.phase}] ${update.agent}: ${update.action} - ${update.status}`);

    // Update current phase
    if (update.phase && update.phase.startsWith('PHASE')) {
      this.currentPhase = update.phase;
      this.metrics.current_phase = `${update.phase}: ${this.phases[update.phase]?.name || 'Unknown'}`;

      if (this.phases[update.phase]) {
        this.phases[update.phase].status = update.status.toLowerCase();
        if (update.progress) {
          this.phases[update.phase].progress = update.progress;
        }
      }
    }

    // Create or update task
    const taskId = `${update.agent}-${update.action}`.toLowerCase().replace(/\s+/g, '-');

    await this.updateTasksFile((tasks) => {
      let task = tasks.tasks.find((t) => t.id === taskId);

      if (!task) {
        task = {
          id: taskId,
          name: `${update.action}: ${update.description}`,
          agent: update.agent,
          phase: update.phase,
          status: this.mapStatus(update.status),
          progress: update.progress || 0,
          created_at: update.timestamp || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          duration: update.duration,
          output: update.output,
          next_step: update.next,
        };
        tasks.tasks.push(task);
        tasks.summary.total_tasks++;
      } else {
        task.status = this.mapStatus(update.status);
        task.progress = update.progress || task.progress;
        task.updated_at = new Date().toISOString();
        task.duration = update.duration || task.duration;
        task.output = update.output.length > 0 ? update.output : task.output;
        task.next_step = update.next || task.next_step;
      }

      // Update summary counts
      this.updateSummaryCounts(tasks);

      return tasks;
    });

    await this.logActivity(
      'INFO',
      update.agent,
      `${update.action} - ${update.status}: ${update.description}`
    );
  }

  mapStatus(status) {
    const statusMap = {
      STARTED: 'in_progress',
      IN_PROGRESS: 'in_progress',
      'IN PROGRESS': 'in_progress',
      COMPLETE: 'completed',
      COMPLETED: 'completed',
      BLOCKED: 'blocked',
      QUEUED: 'queued',
      PENDING: 'queued',
    };

    return statusMap[status.toUpperCase()] || 'in_progress';
  }

  async parseTaskList(content) {
    // Parse the CURRENT TASKS IN FLIGHT section
    const taskListMatch = content.match(
      /CURRENT TASKS IN FLIGHT:([\s\S]*?)(?:━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━|$)/
    );

    if (taskListMatch) {
      const taskListContent = taskListMatch[1];

      // Parse ACTIVE tasks
      const activeMatch = taskListContent.match(
        /ACTIVE \((\d+)\):([\s\S]*?)(?:QUEUED|COMPLETED|$)/
      );
      if (activeMatch) {
        const count = parseInt(activeMatch[1]);
        this.metrics.stories_in_progress = count;
      }

      // Parse QUEUED tasks
      const queuedMatch = taskListContent.match(/QUEUED \((\d+)\):([\s\S]*?)(?:COMPLETED|$)/);
      if (queuedMatch) {
        const count = parseInt(queuedMatch[1]);
        this.metrics.stories_queued = count;
      }

      // Parse COMPLETED tasks
      const completedMatch = taskListContent.match(/COMPLETED TODAY \((\d+)\):/);
      if (completedMatch) {
        const count = parseInt(completedMatch[1]);
        this.metrics.stories_completed = count;
      }

      // Parse blockers
      const blockerMatch = taskListContent.match(/CURRENT BLOCKERS:\s*([^\n]+)/);
      if (blockerMatch) {
        const blockerText = blockerMatch[1].trim();
        if (blockerText !== 'None') {
          this.blockers = [blockerText];
        } else {
          this.blockers = [];
        }
      }
    }
  }

  async parsePhaseStatus(content) {
    // Parse the PROJECT STATUS section
    const statusMatch = content.match(/PROJECT STATUS:([\s\S]*?)(?:ESTIMATED COMPLETION|$)/);

    if (statusMatch) {
      const statusContent = statusMatch[1];

      // Parse each phase
      for (const [phaseKey, phaseData] of Object.entries(this.phases)) {
        const phaseRegex = new RegExp(`${phaseKey}:[^\\[]*\\[([^\\]]+)\\]`);
        const match = statusContent.match(phaseRegex);

        if (match) {
          const statusEmoji = match[1].trim();

          if (statusEmoji.includes('✅') || statusEmoji.includes('Complete')) {
            phaseData.status = 'completed';
            phaseData.progress = 100;
          } else if (statusEmoji.includes('🔄') || statusEmoji.includes('In Progress')) {
            phaseData.status = 'in_progress';
          } else if (statusEmoji.includes('⏳') || statusEmoji.includes('Pending')) {
            phaseData.status = 'pending';
          }
        }
      }
    }
  }

  updateSummaryCounts(tasks) {
    tasks.summary.completed = tasks.tasks.filter((t) => t.status === 'completed').length;
    tasks.summary.in_progress = tasks.tasks.filter((t) => t.status === 'in_progress').length;
    tasks.summary.blocked = tasks.tasks.filter((t) => t.status === 'blocked').length;
    tasks.summary.queued = tasks.tasks.filter((t) => t.status === 'queued').length;

    if (tasks.summary.total_tasks > 0) {
      tasks.summary.completion_percent = Math.round(
        (tasks.summary.completed / tasks.summary.total_tasks) * 100
      );
    }

    tasks.phases = this.phases;
    tasks.blockers = this.blockers;
  }

  async updateTasksFile(updateFn) {
    try {
      const tasksPath = path.join(this.dataDir, 'tasks.json');
      const tasksData = JSON.parse(await fs.readFile(tasksPath, 'utf8'));
      const updatedTasks = updateFn(tasksData);
      updatedTasks.last_updated = new Date().toISOString();

      await fs.writeFile(tasksPath, JSON.stringify(updatedTasks, null, 2));
    } catch (error) {
      console.error('Error updating tasks file:', error);
    }
  }

  startMetricsUpdater() {
    setInterval(async () => {
      this.metrics.uptime_seconds = Math.floor((Date.now() - this.startTime) / 1000);
      this.metrics.agents_active = this.activeAgents.size;
      this.metrics.last_updated = new Date().toISOString();

      try {
        await fs.writeFile(
          path.join(this.dataDir, 'metrics.json'),
          JSON.stringify(this.metrics, null, 2)
        );
      } catch (error) {
        console.error('Error updating metrics:', error);
      }
    }, 2000);
  }

  async logActivity(level, agent, message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] [${agent}] ${message}\n`;

    try {
      const logFile = path.join(this.dataDir, 'orchestration.log');
      await fs.appendFile(logFile, logEntry);
    } catch (error) {
      console.error('Error writing to log:', error);
    }
  }

  async shutdown() {
    console.log('🛑 Shutting down Orchestrator Tracker...');

    if (this.fileWatcher) {
      await this.fileWatcher.close();
    }

    await this.logActivity('INFO', 'ORCHESTRATOR-TRACKER', 'Monitoring stopped');
  }
}

// Initialize and start the tracker
const tracker = new OrchestratorTracker();

process.on('SIGINT', async () => {
  await tracker.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await tracker.shutdown();
  process.exit(0);
});

// Start the tracker
tracker.initialize().catch((error) => {
  console.error('Failed to start Orchestrator Tracker:', error);
  process.exit(1);
});
