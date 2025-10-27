#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the current tasks data
const dataPath = path.join(__dirname, 'data', 'tasks.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Stories that were falsely marked as complete
const storiesToFix = ['US-309', 'US-310', 'US-311', 'US-313'];

console.log('=== Fixing False Completion Status ===\n');

// Fix each story's status based on actual subtask completion
data.phases['active-development'].tasks.forEach(task => {
  if (task.story_id && storiesToFix.includes(task.story_id)) {
    if (task.subtasks && task.subtasks.length > 0) {
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

      console.log(`Story ${task.story_id}:`);
      console.log(`  Old: ${oldStatus} (${oldProgress}%)`);
      console.log(`  New: ${task.status} (${task.progress_percent}%)`);
      console.log(`  Subtasks: ${completedCount}/${totalCount} complete`);
      console.log(`  Reality: ${totalCount - completedCount} subtasks still need work\n`);
    }
  }
});

// Update Epic 003 parent task to reflect true completion
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

  console.log('Epic 003 Status:');
  console.log(`  Completed: ${completedStories} stories`);
  console.log(`  In Progress: ${inProgressStories} stories`);
  console.log(`  Total: ${totalStories} stories`);
  console.log(`  Progress: ${epic003.progress_percent}%\n`);
}

// Save the corrected data
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
console.log('✅ Dashboard data updated with TRUE completion status');
console.log('✅ False claims have been corrected');
console.log('\n=== Next Steps ===');
console.log('1. Launch backend-api-builder agent to complete remaining subtasks');
console.log('2. Monitor subtask completion in real-time');
console.log('3. Only mark stories complete when ALL subtasks are done');