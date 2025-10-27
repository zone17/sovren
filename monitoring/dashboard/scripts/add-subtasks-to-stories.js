#!/usr/bin/env node

/**
 * Add Detailed Subtasks to User Stories
 *
 * Each user story now includes a detailed list of subtasks in the correct order
 * of operations that the custom agent (or human engineer) needs to complete.
 *
 * Subtask Format:
 * - Sequential order (step 1, 2, 3, etc.)
 * - Clear, actionable description
 * - Status tracking (pending, in_progress, completed)
 * - Progress calculation based on completed subtasks
 */

const fs = require('fs');
const path = require('path');

const TASKS_FILE = path.join(__dirname, '../data/tasks.json');

console.log('📝 Adding detailed subtasks to user stories...\n');

// Example subtask definitions for Epic 003 stories
const storySubtasks = {
  'US-309': {
    name: 'Remove Hardcoded Relay URLs',
    subtasks: [
      { order: 1, description: 'Audit codebase for all hardcoded relay URLs', status: 'completed' },
      { order: 2, description: 'Create centralized relay configuration file (shared/config/relays.ts)', status: 'completed' },
      { order: 3, description: 'Define relay configuration interface and types', status: 'in_progress' },
      { order: 4, description: 'Implement environment variable support for relay URLs', status: 'pending' },
      { order: 5, description: 'Create default relay list for development environment', status: 'pending' },
      { order: 6, description: 'Update all services to use centralized relay config', status: 'pending' },
      { order: 7, description: 'Write unit tests for relay configuration', status: 'pending' },
      { order: 8, description: 'Update documentation with relay configuration guide', status: 'pending' }
    ]
  },

  'US-310': {
    name: 'NIP-19 Encoding Utilities',
    subtasks: [
      { order: 1, description: 'Install nip19 encoding dependencies', status: 'completed' },
      { order: 2, description: 'Create NIP19 utility module (shared/utils/nip19.ts)', status: 'completed' },
      { order: 3, description: 'Implement npub encoding/decoding functions', status: 'in_progress' },
      { order: 4, description: 'Implement nsec encoding/decoding functions', status: 'pending' },
      { order: 5, description: 'Implement note encoding/decoding functions', status: 'pending' },
      { order: 6, description: 'Implement nprofile encoding/decoding functions', status: 'pending' },
      { order: 7, description: 'Add input validation and error handling', status: 'pending' },
      { order: 8, description: 'Write comprehensive unit tests (95%+ coverage)', status: 'pending' },
      { order: 9, description: 'Create usage examples and documentation', status: 'pending' }
    ]
  },

  'US-311': {
    name: 'Create Unified NOSTR Session Management',
    subtasks: [
      { order: 1, description: 'Design session state interface and types', status: 'completed' },
      { order: 2, description: 'Create SessionManager service class', status: 'completed' },
      { order: 3, description: 'Implement session creation and initialization', status: 'in_progress' },
      { order: 4, description: 'Add session persistence to localStorage', status: 'pending' },
      { order: 5, description: 'Implement session expiry and refresh logic', status: 'pending' },
      { order: 6, description: 'Add multi-relay session support', status: 'pending' },
      { order: 7, description: 'Implement session event listeners and callbacks', status: 'pending' },
      { order: 8, description: 'Write integration tests with real relay connections', status: 'pending' },
      { order: 9, description: 'Add session debugging and monitoring hooks', status: 'pending' },
      { order: 10, description: 'Document session management API', status: 'pending' }
    ]
  },

  'US-313': {
    name: 'NIP-04 Encrypted DM Support',
    subtasks: [
      { order: 1, description: 'Install NIP-04 encryption dependencies', status: 'completed' },
      { order: 2, description: 'Create EncryptedDMService module', status: 'completed' },
      { order: 3, description: 'Implement message encryption function', status: 'in_progress' },
      { order: 4, description: 'Implement message decryption function', status: 'pending' },
      { order: 5, description: 'Add key derivation for shared secrets', status: 'pending' },
      { order: 6, description: 'Implement DM sending logic with proper event structure', status: 'pending' },
      { order: 7, description: 'Implement DM receiving and decryption flow', status: 'pending' },
      { order: 8, description: 'Add error handling for decryption failures', status: 'pending' },
      { order: 9, description: 'Write security tests for encryption/decryption', status: 'pending' },
      { order: 10, description: 'Create DM UI components (send/receive)', status: 'pending' },
      { order: 11, description: 'Add DM thread management', status: 'pending' },
      { order: 12, description: 'Document encrypted DM usage and security considerations', status: 'pending' }
    ]
  },

  'US-316': {
    name: 'NOSTR Monitoring Service',
    subtasks: [
      { order: 1, description: 'Design monitoring metrics and events structure', status: 'completed' },
      { order: 2, description: 'Create MonitoringService class', status: 'in_progress' },
      { order: 3, description: 'Implement relay connection health checks', status: 'pending' },
      { order: 4, description: 'Add event publishing success/failure tracking', status: 'pending' },
      { order: 5, description: 'Implement subscription monitoring', status: 'pending' },
      { order: 6, description: 'Add performance metrics (latency, throughput)', status: 'pending' },
      { order: 7, description: 'Create monitoring dashboard component', status: 'pending' },
      { order: 8, description: 'Implement alerting for connection failures', status: 'pending' },
      { order: 9, description: 'Add metrics export to monitoring systems', status: 'pending' },
      { order: 10, description: 'Write monitoring service tests', status: 'pending' }
    ]
  },

  'US-317': {
    name: 'Implement NOSTR Caching Layer',
    subtasks: [
      { order: 1, description: 'Design cache schema and invalidation strategy', status: 'completed' },
      { order: 2, description: 'Create EventCacheService using React Query', status: 'in_progress' },
      { order: 3, description: 'Implement event caching with TTL', status: 'pending' },
      { order: 4, description: 'Add cache invalidation on new events', status: 'pending' },
      { order: 5, description: 'Implement profile caching', status: 'pending' },
      { order: 6, description: 'Add metadata caching for NIP-05 verification', status: 'pending' },
      { order: 7, description: 'Implement cache persistence to IndexedDB', status: 'pending' },
      { order: 8, description: 'Add cache size limits and LRU eviction', status: 'pending' },
      { order: 9, description: 'Write cache performance tests', status: 'pending' },
      { order: 10, description: 'Document caching strategy and configuration', status: 'pending' }
    ]
  },

  'US-318': {
    name: 'Comprehensive Integration Tests',
    subtasks: [
      { order: 1, description: 'Set up integration test framework (Playwright)', status: 'pending' },
      { order: 2, description: 'Create test relay mock/stub', status: 'pending' },
      { order: 3, description: 'Write E2E test for NOSTR event publishing', status: 'pending' },
      { order: 4, description: 'Write E2E test for event subscription flow', status: 'pending' },
      { order: 5, description: 'Write E2E test for NIP-05 verification', status: 'pending' },
      { order: 6, description: 'Write E2E test for encrypted DM flow', status: 'pending' },
      { order: 7, description: 'Add tests for relay failover', status: 'pending' },
      { order: 8, description: 'Add tests for offline/online transitions', status: 'pending' },
      { order: 9, description: 'Set up CI/CD pipeline for integration tests', status: 'pending' },
      { order: 10, description: 'Document integration test patterns', status: 'pending' }
    ]
  },

  'US-319': {
    name: 'Implement Error Handling UI',
    subtasks: [
      { order: 1, description: 'Design error notification component', status: 'pending' },
      { order: 2, description: 'Create ErrorBoundary component for NOSTR errors', status: 'pending' },
      { order: 3, description: 'Implement toast notifications for transient errors', status: 'pending' },
      { order: 4, description: 'Add connection status indicator UI', status: 'pending' },
      { order: 5, description: 'Create retry mechanism with user feedback', status: 'pending' },
      { order: 6, description: 'Add error logging and reporting', status: 'pending' },
      { order: 7, description: 'Implement graceful degradation for offline mode', status: 'pending' },
      { order: 8, description: 'Write accessibility tests for error UI', status: 'pending' }
    ]
  },

  'US-320': {
    name: 'WebSocket Connection Manager',
    subtasks: [
      { order: 1, description: 'Design connection manager architecture', status: 'pending' },
      { order: 2, description: 'Create WebSocketManager class', status: 'pending' },
      { order: 3, description: 'Implement connection pooling for multiple relays', status: 'pending' },
      { order: 4, description: 'Add automatic reconnection with exponential backoff', status: 'pending' },
      { order: 5, description: 'Implement heartbeat/ping-pong for connection health', status: 'pending' },
      { order: 6, description: 'Add connection state management (connecting, open, closing, closed)', status: 'pending' },
      { order: 7, description: 'Implement message queuing for disconnected state', status: 'pending' },
      { order: 8, description: 'Add connection lifecycle event emitters', status: 'pending' },
      { order: 9, description: 'Write connection manager tests with WebSocket mocks', status: 'pending' },
      { order: 10, description: 'Document connection manager API', status: 'pending' }
    ]
  }
};

// Read tasks.json
let tasksData;
try {
  tasksData = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
} catch (error) {
  console.error('❌ Error reading tasks.json:', error.message);
  process.exit(1);
}

const tasks = tasksData.phases['active-development'].tasks;
let updatedCount = 0;

// Update stories with subtasks
tasks.forEach(task => {
  if (task.type === 'story' && task.story_id && storySubtasks[task.story_id]) {
    const subtaskConfig = storySubtasks[task.story_id];

    // Add subtasks to the story
    task.subtasks = subtaskConfig.subtasks;

    // Calculate completion percentage based on subtasks
    const totalSubtasks = task.subtasks.length;
    const completedSubtasks = task.subtasks.filter(st => st.status === 'completed').length;
    task.progress_percent = Math.round((completedSubtasks / totalSubtasks) * 100);

    // Update overall status based on subtask progress
    if (completedSubtasks === 0) {
      task.status = 'pending';
    } else if (completedSubtasks === totalSubtasks) {
      task.status = 'testing'; // Move to testing when all subtasks done
    } else {
      task.status = 'in_progress';
    }

    updatedCount++;
    console.log(`✅ ${task.story_id}: ${task.name}`);
    console.log(`   Subtasks: ${completedSubtasks}/${totalSubtasks} (${task.progress_percent}%)`);
    console.log(`   Status: ${task.status}\n`);
  }
});

// Save updated data
fs.writeFileSync(TASKS_FILE, JSON.stringify(tasksData, null, 2));

console.log(`\n✅ Updated ${updatedCount} stories with detailed subtasks`);
console.log(`💾 Saved to ${TASKS_FILE}\n`);

console.log('📊 Subtask Summary:');
console.log('   Each story now has:');
console.log('   - Sequential subtasks (in order of operations)');
console.log('   - Status tracking (pending, in_progress, completed)');
console.log('   - Automatic progress calculation');
console.log('   - Real-time completion percentage\n');
