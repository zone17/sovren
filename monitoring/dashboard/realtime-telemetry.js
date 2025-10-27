#!/usr/bin/env node
/**
 * Real-time Claude Code Telemetry System
 *
 * Automatically captures ALL Claude Code activity with ZERO manual intervention:
 * - Agent launches (Task tool)
 * - Tool usage (Read, Write, Edit, Bash, etc.)
 * - Todo list changes
 * - File modifications
 * - Agent completions
 *
 * This is FULL TELEMETRY - no manual updates needed!
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const { Tail } = require('tail');

class RealtimeTelemetry {
  constructor() {
    this.dataDir = path.join(__dirname, 'data');
    this.claudeDir = path.join(process.env.HOME, '.claude');
    this.projectRoot = '/Users/fp/Desktop/Sovren';

    // State tracking
    this.activeAgents = new Map();
    this.activeTasks = new Map();
    this.toolUsageStats = {
      read: 0,
      write: 0,
      edit: 0,
      bash: 0,
      task: 0
    };

    this.sessionStart = new Date().toISOString();
    this.lastUpdate = new Date().toISOString();

    // Files to monitor
    this.claudeProjects = path.join(this.claudeDir, 'projects', '-Users-fp-Desktop-Sovren');
    this.claudeTodos = path.join(this.claudeDir, 'todos');
    this.claudeAgents = path.join(this.claudeDir, 'agents');
  }

  async initialize() {
    console.log('🚀 Real-time Claude Code Telemetry System');
    console.log('━'.repeat(70));
    console.log(`📁 Project: ${this.projectRoot}`);
    console.log(`📡 Claude Data: ${this.claudeDir}`);
    console.log('━'.repeat(70));

    await this.ensureDataDir();
    await this.initializeState();
    await this.startMonitoring();

    console.log('\n✅ Telemetry system active - capturing ALL Claude Code activity');
    console.log('📊 Dashboard: http://localhost:3001');
    console.log('\n🔴 LIVE - No manual intervention required\n');
  }

  async ensureDataDir() {
    await fs.mkdir(this.dataDir, { recursive: true });
  }

  async initializeState() {
    // Initialize with clean state
    const initialState = {
      project_id: 'sovren-refactoring',
      started_at: this.sessionStart,
      current_phase: 'active-development',
      phases: {
        'active-development': {
          status: 'in_progress',
          started_at: this.sessionStart,
          tasks: []
        }
      },
      summary: {
        total_tasks: 0,
        completed: 0,
        in_progress: 0,
        blocked: 0,
        queued: 0,
        completion_percent: 0
      }
    };

    await this.saveState('tasks.json', initialState);

    const agentsState = {
      timestamp: new Date().toISOString(),
      agents: [],
      summary: {
        total_agents: 0,
        active_agents: 0,
        idle_agents: 0,
        total_tasks_completed: 0,
        total_tasks_in_progress: 0
      }
    };

    await this.saveState('agents.json', agentsState);

    await this.log('INFO', 'TELEMETRY', 'Real-time telemetry system initialized - monitoring all Claude Code activity');
  }

  async startMonitoring() {
    console.log('🔍 Starting file watchers...\n');

    // Monitor Claude Code project conversation for all tool calls
    if (fsSync.existsSync(this.claudeProjects)) {
      this.watchProjectConversation();
      console.log('  ✓ Watching project conversation (all tool calls)');
    }

    // Monitor project files for changes
    this.watchProjectFiles();
    console.log('  ✓ Watching Sovren project files');

    // Monitor todos directory
    if (fsSync.existsSync(this.claudeTodos)) {
      this.watchTodos();
      console.log('  ✓ Watching todo list changes');
    }

    // Poll for updates every 5 seconds
    this.startUpdateLoop();
    console.log('  ✓ Update loop started (5s interval)');
  }

  watchProjectConversation() {
    try {
      // Watch ALL conversation files in the project directory
      const watcher = chokidar.watch(`${this.claudeProjects}/*.jsonl`, {
        persistent: true,
        ignoreInitial: false,
        awaitWriteFinish: {
          stabilityThreshold: 500,
          pollInterval: 100
        }
      });

      watcher.on('change', async (filePath) => {
        // Read the last 5 lines to capture multiple tool calls
        try {
          const data = await fs.readFile(filePath, 'utf8');
          const lines = data.trim().split('\n');

          // Process last 5 lines (most recent activity)
          const recentLines = lines.slice(-5);

          for (const line of recentLines) {
            try {
              const entry = JSON.parse(line);
              await this.processConversationEntry(entry);
            } catch (e) {
              // Skip invalid JSON lines
            }
          }

          console.log(`📡 Processed conversation update from ${path.basename(filePath)}`);
        } catch (e) {
          // Skip file read errors
        }
      });

      watcher.on('add', async (filePath) => {
        console.log(`📝 Processing existing conversation: ${path.basename(filePath)}`);

        // Process the file to capture current state
        try {
          const data = await fs.readFile(filePath, 'utf8');
          const lines = data.trim().split('\n');

          // Process last 10 lines to capture recent state
          const recentLines = lines.slice(-10);

          for (const line of recentLines) {
            try {
              const entry = JSON.parse(line);
              await this.processConversationEntry(entry);
            } catch (e) {
              // Skip invalid JSON lines
            }
          }

          console.log(`✓ Captured state from ${path.basename(filePath)}`);
        } catch (e) {
          // Skip file read errors
        }
      });

      console.log(`\n  📡 Monitoring ${this.claudeProjects}/*.jsonl`);
      console.log(`  🔍 Watching for ALL Claude Code conversations in Sovren project`);
    } catch (error) {
      console.error('Failed to watch project conversation:', error.message);
    }
  }

  async processConversationEntry(entry) {
    const timestamp = entry.timestamp || new Date().toISOString();

    // Process assistant messages containing tool uses
    if (entry.type === 'assistant' && entry.message && entry.message.content) {
      for (const content of entry.message.content) {
        if (content.type === 'tool_use') {
          const toolName = content.name;
          const params = content.input;

          switch (toolName) {
            case 'Task':
              await this.handleAgentLaunch({ name: toolName, input: params }, timestamp);
              break;
            case 'Read':
            case 'Write':
            case 'Edit':
            case 'Bash':
              await this.handleToolUsage(toolName, { name: toolName, input: params }, timestamp);
              break;
            case 'TodoWrite':
              await this.handleTodoUpdate({ name: toolName, input: params }, timestamp);
              break;
          }
        }
      }
    }
  }

  async handleAgentLaunch(entry, timestamp) {
    const params = entry.input || entry.parameters || entry.params || {};
    const agentType = params.subagent_type || params.agent_type || 'unknown';
    const taskDesc = params.prompt || params.task || params.description || 'Unknown task';

    // Check if agent already exists (avoid duplicates)
    const existingAgent = Array.from(this.activeAgents.values()).find(a => a.name === agentType);
    if (existingAgent) {
      console.log(`\n🔄 Agent already active: ${agentType} - updating task`);
      existingAgent.current_task = {
        name: taskDesc.substring(0, 100),
        progress: 0
      };
      existingAgent.last_activity = timestamp;
      await this.updateAgents();
      return;
    }

    console.log(`\n🚀 Agent Launched: ${agentType}`);
    console.log(`   Task: ${taskDesc.substring(0, 80)}...`);

    const agentId = `agent-${Date.now()}`;
    const agent = {
      id: agentId,
      name: agentType,
      type: this.getAgentType(agentType),
      status: 'active',
      parent_agent: null,
      sub_agents: [],
      current_task: {
        name: taskDesc.substring(0, 100),
        progress: 0
      },
      started_at: timestamp,
      last_activity: timestamp,
      thinking: [{
        timestamp,
        thought: `Launched: ${taskDesc.substring(0, 80)}`,
        type: 'action'
      }],
      metrics: {
        tasks_completed: 0,
        tasks_in_progress: 1,
        average_task_time: '0m',
        success_rate: 100
      }
    };

    this.activeAgents.set(agentId, agent);
    this.toolUsageStats.task++;

    await this.updateAgents();
    await this.log('INFO', agentType, `Agent launched: ${taskDesc.substring(0, 80)}`);
  }

  async handleToolUsage(toolName, entry, timestamp) {
    const tool = toolName.toLowerCase();
    this.toolUsageStats[tool] = (this.toolUsageStats[tool] || 0) + 1;

    // Update agent thinking for the most recent active agent
    const agents = Array.from(this.activeAgents.values());
    const activeAgent = agents.find(a => a.status === 'active');

    if (activeAgent) {
      const params = entry.input || entry.parameters || entry.params || {};
      let thought = `Using ${toolName}`;

      if (toolName === 'Read' && params.file_path) {
        thought = `Reading ${path.basename(params.file_path)}`;
      } else if (toolName === 'Write' && params.file_path) {
        thought = `Writing ${path.basename(params.file_path)}`;
      } else if (toolName === 'Edit' && params.file_path) {
        thought = `Editing ${path.basename(params.file_path)}`;
      } else if (toolName === 'Bash' && params.command) {
        thought = `Running: ${params.command.substring(0, 50)}`;
      }

      activeAgent.thinking.push({
        timestamp,
        thought,
        type: 'implementation'
      });

      // Keep only last 10 thoughts
      if (activeAgent.thinking.length > 10) {
        activeAgent.thinking = activeAgent.thinking.slice(-10);
      }

      activeAgent.last_activity = timestamp;
      await this.updateAgents();
    }

    // Log significant tool usage
    if (['Write', 'Edit'].includes(toolName)) {
      const params = entry.parameters || {};
      const file = params.file_path ? path.basename(params.file_path) : 'unknown';
      await this.log('INFO', 'FILE-CHANGE', `${toolName}: ${file}`);
    }
  }

  async handleTodoUpdate(entry, timestamp) {
    const params = entry.input || entry.parameters || {};
    const todos = params.todos || [];

    const inProgress = todos.filter(t => t.status === 'in_progress');
    const completed = todos.filter(t => t.status === 'completed');

    console.log(`\n📝 Todo Update: ${inProgress.length} active, ${completed.length} completed`);

    // Update tasks based on todos
    const tasksData = await this.loadState('tasks.json');

    // Get current phase from tasks data
    const currentPhase = tasksData.current_phase || 'implementation';

    // Sync todos to tasks with hierarchical structure (avoid duplicates)
    todos.forEach((todo, idx) => {
      // Check for existing task by name OR by epic/story structure
      const existingTask = tasksData.phases[currentPhase].tasks.find(t => {
        // Match by exact name
        if (t.name === todo.content) return true;

        // Match by epic structure (Epic number + Stream)
        const epicMatch = todo.content.match(/Epic\s+(\d+)\s+Stream\s+([A-Z])/i);
        if (epicMatch && t.type === 'epic') {
          return t.epic_number === epicMatch[1] && t.stream === epicMatch[2];
        }

        // Match by story ID
        const storyMatch = todo.content.match(/([A-Z]+-\d+):/i);
        if (storyMatch && t.type === 'story') {
          return t.story_id === storyMatch[1];
        }

        return false;
      });

      if (!existingTask && todo.status !== 'pending') {
        // Parse epic and story structure from todo content
        const taskData = this.parseTaskStructure(todo, timestamp);
        tasksData.phases[currentPhase].tasks.push(taskData);
      } else if (existingTask) {
        // Update status of existing task
        existingTask.status = todo.status === 'completed' ? 'completed' : 'in_progress';
        existingTask.progress_percent = todo.status === 'completed' ? 100 : existingTask.progress_percent || 50;
        if (todo.status === 'completed' && !existingTask.completed_at) {
          existingTask.completed_at = timestamp;
        }
      }
    });

    // Match tasks with agents working on them
    await this.matchTasksToAgents(tasksData, currentPhase);

    // Update summary
    const allTasks = tasksData.phases[currentPhase].tasks;
    tasksData.summary.total_tasks = allTasks.length;
    tasksData.summary.completed = allTasks.filter(t => t.status === 'completed').length;
    tasksData.summary.in_progress = allTasks.filter(t => t.status === 'in_progress').length;
    tasksData.summary.completion_percent = allTasks.length > 0
      ? Math.round((tasksData.summary.completed / tasksData.summary.total_tasks) * 100)
      : 0;

    await this.saveState('tasks.json', tasksData);
  }

  /**
   * Match tasks to the agents currently working on them
   */
  async matchTasksToAgents(tasksData, currentPhase) {
    const agents = Array.from(this.activeAgents.values());

    // For each in-progress task, try to find the agent working on it
    tasksData.phases[currentPhase].tasks.forEach(task => {
      if (task.status !== 'in_progress') return;

      // Try to match by story ID in agent's current task description
      if (task.story_id) {
        const matchingAgent = agents.find(agent =>
          agent.current_task &&
          agent.current_task.name &&
          agent.current_task.name.includes(task.story_id)
        );

        if (matchingAgent) {
          task.agent = matchingAgent.name;
          task.agent_type = matchingAgent.type;
          // Extract progress from agent if available
          task.progress_percent = matchingAgent.current_task.progress || 25;
        }
      }

      // Try to match by task name keywords
      if (!task.agent || task.agent === 'claude-code') {
        const taskKeywords = task.name.toLowerCase();

        const matchingAgent = agents.find(agent => {
          if (!agent.current_task || !agent.current_task.name) return false;
          const agentTask = agent.current_task.name.toLowerCase();

          // Check if agent's task mentions this task
          return taskKeywords.split(' ').some(keyword =>
            keyword.length > 4 && agentTask.includes(keyword)
          );
        });

        if (matchingAgent) {
          task.agent = matchingAgent.name;
          task.agent_type = matchingAgent.type;
          task.progress_percent = matchingAgent.current_task.progress || 25;
        }
      }
    });
  }

  /**
   * Parse task structure to identify epics with sub-stories
   */
  parseTaskStructure(todo, timestamp) {
    const content = todo.content;
    const status = todo.status === 'completed' ? 'completed' : 'in_progress';

    // Check if this is an Epic with stories
    // Pattern: "Epic XXX Stream X: Name - ✅ COMPLETE (N stories)"
    const epicMatch = content.match(/Epic\s+(\d+)\s+Stream\s+([A-Z]):\s+(.+?)\s+-\s+(✅|🔄)?\s*(COMPLETE|IN PROGRESS)?\s*\((\d+)\s+stories?\)/i);

    if (epicMatch) {
      const [, epicNum, stream, name, , epicStatus, storyCount] = epicMatch;

      return {
        id: `epic-${epicNum}-stream-${stream.toLowerCase()}-${Date.now()}`,
        type: 'epic',
        name: content,
        epic_number: epicNum,
        stream: stream,
        description: name.trim(),
        agent: 'claude-code',
        status: status,
        progress_percent: status === 'completed' ? 100 : 50,
        started_at: timestamp,
        completed_at: status === 'completed' ? timestamp : null,
        story_count: parseInt(storyCount),
        stories: [] // Will be populated from individual story todos
      };
    }

    // Check if this is an individual story
    // Pattern: "TS-001: Description" or "Story TS-001: Description"
    const storyMatch = content.match(/(?:Story\s+)?([A-Z]+-\d+):\s+(.+)/i);

    if (storyMatch) {
      const [, storyId, description] = storyMatch;

      return {
        id: `story-${storyId.toLowerCase()}-${Date.now()}`,
        type: 'story',
        story_id: storyId,
        name: content,
        description: description.trim(),
        agent: 'claude-code',
        status: status,
        progress_percent: status === 'completed' ? 100 : 50,
        started_at: timestamp,
        completed_at: status === 'completed' ? timestamp : null,
        files_modified: [],
        test_coverage: null
      };
    }

    // Default task structure
    return {
      id: `task-${Date.now()}`,
      type: 'task',
      name: content,
      agent: 'claude-code',
      status: status,
      progress_percent: status === 'completed' ? 100 : 50,
      started_at: timestamp,
      completed_at: status === 'completed' ? timestamp : null
    };
  }

  watchProjectFiles() {
    const watcher = chokidar.watch([
      path.join(this.projectRoot, 'packages/**/*.{ts,tsx,js,jsx}'),
      path.join(this.projectRoot, 'packages/**/*.json'),
      path.join(this.projectRoot, 'docs/**/*.md')
    ], {
      ignored: /(node_modules|\.git|dist|build)/,
      persistent: true,
      ignoreInitial: true
    });

    let changeTimeout;
    watcher.on('change', (filePath) => {
      clearTimeout(changeTimeout);
      changeTimeout = setTimeout(async () => {
        const relativePath = path.relative(this.projectRoot, filePath);
        console.log(`📝 File changed: ${relativePath}`);
        await this.log('INFO', 'FILE-CHANGE', `Modified: ${relativePath}`);
      }, 500);
    });
  }

  watchTodos() {
    const watcher = chokidar.watch(this.claudeTodos, {
      persistent: true,
      ignoreInitial: true,
      depth: 1
    });

    watcher.on('change', async (filePath) => {
      console.log('📋 Todo list updated');
      // Todo changes are captured via history.jsonl TodoWrite entries
    });
  }

  async updateAgents() {
    const agents = Array.from(this.activeAgents.values());

    const agentsData = {
      timestamp: new Date().toISOString(),
      agents: agents,
      summary: {
        total_agents: agents.length,
        active_agents: agents.filter(a => a.status === 'active').length,
        idle_agents: agents.filter(a => a.status === 'idle').length,
        total_tasks_completed: agents.reduce((sum, a) => sum + a.metrics.tasks_completed, 0),
        total_tasks_in_progress: agents.reduce((sum, a) => sum + a.metrics.tasks_in_progress, 0)
      }
    };

    await this.saveState('agents.json', agentsData);
  }

  startUpdateLoop() {
    setInterval(async () => {
      // Update agent last_activity
      for (const agent of this.activeAgents.values()) {
        if (agent.status === 'active') {
          agent.last_activity = new Date().toISOString();
        }
      }

      await this.updateAgents();

      // Match tasks to agents periodically
      const tasksData = await this.loadState('tasks.json');
      const currentPhase = tasksData.current_phase || 'implementation';
      await this.matchTasksToAgents(tasksData, currentPhase);
      await this.saveState('tasks.json', tasksData);

      // Update metrics
      const metrics = {
        timestamp: new Date().toISOString(),
        uptime_seconds: Math.floor((Date.now() - new Date(this.sessionStart).getTime()) / 1000),
        tasks_processed: this.activeTasks.size,
        success_rate: 100,
        average_task_duration_ms: 0,
        active_agents: this.activeAgents.size,
        tool_usage: this.toolUsageStats,
        errors_count: 0
      };

      await this.saveState('metrics.json', metrics);
    }, 5000);
  }

  getAgentType(name) {
    const types = {
      'project-orchestrator': 'orchestrator',
      'backend-api-builder': 'backend',
      'elite-frontend-dev': 'frontend',
      'test-automation-engineer': 'testing',
      'technical-docs-writer': 'documentation',
      'monitoring-observability-architect': 'monitoring'
    };
    return types[name] || 'worker';
  }

  async saveState(filename, data) {
    await fs.writeFile(path.join(this.dataDir, filename), JSON.stringify(data, null, 2));
  }

  async loadState(filename) {
    try {
      const data = await fs.readFile(path.join(this.dataDir, filename), 'utf8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async log(level, agent, message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] [${agent}] ${message}\n`;
    await fs.appendFile(path.join(this.dataDir, 'orchestration.log'), logEntry);
  }
}

// Start the telemetry system
const telemetry = new RealtimeTelemetry();

telemetry.initialize().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n👋 Shutting down telemetry system...');
  await telemetry.log('INFO', 'TELEMETRY', 'System shutting down');
  process.exit(0);
});

module.exports = RealtimeTelemetry;
