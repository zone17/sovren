/**
 * 🚩 **FEATURE FLAG TOGGLE - ELITE DEV TOOLS**
 *
 * Elite Engineering Standards:
 * - Development-only component for testing feature flags
 * - Type-safe flag management
 * - Clean UI with instant feedback
 * - Hidden in production builds
 */

import React, { useState } from 'react';
import { featureFlags } from '../../shared/types/feature-flags';

interface FeatureFlagToggleProps {
  isVisible?: boolean;
}

export const FeatureFlagToggle: React.FC<FeatureFlagToggleProps> = ({
  isVisible = process.env.NODE_ENV === 'development',
}) => {
  const [flags, setFlags] = useState(featureFlags);

  if (!isVisible) return null;

  const handleToggle = (flagName: keyof typeof featureFlags) => {
    const newFlags = { ...flags, [flagName]: !flags[flagName] };
    setFlags(newFlags);

    // Update the actual featureFlags object
    Object.assign(featureFlags, { [flagName]: newFlags[flagName] });

    console.log(`🚩 Feature Flag "${flagName}" ${newFlags[flagName] ? 'ENABLED' : 'DISABLED'}`);
  };

  return (
    <div className="fixed bottom-4 right-4 bg-background text-foreground p-4 rounded-lg shadow-lg border border-border z-50">
      <div className="text-sm font-bold mb-2 text-green-400">🚩 DEV: Feature Flags</div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground/40">Backend Integration</span>
          <button
            onClick={() => handleToggle('enableBackendIntegration')}
            className={`
              px-2 py-1 text-xs rounded font-medium transition-colors
              ${
                flags.enableBackendIntegration
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-muted text-muted-foreground/40 hover:bg-accent'
              }
            `}
          >
            {flags.enableBackendIntegration ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground/60 mt-2 border-t border-border pt-2">
        Toggle flags for testing. Refresh to reset.
      </div>
    </div>
  );
};
