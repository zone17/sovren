/**
 * 🚩 **FEATURE FLAGS - ELITE ENGINEERING**
 *
 * Type-safe feature flag configuration for elite development practices
 */

export interface FeatureFlags {
  // 🔗 **FRONTEND-BACKEND INTEGRATION**
  enableBackendIntegration: boolean;
}

export const featureFlags: FeatureFlags = {
  // Default true — only false when explicitly disabled
  enableBackendIntegration: import.meta.env.VITE_ENABLE_BACKEND !== 'false',
};
