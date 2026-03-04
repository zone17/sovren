// Content Shield Feature Module Exports

// Components
export { ShieldDashboard } from './components/ShieldDashboard';
export { AuthenticityBadge } from './components/AuthenticityBadge';
export { AlertsFeed } from './components/AlertsFeed';
export { FingerprintCoverage } from './components/FingerprintCoverage';
export { ProvenanceChainViewer } from './components/ProvenanceChainViewer';

// Error Boundary
export { ContentShieldErrorBoundary } from './ErrorBoundary';

// Hooks
export { useAlertDetail, useAlerts, useUpdateAlertStatus } from './hooks/useAlerts';
export { useDmcaReport } from './hooks/useDmcaReport';
export { useFingerprintCoverage } from './hooks/useFingerprintCoverage';
export { useProvenanceChain } from './hooks/useProvenanceChain';
export { useSignProvenance } from './hooks/useSignProvenance';
export { usePublishWithProvenance } from './hooks/usePublishWithProvenance';

// API Service
export { shieldApi } from './services/shieldApi';

// Types
export type {
  AlertDetail,
  AlertStatus,
  ContentAlert,
  DMCAReport,
  FingerprintCoverageData,
  MatchLevel,
  ProvenanceData,
  RelayConfirmation,
  SignProvenanceBody,
  VerificationStatus,
} from './types';
