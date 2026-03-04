/**
 * 🚀 **FEATURES MODULE MASTER EXPORTS**
 *
 * Elite Engineering Standards:
 * - Feature-based modular architecture
 * - Clean separation of concerns
 * - Type-safe module boundaries
 * - TDD-compliant structure
 */

// 🔐 **AUTHENTICATION FEATURE**
export * from './auth';

// 📝 **CONTENT MANAGEMENT FEATURE**
export * from './content';

// 🤖 **ANALYTICS & AI FEATURE**
export * from './analytics';

// 📊 **DASHBOARD & MONITORING FEATURE**
export * from './dashboard';

// 🔍 **DISCOVERY FEATURE**
export * from './discovery';

// ⚡ **PAYMENTS FEATURE**
export * from './payments';

// BUSINESS MANAGER FEATURE
export * from './business';

// CREATOR NETWORK FEATURE
export * from './creator-network';

// MULTI-PLATFORM HUB FEATURE
export * from './multi-platform';

// WELLNESS FEATURE
export * from './wellness';

// CONTENT SHIELD FEATURE
// Note: AlertStatus is aliased to avoid collision with dashboard/AlertStatus
export {
  ShieldDashboard,
  AuthenticityBadge,
  AlertsFeed,
  FingerprintCoverage,
  ProvenanceChainViewer,
  ContentShieldErrorBoundary,
  useAlertDetail,
  useAlerts,
  useUpdateAlertStatus,
  useDmcaReport,
  useFingerprintCoverage,
  useProvenanceChain,
  shieldApi,
} from './content-shield';
export type {
  AlertDetail,
  AlertStatus as ShieldAlertStatus,
  ContentAlert,
  DMCAReport,
  FingerprintCoverageData,
  MatchLevel,
  ProvenanceData,
  RelayConfirmation,
  SignProvenanceBody,
  VerificationStatus,
} from './content-shield';
