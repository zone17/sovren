#!/usr/bin/env node

/**
 * Add Epic 004 and Epic 005 Stories to Dashboard
 * Populates the tasks.json file with user stories for upcoming epics
 *
 * Epic 004: State Management (25 stories)
 * Epic 005: Backend Services (42 stories)
 */

const fs = require('fs');
const path = require('path');

const TASKS_FILE = path.join(__dirname, '../data/tasks.json');

console.log('📊 Adding Epic 004 and Epic 005 Stories...\n');

// Epic 004: State Management Boundaries (25 stories)
const epic004Stories = [
  // Phase 1: Audit & Guidelines (Stories 1-5)
  { id: 'US-401', name: 'Audit Redux Store Structure', agent_type: 'backend', priority: 'P0', description: 'Inventory all existing Redux slices and categorize state types' },
  { id: 'US-402', name: 'Audit React Query Usage', agent_type: 'frontend', priority: 'P0', description: 'Inventory all React Query hooks and identify overlaps with Redux' },
  { id: 'US-403', name: 'Create State Management Decision Tree', agent_type: 'tech-architecture', priority: 'P0', description: 'Clear decision tree for choosing Redux vs React Query' },
  { id: 'US-404', name: 'Design State Architecture Diagrams', agent_type: 'tech-architecture', priority: 'P0', description: 'Visual architecture diagrams showing state boundaries' },
  { id: 'US-405', name: 'Document State Management Guidelines', agent_type: 'documentation', priority: 'P0', description: 'Comprehensive state management guidelines for developers' },

  // Phase 2: Server Data Migration (Stories 6-12)
  { id: 'US-406', name: 'Migrate Creator Data to React Query', agent_type: 'backend', priority: 'P1', description: 'Move creator list from Redux to React Query hooks' },
  { id: 'US-407', name: 'Migrate Content Data to React Query', agent_type: 'backend', priority: 'P1', description: 'Move content fetching to React Query with caching' },
  { id: 'US-408', name: 'Migrate User Data to React Query', agent_type: 'backend', priority: 'P1', description: 'Migrate user profiles to React Query' },
  { id: 'US-409', name: 'Migrate Payment Data to React Query', agent_type: 'backend', priority: 'P1', description: 'Move payment history and subscriptions to React Query' },
  { id: 'US-410', name: 'Implement React Query DevTools', agent_type: 'frontend', priority: 'P1', description: 'Add React Query DevTools for cache inspection' },
  { id: 'US-411', name: 'Configure Query Cache Persistence', agent_type: 'frontend', priority: 'P1', description: 'Persist query cache to localStorage' },
  { id: 'US-412', name: 'Implement Optimistic Updates', agent_type: 'frontend', priority: 'P1', description: 'Add optimistic UI updates for mutations' },

  // Phase 3: Client State Consolidation (Stories 13-17)
  { id: 'US-413', name: 'Consolidate UI State in Redux', agent_type: 'frontend', priority: 'P1', description: 'Move all UI state to dedicated Redux slices' },
  { id: 'US-414', name: 'Implement Modal State Management', agent_type: 'frontend', priority: 'P1', description: 'Centralized modal state with Redux' },
  { id: 'US-415', name: 'Implement Form State Management', agent_type: 'frontend', priority: 'P1', description: 'Redux-based form state for complex forms' },
  { id: 'US-416', name: 'Implement Auth State in Redux', agent_type: 'frontend', priority: 'P0', description: 'Client-side auth state (tokens, user identity)' },
  { id: 'US-417', name: 'Implement Preferences State', agent_type: 'frontend', priority: 'P2', description: 'User preferences and settings in Redux with persistence' },

  // Phase 4: Testing & Validation (Stories 18-22)
  { id: 'US-418', name: 'Write React Query Hook Tests', agent_type: 'testing', priority: 'P0', description: 'Comprehensive tests for all React Query hooks' },
  { id: 'US-419', name: 'Write Redux Slice Tests', agent_type: 'testing', priority: 'P0', description: 'Unit tests for all Redux slices and reducers' },
  { id: 'US-420', name: 'Integration Tests for State Flow', agent_type: 'testing', priority: 'P0', description: 'End-to-end tests for complete state flows' },
  { id: 'US-421', name: 'Performance Testing', agent_type: 'testing', priority: 'P1', description: 'Benchmark state management performance' },
  { id: 'US-422', name: 'Cache Hit Rate Monitoring', agent_type: 'monitoring', priority: 'P1', description: 'Monitor React Query cache effectiveness' },

  // Phase 5: Documentation & Training (Stories 23-25)
  { id: 'US-423', name: 'Developer Documentation', agent_type: 'documentation', priority: 'P0', description: 'Complete developer guide for state management' },
  { id: 'US-424', name: 'Migration Guide', agent_type: 'documentation', priority: 'P0', description: 'Guide for migrating from old to new state patterns' },
  { id: 'US-425', name: 'Code Examples and Templates', agent_type: 'documentation', priority: 'P1', description: 'Reusable templates for common state patterns' }
];

// Epic 005: Backend Services (42 stories)
const epic005Stories = [
  // Content Service Refactoring (7 stories)
  { id: 'US-501', name: 'ContentCreationService Extraction', agent_type: 'backend', priority: 'P0', description: 'Extract content creation logic into dedicated service' },
  { id: 'US-502', name: 'ContentPublishingService Extraction', agent_type: 'backend', priority: 'P0', description: 'Extract publishing logic to separate service' },
  { id: 'US-503', name: 'ContentModerationService Extraction', agent_type: 'backend', priority: 'P1', description: 'Moderation and filtering as separate service' },
  { id: 'US-504', name: 'ContentSearchService Extraction', agent_type: 'backend', priority: 'P1', description: 'Search and indexing service' },
  { id: 'US-505', name: 'ContentRecommendationService Extraction', agent_type: 'backend', priority: 'P2', description: 'AI-powered recommendation service' },
  { id: 'US-506', name: 'ContentAnalyticsService Extraction', agent_type: 'backend', priority: 'P1', description: 'Content metrics and analytics service' },
  { id: 'US-507', name: 'ContentVersioningService Extraction', agent_type: 'backend', priority: 'P2', description: 'Content history and versioning service' },

  // User Service Refactoring (6 stories)
  { id: 'US-508', name: 'UserAuthenticationService Extraction', agent_type: 'backend', priority: 'P0', description: 'Authentication and session management service' },
  { id: 'US-509', name: 'UserProfileService Extraction', agent_type: 'backend', priority: 'P0', description: 'Profile CRUD operations service' },
  { id: 'US-510', name: 'UserPreferencesService Extraction', agent_type: 'backend', priority: 'P1', description: 'User settings and preferences service' },
  { id: 'US-511', name: 'UserActivityService Extraction', agent_type: 'backend', priority: 'P1', description: 'Activity tracking and logging service' },
  { id: 'US-512', name: 'UserRelationshipService Extraction', agent_type: 'backend', priority: 'P1', description: 'Follow/unfollow/block management service' },
  { id: 'US-513', name: 'UserAnalyticsService Extraction', agent_type: 'backend', priority: 'P2', description: 'User metrics and segmentation service' },

  // Payment Service Refactoring (7 stories)
  { id: 'US-514', name: 'InvoiceService Extraction', agent_type: 'backend', priority: 'P0', description: 'Invoice generation and management service' },
  { id: 'US-515', name: 'PaymentProcessingService Extraction', agent_type: 'backend', priority: 'P0', description: 'Payment execution and verification service' },
  { id: 'US-516', name: 'SubscriptionService Extraction', agent_type: 'backend', priority: 'P0', description: 'Subscription lifecycle management service' },
  { id: 'US-517', name: 'RefundService Extraction', agent_type: 'backend', priority: 'P1', description: 'Refund processing service' },
  { id: 'US-518', name: 'PaymentAnalyticsService Extraction', agent_type: 'backend', priority: 'P1', description: 'Payment metrics and reporting service' },
  { id: 'US-519', name: 'WebhookService Extraction', agent_type: 'backend', priority: 'P0', description: 'Webhook handling and validation service' },
  { id: 'US-520', name: 'CurrencyService Extraction', agent_type: 'backend', priority: 'P2', description: 'Currency conversion and pricing service' },

  // Shared Services (4 stories)
  { id: 'US-521', name: 'EmailService Implementation', agent_type: 'backend', priority: 'P0', description: 'Shared email notification service' },
  { id: 'US-522', name: 'NotificationService Implementation', agent_type: 'backend', priority: 'P1', description: 'Multi-channel notification service' },
  { id: 'US-523', name: 'AuditLogService Implementation', agent_type: 'backend', priority: 'P1', description: 'Audit trail and compliance logging service' },
  { id: 'US-524', name: 'CacheService Implementation', agent_type: 'backend', priority: 'P0', description: 'Shared caching logic service' },

  // Dependency Injection & Architecture (5 stories)
  { id: 'US-525', name: 'Dependency Injection Container Setup', agent_type: 'backend', priority: 'P0', description: 'InversifyJS DI container configuration' },
  { id: 'US-526', name: 'Service Interface Definitions', agent_type: 'backend', priority: 'P0', description: 'TypeScript interfaces for all services' },
  { id: 'US-527', name: 'Service Factory Pattern', agent_type: 'backend', priority: 'P1', description: 'Factory pattern for service instantiation' },
  { id: 'US-528', name: 'Service Registry Implementation', agent_type: 'backend', priority: 'P1', description: 'Central service registry and resolution' },
  { id: 'US-529', name: 'Circular Dependency Prevention', agent_type: 'backend', priority: 'P1', description: 'Architecture to prevent circular dependencies' },

  // Testing & Quality (5 stories)
  { id: 'US-530', name: 'Service Unit Test Suite', agent_type: 'testing', priority: 'P0', description: 'Comprehensive unit tests for all services' },
  { id: 'US-531', name: 'Service Integration Tests', agent_type: 'testing', priority: 'P0', description: 'Integration tests for service interactions' },
  { id: 'US-532', name: 'Service Performance Tests', agent_type: 'testing', priority: 'P1', description: 'Performance benchmarks for services' },
  { id: 'US-533', name: 'Service Mock Library', agent_type: 'testing', priority: 'P1', description: 'Reusable service mocks for testing' },
  { id: 'US-534', name: 'Test Coverage Validation', agent_type: 'testing', priority: 'P0', description: 'Ensure 95%+ test coverage maintained' },

  // Migration & Deployment (4 stories)
  { id: 'US-535', name: 'API Route Migration', agent_type: 'backend', priority: 'P0', description: 'Update all API routes to use new services' },
  { id: 'US-536', name: 'Legacy Service Deprecation', agent_type: 'backend', priority: 'P1', description: 'Deprecate old monolithic services' },
  { id: 'US-537', name: 'Zero-Downtime Migration Strategy', agent_type: 'cicd', priority: 'P0', description: 'Deploy refactored services without downtime' },
  { id: 'US-538', name: 'Rollback Plan Implementation', agent_type: 'cicd', priority: 'P0', description: 'Automated rollback if issues detected' },

  // Documentation & Training (4 stories)
  { id: 'US-539', name: 'Service Architecture Documentation', agent_type: 'documentation', priority: 'P0', description: 'Complete service architecture diagrams and docs' },
  { id: 'US-540', name: 'Service Contract Documentation', agent_type: 'documentation', priority: 'P0', description: 'JSDoc/TSDoc for all service interfaces' },
  { id: 'US-541', name: 'DI Container Usage Guide', agent_type: 'documentation', priority: 'P1', description: 'Developer guide for using dependency injection' },
  { id: 'US-542', name: 'Service Migration ADR', agent_type: 'documentation', priority: 'P0', description: 'Architecture Decision Record for refactoring' }
];

// Read existing tasks.json
let tasksData;
try {
  tasksData = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
} catch (error) {
  console.error('❌ Error reading tasks.json:', error.message);
  process.exit(1);
}

const tasks = tasksData.phases['active-development'].tasks;

// Track existing story IDs to avoid duplicates
const existingStoryIds = new Set();
tasks.forEach(task => {
  if (task.type === 'story' && task.story_id) {
    existingStoryIds.add(task.story_id);
  }
});

let addedCount = 0;
const timestamp = Date.now();

// Add Epic 004 stories
console.log('📝 Adding Epic 004: State Management (25 stories)...');
epic004Stories.forEach((story, index) => {
  if (!existingStoryIds.has(story.id)) {
    const storyTask = {
      id: `story-${story.id.toLowerCase()}-${timestamp + index}`,
      type: 'story',
      story_id: story.id,
      name: `${story.id}: ${story.name}`,
      description: story.description,
      agent: 'unassigned',
      agent_type: story.agent_type,
      status: 'pending',
      progress_percent: 0,
      started_at: null,
      completed_at: null,
      epic_label: 'Epic 004: State Management',
      priority: story.priority,
      files_modified: [],
      test_coverage: null
    };
    tasks.push(storyTask);
    addedCount++;
  }
});
console.log(`✅ Added ${addedCount} Epic 004 stories\n`);

// Add Epic 005 stories
const epic005AddedCount = addedCount;
console.log('📝 Adding Epic 005: Backend Services (42 stories)...');
epic005Stories.forEach((story, index) => {
  if (!existingStoryIds.has(story.id)) {
    const storyTask = {
      id: `story-${story.id.toLowerCase()}-${timestamp + epic004Stories.length + index}`,
      type: 'story',
      story_id: story.id,
      name: `${story.id}: ${story.name}`,
      description: story.description,
      agent: 'unassigned',
      agent_type: story.agent_type,
      status: 'pending',
      progress_percent: 0,
      started_at: null,
      completed_at: null,
      epic_label: 'Epic 005: Backend Services',
      priority: story.priority,
      files_modified: [],
      test_coverage: null
    };
    tasks.push(storyTask);
    addedCount++;
  }
});
console.log(`✅ Added ${addedCount - epic005AddedCount} Epic 005 stories\n`);

// Add epic parent tasks if they don't exist
const epicParentExists = tasks.some(t => t.id === 'epic-004-parent' || t.id === 'epic-005-parent');
if (!epicParentExists) {
  tasks.unshift(
    {
      id: 'epic-005-parent',
      type: 'epic',
      name: 'Epic 005: Backend Services - 0/42 complete',
      agent: 'project-orchestrator',
      status: 'pending',
      progress_percent: 0,
      started_at: null,
      completed_at: null
    },
    {
      id: 'epic-004-parent',
      type: 'epic',
      name: 'Epic 004: State Management - 0/25 complete',
      agent: 'project-orchestrator',
      status: 'pending',
      progress_percent: 0,
      started_at: null,
      completed_at: null
    }
  );
  console.log('✅ Added Epic 004 and Epic 005 parent tasks\n');
}

// Update summary
tasksData.summary = {
  total_tasks: tasks.length,
  completed: tasks.filter(t => t.status === 'completed' || t.status === 'done').length,
  in_progress: tasks.filter(t => t.status === 'in_progress' || t.status === 'active').length,
  blocked: tasks.filter(t => t.status === 'blocked').length,
  queued: tasks.filter(t => t.status === 'pending' || t.status === 'queued').length,
  completion_percent: Math.round((tasks.filter(t => t.status === 'completed' || t.status === 'done').length / tasks.length) * 100)
};

// Write updated data
fs.writeFileSync(TASKS_FILE, JSON.stringify(tasksData, null, 2));

console.log('✅ Successfully added Epic 004 and Epic 005 stories!\n');
console.log('📊 Updated Summary:');
console.log(`   Total Tasks: ${tasksData.summary.total_tasks}`);
console.log(`   Epic 003 Stories: 26`);
console.log(`   Epic 004 Stories: 25`);
console.log(`   Epic 005 Stories: 42`);
console.log(`   Total Stories: 93`);
console.log(`   Completion: ${tasksData.summary.completion_percent}%\n`);

console.log('🔄 Dashboard will auto-reload to show new epics');
console.log('   Force refresh browser: Cmd+Shift+R or Ctrl+Shift+R\n');
