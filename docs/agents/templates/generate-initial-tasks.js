/**
 * Generate Initial Tasks from PRD
 *
 * This script extracts epics and user stories from a PRD file and generates
 * the initial tasks.json file for the Agent Orchestration Dashboard.
 *
 * Usage:
 *   node generate-initial-tasks.js [prd-file-path] [project-name]
 *
 * Example:
 *   node generate-initial-tasks.js ../../SOVREN_PRD.md "Sovren Platform"
 */

const fs = require('fs');
const path = require('path');

// Configuration
const PRD_FILE = process.argv[2] || '../../SOVREN_PRD.md';
const PROJECT_NAME = process.argv[3] || 'Your Project';
const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'tasks.json');

console.log('╔═══════════════════════════════════════════════════════╗');
console.log('║   Task Generation from PRD                           ║');
console.log('╚═══════════════════════════════════════════════════════╝\n');

console.log(`📖 Reading PRD: ${PRD_FILE}`);
console.log(`📝 Project Name: ${PROJECT_NAME}`);
console.log(`💾 Output File: ${OUTPUT_FILE}\n`);

// Read PRD file
let prdContent;
try {
  prdContent = fs.readFileSync(PRD_FILE, 'utf-8');
  console.log(`✅ Successfully read PRD file (${prdContent.length} characters)`);
} catch (error) {
  console.error(`❌ Error reading PRD file: ${error.message}`);
  console.error('Please ensure the PRD file exists and the path is correct.');
  process.exit(1);
}

// Parse epics
const epicRegex = /##\s*Epic\s+(\d+):\s*(.+)/gi;
const epicMatches = [...prdContent.matchAll(epicRegex)];

const epics = epicMatches.map((match) => ({
  number: match[1].padStart(3, '0'),
  name: match[2].trim(),
}));

console.log(`\n📊 Found ${epics.length} epics:`);
epics.forEach((epic) => {
  console.log(`   - Epic ${epic.number}: ${epic.name}`);
});

// Parse user stories
const storyRegex = /-\s*\[.\]\s*US-(\d+):\s*(.+)/gi;
const storyMatches = [...prdContent.matchAll(storyRegex)];

const stories = storyMatches.map((match) => {
  const storyNum = match[1];
  const storyTitle = match[2].trim();

  // Determine epic based on story number ranges
  let epicLabel = '';
  const num = parseInt(storyNum);

  if (num >= 101 && num <= 112) {
    epicLabel = 'Epic 001: Type Safety';
  } else if (num >= 201 && num <= 218) {
    epicLabel = 'Epic 002: Payment Processing';
  } else if (num >= 301 && num <= 326) {
    epicLabel = 'Epic 003: NOSTR Consolidation';
  } else if (num >= 401 && num <= 425) {
    epicLabel = 'Epic 004: State Management';
  } else if (num >= 501 && num <= 599) {
    epicLabel = 'Epic 005: Backend Services';
  }

  return {
    id: `story-us-${storyNum}`,
    type: 'story',
    story_id: `US-${storyNum}`,
    name: `US-${storyNum}: ${storyTitle}`,
    agent: 'unassigned',
    agent_type: 'general',
    status: 'pending',
    progress_percent: 0,
    started_at: null,
    completed_at: null,
    epic_label: epicLabel,
    priority: 'P2',
    subtasks: [],
  };
});

console.log(`\n📝 Found ${stories.length} user stories`);

// Group stories by epic
const storiesByEpic = {};
stories.forEach((story) => {
  const epicLabel = story.epic_label || 'No Epic';
  if (!storiesByEpic[epicLabel]) {
    storiesByEpic[epicLabel] = [];
  }
  storiesByEpic[epicLabel].push(story);
});

console.log('\n📦 Stories by epic:');
Object.entries(storiesByEpic).forEach(([epicLabel, epicStories]) => {
  console.log(`   - ${epicLabel}: ${epicStories.length} stories`);
});

// Create epic parent tasks
const epicParentTasks = epics.map((epic) => {
  const epicLabel = `Epic ${epic.number}: ${epic.name}`;
  const epicStories = storiesByEpic[epicLabel] || [];
  const completedStories = epicStories.filter((s) => s.status === 'completed').length;
  const totalStories = epicStories.length;
  const progressPercent =
    totalStories > 0 ? Math.round((completedStories / totalStories) * 100) : 0;

  return {
    id: `epic-${epic.number}-parent`,
    type: 'epic',
    name: `${epicLabel} - ${completedStories}/${totalStories} complete`,
    agent: 'project-orchestrator',
    agent_type: 'orchestrator',
    status: completedStories === totalStories ? 'completed' : 'pending',
    progress_percent: progressPercent,
    started_at: null,
    completed_at: null,
  };
});

// Generate tasks.json structure
const taskData = {
  project_name: PROJECT_NAME,
  started_at: new Date().toISOString(),
  current_phase: 'active-development',
  phases: {
    'active-development': {
      status: 'in_progress',
      started_at: new Date().toISOString(),
      tasks: [...epicParentTasks, ...stories],
    },
  },
  summary: {
    total_tasks: stories.length,
    completed: stories.filter((s) => s.status === 'completed').length,
    in_progress: stories.filter((s) => s.status === 'in_progress').length,
    blocked: stories.filter((s) => s.status === 'blocked').length,
    queued: stories.filter((s) => s.status === 'pending').length,
    completion_percent:
      stories.length > 0
        ? Math.round(
            (stories.filter((s) => s.status === 'completed').length / stories.length) * 100
          )
        : 0,
  },
};

// Ensure data directory exists
const dataDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log(`\n📁 Created data directory: ${dataDir}`);
}

// Write tasks.json
try {
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(taskData, null, 2));
  console.log(`\n✅ Successfully generated tasks.json`);
  console.log(`   Location: ${OUTPUT_FILE}`);
  console.log(`   Size: ${fs.statSync(OUTPUT_FILE).size} bytes`);
} catch (error) {
  console.error(`\n❌ Error writing tasks.json: ${error.message}`);
  process.exit(1);
}

// Summary
console.log('\n╔═══════════════════════════════════════════════════════╗');
console.log('║   Generation Summary                                 ║');
console.log('╚═══════════════════════════════════════════════════════╝');
console.log(`\n📊 Statistics:`);
console.log(`   - Epics: ${epics.length}`);
console.log(`   - User Stories: ${stories.length}`);
console.log(`   - Total Tasks: ${epicParentTasks.length + stories.length}`);
console.log(`   - Overall Progress: ${taskData.summary.completion_percent}%`);

console.log(`\n✅ Task generation complete!`);
console.log(`\nNext steps:`);
console.log(`   1. Review data/tasks.json for accuracy`);
console.log(`   2. Run 'node add-subtasks-to-stories.js' to add detailed subtasks`);
console.log(`   3. Start the dashboard with 'npm start'`);
console.log(`   4. Open http://localhost:3001 in your browser\n`);
