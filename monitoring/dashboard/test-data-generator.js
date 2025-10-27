/**
 * Test Data Generator for Sovren Monitoring Dashboard
 *
 * Simulates realistic agent activity by:
 * - Creating sample tasks in various states
 * - Generating continuous log entries
 * - Updating task progress
 * - Simulating different agent behaviors
 *
 * Usage: npm run test
 */

const fs = require('fs').promises;
const path = require('path');

// Configuration
const DATA_DIR = path.join(__dirname, 'data');
const FILES = {
  tasks: path.join(DATA_DIR, 'tasks.json'),
  logs: path.join(DATA_DIR, 'orchestration.log'),
  metrics: path.join(DATA_DIR, 'metrics.json'),
  agents: path.join(DATA_DIR, 'agents.json')
};

// Agent names for realistic simulation
const AGENTS = [
  'OrchestratorAgent',
  'RefactorAgent',
  'TestAgent',
  'DocumentationAgent',
  'SecurityAgent',
  'PerformanceAgent'
];

// Log levels and their colors
const LOG_LEVELS = {
  INFO: '📘',
  SUCCESS: '✅',
  WARNING: '⚠️',
  ERROR: '❌',
  DEBUG: '🔍'
};

// Sample task templates
const TASK_TEMPLATES = [
  {
    id: 'task-001',
    title: 'Refactor authentication module',
    type: 'refactor',
    status: 'completed',
    progress: 100,
    agent: 'RefactorAgent',
    priority: 'high'
  },
  {
    id: 'task-002',
    title: 'Update API documentation',
    type: 'documentation',
    status: 'completed',
    progress: 100,
    agent: 'DocumentationAgent',
    priority: 'medium'
  },
  {
    id: 'task-003',
    title: 'Implement rate limiting',
    type: 'feature',
    status: 'in_progress',
    progress: 65,
    agent: 'SecurityAgent',
    priority: 'high'
  },
  {
    id: 'task-004',
    title: 'Optimize database queries',
    type: 'performance',
    status: 'in_progress',
    progress: 40,
    agent: 'PerformanceAgent',
    priority: 'medium'
  },
  {
    id: 'task-005',
    title: 'Fix TypeScript type errors',
    type: 'bugfix',
    status: 'blocked',
    progress: 20,
    agent: 'RefactorAgent',
    priority: 'high',
    blocker: 'Waiting for upstream dependency update'
  },
  {
    id: 'task-006',
    title: 'Add E2E tests for checkout flow',
    type: 'testing',
    status: 'queued',
    progress: 0,
    agent: 'TestAgent',
    priority: 'low'
  }
];

// Log message templates
const LOG_TEMPLATES = {
  INFO: [
    'Starting task execution: {task}',
    'Agent {agent} initialized successfully',
    'Processing file: {file}',
    'Configuration loaded from {source}',
    'Checkpoint saved: {checkpoint}'
  ],
  SUCCESS: [
    'Task completed: {task}',
    'Tests passed: {count} tests',
    'Build successful in {time}ms',
    'Deployment completed to {environment}',
    'Code analysis passed with score {score}/100'
  ],
  WARNING: [
    'Deprecated API usage detected in {file}',
    'High memory usage: {percent}%',
    'Rate limit approaching: {requests} requests',
    'Slow query detected: {query} took {time}ms',
    'Cache miss rate elevated: {percent}%'
  ],
  ERROR: [
    'Failed to connect to {service}',
    'Validation error in {field}: {reason}',
    'Task failed: {task} - {error}',
    'Build error: {message}',
    'API request failed: {endpoint} returned {status}'
  ],
  DEBUG: [
    'Variable state: {variable} = {value}',
    'Function call: {function}({args})',
    'Cache hit for key: {key}',
    'Event emitted: {event}',
    'Middleware executed: {middleware}'
  ]
};

/**
 * Generate random integer between min and max (inclusive)
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Pick random element from array
 */
function randomPick(array) {
  return array[randomInt(0, array.length - 1)];
}

/**
 * Generate timestamp in ISO format
 */
function timestamp() {
  return new Date().toISOString();
}

/**
 * Generate realistic log message
 */
function generateLogMessage() {
  const level = randomPick(Object.keys(LOG_LEVELS));
  const agent = randomPick(AGENTS);
  const template = randomPick(LOG_TEMPLATES[level]);

  // Replace placeholders with realistic values
  let message = template
    .replace('{task}', `task-${randomInt(1, 10).toString().padStart(3, '0')}`)
    .replace('{agent}', agent)
    .replace('{file}', `src/components/${randomPick(['Auth', 'Dashboard', 'Profile', 'Settings'])}.tsx`)
    .replace('{source}', randomPick(['config.json', '.env', 'database.yml']))
    .replace('{checkpoint}', `checkpoint-${randomInt(1, 100)}`)
    .replace('{count}', randomInt(10, 100))
    .replace('{time}', randomInt(100, 5000))
    .replace('{environment}', randomPick(['staging', 'production', 'development']))
    .replace('{score}', randomInt(70, 100))
    .replace('{percent}', randomInt(50, 95))
    .replace('{requests}', randomInt(500, 1000))
    .replace('{query}', 'SELECT * FROM users WHERE...')
    .replace('{service}', randomPick(['PostgreSQL', 'Redis', 'Elasticsearch']))
    .replace('{field}', randomPick(['email', 'password', 'username']))
    .replace('{reason}', 'invalid format')
    .replace('{error}', randomPick(['Network timeout', 'Permission denied', 'Invalid input']))
    .replace('{message}', 'Module not found')
    .replace('{endpoint}', '/api/users')
    .replace('{status}', randomPick(['404', '500', '403']))
    .replace('{variable}', randomPick(['userId', 'authToken', 'config']))
    .replace('{value}', randomInt(1, 1000))
    .replace('{function}', randomPick(['processData', 'validateInput', 'fetchUser']))
    .replace('{args}', 'id=123, force=true')
    .replace('{key}', `cache:user:${randomInt(1, 100)}`)
    .replace('{event}', randomPick(['user.login', 'task.complete', 'error.critical']))
    .replace('{middleware}', randomPick(['auth', 'cors', 'rateLimit']));

  return `[${timestamp()}] [${level}] [${agent}] ${message}`;
}

/**
 * Calculate task summary statistics
 */
function calculateSummary(tasks) {
  const summary = {
    total_tasks: tasks.length,
    completed: 0,
    in_progress: 0,
    blocked: 0,
    queued: 0,
    completion_percent: 0
  };

  tasks.forEach(task => {
    summary[task.status] = (summary[task.status] || 0) + 1;
  });

  if (summary.total_tasks > 0) {
    summary.completion_percent = Math.round((summary.completed / summary.total_tasks) * 100);
  }

  return summary;
}

/**
 * Update task progress randomly
 */
function updateTaskProgress(task) {
  if (task.status === 'in_progress' && task.progress < 100) {
    // Randomly increase progress by 1-10%
    task.progress = Math.min(100, task.progress + randomInt(1, 10));

    // Complete task if progress reaches 100%
    if (task.progress === 100) {
      task.status = 'completed';
      task.completed_at = timestamp();
      console.log(`  ${LOG_LEVELS.SUCCESS} Task completed: ${task.title}`);
    }
  }

  // Sometimes unblock blocked tasks
  if (task.status === 'blocked' && Math.random() > 0.9) {
    task.status = 'in_progress';
    delete task.blocker;
    console.log(`  ${LOG_LEVELS.INFO} Task unblocked: ${task.title}`);
  }

  // Sometimes start queued tasks
  if (task.status === 'queued' && Math.random() > 0.85) {
    task.status = 'in_progress';
    task.started_at = timestamp();
    console.log(`  ${LOG_LEVELS.INFO} Task started: ${task.title}`);
  }

  return task;
}

/**
 * Generate metrics data
 */
function generateMetrics(tasks) {
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');

  return {
    timestamp: timestamp(),
    uptime_seconds: Math.floor(process.uptime()),
    tasks_processed: completedTasks.length,
    success_rate: tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 100,
    average_task_duration_ms: randomInt(5000, 30000),
    active_agents: inProgressTasks.length,
    errors_count: randomInt(0, 5),
    system: {
      cpu_usage: randomInt(10, 70),
      memory_usage_mb: randomInt(200, 800),
      disk_usage_percent: randomInt(30, 60)
    }
  };
}

/**
 * Generate thinking stream for an agent
 */
function generateThinkingStream(agentType) {
  const thoughts = [];
  const now = new Date();
  const thoughtTypes = ['analysis', 'discovery', 'action', 'implementation', 'testing', 'thinking', 'idle'];

  const thoughtTemplates = {
    analysis: [
      'Analyzing {component} structure...',
      'Examining {count} dependencies...',
      'Reviewing code patterns in {module}...'
    ],
    discovery: [
      'Found {count} {issues} that need attention',
      'Identified optimization opportunity in {component}',
      'Discovered pattern violation in {module}'
    ],
    action: [
      'Creating {artifact} for {component}...',
      'Implementing {feature} with {approach}...',
      'Refactoring {module} to improve {metric}...'
    ],
    implementation: [
      'Writing {type} for {component}...',
      'Building {feature} module...',
      'Integrating {service} with {component}...'
    ],
    testing: [
      'Running {type} tests for {component}...',
      'Validating {feature} functionality...',
      'Testing edge cases for {module}...'
    ],
    thinking: [
      'Considering approach for {problem}...',
      'Evaluating trade-offs for {solution}...',
      'Planning implementation strategy...'
    ],
    idle: [
      'Waiting for task assignment...',
      'Ready for next operation...',
      'Standing by...'
    ]
  };

  // Generate 3-5 recent thoughts
  const thoughtCount = randomInt(3, 5);
  for (let i = 0; i < thoughtCount; i++) {
    const thoughtType = randomPick(thoughtTypes);
    const template = randomPick(thoughtTemplates[thoughtType]);

    const thought = template
      .replace('{component}', randomPick(['payment service', 'auth module', 'API gateway', 'database layer']))
      .replace('{count}', randomInt(5, 20))
      .replace('{issues}', randomPick(['type errors', 'vulnerabilities', 'performance bottlenecks']))
      .replace('{module}', randomPick(['UserService', 'PaymentProcessor', 'AuthHandler', 'DataValidator']))
      .replace('{artifact}', randomPick(['interface', 'type definition', 'test suite', 'documentation']))
      .replace('{feature}', randomPick(['retry logic', 'rate limiting', 'caching layer', 'error handling']))
      .replace('{approach}', randomPick(['TDD', 'functional composition', 'dependency injection']))
      .replace('{metric}', randomPick(['performance', 'type safety', 'maintainability', 'testability']))
      .replace('{type}', randomPick(['unit', 'integration', 'E2E', 'performance']))
      .replace('{service}', randomPick(['Redis', 'PostgreSQL', 'Kafka', 'Elasticsearch']))
      .replace('{problem}', randomPick(['scaling issue', 'race condition', 'memory leak', 'type mismatch']))
      .replace('{solution}', randomPick(['caching strategy', 'async pattern', 'state management', 'error boundary']));

    thoughts.push({
      timestamp: new Date(now - (thoughtCount - i) * 5000).toISOString(),
      thought: thought,
      type: thoughtType
    });
  }

  return thoughts;
}

/**
 * Generate agent data
 */
function generateAgentsData(tasks) {
  const agentTypes = {
    'OrchestratorAgent': 'orchestrator',
    'RefactorAgent': 'backend',
    'TestAgent': 'testing',
    'DocumentationAgent': 'documentation',
    'SecurityAgent': 'security',
    'PerformanceAgent': 'performance'
  };

  const agents = [];
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  // Create orchestrator agent
  const orchestrator = {
    id: 'agent-001',
    name: 'project-orchestrator',
    type: 'orchestrator',
    status: 'active',
    parent_agent: null,
    sub_agents: ['agent-002', 'agent-003', 'agent-004'],
    current_task: inProgressTasks.length > 0 ? {
      id: inProgressTasks[0].id,
      name: inProgressTasks[0].title,
      progress: inProgressTasks[0].progress
    } : null,
    started_at: new Date(Date.now() - randomInt(600000, 3600000)).toISOString(),
    last_activity: new Date().toISOString(),
    thinking: generateThinkingStream('orchestrator'),
    metrics: {
      tasks_completed: completedTasks.length,
      tasks_in_progress: inProgressTasks.length,
      average_task_time: `${randomInt(10, 30)}m ${randomInt(0, 59)}s`,
      success_rate: randomInt(95, 100)
    }
  };
  agents.push(orchestrator);

  // Create sub-agents
  AGENTS.slice(1, 4).forEach((agentName, index) => {
    const agentId = `agent-00${index + 2}`;
    const agentTasks = tasks.filter(t => t.agent === agentName);
    const agentInProgress = agentTasks.filter(t => t.status === 'in_progress');
    const agentCompleted = agentTasks.filter(t => t.status === 'completed');

    const agent = {
      id: agentId,
      name: agentName.toLowerCase().replace('agent', '-worker'),
      type: agentTypes[agentName] || 'worker',
      status: agentInProgress.length > 0 ? 'active' : 'idle',
      parent_agent: 'agent-001',
      sub_agents: [],
      current_task: agentInProgress.length > 0 ? {
        id: agentInProgress[0].id,
        name: agentInProgress[0].title,
        progress: agentInProgress[0].progress
      } : null,
      started_at: new Date(Date.now() - randomInt(300000, 1800000)).toISOString(),
      last_activity: agentInProgress.length > 0 ? new Date().toISOString() :
                     new Date(Date.now() - randomInt(60000, 300000)).toISOString(),
      thinking: generateThinkingStream(agentTypes[agentName] || 'worker'),
      metrics: {
        tasks_completed: agentCompleted.length,
        tasks_in_progress: agentInProgress.length,
        average_task_time: `${randomInt(5, 20)}m ${randomInt(0, 59)}s`,
        success_rate: randomInt(90, 100)
      }
    };
    agents.push(agent);
  });

  const activeAgents = agents.filter(a => a.status === 'active').length;
  const idleAgents = agents.filter(a => a.status === 'idle').length;
  const totalCompleted = agents.reduce((sum, a) => sum + a.metrics.tasks_completed, 0);
  const totalInProgress = agents.reduce((sum, a) => sum + a.metrics.tasks_in_progress, 0);

  return {
    timestamp: new Date().toISOString(),
    agents: agents,
    summary: {
      total_agents: agents.length,
      active_agents: activeAgents,
      idle_agents: idleAgents,
      total_tasks_completed: totalCompleted,
      total_tasks_in_progress: totalInProgress
    }
  };
}

/**
 * Update agents file
 */
async function updateAgents(tasks) {
  const agentsData = generateAgentsData(tasks);
  await fs.writeFile(FILES.agents, JSON.stringify(agentsData, null, 2));
}

/**
 * Initialize test data
 */
async function initializeTestData() {
  console.log('🧪 Test Data Generator - Initializing...\n');

  // Ensure data directory exists
  await fs.mkdir(DATA_DIR, { recursive: true });

  // Create initial tasks
  const tasks = TASK_TEMPLATES.map(t => ({
    ...t,
    created_at: new Date(Date.now() - randomInt(3600000, 86400000)).toISOString(),
    started_at: t.status !== 'queued' ? new Date(Date.now() - randomInt(1800000, 7200000)).toISOString() : undefined,
    completed_at: t.status === 'completed' ? new Date(Date.now() - randomInt(0, 3600000)).toISOString() : undefined,
    estimated_duration_ms: randomInt(300000, 3600000)
  }));

  const tasksData = {
    project_id: 'sovren-refactoring',
    started_at: new Date(Date.now() - 86400000).toISOString(),
    current_phase: 'implementation',
    phases: {
      planning: {
        status: 'completed',
        started_at: new Date(Date.now() - 86400000).toISOString(),
        completed_at: new Date(Date.now() - 43200000).toISOString(),
        tasks: []
      },
      implementation: {
        status: 'in_progress',
        started_at: new Date(Date.now() - 43200000).toISOString(),
        tasks: tasks
      }
    },
    summary: calculateSummary(tasks)
  };

  // Write initial tasks
  await fs.writeFile(FILES.tasks, JSON.stringify(tasksData, null, 2));
  console.log(`✓ Created tasks.json with ${tasks.length} tasks`);

  // Write initial log
  const initialLog = `[${timestamp()}] [INFO] [SYSTEM] Test data generator started\n`;
  await fs.writeFile(FILES.logs, initialLog);
  console.log('✓ Created orchestration.log');

  // Write initial metrics
  const metrics = generateMetrics(tasks);
  await fs.writeFile(FILES.metrics, JSON.stringify(metrics, null, 2));
  console.log('✓ Created metrics.json');

  // Write initial agents
  const agents = generateAgentsData(tasks);
  await fs.writeFile(FILES.agents, JSON.stringify(agents, null, 2));
  console.log(`✓ Created agents.json with ${agents.agents.length} agents`);

  console.log('\n✅ Initialization complete!\n');

  return tasksData;
}

/**
 * Append log entry
 */
async function appendLog(message) {
  await fs.appendFile(FILES.logs, message + '\n');
}

/**
 * Update tasks file
 */
async function updateTasks(tasksData) {
  await fs.writeFile(FILES.tasks, JSON.stringify(tasksData, null, 2));
}

/**
 * Update metrics file
 */
async function updateMetrics(tasks) {
  const metrics = generateMetrics(tasks);
  await fs.writeFile(FILES.metrics, JSON.stringify(metrics, null, 2));
}

/**
 * Main simulation loop
 */
async function simulate() {
  let tasksData = await initializeTestData();
  let iteration = 0;

  console.log('🔄 Starting continuous simulation...');
  console.log('📝 Generating logs and updating tasks every 2-3 seconds');
  console.log('Press Ctrl+C to stop\n');

  const interval = setInterval(async () => {
    iteration++;
    console.log(`\n--- Iteration ${iteration} ---`);

    // Generate 1-3 log messages
    const logCount = randomInt(1, 3);
    for (let i = 0; i < logCount; i++) {
      const logMessage = generateLogMessage();
      await appendLog(logMessage);
      console.log(`  📝 ${logMessage}`);
    }

    // Update task progress
    const tasks = tasksData.phases.implementation.tasks;
    const updatedTasks = tasks.map(updateTaskProgress);
    tasksData.phases.implementation.tasks = updatedTasks;
    tasksData.summary = calculateSummary(updatedTasks);

    // Update tasks file
    await updateTasks(tasksData);

    // Update metrics
    await updateMetrics(updatedTasks);
    console.log(`  📊 Metrics updated`);

    // Update agents
    await updateAgents(updatedTasks);
    console.log(`  🤖 Agents updated`);

    // Show summary
    const { completed, in_progress, blocked, queued } = tasksData.summary;
    console.log(`  📈 Tasks: ${completed} completed, ${in_progress} in progress, ${blocked} blocked, ${queued} queued`);

  }, randomInt(2000, 3000)); // Random interval between 2-3 seconds

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n⚠️  Shutting down test data generator...');
    clearInterval(interval);

    // Write final log
    await appendLog(`[${timestamp()}] [INFO] [SYSTEM] Test data generator stopped`);
    console.log('✓ Final log entry written');
    console.log('✅ Shutdown complete\n');

    process.exit(0);
  });
}

// Start simulation
simulate().catch(error => {
  console.error('✗ Fatal error:', error);
  process.exit(1);
});
