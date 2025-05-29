import { z } from 'zod';

// Define all feature flags and their types here
export const featureFlagSchema = z.object({
  enablePayments: z.boolean().default(false),
  enableAIRecommendations: z.boolean().default(false),
  enableNostrIntegration: z.boolean().default(true),
  enableExperimentalUI: z.boolean().default(false),
  // Add more flags as needed
});

export type FeatureFlags = z.infer<typeof featureFlagSchema>;

// Default flags (used for new environments or as fallback)
export const defaultFeatureFlags: FeatureFlags = featureFlagSchema.parse({});

// Utility to validate and parse flags from any source
export function parseFeatureFlags(input: unknown): FeatureFlags {
  return featureFlagSchema.parse(input);
}
