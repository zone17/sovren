#!/usr/bin/env node
/**
 * Populate Epic 004: State Management - All 25 Stories with Subtasks
 *
 * This script adds all Epic 004 stories to the dashboard with properly
 * ordered subtasks matching the execution order from STORY_BREAKDOWN.md
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TASKS_FILE = join(__dirname, '../monitoring/dashboard/data/tasks.json');

// Epic 004: All 25 stories with complete subtasks in proper order
const EPIC_004_STORIES = [
  // PHASE 1: Audit & Guidelines (Stories 1-5) - Sequential
  {
    story_id: 'US-E4-001',
    name: 'US-E4-001: Audit Redux Store Structure',
    epic_label: 'Epic 004: State Management',
    priority: 'P0-CRITICAL',
    status: 'completed', // Already done by project-orchestrator
    progress_percent: 100,
    agent: 'backend-api-builder',
    agent_type: 'backend',
    dependencies: [],
    subtasks: [
      {
        order: 1,
        description: 'Analyze all existing Redux slices in store configuration',
        status: 'completed',
      },
      {
        order: 2,
        description: 'Categorize each slice property as client-state, server-state, or mixed',
        status: 'completed',
      },
      {
        order: 3,
        description: 'Generate JSON audit report with slice categorization',
        status: 'completed',
      },
      { order: 4, description: 'Create markdown summary for team review', status: 'completed' },
      { order: 5, description: 'Identify all server data currently in Redux', status: 'completed' },
      { order: 6, description: 'Identify all client state properly in Redux', status: 'completed' },
      {
        order: 7,
        description: 'Document migration priorities and complexity',
        status: 'completed',
      },
      {
        order: 8,
        description: 'Get technical lead approval on audit findings',
        status: 'completed',
      },
    ],
  },
  {
    story_id: 'US-E4-002',
    name: 'US-E4-002: Audit React Query Usage',
    epic_label: 'Epic 004: State Management',
    priority: 'P0-CRITICAL',
    status: 'completed',
    progress_percent: 100,
    agent: 'backend-api-builder',
    agent_type: 'backend',
    dependencies: [],
    subtasks: [
      {
        order: 1,
        description: 'Find all useQuery, useMutation, useInfiniteQuery hooks in codebase',
        status: 'completed',
      },
      {
        order: 2,
        description: 'Document each hook with cache key and data type',
        status: 'completed',
      },
      {
        order: 3,
        description: 'Identify duplicate state between Redux and React Query',
        status: 'completed',
      },
      {
        order: 4,
        description: 'Generate JSON audit report with query documentation',
        status: 'completed',
      },
      {
        order: 5,
        description: 'Identify missing React Query hooks for server data',
        status: 'completed',
      },
      { order: 6, description: 'Document cache strategy improvements needed', status: 'completed' },
      { order: 7, description: 'Create consolidation recommendations', status: 'completed' },
      { order: 8, description: 'Get team approval on findings', status: 'completed' },
    ],
  },
  {
    story_id: 'US-E4-003',
    name: 'US-E4-003: Create State Management Decision Tree',
    epic_label: 'Epic 004: State Management',
    priority: 'P0-CRITICAL',
    status: 'completed',
    progress_percent: 100,
    agent: 'backend-api-builder',
    agent_type: 'backend',
    dependencies: ['US-E4-001', 'US-E4-002'],
    subtasks: [
      {
        order: 1,
        description: 'Design decision flow diagram for state selection',
        status: 'completed',
      },
      { order: 2, description: 'Create Mermaid diagram visualization', status: 'completed' },
      { order: 3, description: 'Document rules: API data → React Query', status: 'completed' },
      { order: 4, description: 'Document rules: UI state → Redux', status: 'completed' },
      { order: 5, description: 'Document rules: Component-local → useState', status: 'completed' },
      { order: 6, description: 'Provide examples for each decision path', status: 'completed' },
      { order: 7, description: 'Document edge cases and special scenarios', status: 'completed' },
      { order: 8, description: 'Get team consensus and approval', status: 'completed' },
    ],
  },
  {
    story_id: 'US-E4-004',
    name: 'US-E4-004: Design State Architecture Diagrams',
    epic_label: 'Epic 004: State Management',
    priority: 'P0-CRITICAL',
    status: 'completed',
    progress_percent: 100,
    agent: 'backend-api-builder',
    agent_type: 'backend',
    dependencies: ['US-E4-001', 'US-E4-002', 'US-E4-003'],
    subtasks: [
      {
        order: 1,
        description: 'Create overall architecture diagram (current vs target)',
        status: 'completed',
      },
      {
        order: 2,
        description: 'Create data flow diagram (API → React Query → Components)',
        status: 'completed',
      },
      { order: 3, description: 'Create Redux slice organization diagram', status: 'completed' },
      { order: 4, description: 'Create React Query structure diagram', status: 'completed' },
      { order: 5, description: 'Create state boundaries diagram', status: 'completed' },
      { order: 6, description: 'Generate PNG versions for documentation', status: 'completed' },
      { order: 7, description: 'Add diagrams to team wiki', status: 'completed' },
      { order: 8, description: 'Get architecture approval from tech lead', status: 'completed' },
    ],
  },
  {
    story_id: 'US-E4-005',
    name: 'US-E4-005: Team Guidelines Review Session',
    epic_label: 'Epic 004: State Management',
    priority: 'P0-CRITICAL',
    status: 'completed',
    progress_percent: 100,
    agent: 'backend-api-builder',
    agent_type: 'backend',
    dependencies: ['US-E4-001', 'US-E4-002', 'US-E4-003', 'US-E4-004'],
    subtasks: [
      { order: 1, description: 'Prepare review meeting agenda and materials', status: 'completed' },
      { order: 2, description: 'Schedule team review meeting', status: 'completed' },
      { order: 3, description: 'Present audit findings to team', status: 'completed' },
      { order: 4, description: 'Present decision tree and guidelines', status: 'completed' },
      { order: 5, description: 'Collect feedback from all team members', status: 'completed' },
      { order: 6, description: 'Incorporate feedback into guidelines', status: 'completed' },
      { order: 7, description: 'Create final guidelines document', status: 'completed' },
      { order: 8, description: 'Get team sign-off on finalized guidelines', status: 'completed' },
    ],
  },

  // PHASE 2: Server Data Migration (Stories 6-12) - Can parallelize
  {
    story_id: 'US-E4-006',
    name: 'US-E4-006: Create React Query Hooks for Creators',
    epic_label: 'Epic 004: State Management',
    priority: 'P1',
    status: 'pending',
    progress_percent: 0,
    agent: null,
    agent_type: 'backend',
    dependencies: ['US-E4-005'],
    subtasks: [
      {
        order: 1,
        description: 'Create packages/frontend/src/queries/creators/ directory',
        status: 'pending',
      },
      {
        order: 2,
        description: 'Implement useCreators hook with pagination and filters',
        status: 'pending',
      },
      {
        order: 3,
        description: 'Implement useCreatorProfile hook for individual creators',
        status: 'pending',
      },
      { order: 4, description: 'Implement useUpdateCreator mutation hook', status: 'pending' },
      { order: 5, description: 'Implement useDeleteCreator mutation hook', status: 'pending' },
      { order: 6, description: 'Add optimistic updates for mutations', status: 'pending' },
      { order: 7, description: 'Add error handling and retry logic', status: 'pending' },
      {
        order: 8,
        description: 'Configure appropriate cache times (staleTime, cacheTime)',
        status: 'pending',
      },
      { order: 9, description: 'Write unit tests (80%+ coverage)', status: 'pending' },
      { order: 10, description: 'Write integration tests with mock API', status: 'pending' },
    ],
  },
  {
    story_id: 'US-E4-007',
    name: 'US-E4-007: Create React Query Hooks for Content',
    epic_label: 'Epic 004: State Management',
    priority: 'P1',
    status: 'pending',
    progress_percent: 0,
    agent: null,
    agent_type: 'backend',
    dependencies: ['US-E4-005'],
    subtasks: [
      {
        order: 1,
        description: 'Create packages/frontend/src/queries/content/ directory',
        status: 'pending',
      },
      {
        order: 2,
        description: 'Implement useContent hook with infinite scrolling',
        status: 'pending',
      },
      {
        order: 3,
        description: 'Implement useContentItem hook for single content',
        status: 'pending',
      },
      {
        order: 4,
        description: 'Implement useCreateContent mutation with optimistic updates',
        status: 'pending',
      },
      { order: 5, description: 'Implement useUpdateContent mutation hook', status: 'pending' },
      { order: 6, description: 'Implement useDeleteContent mutation hook', status: 'pending' },
      {
        order: 7,
        description: 'Implement useContentStream for real-time updates',
        status: 'pending',
      },
      { order: 8, description: 'Add error boundaries for content operations', status: 'pending' },
      { order: 9, description: 'Write unit tests (80%+ coverage)', status: 'pending' },
      { order: 10, description: 'Write integration tests', status: 'pending' },
    ],
  },
  {
    story_id: 'US-E4-008',
    name: 'US-E4-008: Create React Query Hooks for Payments',
    epic_label: 'Epic 004: State Management',
    priority: 'P1',
    status: 'pending',
    progress_percent: 0,
    agent: null,
    agent_type: 'backend',
    dependencies: ['US-E4-005'],
    subtasks: [
      {
        order: 1,
        description: 'Create packages/frontend/src/queries/payments/ directory',
        status: 'pending',
      },
      { order: 2, description: 'Implement useSubscriptions hook with caching', status: 'pending' },
      { order: 3, description: 'Implement useInvoices hook with pagination', status: 'pending' },
      {
        order: 4,
        description: 'Implement usePaymentStatus hook with polling logic',
        status: 'pending',
      },
      { order: 5, description: 'Implement useCreatePayment mutation hook', status: 'pending' },
      { order: 6, description: 'Implement useCancelSubscription mutation hook', status: 'pending' },
      { order: 7, description: 'Add error handling for payment failures', status: 'pending' },
      { order: 8, description: 'Add retry logic for failed payments', status: 'pending' },
      { order: 9, description: 'Write unit tests (80%+ coverage)', status: 'pending' },
      { order: 10, description: 'Write integration tests', status: 'pending' },
    ],
  },
  {
    story_id: 'US-E4-009',
    name: 'US-E4-009: Remove Server Data from Redux Slices',
    epic_label: 'Epic 004: State Management',
    priority: 'P1',
    status: 'pending',
    progress_percent: 0,
    agent: null,
    agent_type: 'backend',
    dependencies: ['US-E4-006', 'US-E4-007', 'US-E4-008'],
    subtasks: [
      {
        order: 1,
        description: 'Delete creatorsSlice.ts entirely (all server data)',
        status: 'pending',
      },
      {
        order: 2,
        description: 'Remove server data from cmsSlice.ts (keep only UI state)',
        status: 'pending',
      },
      { order: 3, description: 'Remove server data from analyticsSlice.ts', status: 'pending' },
      {
        order: 4,
        description: 'Remove all Redux actions for server data fetching',
        status: 'pending',
      },
      { order: 5, description: 'Remove all Redux selectors for server data', status: 'pending' },
      {
        order: 6,
        description: 'Update store configuration (remove deleted slices)',
        status: 'pending',
      },
      {
        order: 7,
        description: 'Fix all TypeScript errors from removed exports',
        status: 'pending',
      },
      {
        order: 8,
        description: 'Update all tests to remove server data expectations',
        status: 'pending',
      },
      {
        order: 9,
        description: 'Verify no server data remains in Redux (audit)',
        status: 'pending',
      },
      { order: 10, description: 'Run full test suite to ensure no breakage', status: 'pending' },
    ],
  },
  {
    story_id: 'US-E4-010',
    name: 'US-E4-010: Update Components to Use React Query',
    epic_label: 'Epic 004: State Management',
    priority: 'P1',
    status: 'pending',
    progress_percent: 0,
    agent: null,
    agent_type: 'frontend',
    dependencies: ['US-E4-009'],
    subtasks: [
      {
        order: 1,
        description: 'Update CreatorList component to use useCreators hook',
        status: 'pending',
      },
      {
        order: 2,
        description: 'Update CreatorProfile component to use useCreatorProfile hook',
        status: 'pending',
      },
      {
        order: 3,
        description: 'Update ContentList component to use useContent hook',
        status: 'pending',
      },
      {
        order: 4,
        description: 'Update ContentEditor component to use useContentItem hook',
        status: 'pending',
      },
      {
        order: 5,
        description: 'Update PaymentHistory component to use useInvoices hook',
        status: 'pending',
      },
      {
        order: 6,
        description: 'Update SubscriptionManager component to use useSubscriptions hook',
        status: 'pending',
      },
      {
        order: 7,
        description: 'Update all imports (remove Redux imports, add React Query)',
        status: 'pending',
      },
      {
        order: 8,
        description: 'Update PropTypes/interfaces for new data shapes',
        status: 'pending',
      },
      {
        order: 9,
        description: 'Update component tests to use React Query test utils',
        status: 'pending',
      },
      {
        order: 10,
        description: 'Verify all components render correctly with new hooks',
        status: 'pending',
      },
    ],
  },
  {
    story_id: 'US-E4-011',
    name: 'US-E4-011: Implement Caching Strategies',
    epic_label: 'Epic 004: State Management',
    priority: 'P1',
    status: 'pending',
    progress_percent: 0,
    agent: null,
    agent_type: 'backend',
    dependencies: ['US-E4-010'],
    subtasks: [
      {
        order: 1,
        description: 'Create packages/frontend/src/queries/queryClient.ts',
        status: 'pending',
      },
      {
        order: 2,
        description: 'Configure global QueryClient defaults (staleTime, cacheTime, retry)',
        status: 'pending',
      },
      {
        order: 3,
        description: 'Define cache strategies for creators (5 min staleTime)',
        status: 'pending',
      },
      {
        order: 4,
        description: 'Define cache strategies for content (1 min staleTime)',
        status: 'pending',
      },
      {
        order: 5,
        description: 'Define cache strategies for payments (10 min staleTime)',
        status: 'pending',
      },
      { order: 6, description: 'Configure background refetch intervals', status: 'pending' },
      { order: 7, description: 'Configure refetchOnWindowFocus behavior', status: 'pending' },
      { order: 8, description: 'Configure refetchOnReconnect behavior', status: 'pending' },
      { order: 9, description: 'Set up cache persistence (if needed)', status: 'pending' },
      { order: 10, description: 'Document caching strategies and rationale', status: 'pending' },
    ],
  },
  {
    story_id: 'US-E4-012',
    name: 'US-E4-012: Implement Error Handling for React Query',
    epic_label: 'Epic 004: State Management',
    priority: 'P1',
    status: 'pending',
    progress_percent: 0,
    agent: null,
    agent_type: 'backend',
    dependencies: ['US-E4-010', 'US-E4-011'],
    subtasks: [
      {
        order: 1,
        description: 'Create packages/frontend/src/queries/errorHandling.ts',
        status: 'pending',
      },
      {
        order: 2,
        description: 'Implement global query error handler with toast notifications',
        status: 'pending',
      },
      {
        order: 3,
        description: 'Implement mutation error handler with rollback logic',
        status: 'pending',
      },
      { order: 4, description: 'Create QueryErrorBoundary component', status: 'pending' },
      {
        order: 5,
        description: 'Add error boundaries to components using queries',
        status: 'pending',
      },
      {
        order: 6,
        description: 'Implement retry UI components for failed queries',
        status: 'pending',
      },
      { order: 7, description: 'Add offline detection and error messages', status: 'pending' },
      { order: 8, description: 'Configure error logging to Sentry', status: 'pending' },
      {
        order: 9,
        description: 'Define user-friendly error messages for common errors',
        status: 'pending',
      },
      {
        order: 10,
        description: 'Test error scenarios (network failures, 401, 500, etc.)',
        status: 'pending',
      },
    ],
  },

  // PHASE 3: Client State Consolidation (Stories 13-17) - Can parallelize with Phase 2
  {
    story_id: 'US-E4-013',
    name: 'US-E4-013: Consolidate UI State in Redux',
    epic_label: 'Epic 004: State Management',
    priority: 'P1',
    status: 'pending',
    progress_percent: 0,
    agent: null,
    agent_type: 'backend',
    dependencies: ['US-E4-005'],
    subtasks: [
      {
        order: 1,
        description: 'Expand uiSlice.ts with all UI state properties',
        status: 'pending',
      },
      { order: 2, description: 'Add theme state management (light/dark)', status: 'pending' },
      { order: 3, description: 'Add sidebar state (open/closed)', status: 'pending' },
      { order: 4, description: 'Add modal state (activeModal, modalData)', status: 'pending' },
      { order: 5, description: 'Add notifications state (list, timestamps)', status: 'pending' },
      { order: 6, description: 'Add toast state (list, auto-dismiss)', status: 'pending' },
      { order: 7, description: 'Create Redux actions for all UI operations', status: 'pending' },
      { order: 8, description: 'Create Redux selectors for UI state access', status: 'pending' },
      { order: 9, description: 'Add middleware for localStorage persistence', status: 'pending' },
      {
        order: 10,
        description: 'Write unit tests for UI reducers and selectors',
        status: 'pending',
      },
    ],
  },
  {
    story_id: 'US-E4-014',
    name: 'US-E4-014: Remove UI State from React Query',
    epic_label: 'Epic 004: State Management',
    priority: 'P1',
    status: 'pending',
    progress_percent: 0,
    agent: null,
    agent_type: 'backend',
    dependencies: ['US-E4-013'],
    subtasks: [
      { order: 1, description: 'Audit React Query cache for UI state patterns', status: 'pending' },
      {
        order: 2,
        description: 'Identify all instances of UI state in query cache',
        status: 'pending',
      },
      { order: 3, description: 'Remove query hooks used for UI state', status: 'pending' },
      { order: 4, description: 'Replace with Redux useSelector calls', status: 'pending' },
      {
        order: 5,
        description: 'Update components to dispatch Redux actions for UI updates',
        status: 'pending',
      },
      { order: 6, description: 'Remove setQueryData calls for UI preferences', status: 'pending' },
      {
        order: 7,
        description: 'Verify React Query DevTools shows only server data',
        status: 'pending',
      },
      { order: 8, description: 'Update tests to reflect Redux UI state', status: 'pending' },
      { order: 9, description: 'Run full test suite', status: 'pending' },
      { order: 10, description: 'Document cleanup in CHANGELOG', status: 'pending' },
    ],
  },
  {
    story_id: 'US-E4-015',
    name: 'US-E4-015: Update Theme and Modal Management',
    epic_label: 'Epic 004: State Management',
    priority: 'P1',
    status: 'pending',
    progress_percent: 0,
    agent: null,
    agent_type: 'frontend',
    dependencies: ['US-E4-013', 'US-E4-014'],
    subtasks: [
      { order: 1, description: 'Create ThemeProvider component using Redux', status: 'pending' },
      { order: 2, description: 'Implement theme toggle functionality', status: 'pending' },
      { order: 3, description: 'Add theme persistence to localStorage', status: 'pending' },
      { order: 4, description: 'Apply theme to document root on mount/change', status: 'pending' },
      { order: 5, description: 'Create ModalManager component using Redux', status: 'pending' },
      { order: 6, description: 'Implement modal stacking prevention logic', status: 'pending' },
      { order: 7, description: 'Add ESC key handler to close modals', status: 'pending' },
      { order: 8, description: 'Add accessibility features (focus trap, ARIA)', status: 'pending' },
      { order: 9, description: 'Create CSS variables for theming', status: 'pending' },
      { order: 10, description: 'Write component tests for theme and modals', status: 'pending' },
    ],
  },
  {
    story_id: 'US-E4-016',
    name: 'US-E4-016: Update Notification System',
    epic_label: 'Epic 004: State Management',
    priority: 'P1',
    status: 'pending',
    progress_percent: 0,
    agent: null,
    agent_type: 'frontend',
    dependencies: ['US-E4-015'],
    subtasks: [
      {
        order: 1,
        description: 'Create NotificationCenter component using Redux',
        status: 'pending',
      },
      {
        order: 2,
        description: 'Implement auto-dismiss timer for non-persistent notifications',
        status: 'pending',
      },
      { order: 3, description: 'Implement notification stacking UI', status: 'pending' },
      {
        order: 4,
        description: 'Create useNotification hook for easy dispatching',
        status: 'pending',
      },
      { order: 5, description: 'Differentiate toast vs notification types', status: 'pending' },
      { order: 6, description: 'Add sound/vibration options for notifications', status: 'pending' },
      {
        order: 7,
        description: 'Add accessibility announcements (ARIA live region)',
        status: 'pending',
      },
      {
        order: 8,
        description: 'Style notifications with different severity levels',
        status: 'pending',
      },
      { order: 9, description: 'Write unit tests for notification logic', status: 'pending' },
      {
        order: 10,
        description: 'Write integration tests for notification flows',
        status: 'pending',
      },
    ],
  },
  {
    story_id: 'US-E4-017',
    name: 'US-E4-017: Update Form State Management',
    epic_label: 'Epic 004: State Management',
    priority: 'P1',
    status: 'pending',
    progress_percent: 0,
    agent: null,
    agent_type: 'frontend',
    dependencies: ['US-E4-016'],
    subtasks: [
      { order: 1, description: 'Create form state guidelines document', status: 'pending' },
      {
        order: 2,
        description: 'Define when to use Redux vs local state for forms',
        status: 'pending',
      },
      { order: 3, description: 'Create formSlice for complex multi-step forms', status: 'pending' },
      { order: 4, description: 'Implement form initialization action', status: 'pending' },
      { order: 5, description: 'Implement form data update actions', status: 'pending' },
      {
        order: 6,
        description: 'Implement step navigation actions (next, previous)',
        status: 'pending',
      },
      { order: 7, description: 'Add auto-save functionality for complex forms', status: 'pending' },
      { order: 8, description: 'Create example multi-step form component', status: 'pending' },
      { order: 9, description: 'Refactor simple forms to use local state', status: 'pending' },
      { order: 10, description: 'Write tests for form state flows', status: 'pending' },
    ],
  },

  // PHASE 4: Testing & Validation (Stories 18-22) - After Phase 2 & 3
  {
    story_id: 'US-E4-018',
    name: 'US-E4-018: Integration Tests for Data Flow',
    epic_label: 'Epic 004: State Management',
    priority: 'P1',
    status: 'pending',
    progress_percent: 0,
    agent: null,
    agent_type: 'testing',
    dependencies: ['US-E4-012', 'US-E4-017'],
    subtasks: [
      {
        order: 1,
        description: 'Set up integration test infrastructure for state management',
        status: 'pending',
      },
      {
        order: 2,
        description: 'Write React Query data flow tests (fetch and cache)',
        status: 'pending',
      },
      {
        order: 3,
        description: 'Write Redux state flow tests (actions and selectors)',
        status: 'pending',
      },
      { order: 4, description: 'Write cache invalidation tests', status: 'pending' },
      { order: 5, description: 'Write optimistic update tests', status: 'pending' },
      { order: 6, description: 'Write error handling tests', status: 'pending' },
      { order: 7, description: 'Write cross-feature integration tests', status: 'pending' },
      {
        order: 8,
        description: 'Achieve 80%+ test coverage for state management',
        status: 'pending',
      },
      { order: 9, description: 'Update CI pipeline with new tests', status: 'pending' },
      { order: 10, description: 'Verify all tests pass in CI', status: 'pending' },
    ],
  },
  {
    story_id: 'US-E4-019',
    name: 'US-E4-019: Performance Benchmarking',
    epic_label: 'Epic 004: State Management',
    priority: 'P1',
    status: 'pending',
    progress_percent: 0,
    agent: null,
    agent_type: 'backend',
    dependencies: ['US-E4-018'],
    subtasks: [
      {
        order: 1,
        description: 'Create benchmark script for state management performance',
        status: 'pending',
      },
      { order: 2, description: 'Measure baseline metrics (before refactoring)', status: 'pending' },
      { order: 3, description: 'Measure cache hit rate in typical user flow', status: 'pending' },
      { order: 4, description: 'Measure Redux update speed (1000 updates)', status: 'pending' },
      { order: 5, description: 'Measure bundle size impact', status: 'pending' },
      { order: 6, description: 'Measure post-refactoring metrics', status: 'pending' },
      { order: 7, description: 'Verify cache hit rate > 80%', status: 'pending' },
      { order: 8, description: 'Verify Redux updates < 16ms (60fps)', status: 'pending' },
      { order: 9, description: 'Generate performance report', status: 'pending' },
      { order: 10, description: 'Document results in PR', status: 'pending' },
    ],
  },
  {
    story_id: 'US-E4-020',
    name: 'US-E4-020: Cache Hit Rate Validation',
    epic_label: 'Epic 004: State Management',
    priority: 'P2',
    status: 'pending',
    progress_percent: 0,
    agent: null,
    agent_type: 'backend',
    dependencies: ['US-E4-019'],
    subtasks: [
      { order: 1, description: 'Create CacheMetrics class for monitoring', status: 'pending' },
      { order: 2, description: 'Subscribe to QueryCache events', status: 'pending' },
      { order: 3, description: 'Track hits, misses, stale fetches per query', status: 'pending' },
      { order: 4, description: 'Calculate global cache hit rate', status: 'pending' },
      {
        order: 5,
        description: 'Create dashboard for cache metrics visualization',
        status: 'pending',
      },
      { order: 6, description: 'Implement alerts for low hit rate (< 70%)', status: 'pending' },
      { order: 7, description: 'Monitor background refetch patterns', status: 'pending' },
      { order: 8, description: 'Send metrics to analytics service', status: 'pending' },
      { order: 9, description: 'Generate daily cache reports', status: 'pending' },
      { order: 10, description: 'Verify sustained hit rate > 80%', status: 'pending' },
    ],
  },
  {
    story_id: 'US-E4-021',
    name: 'US-E4-021: Bundle Size Impact Check',
    epic_label: 'Epic 004: State Management',
    priority: 'P2',
    status: 'pending',
    progress_percent: 0,
    agent: null,
    agent_type: 'backend',
    dependencies: ['US-E4-020'],
    subtasks: [
      { order: 1, description: 'Install webpack-bundle-analyzer', status: 'pending' },
      { order: 2, description: 'Create bundle analysis script', status: 'pending' },
      { order: 3, description: 'Capture baseline bundle size', status: 'pending' },
      { order: 4, description: 'Build with bundle analyzer plugin', status: 'pending' },
      { order: 5, description: 'Analyze React Query bundle contribution', status: 'pending' },
      { order: 6, description: 'Analyze Redux Toolkit bundle contribution', status: 'pending' },
      { order: 7, description: 'Compare before/after total bundle size', status: 'pending' },
      { order: 8, description: 'Verify size increase < 5KB', status: 'pending' },
      { order: 9, description: 'Implement lazy loading where needed', status: 'pending' },
      { order: 10, description: 'Generate bundle size report for PR', status: 'pending' },
    ],
  },
  {
    story_id: 'US-E4-022',
    name: 'US-E4-022: End-to-End Test Coverage',
    epic_label: 'Epic 004: State Management',
    priority: 'P1',
    status: 'pending',
    progress_percent: 0,
    agent: null,
    agent_type: 'testing',
    dependencies: ['US-E4-021'],
    subtasks: [
      { order: 1, description: 'Create E2E test suite for state management', status: 'pending' },
      {
        order: 2,
        description: 'Write E2E test for creator flow with React Query',
        status: 'pending',
      },
      { order: 3, description: 'Write E2E test for content flow with caching', status: 'pending' },
      { order: 4, description: 'Write E2E test for payment flow', status: 'pending' },
      {
        order: 5,
        description: 'Write E2E test for UI state persistence (theme, modals)',
        status: 'pending',
      },
      { order: 6, description: 'Write E2E test for error recovery scenarios', status: 'pending' },
      { order: 7, description: 'Write E2E test for multi-step form flows', status: 'pending' },
      { order: 8, description: 'Integrate E2E tests with CI pipeline', status: 'pending' },
      { order: 9, description: 'Verify all E2E tests pass consistently', status: 'pending' },
      { order: 10, description: 'Document E2E test coverage', status: 'pending' },
    ],
  },

  // PHASE 5: Documentation & Training (Stories 23-25) - After all implementation
  {
    story_id: 'US-E4-023',
    name: 'US-E4-023: Create Developer Guidelines Document',
    epic_label: 'Epic 004: State Management',
    priority: 'P2',
    status: 'pending',
    progress_percent: 0,
    agent: null,
    agent_type: 'documentation',
    dependencies: ['US-E4-022'],
    subtasks: [
      { order: 1, description: 'Create DEVELOPER_GUIDELINES.md structure', status: 'pending' },
      { order: 2, description: 'Write Quick Decision Guide section', status: 'pending' },
      { order: 3, description: 'Write React Query patterns with code examples', status: 'pending' },
      { order: 4, description: 'Write Redux patterns with code examples', status: 'pending' },
      { order: 5, description: 'Write form state guidelines', status: 'pending' },
      { order: 6, description: 'Document anti-patterns to avoid', status: 'pending' },
      { order: 7, description: 'Create migration guide for existing code', status: 'pending' },
      { order: 8, description: 'Get team review and feedback', status: 'pending' },
      { order: 9, description: 'Publish to team wiki', status: 'pending' },
      { order: 10, description: 'Add to onboarding documentation', status: 'pending' },
    ],
  },
  {
    story_id: 'US-E4-024',
    name: 'US-E4-024: Create Training Workshop Materials',
    epic_label: 'Epic 004: State Management',
    priority: 'P2',
    status: 'pending',
    progress_percent: 0,
    agent: null,
    agent_type: 'documentation',
    dependencies: ['US-E4-023'],
    subtasks: [
      { order: 1, description: 'Create training/ directory structure', status: 'pending' },
      { order: 2, description: 'Create slide deck for workshop', status: 'pending' },
      { order: 3, description: 'Prepare live coding demo script', status: 'pending' },
      { order: 4, description: 'Create hands-on exercises for developers', status: 'pending' },
      { order: 5, description: 'Create exercise solutions', status: 'pending' },
      { order: 6, description: 'Schedule workshop session', status: 'pending' },
      { order: 7, description: 'Deliver workshop to team', status: 'pending' },
      { order: 8, description: 'Record workshop for future reference', status: 'pending' },
      { order: 9, description: 'Collect feedback from attendees', status: 'pending' },
      { order: 10, description: 'Update materials based on feedback', status: 'pending' },
    ],
  },
  {
    story_id: 'US-E4-025',
    name: 'US-E4-025: Create Architecture Decision Record (ADR)',
    epic_label: 'Epic 004: State Management',
    priority: 'P2',
    status: 'pending',
    progress_percent: 0,
    agent: null,
    agent_type: 'documentation',
    dependencies: ['US-E4-024'],
    subtasks: [
      { order: 1, description: 'Create ADR-004-state-management-boundaries.md', status: 'pending' },
      { order: 2, description: 'Write Context section (problem statement)', status: 'pending' },
      { order: 3, description: 'Write Decision section (our choice)', status: 'pending' },
      {
        order: 4,
        description: 'Write Consequences section (positive and negative)',
        status: 'pending',
      },
      { order: 5, description: 'Document alternatives considered', status: 'pending' },
      { order: 6, description: 'Add references and external links', status: 'pending' },
      { order: 7, description: 'Get peer review from senior engineers', status: 'pending' },
      { order: 8, description: 'Incorporate review feedback', status: 'pending' },
      { order: 9, description: 'Add to project ADR index', status: 'pending' },
      { order: 10, description: 'Publish ADR as part of Epic 004 completion', status: 'pending' },
    ],
  },
];

async function populateEpic004() {
  console.log('🔍 Loading tasks.json...\n');
  const tasksData = JSON.parse(await fs.readFile(TASKS_FILE, 'utf8'));

  // Add Epic 004 parent task
  const epic004Parent = {
    id: 'epic-004-parent',
    type: 'epic',
    name: 'Epic 004: State Management - 5/25 complete (Phase 1 done)',
    agent: 'project-orchestrator',
    status: 'in_progress',
    progress_percent: 20,
    started_at: new Date().toISOString(),
    completed_at: null,
  };

  // Check if epic already exists
  const existingEpic = tasksData.phases['active-development'].tasks.find(
    (t) => t.id === 'epic-004-parent'
  );

  if (!existingEpic) {
    tasksData.phases['active-development'].tasks.unshift(epic004Parent);
    console.log('✅ Added Epic 004 parent task\n');
  }

  // Add all 25 stories
  let addedCount = 0;
  let updatedCount = 0;

  for (const story of EPIC_004_STORIES) {
    // Check if story already exists
    const existingStory = tasksData.phases['active-development'].tasks.find(
      (t) => t.story_id === story.story_id
    );

    if (existingStory) {
      // Update existing story
      Object.assign(existingStory, story);
      updatedCount++;
      console.log(`🔄 Updated ${story.story_id}: ${story.name}`);
    } else {
      // Add new story
      const storyTask = {
        id: `story-${story.story_id.toLowerCase()}`,
        type: 'story',
        ...story,
        started_at: story.status === 'completed' ? new Date().toISOString() : null,
        completed_at: story.status === 'completed' ? new Date().toISOString() : null,
      };

      tasksData.phases['active-development'].tasks.push(storyTask);
      addedCount++;
      console.log(`✅ Added ${story.story_id}: ${story.name}`);
    }

    const subtaskCount = story.subtasks.length;
    const completedCount = story.subtasks.filter((st) => st.status === 'completed').length;
    console.log(`   📋 ${completedCount}/${subtaskCount} subtasks complete`);
    console.log('');
  }

  console.log('💾 Saving updated tasks.json...\n');
  await fs.writeFile(TASKS_FILE, JSON.stringify(tasksData, null, 2));

  console.log(`✅ SUCCESS!\n`);
  console.log(`📊 Epic 004 Population Summary:`);
  console.log(`   - Stories added: ${addedCount}`);
  console.log(`   - Stories updated: ${updatedCount}`);
  console.log(`   - Total Epic 004 stories: 25`);
  console.log(`   - Phase 1 complete: 5/5 stories ✅`);
  console.log(`   - Phase 2-5 pending: 20 stories`);
  console.log(`\n📊 Dashboard at http://localhost:3001 now shows:`);
  console.log(`   - Epic 004: 5/25 stories (20% complete)`);
  console.log(`   - All subtasks properly ordered for execution`);
  console.log(`   - Ready for Wave 2 agent coordination\n`);
}

populateEpic004().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
