import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useSubmitPulse } from '../hooks/useWellnessPulse';

interface WellnessPulseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SCALE_LABELS: Record<number, string> = {
  1: 'Very low',
  2: 'Low',
  3: 'Moderate',
  4: 'High',
  5: 'Very high',
};

export const WellnessPulseModal: React.FC<WellnessPulseModalProps> = ({ isOpen, onClose }) => {
  const [energy, setEnergy] = useState(3);
  const [motivation, setMotivation] = useState(3);
  const [stress, setStress] = useState(2);
  const submitMutation = useSubmitPulse();

  const handleSubmit = () => {
    submitMutation.mutate(
      { energy, motivation, stress },
      {
        onSuccess: () => {
          onClose();
          setEnergy(3);
          setMotivation(3);
          setStress(2);
        },
      }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Wellness Check-In</DialogTitle>
          <DialogDescription>Quick pulse check. How are you feeling right now?</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Energy */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Energy</Label>
              <span className="text-xs text-gray-500">{SCALE_LABELS[energy]}</span>
            </div>
            <Slider
              value={[energy]}
              onValueChange={([v]) => setEnergy(v)}
              min={1}
              max={5}
              step={1}
              aria-label="Energy level"
            />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>Exhausted</span>
              <span>Energized</span>
            </div>
          </div>

          {/* Motivation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Motivation</Label>
              <span className="text-xs text-gray-500">{SCALE_LABELS[motivation]}</span>
            </div>
            <Slider
              value={[motivation]}
              onValueChange={([v]) => setMotivation(v)}
              min={1}
              max={5}
              step={1}
              aria-label="Motivation level"
            />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>Unmotivated</span>
              <span>Driven</span>
            </div>
          </div>

          {/* Stress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Stress</Label>
              <span className="text-xs text-gray-500">{SCALE_LABELS[stress]}</span>
            </div>
            <Slider
              value={[stress]}
              onValueChange={([v]) => setStress(v)}
              min={1}
              max={5}
              step={1}
              aria-label="Stress level"
            />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>Relaxed</span>
              <span>Overwhelmed</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Skip
          </Button>
          <Button onClick={handleSubmit} disabled={submitMutation.isPending}>
            {submitMutation.isPending ? 'Saving...' : 'Submit'}
          </Button>
        </DialogFooter>

        {submitMutation.isError && (
          <p className="text-xs text-red-600 text-center mt-2">
            Failed to save check-in. Please try again.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WellnessPulseModal;
