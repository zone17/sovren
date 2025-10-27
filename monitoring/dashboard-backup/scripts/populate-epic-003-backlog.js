#!/usr/bin/env node

/**
 * Populate Epic 003 backlog with all 26 user stories
 * This script ensures all user stories appear in the Kanban board
 */

const fs = require('fs');
const path = require('path');

const TASKS_FILE = path.join(__dirname, '../data/tasks.json');

// All 26 Epic 003 user stories with their details
const EPIC_003_STORIES = [
  // Stream A: Backend NOSTR Services
  { id: 'US-301', name: 'Consolidate NOSTR Key Management Services', agent_type: 'backend', priority: 'P0' },
  { id: 'US-305', name: 'Unify NOSTR Authentication Services', agent_type: 'backend', priority: 'P0' },
  { id: 'US-304', name: 'Consolidate NIP-05 Verification Services', agent_type: 'backend', priority: 'P1' },
  { id: 'US-311', name: 'Create Unified NOSTR Session Management', agent_type: 'backend', priority: 'P1' },
  { id: 'US-321', name: 'Implement NOSTR Rate Limiting', agent_type: 'backend', priority: 'P2' },

  // Stream B: Frontend NOSTR Components
  { id: 'US-302', name: 'Unify Relay Pool Management', agent_type: 'frontend', priority: 'P0' },
  { id: 'US-306', name: 'Standardize Browser Extension Integration', agent_type: 'frontend', priority: 'P1' },
  { id: 'US-314', name: 'Create Unified Profile Management', agent_type: 'frontend', priority: 'P1' },
  { id: 'US-317', name: 'Implement NOSTR Caching Layer', agent_type: 'frontend', priority: 'P2' },
  { id: 'US-319', name: 'Implement Error Handling UI', agent_type: 'frontend', priority: 'P2' },

  // Stream C: Shared Types & Utilities
  { id: 'US-308', name: 'Comprehensive NOSTR Types', agent_type: 'backend', priority: 'P0' },
  { id: 'US-310', name: 'NIP-19 Encoding Utilities', agent_type: 'backend', priority: 'P1' },
  { id: 'US-312', name: 'Consolidate Cryptography Operations', agent_type: 'backend', priority: 'P1' },
  { id: 'US-313', name: 'NIP-04 Encrypted DM Support', agent_type: 'backend', priority: 'P1' },
  { id: 'US-315', name: 'NIP-26 Delegated Events', agent_type: 'backend', priority: 'P2' },

  // Stream D: Testing & Documentation
  { id: 'US-309', name: 'Remove Hardcoded Relay URLs', agent_type: 'backend', priority: 'P1' },
  { id: 'US-318', name: 'Comprehensive Integration Tests', agent_type: 'testing', priority: 'P1' },
  { id: 'US-323', name: 'NOSTR Architecture Diagrams', agent_type: 'documentation', priority: 'P0' },
  { id: 'US-324', name: 'Developer Documentation', agent_type: 'documentation', priority: 'P1' },
  { id: 'US-326', name: 'E2E Test Suite', agent_type: 'testing', priority: 'P2' },

  // Stream E: Monitoring & Migration
  { id: 'US-316', name: 'NOSTR Monitoring Service', agent_type: 'monitoring', priority: 'P1' },
  { id: 'US-320', name: 'WebSocket Connection Manager', agent_type: 'backend', priority: 'P1' },
  { id: 'US-322', name: 'Backup and Recovery System', agent_type: 'backend', priority: 'P2' },
  { id: 'US-325', name: 'Migration Scripts', agent_type: 'backend', priority: 'P2' },

  // Additional stories
  { id: 'US-303', name: 'Event Publisher Service', agent_type: 'backend', priority: 'P1' },
  { id: 'US-307', name: 'Event Deduplication', agent_type: 'backend', priority: 'P1' },
];

function addMissingStoriesToBacklog() {
  console.log('📋 Populating Epic 003 backlog with all 26 user stories...\n');

  // Read current tasks.json
  const tasksData = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));

  // Get existing story IDs
  const existingStoryIds = new Set();
  const tasks = tasksData.phases['active-development'].tasks;

  tasks.forEach(task => {
    if (task.type === 'story' && task.story_id) {
      existingStoryIds.add(task.story_id);
    }
  });

  console.log(`✓ Found ${existingStoryIds.size} existing stories in tasks.json`);
  console.log(`  Existing: ${Array.from(existingStoryIds).sort().join(', ')}\n`);

  // Find missing stories
  const missingStories = EPIC_003_STORIES.filter(story => !existingStoryIds.has(story.id));

  if (missingStories.length === 0) {
    console.log('✓ All 26 stories already exist in tasks.json!');
    return;
  }

  console.log(`📝 Adding ${missingStories.length} missing stories to backlog:\n`);

  // Add missing stories with "pending" status
  const timestamp = Date.now();
  missingStories.forEach((story, index) => {
    const storyTask = {
      id: `story-${story.id.toLowerCase()}-backlog-${timestamp + index}`,
      type: 'story',
      story_id: story.id,
      name: `${story.id}: ${story.name}`,
      description: story.name,
      agent: 'unassigned',
      status: 'pending',
      progress_percent: 0,
      started_at: null,
      completed_at: null,
      files_modified: [],
      test_coverage: null,
      agent_type: story.agent_type,
      priority: story.priority,
      epic_label: 'Epic 003: NOSTR'
    };

    tasks.push(storyTask);
    console.log(`  ✓ ${story.id}: ${story.name} (${story.priority}, ${story.agent_type})`);
  });

  // Update summary counts
  const storyTasks = tasks.filter(t => t.type === 'story');
  const pendingStories = storyTasks.filter(t => t.status === 'pending');
  const inProgressStories = storyTasks.filter(t => t.status === 'in_progress');
  const completedStories = storyTasks.filter(t => t.status === 'completed');

  tasksData.summary.total_tasks = tasks.length;
  tasksData.summary.queued = pendingStories.length;
  tasksData.summary.in_progress = inProgressStories.length;
  tasksData.summary.completed = completedStories.length;

  // Write updated tasks.json
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasksData, null, 2));

  console.log(`\n✅ SUCCESS! Added ${missingStories.length} stories to backlog`);
  console.log(`\n📊 Epic 003 Story Status:`);
  console.log(`   - To Do (Pending):   ${pendingStories.length} stories`);
  console.log(`   - In Progress:       ${inProgressStories.length} stories`);
  console.log(`   - Completed:         ${completedStories.length} stories`);
  console.log(`   - TOTAL:             ${storyTasks.length} stories`);
  console.log(`\n🎯 Kanban board will now show all ${storyTasks.length} Epic 003 stories!`);
}

// Run the script
addMissingStoriesToBacklog();
