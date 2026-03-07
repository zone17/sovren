const fs = require('fs');
const filePath = '/Users/fp/Desktop/Sovren/monitoring/dashboard/data/tasks.json';
const data = JSON.parse(fs.readFileSync(filePath));

// Find US-E4-009 in the phases.active-development.tasks array
const tasks = data.phases['active-development'].tasks;
const storyIndex = tasks.findIndex((t) => t.story_id === 'US-E4-009');

if (storyIndex !== -1) {
  const story = tasks[storyIndex];

  // Update story status
  story.status = 'completed';
  story.progress_percent = 100;
  story.completed_at = new Date().toISOString();
  story.agent = 'project-orchestrator';

  // Update all subtasks
  story.subtasks.forEach((task) => {
    task.status = 'completed';
  });

  // Find and update the parent epic task
  const epicTask = tasks.find((t) => t.id === 'epic-004-parent');
  if (epicTask) {
    // Count completed stories for Epic 004
    const epic004Stories = tasks.filter(
      (t) => t.epic_label === 'Epic 004: State Management' && t.type === 'story'
    );
    const completedStories = epic004Stories.filter((s) => s.status === 'completed').length;
    const totalStories = epic004Stories.length;

    epicTask.name = `Epic 004: State Management - ${completedStories}/${totalStories} complete`;
    epicTask.progress_percent = Math.round((completedStories / totalStories) * 100);
    epicTask.status = 'in_progress';
    epicTask.started_at = epicTask.started_at || new Date().toISOString();
  }

  // Update summary
  const summary = data.summary || {};
  summary.completed = (summary.completed || 0) + 1;
  summary.in_progress = Math.max(0, (summary.in_progress || 0) - 1);
  summary.total_tasks = tasks.length;
  summary.completion_percent = Math.round((summary.completed / summary.total_tasks) * 100);
  data.summary = summary;

  // Write back to file
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  console.log('✅ US-E4-009 marked as complete');
  console.log('📊 Epic 004 progress updated');

  // Count Wave 2b stories
  const wave2bStories = ['US-E4-009', 'US-E4-010', 'US-E4-011', 'US-E4-012'];
  const wave2bCompleted = wave2bStories.filter((id) => {
    const s = tasks.find((t) => t.story_id === id);
    return s && s.status === 'completed';
  }).length;

  console.log(
    `📈 Wave 2b Progress: ${wave2bCompleted}/4 stories complete (${Math.round((wave2bCompleted / 4) * 100)}%)`
  );
} else {
  console.error('Could not find US-E4-009 in tasks');
}
