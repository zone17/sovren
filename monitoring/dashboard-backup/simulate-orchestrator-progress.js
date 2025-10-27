/**
 * Simulate Orchestrator Progress
 * Manually inject orchestrator progress into the dashboard
 */

const fs = require('fs').promises;
const path = require('path');

async function injectProgress() {
  const dataDir = './data';
  
  // Epic 001 Stories (from your Cursor window)
  const stories = [
    { id: 'epic-001-story-1', name: 'Story 1: Analyze current type coverage', status: 'completed', epic: 'Epic 001', agent: 'BACKEND-AGENT', progress: 100 },
    { id: 'epic-001-story-2', name: 'Story 2: API response types created', status: 'completed', epic: 'Epic 001', agent: 'BACKEND-AGENT', progress: 100 },
    { id: 'epic-001-story-3', name: 'Story 3: Validation middleware already typed', status: 'completed', epic: 'Epic 001', agent: 'BACKEND-AGENT', progress: 100 },
    { id: 'epic-001-story-4', name: 'Story 4: Email service already typed', status: 'completed', epic: 'Epic 001', agent: 'BACKEND-AGENT', progress: 100 },
    { id: 'epic-001-story-5', name: 'Story 5: Fix test utilities (jest, expect, createMockResponse)', status: 'in_progress', epic: 'Epic 001', agent: 'TEST-AGENT', progress: 60 },
    { id: 'epic-001-story-6', name: 'Story 6: Replace z.any() in quality-metrics with Zod schemas', status: 'queued', epic: 'Epic 001', agent: 'BACKEND-AGENT', progress: 0 },
    { id: 'epic-001-story-7', name: 'Story 7: Fix NOSTR key management metadata types', status: 'queued', epic: 'Epic 001', agent: 'BACKEND-AGENT', progress: 0 },
    { id: 'epic-001-story-8', name: 'Story 8: Environment validator - check if exists', status: 'queued', epic: 'Epic 001', agent: 'BACKEND-AGENT', progress: 0 },
    { id: 'epic-001-story-9', name: 'Story 9: Check API route handlers for any types', status: 'queued', epic: 'Epic 001', agent: 'BACKEND-AGENT', progress: 0 },
    { id: 'epic-001-story-10', name: 'Story 10: Fix NOSTR service (featureFlags, validateAndNormalizeEvent)', status: 'queued', epic: 'Epic 001', agent: 'BACKEND-AGENT', progress: 0 },
    { id: 'epic-001-story-11', name: 'Story 11: Enable stricter TypeScript compiler options', status: 'queued', epic: 'Epic 001', agent: 'BACKEND-AGENT', progress: 0 },
    { id: 'epic-001-story-12', name: 'Story 12: Validate type coverage and fix remaining issues', status: 'queued', epic: 'Epic 001', agent: 'BACKEND-AGENT', progress: 0 }
  ];

  const tasks = {
    tasks: stories.map(story => ({
      ...story,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      phase: 'PHASE 3',
      duration: story.status === 'completed' ? '3-5m' : undefined,
      output: story.status === 'completed' ? ['Code updated', 'Tests passing'] : []
    })),
    summary: {
      total_tasks: stories.length,
      completed: stories.filter(s => s.status === 'completed').length,
      in_progress: stories.filter(s => s.status === 'in_progress').length,
      blocked: 0,
      queued: stories.filter(s => s.status === 'queued').length,
      completion_percent: Math.round((stories.filter(s => s.status === 'completed').length / stories.length) * 100)
    },
    phases: {
      'PHASE 0': { name: 'DESIGN', status: 'completed', progress: 100, tasks: [] },
      'PHASE 1': { name: 'PLANNING', status: 'completed', progress: 100, tasks: [] },
      'PHASE 2': { name: 'FOUNDATION', status: 'completed', progress: 100, tasks: [] },
      'PHASE 3': { name: 'DEVELOPMENT', status: 'in_progress', progress: 33, tasks: [] },
      'PHASE 4': { name: 'QUALITY', status: 'pending', progress: 0, tasks: [] },
      'PHASE 5': { name: 'DOCUMENTATION', status: 'pending', progress: 0, tasks: [] },
      'PHASE 6': { name: 'DEPLOYMENT', status: 'pending', progress: 0, tasks: [] }
    },
    agents: [
      { name: 'ORCHESTRATOR', status: 'active', current_task: 'Coordinating Epic 001' },
      { name: 'BACKEND-AGENT', status: 'active', current_task: 'Story 5: Fix test utilities' },
      { name: 'TEST-AGENT', status: 'active', current_task: 'Story 5: Fix test utilities' }
    ],
    blockers: [],
    last_updated: new Date().toISOString()
  };

  const metrics = {
    uptime_seconds: 900, // 15 minutes
    agents_active: 3,
    stories_completed: 4,
    stories_in_progress: 1,
    stories_queued: 7,
    current_phase: 'PHASE 3: DEVELOPMENT - Epic 001 Type Safety',
    last_activity: new Date().toISOString(),
    last_updated: new Date().toISOString()
  };

  await fs.writeFile(
    path.join(dataDir, 'tasks.json'),
    JSON.stringify(tasks, null, 2)
  );

  await fs.writeFile(
    path.join(dataDir, 'metrics.json'),
    JSON.stringify(metrics, null, 2)
  );

  // Add log entries
  const logEntries = [
    `[${new Date().toISOString()}] [INFO] [ORCHESTRATOR] Starting Epic 001: Type Safety (12 stories)\n`,
    `[${new Date().toISOString()}] [SUCCESS] [BACKEND-AGENT] Completed Story 1: Type coverage analysis\n`,
    `[${new Date().toISOString()}] [SUCCESS] [BACKEND-AGENT] Completed Story 2: API response types\n`,
    `[${new Date().toISOString()}] [SUCCESS] [BACKEND-AGENT] Completed Story 3: Validation middleware\n`,
    `[${new Date().toISOString()}] [SUCCESS] [BACKEND-AGENT] Completed Story 4: Email service types\n`,
    `[${new Date().toISOString()}] [INFO] [TEST-AGENT] Started Story 5: Fix test utilities\n`,
    `[${new Date().toISOString()}] [INFO] [TEST-AGENT] Story 5 progress: 60% - Fixing jest, expect, createMockResponse\n`
  ];

  for (const entry of logEntries) {
    await fs.appendFile(path.join(dataDir, 'orchestration.log'), entry);
  }

  console.log('✅ Orchestrator progress injected into dashboard');
  console.log(`📊 Epic 001: ${tasks.summary.completed}/12 stories completed (${tasks.summary.completion_percent}%)`);
  console.log(`🔄 Currently working: Story 5 (60% complete)`);
  console.log(`⏳ Queued: 7 stories`);
}

injectProgress().catch(console.error);
