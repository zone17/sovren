#!/usr/bin/env node
/**
 * Live Sync - Real-time Dashboard Updater
 *
 * Run this while watching the orchestrator work in Cursor
 * Press keys to update the dashboard in real-time
 */

const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

const dataDir = './data';

// Configure readline for keypress events
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

let currentEpic = '001';
let currentStory = 1;
let storyProgress = 0;

async function getCurrentData() {
  try {
    const tasksData = await fs.readFile(path.join(dataDir, 'tasks.json'), 'utf8');
    return JSON.parse(tasksData);
  } catch (error) {
    return null;
  }
}

async function updateTaskProgress(taskId, status, progress) {
  const data = await getCurrentData();
  if (!data) return;

  let task = data.tasks.find((t) => t.id === taskId);

  if (!task) {
    // Create new task
    task = {
      id: taskId,
      name: `Epic ${currentEpic} Story #${currentStory}`,
      epic: `Epic ${currentEpic}`,
      agent: 'ORCHESTRATOR',
      status,
      progress,
      phase: 'PHASE 3',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      output: status === 'completed' ? ['Completed'] : [],
    };
    data.tasks.push(task);
    data.summary.total_tasks++;
  } else {
    const oldStatus = task.status;
    task.status = status;
    task.progress = progress;
    task.updated_at = new Date().toISOString();

    // Update summary counts
    if (oldStatus === 'in_progress') data.summary.in_progress--;
    if (oldStatus === 'queued') data.summary.queued--;
    if (oldStatus === 'completed') data.summary.completed--;
  }

  // Update summary counts
  if (status === 'in_progress') data.summary.in_progress++;
  if (status === 'queued') data.summary.queued++;
  if (status === 'completed') {
    data.summary.completed++;
    task.output = ['Completed'];
  }

  data.summary.completion_percent = Math.round(
    (data.summary.completed / data.summary.total_tasks) * 100
  );

  data.last_updated = new Date().toISOString();

  await fs.writeFile(path.join(dataDir, 'tasks.json'), JSON.stringify(data, null, 2));

  await fs.appendFile(
    path.join(dataDir, 'orchestration.log'),
    `[${new Date().toISOString()}] [${status === 'completed' ? 'SUCCESS' : 'INFO'}] [ORCHESTRATOR] ${task.name} - ${status} (${progress}%)\n`
  );

  return task;
}

function displayHelp() {
  console.clear();
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          🎯 Live Dashboard Sync - Quick Keys              ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║                                                            ║');
  console.log(
    '║  Current: Epic',
    currentEpic,
    'Story #' + currentStory.toString().padStart(2, '0'),
    '                             ║'
  );
  console.log('║  Progress:', storyProgress + '%', '                                            ║');
  console.log('║                                                            ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║  QUICK ACTIONS:                                            ║');
  console.log('║                                                            ║');
  console.log('║  [SPACE]  Complete current story & move to next            ║');
  console.log('║  [+]      Increase progress by 10%                         ║');
  console.log('║  [-]      Decrease progress by 10%                         ║');
  console.log('║  [N]      Next story (keep current progress)               ║');
  console.log('║  [P]      Previous story                                   ║');
  console.log('║  [S]      Start current story (set to in_progress)         ║');
  console.log('║  [C]      Complete current story (100%)                    ║');
  console.log('║                                                            ║');
  console.log('║  [1-5]    Switch to Epic 001-005                           ║');
  console.log('║  [H]      Show this help                                   ║');
  console.log('║  [Q]      Quit                                             ║');
  console.log('║                                                            ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║  WORKFLOW:                                                 ║');
  console.log('║  1. Watch orchestrator in Cursor                           ║');
  console.log('║  2. Press [S] when story starts                            ║');
  console.log('║  3. Press [+] as progress increases                        ║');
  console.log('║  4. Press [SPACE] when story completes                     ║');
  console.log('║  5. Dashboard updates instantly!                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n📊 Dashboard: http://localhost:3000\n');
}

async function handleKeypress(str, key) {
  if (key.ctrl && key.name === 'c') {
    process.exit(0);
  }

  const taskId = `epic-${currentEpic}-story-${currentStory}`;

  switch (key.name) {
    case 'q':
      console.log('\n👋 Goodbye!\n');
      process.exit(0);
      break;

    case 'h':
      displayHelp();
      break;

    case 'space':
      // Complete current and move to next
      await updateTaskProgress(taskId, 'completed', 100);
      console.log(`✅ Completed: Epic ${currentEpic} Story #${currentStory}`);
      currentStory++;
      storyProgress = 0;
      displayHelp();
      break;

    case 's':
      // Start current story
      storyProgress = 10;
      await updateTaskProgress(taskId, 'in_progress', storyProgress);
      console.log(`🔄 Started: Epic ${currentEpic} Story #${currentStory} (${storyProgress}%)`);
      displayHelp();
      break;

    case 'c':
      // Complete current story
      storyProgress = 100;
      await updateTaskProgress(taskId, 'completed', storyProgress);
      console.log(`✅ Completed: Epic ${currentEpic} Story #${currentStory}`);
      displayHelp();
      break;

    case 'n':
      // Next story
      currentStory++;
      storyProgress = 0;
      console.log(`➡️  Moved to: Epic ${currentEpic} Story #${currentStory}`);
      displayHelp();
      break;

    case 'p':
      // Previous story
      if (currentStory > 1) {
        currentStory--;
        console.log(`⬅️  Moved to: Epic ${currentEpic} Story #${currentStory}`);
        displayHelp();
      }
      break;

    case 'return':
    case 'up':
      // Increase progress
      storyProgress = Math.min(100, storyProgress + 10);
      await updateTaskProgress(taskId, 'in_progress', storyProgress);
      console.log(`📈 Progress: Epic ${currentEpic} Story #${currentStory} → ${storyProgress}%`);
      displayHelp();
      break;

    case 'down':
      // Decrease progress
      storyProgress = Math.max(0, storyProgress - 10);
      await updateTaskProgress(taskId, 'in_progress', storyProgress);
      console.log(`📉 Progress: Epic ${currentEpic} Story #${currentStory} → ${storyProgress}%`);
      displayHelp();
      break;

    case '1':
    case '2':
    case '3':
    case '4':
    case '5':
      currentEpic = '00' + key.name;
      currentStory = 1;
      storyProgress = 0;
      console.log(`🎯 Switched to Epic ${currentEpic}`);
      displayHelp();
      break;
  }
}

process.stdin.on('keypress', handleKeypress);

console.log('🚀 Starting Live Dashboard Sync...\n');
setTimeout(() => {
  displayHelp();
}, 500);

process.on('SIGINT', () => {
  console.log('\n\n👋 Goodbye!\n');
  process.exit(0);
});
