// Content Shield Feature Module Exports

// Error Boundary
export { ContentShieldErrorBoundary } from './ErrorBoundary';

// Hooks
export { useAlertDetail, useAlerts, useUpdateAlertStatus } from './hooks/useAlerts';
export { useDmcaReport } from './hooks/useDmcaReport';
export { useFingerprintCoverage } from './hooks/useFingerprintCoverage';
export { useProvenanceChain } from './hooks/useProvenanceChain';

// API Service
export { shieldApi } from './services/shieldApi';

// Types
export type {
  AlertDetail,
  AlertStatus,
  ContentAlert,
  DMCAReport,
  FingerprintCoverageData,
  FingerprintEntry,
  MatchLevel,
  ProvenanceData,
  RelayConfirmation,
  VerificationStatus,
} from './types';
