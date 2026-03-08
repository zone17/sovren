import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { WellnessErrorBoundary } from '../ErrorBoundary';
import BoundarySettings from './BoundarySettings';
import BurnoutRiskGauge from './BurnoutRiskGauge';
import RestDayTracker from './RestDayTracker';
import SustainableScheduler from './SustainableScheduler';
import WellnessPulseModal from './WellnessPulseModal';
import WellnessResources from './WellnessResources';
import WellnessTrend from './WellnessTrend';
import WorkPatternHeatmap from './WorkPatternHeatmap';

export const WellnessDashboard: React.FC = () => {
  const [pulseModalOpen, setPulseModalOpen] = useState(false);

  return (
    <WellnessErrorBoundary>
      <div className="space-y-6 p-6 bg-background min-h-screen">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1
              className="text-2xl font-bold text-foreground"
              style={{ fontFamily: "'Sora', sans-serif" }}
            >
              Creator Wellness
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor your work patterns and maintain sustainable habits.
            </p>
          </div>
          <Button
            onClick={() => setPulseModalOpen(true)}
            className="bg-gradient-to-r from-violet-600 to-purple-600 shadow-[0_4px_16px_rgba(139,92,246,0.3)] text-white"
          >
            Pulse Check-In
          </Button>
        </div>

        {/* Top row: Burnout gauge + Rest days */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 reveal-stagger">
          <BurnoutRiskGauge />
          <RestDayTracker />
          <SustainableScheduler />
        </div>

        {/* Heatmap */}
        <WorkPatternHeatmap />

        {/* Trend + Boundaries */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <WellnessTrend />
          <BoundarySettings />
        </div>

        {/* Resources */}
        <WellnessResources />

        {/* Pulse check-in modal */}
        <WellnessPulseModal isOpen={pulseModalOpen} onClose={() => setPulseModalOpen(false)} />
      </div>
    </WellnessErrorBoundary>
  );
};

export default WellnessDashboard;
