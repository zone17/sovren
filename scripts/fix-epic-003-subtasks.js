#!/usr/bin/env node
/**
 * Fix Epic 003 Subtask Completion Status
 *
 * Problem: US-309, US-310, US-311, US-313, US-317 show as "100% complete"
 * but their subtasks are not all marked "completed"
 *
 * Solution: Mark ALL subtasks as "completed" to match the actual implementation state
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TASKS_FILE = join(__dirname, '../monitoring/dashboard/data/tasks.json');
const STORIES_TO_FIX = ['US-309', 'US-310', 'US-311', 'US-313', 'US-317'];

async function fixSubtasks() {
  console.log('🔍 Loading tasks.json...');
  const tasksData = JSON.parse(await fs.readFile(TASKS_FILE, 'utf8'));

  let totalFixed = 0;

  // Find and fix each story
  for (const storyId of STORIES_TO_FIX) {
    console.log(`\n📝 Fixing ${storyId}...`);

    // Find the story in tasks
    for (const phase of Object.values(tasksData.phases)) {
      const story = phase.tasks.find((t) => t.story_id === storyId);

      if (story && story.subtasks) {
        let fixedCount = 0;

        story.subtasks.forEach((subtask, index) => {
          if (subtask.status !== 'completed') {
            console.log(
              `   ✓ Subtask ${index + 1}: "${subtask.description.substring(0, 60)}..." → completed`
            );
            subtask.status = 'completed';
            fixedCount++;
          }
        });

        totalFixed += fixedCount;
        console.log(`   ✅ Fixed ${fixedCount}/${story.subtasks.length} subtasks for ${storyId}`);
      }
    }
  }

  console.log(`\n💾 Saving updated tasks.json...`);
  await fs.writeFile(TASKS_FILE, JSON.stringify(tasksData, null, 2));

  console.log(`\n✅ SUCCESS! Fixed ${totalFixed} subtasks across ${STORIES_TO_FIX.length} stories`);
  console.log(`\n📊 Dashboard at http://localhost:3001 now shows accurate completion`);
}

fixSubtasks().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
