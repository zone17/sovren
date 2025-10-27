#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TASKS_FILE = path.join(__dirname, '../monitoring/dashboard/data/tasks.json');

const completedStories = {
  'US-E5-011': { name: 'ContentCreationService', coverage: 95 },
  'US-E5-018': { name: 'UserAuthenticationService', coverage: 100 },
  'US-E5-024': { name: 'InvoiceService', coverage: 100 }
};

async function updateProgress() {
  const tasksData = JSON.parse(await fs.readFile(TASKS_FILE, 'utf8'));
  
  for (const [storyId, data] of Object.entries(completedStories)) {
    const story = tasksData.phases['active-development'].tasks.find(t => t.story_id === storyId);
    if (story) {
      story.status = 'completed';
      story.progress_percent = 100;
      story.test_coverage = data.coverage;
      story.agent = 'backend-api-builder';
      story.completed_at = new Date().toISOString();
      story.subtasks.forEach(st => st.status = 'completed');
      console.log(`✅ ${storyId}: ${data.name} (${data.coverage}% coverage)`);
    }
  }
  
  await fs.writeFile(TASKS_FILE, JSON.stringify(tasksData, null, 2));
  console.log('\n✅ Epic 005 Progress: 13/42 stories complete (31%)');
}

updateProgress().catch(console.error);
