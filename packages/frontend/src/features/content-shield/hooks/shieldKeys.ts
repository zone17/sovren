export const shieldKeys = {
  all: ['shield'] as const,
  provenance: () => [...shieldKeys.all, 'provenance'] as const,
  provenanceDetail: (contentId: string) => [...shieldKeys.provenance(), contentId] as const,
  alerts: () => [...shieldKeys.all, 'alerts'] as const,
  // NOTE: existing useAlerts key is ['shield','alerts',status,page] — no limit in key
  alertList: (status: string, page: number) => [...shieldKeys.alerts(), status, page] as const,
  alertDetail: (alertId: string) => [...shieldKeys.alerts(), 'detail', alertId] as const,
  fingerprints: () => [...shieldKeys.all, 'fingerprints'] as const,
  // NOTE: existing useFingerprintCoverage key is ['shield','fingerprints',creatorId,page] — no limit in key
  fingerprintCoverage: (creatorId: string, page: number) =>
    [...shieldKeys.fingerprints(), creatorId, page] as const,
};
