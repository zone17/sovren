'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.defaultFeatureFlags = exports.featureFlagSchema = void 0;
exports.parseFeatureFlags = parseFeatureFlags;
const zod_1 = require('zod');
// Define all feature flags and their types here
exports.featureFlagSchema = zod_1.z.object({
  enablePayments: zod_1.z.boolean().default(false),
  enableAIRecommendations: zod_1.z.boolean().default(false),
  enableNostrIntegration: zod_1.z.boolean().default(true),
  enableExperimentalUI: zod_1.z.boolean().default(false),
  // Add more flags as needed
});
// Default flags (used for new environments or as fallback)
exports.defaultFeatureFlags = exports.featureFlagSchema.parse({});
// Utility to validate and parse flags from any source
function parseFeatureFlags(input) {
  return exports.featureFlagSchema.parse(input);
}
