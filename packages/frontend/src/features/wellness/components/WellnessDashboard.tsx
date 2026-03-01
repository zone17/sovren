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
      <div className="space-y-6 p-6 bg-gradient-to-br from-green-50/50 via-white to-blue-50/50 min-h-screen">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Creator Wellness</h1>
            <p className="text-sm text-gray-500 mt-1">
              Monitor your work patterns and maintain sustainable habits.
            </p>
          </div>
          <Button onClick={() => setPulseModalOpen(true)}>Pulse Check-In</Button>
        </div>

        {/* Top row: Burnout gauge + Rest days */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
