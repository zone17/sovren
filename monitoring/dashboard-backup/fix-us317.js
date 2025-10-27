#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the current tasks data
const dataPath = path.join(__dirname, 'data', 'tasks.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log('=== Fixing US-317 False Completion Status ===\n');

// Find and fix US-317
const task = data.phases['active-development'].tasks.find(t => t.story_id === 'US-317');

if (task && task.subtasks) {
  const completedCount = task.subtasks.filter(st => st.status === 'completed').length;
  const inProgressCount = task.subtasks.filter(st => st.status === 'in_progress').length;
  const totalCount = task.subtasks.length;

  const oldStatus = task.status;
  const oldProgress = task.progress_percent;

  // Calculate true progress
  task.progress_percent = Math.round((completedCount / totalCount) * 100);

  // Determine true status based on subtasks
  if (completedCount === totalCount) {
    task.status = 'completed';
  } else if (completedCount > 0 || inProgressCount > 0) {
    task.status = 'in_progress';
    task.completed_at = null;
    if (!task.started_at) {
      task.started_at = new Date().toISOString();
    }
  } else {
    task.status = 'pending';
    task.completed_at = null;
    task.started_at = null;
  }

  console.log(`Story US-317: Implement NOSTR Caching Layer`);
  console.log(`  Old: ${oldStatus} (${oldProgress}%)`);
  console.log(`  New: ${task.status} (${task.progress_percent}%)`);
  console.log(`  Subtasks: ${completedCount}/${totalCount} complete`);

  // Check if the actual code exists
  const cacheServicePath = '/Users/fp/Desktop/Sovren/packages/frontend/src/services/nostr/EventCacheService.ts';
  const fileExists = fs.existsSync(cacheServicePath);

  if (fileExists) {
    const stats = fs.statSync(cacheServicePath);
    console.log(`  ✅ EventCacheService.ts EXISTS (${stats.size} bytes)`);
    console.log(`  ⚠️ BUT: Only ${completedCount}/${totalCount} subtasks are actually complete!`);
  } else {
    console.log(`  ❌ EventCacheService.ts DOES NOT EXIST`);
  }

  console.log(`\n  Reality Check:`);
  console.log(`  - Subtasks claiming complete but file exists suggests partial implementation`);
  console.log(`  - Need to verify which subtasks are ACTUALLY implemented in the code`);
  console.log(`  - ${totalCount - completedCount} subtasks still need work\n`);
}

// Update Epic 003 again with corrected US-317
const epic003 = data.phases['active-development'].tasks.find(t => t.id === 'epic-003-parent');
if (epic003) {
  const epic003Stories = data.phases['active-development'].tasks.filter(t =>
    t.epic_label === 'Epic 003: NOSTR' && t.type === 'story'
  );

  const completedStories = epic003Stories.filter(s => s.status === 'completed').length;
  const inProgressStories = epic003Stories.filter(s => s.status === 'in_progress').length;
  const totalStories = epic003Stories.length;

  epic003.name = `Epic 003: NOSTR Consolidation - ${completedStories}/${totalStories} complete`;
  epic003.progress_percent = Math.round((completedStories / totalStories) * 100);

  console.log('Updated Epic 003 Status:');
  console.log(`  Completed: ${completedStories} stories`);
  console.log(`  In Progress: ${inProgressStories} stories (including US-317)`);
  console.log(`  Total: ${totalStories} stories`);
  console.log(`  True Progress: ${epic003.progress_percent}%\n`);
}

// Save the corrected data
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
console.log('✅ US-317 status corrected in dashboard');
console.log('✅ Dashboard now reflects TRUE implementation status');