import { z } from 'zod';
import {
  featureFlagSchema,
  type FeatureFlags,
  parseFeatureFlags,
  defaultFeatureFlags,
} from './featureFlags';

describe('Feature Flags', () => {
  describe('featureFlagSchema', () => {
    it('should validate default feature flags', () => {
      const result = featureFlagSchema.safeParse(defaultFeatureFlags);
      expect(result.success).toBe(true);
    });

    it('should accept valid feature flag configuration', () => {
      const validFlags = {
        enablePayments: true,
        enableAIRecommendations: false,
        enableNostrIntegration: true,
        enableExperimentalUI: true,
      };

      const result = featureFlagSchema.safeParse(validFlags);
      expect(result.success).toBe(true);
    });

    it('should reject invalid feature flag configuration', () => {
      const invalidFlags = {
        enablePayments: 'true', // should be boolean
        enableAIRecommendations: false,
        enableNostrIntegration: true,
      };

      const result = featureFlagSchema.safeParse(invalidFlags);
      expect(result.success).toBe(false);
    });

    it('should use default values for missing flags', () => {
      const partialFlags = {
        enablePayments: true,
      };

      const result = featureFlagSchema.parse(partialFlags);
      expect(result.enablePayments).toBe(true);
      expect(result.enableAIRecommendations).toBe(false); // default
      expect(result.enableNostrIntegration).toBe(true); // default
      expect(result.enableExperimentalUI).toBe(false); // default
    });
  });

  describe('parseFeatureFlags', () => {
    it('should parse valid feature flags', () => {
      const input = {
        enablePayments: true,
        enableAIRecommendations: true,
        enableNostrIntegration: false,
        enableExperimentalUI: false,
      };

      const result = parseFeatureFlags(input);
      expect(result).toEqual(input);
    });

    it('should throw on invalid input', () => {
      const invalidInput = {
        enablePayments: 'invalid',
      };

      expect(() => parseFeatureFlags(invalidInput)).toThrow();
    });
  });

  describe('defaultFeatureFlags', () => {
    it('should have all required flags with default values', () => {
      expect(defaultFeatureFlags.enablePayments).toBe(false);
      expect(defaultFeatureFlags.enableAIRecommendations).toBe(false);
      expect(defaultFeatureFlags.enableNostrIntegration).toBe(true);
      expect(defaultFeatureFlags.enableExperimentalUI).toBe(false);
    });
  });
});
