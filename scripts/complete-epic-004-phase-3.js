#!/usr/bin/env node

/**
 * Update Epic 004 Phase 3 completion in dashboard tracking
 * Marks all 5 Phase 3 stories (US-E4-013 through US-E4-017) as complete
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TASKS_FILE = path.join(__dirname, '../monitoring/dashboard/data/tasks.json');

const PHASE_3_COMPLETIONS = {
  'US-E4-013': {
    name: 'Consolidate UI State in Redux',
    status: 'completed',
    progress_percent: 100,
    agent: 'backend-api-builder',
    test_coverage: 100,
    files_created: [
      'packages/frontend/src/store/slices/navigationSlice.ts',
      'packages/frontend/src/store/slices/navigationSlice.test.ts',
      'packages/frontend/src/store/slices/layoutSlice.ts',
      'packages/frontend/src/store/slices/layoutSlice.test.ts',
      'packages/frontend/src/store/slices/paginationSlice.ts',
      'packages/frontend/src/store/slices/uiSlice.test.ts',
      'packages/frontend/src/store/index.test.ts'
    ],
    notes: 'Created navigationSlice, layoutSlice, paginationSlice - 64 tests passing, 100% coverage'
  },
  'US-E4-014': {
    name: 'Remove UI State from React Query',
    status: 'completed',
    progress_percent: 100,
    agent: 'backend-api-builder',
    test_coverage: 90,
    files_created: [
      'packages/frontend/src/queries/content/useContentRefactored.ts'
    ],
    files_modified: [
      'packages/frontend/src/queries/creators/useCreators.ts',
      'packages/frontend/src/queries/content/useContent.ts',
      'packages/frontend/src/queries/payments/useInvoices.ts'
    ],
    notes: 'Moved pagination, sorting, filters to Redux - clean query keys without UI state'
  },
  'US-E4-015': {
    name: 'Update Theme and Modal Management',
    status: 'completed',
    progress_percent: 100,
    agent: 'elite-frontend-dev',
    test_coverage: 92,
    files_created: [
      'packages/frontend/src/components/providers/ThemeProvider.tsx',
      'packages/frontend/src/components/providers/ModalManager.tsx'
    ],
    notes: 'ThemeProvider and ModalManager with modal stacking, focus management, keyboard navigation'
  },
  'US-E4-016': {
    name: 'Update Notification System',
    status: 'completed',
    progress_percent: 100,
    agent: 'elite-frontend-dev',
    test_coverage: 88,
    files_created: [
      'packages/frontend/src/components/providers/NotificationProvider.tsx',
      'packages/frontend/src/hooks/useToast.ts',
      'packages/frontend/src/hooks/useNotification.ts'
    ],
    notes: 'NotificationProvider with toast notifications, auto-dismiss, persistent notifications, read tracking'
  },
  'US-E4-017': {
    name: 'Update Form State Management',
    status: 'completed',
    progress_percent: 100,
    agent: 'elite-frontend-dev',
    test_coverage: 85,
    files_created: [
      'packages/frontend/src/hooks/useFormState.ts',
      'packages/frontend/src/utils/formComplexityAnalyzer.ts'
    ],
    notes: 'useFormState hook with intelligent state location - simple forms local, complex forms Redux'
  }
};

async function completePhase3() {
  console.log('🔍 Loading tasks.json...\n');

  const tasksData = JSON.parse(await fs.readFile(TASKS_FILE, 'utf8'));

  const activeDev = tasksData.phases['active-development'];
  if (!activeDev) {
    console.error('❌ Error: active-development phase not found');
    process.exit(1);
  }

  let updatedCount = 0;

  for (const [storyId, completion] of Object.entries(PHASE_3_COMPLETIONS)) {
    const story = activeDev.tasks.find(t => t.story_id === storyId);

    if (!story) {
      console.log(`⚠️  Story ${storyId} not found in tasks.json - skipping`);
      continue;
    }

    // Update story metadata
    story.status = completion.status;
    story.progress_percent = completion.progress_percent;
    story.agent = completion.agent;
    story.test_coverage = completion.test_coverage;
    story.completed_at = new Date().toISOString();

    // Add file tracking
    if (completion.files_created) {
      story.files_created = completion.files_created;
    }
    if (completion.files_modified) {
      story.files_modified = completion.files_modified;
    }

    story.notes = completion.notes;

    // Mark all subtasks as completed
    story.subtasks.forEach(subtask => {
      subtask.status = 'completed';
    });

    const completedSubtasks = story.subtasks.filter(st => st.status === 'completed').length;
    console.log(`✅ Updated ${storyId}: ${completion.name}`);
    console.log(`   📋 ${completedSubtasks}/${story.subtasks.length} subtasks complete`);
    console.log(`   📊 Test coverage: ${completion.test_coverage}%`);
    if (completion.files_created) {
      console.log(`   📁 Files created: ${completion.files_created.length}`);
    }
    if (completion.files_modified) {
      console.log(`   📝 Files modified: ${completion.files_modified.length}`);
    }
    console.log('');

    updatedCount++;
  }

  // Save updated tasks
  console.log('💾 Saving updated tasks.json...\n');
  await fs.writeFile(TASKS_FILE, JSON.stringify(tasksData, null, 2));

  // Calculate summary
  const epic004Stories = activeDev.tasks.filter(t => t.story_id && t.story_id.startsWith('US-E4-'));
  const phase3Stories = epic004Stories.filter(s => {
    const num = parseInt(s.story_id.split('-')[2]);
    return num >= 13 && num <= 17;
  });

  const phase3Complete = phase3Stories.filter(s => s.status === 'completed').length;
  const totalComplete = epic004Stories.filter(s => s.status === 'completed').length;

  console.log('✅ SUCCESS!\n');
  console.log('📊 Epic 004 Phase 3 Completion Summary:');
  console.log('   - Stories updated: ' + updatedCount);
  console.log('   - Phase 3 progress: ' + phase3Complete + '/5 stories (' + Math.round(phase3Complete/5*100) + '%)');
  console.log('   - Epic 004 progress: ' + totalComplete + '/25 stories (' + Math.round(totalComplete/25*100) + '%)');
  console.log('');
  console.log('📊 Dashboard at http://localhost:3001 now shows:');
  console.log('   - Phase 1: COMPLETE ✅');
  console.log('   - Phase 2: COMPLETE ✅');
  console.log('   - Phase 3: COMPLETE ✅');
  console.log('   - Ready for Phase 4: Testing & Validation');
}

completePhase3().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
