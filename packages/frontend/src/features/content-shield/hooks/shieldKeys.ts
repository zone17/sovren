export const shieldKeys = {
  all: ['shield'] as const,
  provenance: () => [...shieldKeys.all, 'provenance'] as const,
  provenanceDetail: (contentId: string) => [...shieldKeys.provenance(), contentId] as const,
  alerts: () => [...shieldKeys.all, 'alerts'] as const,
  alertList: (status: string, page: number) => [...shieldKeys.alerts(), status, page] as const,
  alertDetail: (alertId: string) => [...shieldKeys.alerts(), 'detail', alertId] as const,
  fingerprints: () => [...shieldKeys.all, 'fingerprints'] as const,
  fingerprintCoverage: (creatorId: string, page: number) =>
    [...shieldKeys.fingerprints(), creatorId, page] as const,
};
