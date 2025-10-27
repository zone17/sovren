/**
 * Sovren Monitoring Dashboard - Real-time Backend Server
 *
 * Features:
 * - Express server serving static files
 * - Socket.IO for real-time bidirectional communication
 * - Chokidar file watching for automatic updates
 * - Graceful shutdown handling
 * - RESTful API endpoint for status checks
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const chokidar = require('chokidar');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');

// File paths
const FILES = {
  tasks: path.join(DATA_DIR, 'tasks.json'),
  logs: path.join(DATA_DIR, 'orchestration.log'),
  metrics: path.join(DATA_DIR, 'metrics.json'),
  agents: path.join(DATA_DIR, 'agents.json')
};

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// In-memory data cache
let currentData = {
  tasks: null,
  logs: null,
  metrics: null,
  agents: null
};

// Debounce timers for file changes
const debounceTimers = {
  tasks: null,
  logs: null,
  metrics: null,
  agents: null
};

/**
 * Create default tasks.json structure
 */
function getDefaultTasks() {
  return {
    project_id: 'sovren-refactoring',
    started_at: new Date().toISOString(),
    current_phase: 'planning',
    phases: {
      planning: {
        status: 'in_progress',
        started_at: new Date().toISOString(),
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
}

/**
 * Create default metrics.json structure
 */
function getDefaultMetrics() {
  return {
    timestamp: new Date().toISOString(),
    uptime_seconds: 0,
    tasks_processed: 0,
    success_rate: 100,
    average_task_duration_ms: 0,
    active_agents: 0,
    errors_count: 0,
    system: {
      cpu_usage: 0,
      memory_usage_mb: 0,
      disk_usage_percent: 0
    }
  };
}

/**
 * Get default log message
 */
function getDefaultLog() {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [INFO] [SYSTEM] Monitoring dashboard initialized - Welcome to Sovren Agent Orchestration\n`;
}

/**
 * Create default agents.json structure
 */
function getDefaultAgents() {
  return {
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
}

/**
 * Ensure data directory and files exist
 */
async function initializeDataFiles() {
  try {
    // Create data directory if it doesn't exist
    await fs.mkdir(DATA_DIR, { recursive: true });
    console.log(`✓ Data directory: ${DATA_DIR}`);

    // Initialize tasks.json
    try {
      await fs.access(FILES.tasks);
      console.log('✓ tasks.json exists');
    } catch {
      await fs.writeFile(FILES.tasks, JSON.stringify(getDefaultTasks(), null, 2));
      console.log('✓ Created default tasks.json');
    }

    // Initialize orchestration.log
    try {
      await fs.access(FILES.logs);
      console.log('✓ orchestration.log exists');
    } catch {
      await fs.writeFile(FILES.logs, getDefaultLog());
      console.log('✓ Created default orchestration.log');
    }

    // Initialize metrics.json
    try {
      await fs.access(FILES.metrics);
      console.log('✓ metrics.json exists');
    } catch {
      await fs.writeFile(FILES.metrics, JSON.stringify(getDefaultMetrics(), null, 2));
      console.log('✓ Created default metrics.json');
    }

    // Initialize agents.json
    try {
      await fs.access(FILES.agents);
      console.log('✓ agents.json exists');
    } catch {
      await fs.writeFile(FILES.agents, JSON.stringify(getDefaultAgents(), null, 2));
      console.log('✓ Created default agents.json');
    }

    // Load initial data into cache
    await loadAllData();
    console.log('✓ Initial data loaded into cache');

  } catch (error) {
    console.error('✗ Error initializing data files:', error.message);
    throw error;
  }
}

/**
 * Load all data files into cache
 */
async function loadAllData() {
  try {
    // Load tasks
    const tasksContent = await fs.readFile(FILES.tasks, 'utf-8');
    currentData.tasks = JSON.parse(tasksContent);

    // Load logs (last 100 lines for performance)
    const logsContent = await fs.readFile(FILES.logs, 'utf-8');
    const logLines = logsContent.split('\n').filter(line => line.trim());
    currentData.logs = logLines.slice(-100).join('\n');

    // Load metrics
    const metricsContent = await fs.readFile(FILES.metrics, 'utf-8');
    currentData.metrics = JSON.parse(metricsContent);

    // Load agents
    const agentsContent = await fs.readFile(FILES.agents, 'utf-8');
    currentData.agents = JSON.parse(agentsContent);

  } catch (error) {
    console.error('✗ Error loading data:', error.message);
    // Keep existing cache on error
  }
}

/**
 * Read and parse JSON file with error handling
 */
async function readJsonFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`✗ Error reading ${path.basename(filePath)}:`, error.message);
    return null;
  }
}

/**
 * Read log file with error handling (last 100 lines)
 */
async function readLogFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    return lines.slice(-100).join('\n');
  } catch (error) {
    console.error(`✗ Error reading ${path.basename(filePath)}:`, error.message);
    return '';
  }
}

/**
 * Handle file change with debouncing
 */
function handleFileChange(fileType, filePath) {
  // Clear existing timer
  if (debounceTimers[fileType]) {
    clearTimeout(debounceTimers[fileType]);
  }

  // Set new debounced handler (100ms stability threshold)
  debounceTimers[fileType] = setTimeout(async () => {
    console.log(`📝 File changed: ${path.basename(filePath)}`);

    try {
      let data;
      let eventName;

      switch (fileType) {
        case 'tasks':
          data = await readJsonFile(filePath);
          currentData.tasks = data;
          eventName = 'tasks-update';
          break;

        case 'logs':
          data = await readLogFile(filePath);
          currentData.logs = data;
          eventName = 'logs-update';
          break;

        case 'metrics':
          data = await readJsonFile(filePath);
          currentData.metrics = data;
          eventName = 'metrics-update';
          break;

        case 'agents':
          data = await readJsonFile(filePath);
          currentData.agents = data;
          eventName = 'agents-update';
          break;

        default:
          console.warn(`Unknown file type: ${fileType}`);
          return;
      }

      if (data !== null || fileType === 'logs') {
        // Emit update to all connected clients
        io.emit(eventName, data);
        console.log(`✓ Emitted ${eventName} to ${io.engine.clientsCount} client(s)`);
      }

    } catch (error) {
      console.error(`✗ Error processing ${fileType} change:`, error.message);
    }
  }, 100);
}

/**
 * Initialize file watchers
 */
function initializeFileWatchers() {
  console.log('\n📡 Initializing file watchers...');

  // Watch tasks.json
  const tasksWatcher = chokidar.watch(FILES.tasks, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50
    }
  });

  tasksWatcher.on('change', () => handleFileChange('tasks', FILES.tasks));
  tasksWatcher.on('error', error => console.error('✗ Tasks watcher error:', error));
  console.log(`✓ Watching: ${path.basename(FILES.tasks)}`);

  // Watch orchestration.log
  const logsWatcher = chokidar.watch(FILES.logs, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50
    }
  });

  logsWatcher.on('change', () => handleFileChange('logs', FILES.logs));
  logsWatcher.on('error', error => console.error('✗ Logs watcher error:', error));
  console.log(`✓ Watching: ${path.basename(FILES.logs)}`);

  // Watch metrics.json
  const metricsWatcher = chokidar.watch(FILES.metrics, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50
    }
  });

  metricsWatcher.on('change', () => handleFileChange('metrics', FILES.metrics));
  metricsWatcher.on('error', error => console.error('✗ Metrics watcher error:', error));
  console.log(`✓ Watching: ${path.basename(FILES.metrics)}`);

  // Watch agents.json
  const agentsWatcher = chokidar.watch(FILES.agents, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50
    }
  });

  agentsWatcher.on('change', () => handleFileChange('agents', FILES.agents));
  agentsWatcher.on('error', error => console.error('✗ Agents watcher error:', error));
  console.log(`✓ Watching: ${path.basename(FILES.agents)}`);

  return { tasksWatcher, logsWatcher, metricsWatcher, agentsWatcher };
}

/**
 * Socket.IO connection handler
 */
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id} (Total: ${io.engine.clientsCount})`);

  // Send initial data immediately
  socket.emit('initial-data', currentData);
  console.log(`✓ Sent initial data to ${socket.id}`);

  // Handle refresh requests
  socket.on('request-refresh', async () => {
    console.log(`🔄 Refresh requested by ${socket.id}`);
    await loadAllData();
    socket.emit('initial-data', currentData);
  });

  // Handle save-task-data (for subtask updates)
  socket.on('save-task-data', async (data) => {
    console.log(`💾 Save task data requested by ${socket.id}`);
    try {
      // Write to tasks.json
      fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2));
      console.log('✅ Task data saved successfully');

      // Update currentData
      currentData = data;

      // Broadcast update to all connected clients
      io.emit('data-update', data);
      console.log('📡 Broadcast data update to all clients');
    } catch (error) {
      console.error('❌ Error saving task data:', error);
      socket.emit('save-error', { message: error.message });
    }
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log(`🔌 Client disconnected: ${socket.id} (Reason: ${reason}, Remaining: ${io.engine.clientsCount})`);
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error(`✗ Socket error from ${socket.id}:`, error.message);
  });
});

/**
 * REST API endpoint for status check
 */
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    connected_clients: io.engine.clientsCount,
    data: currentData
  });
});

/**
 * API endpoint for agent data
 */
app.get('/api/agents', (req, res) => {
  res.json(currentData.agents || getDefaultAgents());
});

/**
 * API endpoint for specific agent's thinking
 */
app.get('/api/agents/:id/thinking', (req, res) => {
  const agentData = currentData.agents || getDefaultAgents();
  const agent = agentData.agents?.find(a => a.id === req.params.id);
  res.json(agent ? agent.thinking : []);
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal) {
  console.log(`\n⚠️  ${signal} received, shutting down gracefully...`);

  // Close Socket.IO connections
  io.close(() => {
    console.log('✓ Socket.IO connections closed');
  });

  // Close HTTP server
  server.close(() => {
    console.log('✓ HTTP server closed');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('✗ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

/**
 * Start server
 */
async function startServer() {
  try {
    console.log('🚀 Sovren Monitoring Dashboard Server');
    console.log('=====================================\n');

    // Initialize data files
    await initializeDataFiles();

    // Initialize file watchers
    const watchers = initializeFileWatchers();

    // Start HTTP server
    server.listen(PORT, () => {
      console.log('\n✅ Server started successfully!');
      console.log(`📍 HTTP Server: http://localhost:${PORT}`);
      console.log(`📍 API Status: http://localhost:${PORT}/api/status`);
      console.log(`📍 Socket.IO: Ready for connections`);
      console.log('\n👀 Monitoring files for changes...');
      console.log('Press Ctrl+C to stop\n');
    });

    // Register shutdown handlers
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  } catch (error) {
    console.error('✗ Fatal error starting server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
