#!/usr/bin/env node

/**
 * Verify Kanban Board Data
 * Confirms all 26 Epic 003 stories are properly categorized
 */

const fs = require('fs');
const path = require('path');

const TASKS_FILE = path.join(__dirname, '../data/tasks.json');

function verifyKanbanData() {
  console.log('🔍 Verifying Kanban Board Data...\n');

  // Read tasks.json
  const tasksData = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
  const tasks = tasksData.phases['active-development'].tasks;

  // Filter story-level tasks (same logic as app.js)
  const stories = tasks.filter(task => task.type === 'story');

  console.log(`✓ Found ${stories.length} total stories in tasks.json\n`);

  // Categorize stories by status (matching app.js logic)
  const todoStories = stories.filter(s =>
    s.status === 'pending' || s.status === 'queued'
  );

  const inProgressStories = stories.filter(s =>
    s.status === 'in_progress' || s.status === 'active'
  );

  const testingStories = stories.filter(s =>
    s.status === 'testing' || s.status === 'review'
  );

  const completedStories = stories.filter(s =>
    s.status === 'completed' || s.status === 'done'
  );

  // Display results
  console.log('═'.repeat(80));
  console.log('KANBAN BOARD VERIFICATION');
  console.log('═'.repeat(80));
  console.log('');

  // To Do Lane
  console.log(`📝 TO DO LANE: ${todoStories.length} stories`);
  console.log('─'.repeat(80));
  if (todoStories.length > 0) {
    todoStories.forEach(s => {
      const priority = s.priority || '??';
      const agent = s.agent_type || 'unassigned';
      console.log(`   ${s.story_id}: ${s.description || s.name} (${priority}, ${agent})`);
    });
  } else {
    console.log('   (Empty - This is the problem!)');
  }
  console.log('');

  // In Progress Lane
  console.log(`🔄 IN PROGRESS LANE: ${inProgressStories.length} stories`);
  console.log('─'.repeat(80));
  inProgressStories.forEach(s => {
    const agent = s.agent || 'unassigned';
    const progress = s.progress_percent || 0;
    console.log(`   ${s.story_id}: ${s.description || s.name} (${agent}, ${progress}%)`);
  });
  console.log('');

  // Testing Lane
  console.log(`🔬 TESTING LANE: ${testingStories.length} stories`);
  console.log('─'.repeat(80));
  if (testingStories.length > 0) {
    testingStories.forEach(s => {
      console.log(`   ${s.story_id}: ${s.description || s.name}`);
    });
  } else {
    console.log('   (Empty)');
  }
  console.log('');

  // Complete Lane
  console.log(`✅ COMPLETE LANE: ${completedStories.length} stories`);
  console.log('─'.repeat(80));
  completedStories.forEach(s => {
    const completedAt = s.completed_at ? new Date(s.completed_at).toLocaleDateString() : 'unknown';
    console.log(`   ${s.story_id}: ${s.description || s.name} (${completedAt})`);
  });
  console.log('');

  console.log('═'.repeat(80));
  console.log('SUMMARY');
  console.log('═'.repeat(80));
  console.log(`Total Stories:     ${stories.length} / 26 expected`);
  console.log(`To Do:             ${todoStories.length}`);
  console.log(`In Progress:       ${inProgressStories.length}`);
  console.log(`Testing:           ${testingStories.length}`);
  console.log(`Completed:         ${completedStories.length}`);
  console.log('');

  // Validation
  const allExpected = 26;
  const allFound = stories.length;

  if (allFound === allExpected) {
    console.log('✅ SUCCESS! All 26 Epic 003 stories are present in tasks.json');

    if (todoStories.length > 0) {
      console.log(`✅ SUCCESS! To Do lane has ${todoStories.length} stories (backlog is visible!)`);
    } else {
      console.log('⚠️  WARNING! To Do lane is empty (backlog not showing)');
    }
  } else {
    console.log(`⚠️  WARNING! Expected 26 stories, found ${allFound}`);
    console.log('   Missing stories will not appear in the Kanban board.');
  }

  console.log('');
  console.log('🎯 Next step: Force refresh the dashboard (Cmd+Shift+R or Ctrl+Shift+R)');
  console.log('');
}

// Run verification
verifyKanbanData();
