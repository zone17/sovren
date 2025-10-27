const fs = require('fs');
const filePath = '/Users/fp/Desktop/Sovren/monitoring/dashboard/data/tasks.json';
const data = JSON.parse(fs.readFileSync(filePath));

const tasks = data.phases['active-development'].tasks;
const wave2bStories = ['US-E4-010', 'US-E4-011', 'US-E4-012'];
const now = new Date().toISOString();

// Update each story to completed
wave2bStories.forEach(storyId => {
  const storyIndex = tasks.findIndex(t => t.story_id === storyId);

  if (storyIndex !== -1) {
    const story = tasks[storyIndex];

    // Update story status
    story.status = 'completed';
    story.progress_percent = 100;
    story.completed_at = now;
    story.agent = storyId === 'US-E4-010' ? 'elite-frontend-dev' : 'backend-api-builder';
    story.started_at = story.started_at || now;

    // Update all subtasks
    if (story.subtasks) {
      story.subtasks.forEach(task => {
        task.status = 'completed';
      });
    }

    console.log(`✅ ${storyId} marked as complete`);
  }
});

// Update Epic 004 progress
const epicTask = tasks.find(t => t.id === 'epic-004-parent');
if (epicTask) {
  const epic004Stories = tasks.filter(t => t.epic_label === 'Epic 004: State Management' && t.type === 'story');
  const completedStories = epic004Stories.filter(s => s.status === 'completed').length;
  const totalStories = epic004Stories.length;

  epicTask.name = `Epic 004: State Management - ${completedStories}/${totalStories} complete`;
  epicTask.progress_percent = Math.round((completedStories / totalStories) * 100);
  epicTask.status = 'in_progress';
}

// Update summary
data.summary = data.summary || {};
const allTasks = tasks.filter(t => t.type === 'story');
data.summary.completed = allTasks.filter(t => t.status === 'completed').length;
data.summary.in_progress = allTasks.filter(t => t.status === 'in_progress').length;
data.summary.total_tasks = allTasks.length;
data.summary.completion_percent = Math.round((data.summary.completed / data.summary.total_tasks) * 100);

// Write back to file
fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

// Summary report
console.log('\n=== WAVE 2B COMPLETION REPORT ===');
console.log('📊 Epic 004 Wave 2b: Phase 2 Server Data Migration');
console.log('✅ US-E4-009: Remove Server Data from Redux Slices');
console.log('✅ US-E4-010: Update Components to Use React Query');
console.log('✅ US-E4-011: Implement Caching Strategies');
console.log('✅ US-E4-012: Implement Error Handling for React Query');
console.log('\n📈 Wave 2b: 4/4 stories complete (100%)');

// Check Phase 2 progress
const phase2Stories = ['US-E4-006', 'US-E4-007', 'US-E4-008', 'US-E4-009', 'US-E4-010', 'US-E4-011', 'US-E4-012'];
const phase2Completed = phase2Stories.filter(id => {
  const s = tasks.find(t => t.story_id === id);
  return s && s.status === 'completed';
}).length;

console.log(`📈 Phase 2 Progress: ${phase2Completed}/7 stories complete (${Math.round(phase2Completed/7*100)}%)`);

// Check Epic 004 overall progress
const epic004Stories = tasks.filter(t => t.epic_label === 'Epic 004: State Management' && t.type === 'story');
const epic004Completed = epic004Stories.filter(s => s.status === 'completed').length;
console.log(`📈 Epic 004 Overall: ${epic004Completed}/${epic004Stories.length} stories complete (${Math.round(epic004Completed/epic004Stories.length*100)}%)`);