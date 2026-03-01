/**
 * NOSTR Components - Barrel Export
 *
 * Epic 003: NOSTR Consolidation
 *
 * All NOSTR-related UI components
 */

export { FilterBuilder } from './FilterBuilder';
export { NostrKeyManagement } from './NostrKeyManagement';
export { DMInbox } from './DMInbox';
export { NostrMonitoringDashboard } from './NostrMonitoringDashboard';
export { default as NostrMonitoringDashboardDefault } from './NostrMonitoringDashboard';

// Re-export types for convenience
export type { NostrFilter, NostrFilterBuilder, CommonFilters } from '@shared/types/nostr/index';
export type { NostrMonitoringDashboardProps } from './NostrMonitoringDashboard';
