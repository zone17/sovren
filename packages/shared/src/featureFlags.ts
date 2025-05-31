import { z } from 'zod';

// Define all feature flags and their types here
export const featureFlagSchema = z.object({
  enablePayments: z.boolean().default(false),
  enableAIRecommendations: z.boolean().default(false),
  enableNostrIntegration: z.boolean().default(true),
  enableExperimentalUI: z.boolean().default(false),

  // 🌐 NOSTR Protocol Feature Flags (Granular Control)
  enableNostrKeyGeneration: z.boolean().default(true),
  enableNostrEventPublishing: z.boolean().default(true),
  enableNostrEventSubscription: z.boolean().default(true),
  enableNostrDirectMessages: z.boolean().default(false), // NIP-04
  enableNostrContactList: z.boolean().default(true), // NIP-02
  enableNostrEventCaching: z.boolean().default(true),
  enableNostrRelay: z.boolean().default(true),
  enableNostrAIContentDiscovery: z.boolean().default(false),
  enableNostrMobileOptimizations: z.boolean().default(true),

  // Add more flags as needed
});

export type FeatureFlags = z.infer<typeof featureFlagSchema>;

// Default flags (used for new environments or as fallback)
export const defaultFeatureFlags: FeatureFlags = featureFlagSchema.parse({});

// Utility to validate and parse flags from any source
export function parseFeatureFlags(input: unknown): FeatureFlags {
  return featureFlagSchema.parse(input);
}
