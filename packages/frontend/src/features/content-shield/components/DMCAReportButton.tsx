import React from 'react';
import { Button } from '@/components/ui/button';
import { useDmcaReport } from '../hooks/useDmcaReport';

interface DMCAReportButtonProps {
  alertId: string;
}

export const DMCAReportButton: React.FC<DMCAReportButtonProps> = ({ alertId }) => {
  const mutation = useDmcaReport();

  return (
    <div>
      <Button
        size="sm"
        className="bg-red-600 hover:bg-red-700 text-xs"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate({ alertId, format: 'json' })}
        aria-label="Generate DMCA takedown report"
      >
        {mutation.isPending ? 'Generating...' : 'DMCA Report'}
      </Button>

      {mutation.isSuccess && (
        <p className="text-xs text-green-600 mt-1">Report generated.</p>
      )}
      {mutation.isError && (
        <p className="text-xs text-red-600 mt-1">Report generation failed.</p>
      )}
    </div>
  );
};

export default DMCAReportButton;
