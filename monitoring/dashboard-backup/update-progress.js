#!/usr/bin/env node
/**
 * Manual Progress Updater
 *
 * Use this to manually update the dashboard with orchestrator progress
 * when the orchestrator is running in Cursor chat context
 */

const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

const dataDir = './data';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function getCurrentData() {
  try {
    const tasksData = await fs.readFile(path.join(dataDir, 'tasks.json'), 'utf8');
    const metricsData = await fs.readFile(path.join(dataDir, 'metrics.json'), 'utf8');
    return {
      tasks: JSON.parse(tasksData),
      metrics: JSON.parse(metricsData),
    };
  } catch (error) {
    return null;
  }
}

async function addTask(epic, storyNum, description, status = 'queued', progress = 0) {
  const data = await getCurrentData();
  if (!data) return;

  const task = {
    id: `epic-${epic}-story-${storyNum}`,
    name: `Epic ${epic} Story #${storyNum}: ${description}`,
    epic: `Epic ${epic.padStart(3, '0')}`,
    agent: 'ORCHESTRATOR',
    status,
    progress,
    phase: 'PHASE 3',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    output: status === 'completed' ? ['Completed'] : [],
  };

  data.tasks.tasks.push(task);
  data.tasks.summary.total_tasks++;

  if (status === 'completed') data.tasks.summary.completed++;
  else if (status === 'in_progress') data.tasks.summary.in_progress++;
  else if (status === 'queued') data.tasks.summary.queued++;

  data.tasks.summary.completion_percent = Math.round(
    (data.tasks.summary.completed / data.tasks.summary.total_tasks) * 100
  );

  await fs.writeFile(path.join(dataDir, 'tasks.json'), JSON.stringify(data.tasks, null, 2));

  await fs.appendFile(
    path.join(dataDir, 'orchestration.log'),
    `[${new Date().toISOString()}] [INFO] [ORCHESTRATOR] ${task.name} - ${status}\n`
  );

  console.log(`✅ Added: ${task.name}`);
}

async function updateTaskStatus(taskId, status, progress) {
  const data = await getCurrentData();
  if (!data) return;

  const task = data.tasks.tasks.find((t) => t.id === taskId);
  if (!task) {
    console.log(`❌ Task ${taskId} not found`);
    return;
  }

  const oldStatus = task.status;
  task.status = status;
  task.progress = progress;
  task.updated_at = new Date().toISOString();

  // Update summary counts
  if (oldStatus === 'in_progress') data.tasks.summary.in_progress--;
  if (oldStatus === 'queued') data.tasks.summary.queued--;
  if (oldStatus === 'completed') data.tasks.summary.completed--;

  if (status === 'in_progress') data.tasks.summary.in_progress++;
  if (status === 'queued') data.tasks.summary.queued++;
  if (status === 'completed') {
    data.tasks.summary.completed++;
    task.output = ['Completed'];
  }

  data.tasks.summary.completion_percent = Math.round(
    (data.tasks.summary.completed / data.tasks.summary.total_tasks) * 100
  );

  await fs.writeFile(path.join(dataDir, 'tasks.json'), JSON.stringify(data.tasks, null, 2));

  await fs.appendFile(
    path.join(dataDir, 'orchestration.log'),
    `[${new Date().toISOString()}] [${status === 'completed' ? 'SUCCESS' : 'INFO'}] [ORCHESTRATOR] ${task.name} - ${status} (${progress}%)\n`
  );

  console.log(`✅ Updated: ${task.name} -> ${status} (${progress}%)`);
}

async function showMenu() {
  console.log('\n🎯 Orchestrator Progress Updater');
  console.log('================================');
  console.log('1. Mark story as completed');
  console.log('2. Update story progress');
  console.log('3. Add new story');
  console.log('4. Show current status');
  console.log('5. Exit');
  console.log('================================\n');

  const choice = await question('Choose an option: ');

  switch (choice) {
    case '1':
      const completeEpic = await question('Epic number (001-005): ');
      const completeStory = await question('Story number: ');
      await updateTaskStatus(`epic-${completeEpic}-story-${completeStory}`, 'completed', 100);
      break;

    case '2':
      const updateEpic = await question('Epic number (001-005): ');
      const updateStory = await question('Story number: ');
      const progress = await question('Progress (0-100): ');
      await updateTaskStatus(
        `epic-${updateEpic}-story-${updateStory}`,
        'in_progress',
        parseInt(progress)
      );
      break;

    case '3':
      const newEpic = await question('Epic number (001-005): ');
      const newStory = await question('Story number: ');
      const description = await question('Description: ');
      const status = await question('Status (queued/in_progress/completed): ');
      const newProgress = status === 'completed' ? 100 : status === 'in_progress' ? 50 : 0;
      await addTask(newEpic, newStory, description, status, newProgress);
      break;

    case '4':
      const data = await getCurrentData();
      if (data) {
        console.log('\n📊 Current Status:');
        console.log(`Total Tasks: ${data.tasks.summary.total_tasks}`);
        console.log(`✅ Completed: ${data.tasks.summary.completed}`);
        console.log(`🔄 In Progress: ${data.tasks.summary.in_progress}`);
        console.log(`⏳ Queued: ${data.tasks.summary.queued}`);
        console.log(`Progress: ${data.tasks.summary.completion_percent}%`);
      }
      break;

    case '5':
      rl.close();
      return;
  }

  await showMenu();
}

// Quick update mode via command line args
async function quickUpdate() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    await showMenu();
    return;
  }

  const [action, epic, story, ...rest] = args;

  if (action === 'complete') {
    await updateTaskStatus(`epic-${epic}-story-${story}`, 'completed', 100);
  } else if (action === 'progress') {
    const progress = parseInt(rest[0]) || 50;
    await updateTaskStatus(`epic-${epic}-story-${story}`, 'in_progress', progress);
  } else if (action === 'add') {
    const description = rest.join(' ');
    await addTask(epic, story, description, 'queued', 0);
  } else {
    console.log('Usage:');
    console.log('  node update-progress.js complete 001 5');
    console.log('  node update-progress.js progress 001 6 75');
    console.log('  node update-progress.js add 001 13 "New story description"');
    console.log('  node update-progress.js (interactive mode)');
  }

  rl.close();
}

quickUpdate().catch((error) => {
  console.error('Error:', error);
  rl.close();
  process.exit(1);
});
