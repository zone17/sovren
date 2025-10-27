#!/usr/bin/env node
/**
 * Manual Agent Tracker - For capturing real Claude Code agent launches
 *
 * USAGE:
 * When you launch an agent with the Task tool, call this script:
 *
 *   node manual-agent-tracker.js launch "project-orchestrator" "Execute Sovren Refactoring"
 *   node manual-agent-tracker.js update "project-orchestrator" "Analyzing Epic 001..."
 *   node manual-agent-tracker.js complete "project-orchestrator"
 */

const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

async function loadAgents() {
  try {
    const data = await fs.readFile(path.join(DATA_DIR, 'agents.json'), 'utf8');
    return JSON.parse(data);
  } catch {
    return { timestamp: new Date().toISOString(), agents: [], summary: {} };
  }
}

async function saveAgents(data) {
  await fs.writeFile(path.join(DATA_DIR, 'agents.json'), JSON.stringify(data, null, 2));
}

async function loadTasks() {
  try {
    const data = await fs.readFile(path.join(DATA_DIR, 'tasks.json'), 'utf8');
    return JSON.parse(data);
  } catch {
    return {
      project_id: 'sovren-refactoring',
      started_at: new Date().toISOString(),
      current_phase: 'implementation',
      phases: { implementation: { status: 'in_progress', started_at: new Date().toISOString(), tasks: [] } },
      summary: { total_tasks: 0, completed: 0, in_progress: 0, blocked: 0, queued: 0, completion_percent: 0 }
    };
  }
}

async function saveTasks(data) {
  await fs.writeFile(path.join(DATA_DIR, 'tasks.json'), JSON.stringify(data, null, 2));
}

async function log(level, agent, message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level}] [${agent}] ${message}\n`;
  await fs.appendFile(path.join(DATA_DIR, 'orchestration.log'), logEntry);
}

async function launchAgent(agentName, taskDescription) {
  const agentTypes = {
    'project-orchestrator': 'orchestrator',
    'backend-api-builder': 'backend',
    'elite-frontend-dev': 'frontend',
    'test-automation-engineer': 'testing',
    'technical-docs-writer': 'documentation'
  };

  const agentsData = await loadAgents();
  const tasksData = await loadTasks();

  // Check if agent already exists
  let agent = agentsData.agents.find(a => a.name === agentName);

  if (!agent) {
    // Create new agent
    agent = {
      id: `agent-${Date.now()}`,
      name: agentName,
      type: agentTypes[agentName] || 'worker',
      status: 'active',
      parent_agent: null,
      sub_agents: [],
      current_task: { name: taskDescription, progress: 0 },
      started_at: new Date().toISOString(),
      last_activity: new Date().toISOString(),
      thinking: [{ timestamp: new Date().toISOString(), thought: `Launched: ${taskDescription}`, type: 'action' }],
      metrics: { tasks_completed: 0, tasks_in_progress: 1, average_task_time: '0m', success_rate: 100 }
    };
    agentsData.agents.push(agent);
  } else {
    // Update existing agent
    agent.status = 'active';
    agent.current_task = { name: taskDescription, progress: 0 };
    agent.last_activity = new Date().toISOString();
    agent.thinking.push({ timestamp: new Date().toISOString(), thought: `New task: ${taskDescription}`, type: 'action' });
    agent.metrics.tasks_in_progress++;
  }

  // Add task
  const task = {
    id: `task-${Date.now()}`,
    name: taskDescription,
    agent: agentName,
    status: 'in_progress',
    progress_percent: 0,
    started_at: new Date().toISOString()
  };

  tasksData.phases.implementation.tasks.push(task);
  tasksData.summary.total_tasks++;
  tasksData.summary.in_progress++;

  // Update summary
  agentsData.timestamp = new Date().toISOString();
  agentsData.summary = {
    total_agents: agentsData.agents.length,
    active_agents: agentsData.agents.filter(a => a.status === 'active').length,
    idle_agents: agentsData.agents.filter(a => a.status === 'idle').length,
    total_tasks_completed: agentsData.agents.reduce((sum, a) => sum + a.metrics.tasks_completed, 0),
    total_tasks_in_progress: agentsData.agents.reduce((sum, a) => sum + a.metrics.tasks_in_progress, 0)
  };

  await saveAgents(agentsData);
  await saveTasks(tasksData);
  await log('INFO', agentName, `Agent launched: ${taskDescription}`);

  console.log(`✅ Agent launched: ${agentName}`);
  console.log(`   Task: ${taskDescription}`);
  console.log(`   📊 Dashboard updated at http://localhost:3001`);
}

async function updateAgent(agentName, thought) {
  const agentsData = await loadAgents();
  const agent = agentsData.agents.find(a => a.name === agentName);

  if (!agent) {
    console.error(`❌ Agent "${agentName}" not found`);
    return;
  }

  agent.thinking.push({
    timestamp: new Date().toISOString(),
    thought: thought,
    type: 'implementation'
  });

  // Keep only last 10 thoughts
  if (agent.thinking.length > 10) {
    agent.thinking = agent.thinking.slice(-10);
  }

  agent.last_activity = new Date().toISOString();
  agentsData.timestamp = new Date().toISOString();

  await saveAgents(agentsData);
  await log('INFO', agentName, thought);

  console.log(`✅ Agent updated: ${agentName}`);
  console.log(`   Thought: ${thought}`);
}

async function completeAgent(agentName) {
  const agentsData = await loadAgents();
  const tasksData = await loadTasks();

  const agent = agentsData.agents.find(a => a.name === agentName);

  if (!agent) {
    console.error(`❌ Agent "${agentName}" not found`);
    return;
  }

  agent.status = 'idle';
  agent.current_task = null;
  agent.metrics.tasks_completed++;
  agent.metrics.tasks_in_progress--;
  agent.last_activity = new Date().toISOString();

  // Complete the most recent in_progress task for this agent
  for (const phase of Object.values(tasksData.phases)) {
    const task = phase.tasks.filter(t => t.agent === agentName && t.status === 'in_progress').pop();
    if (task) {
      task.status = 'completed';
      task.progress_percent = 100;
      task.completed_at = new Date().toISOString();

      tasksData.summary.in_progress--;
      tasksData.summary.completed++;
      tasksData.summary.completion_percent = Math.round((tasksData.summary.completed / tasksData.summary.total_tasks) * 100);
      break;
    }
  }

  agentsData.timestamp = new Date().toISOString();
  agentsData.summary.active_agents = agentsData.agents.filter(a => a.status === 'active').length;
  agentsData.summary.idle_agents = agentsData.agents.filter(a => a.status === 'idle').length;
  agentsData.summary.total_tasks_in_progress = agentsData.agents.reduce((sum, a) => sum + a.metrics.tasks_in_progress, 0);

  await saveAgents(agentsData);
  await saveTasks(tasksData);
  await log('SUCCESS', agentName, 'Task completed');

  console.log(`✅ Agent completed: ${agentName}`);
  console.log(`   📊 Dashboard updated at http://localhost:3001`);
}

// CLI
const [,, command, agentName, ...args] = process.argv;

if (!command) {
  console.log(`
Manual Agent Tracker - Track real Claude Code agent activity

USAGE:
  node manual-agent-tracker.js launch <agent-name> <task-description>
  node manual-agent-tracker.js update <agent-name> <thought>
  node manual-agent-tracker.js complete <agent-name>

EXAMPLES:
  node manual-agent-tracker.js launch "project-orchestrator" "Execute Sovren Refactoring (5 Epics, 123 stories)"
  node manual-agent-tracker.js update "project-orchestrator" "Analyzing Epic 001: Type Safety..."
  node manual-agent-tracker.js complete "project-orchestrator"

AGENT NAMES:
  - project-orchestrator
  - backend-api-builder
  - elite-frontend-dev
  - test-automation-engineer
  - technical-docs-writer
  `);
  process.exit(0);
}

(async () => {
  try {
    switch (command) {
      case 'launch':
        await launchAgent(agentName, args.join(' '));
        break;
      case 'update':
        await updateAgent(agentName, args.join(' '));
        break;
      case 'complete':
        await completeAgent(agentName);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
