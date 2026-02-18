import React from 'react';
import type { RedFlag } from '@shared/types/finance';

interface RedFlagReportProps {
  redFlags: RedFlag[];
}

const SEVERITY_STYLES: Record<RedFlag['severity'], { badge: string; icon: string }> = {
  high: { badge: 'bg-red-100 text-red-800 border-red-200', icon: 'text-red-500' },
  medium: { badge: 'bg-orange-100 text-orange-800 border-orange-200', icon: 'text-orange-500' },
  low: { badge: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: 'text-yellow-500' },
};

const FLAG_TYPE_LABELS: Record<string, string> = {
  exclusivity: 'Exclusivity Clause',
  perpetual: 'Perpetual License',
  delayed_payment: 'Delayed Payment Terms',
  ip_assignment: 'IP Assignment',
};

const RedFlagReport: React.FC<RedFlagReportProps> = ({ redFlags }) => {
  if (redFlags.length === 0) {
    return (
      <div
        className="rounded-lg border border-green-200 bg-green-50 p-4"
        role="status"
        aria-label="No red flags found"
      >
        <p className="text-sm font-medium text-green-800">No red flags detected.</p>
        <p className="mt-1 text-xs text-green-600">
          This contract looks clean. Always review with a legal professional before signing.
        </p>
      </div>
    );
  }

  const highCount = redFlags.filter((f) => f.severity === 'high').length;
  const mediumCount = redFlags.filter((f) => f.severity === 'medium').length;
  const lowCount = redFlags.filter((f) => f.severity === 'low').length;

  return (
    <section aria-labelledby="red-flags-heading" className="space-y-3">
      <div className="flex items-center gap-3">
        <h4 id="red-flags-heading" className="text-sm font-semibold text-gray-900">
          Red Flag Analysis
        </h4>
        <div className="flex gap-2 text-xs">
          {highCount > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">
              {highCount} high
            </span>
          )}
          {mediumCount > 0 && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-orange-700">
              {mediumCount} medium
            </span>
          )}
          {lowCount > 0 && (
            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-yellow-700">
              {lowCount} low
            </span>
          )}
        </div>
      </div>

      <ul className="space-y-2" role="list" aria-label="Red flags found in contract">
        {redFlags.map((flag, index) => {
          const styles = SEVERITY_STYLES[flag.severity];
          return (
            <li
              key={`${flag.type}-${index}`}
              className={`rounded-lg border p-3 ${styles.badge}`}
            >
              <div className="flex items-start gap-2">
                <span className={`mt-0.5 text-lg leading-none ${styles.icon}`} aria-hidden="true">
                  {flag.severity === 'high' ? '!' : flag.severity === 'medium' ? '⚠' : '○'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold uppercase tracking-wide">
                      {FLAG_TYPE_LABELS[flag.type] ?? flag.type}
                    </span>
                    <span className="text-xs capitalize opacity-75">({flag.severity})</span>
                  </div>
                  <blockquote className="mt-1 text-xs italic opacity-80 line-clamp-2">
                    "{flag.match}"
                  </blockquote>
                  <p className="mt-1 text-xs">{flag.suggestion}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default RedFlagReport;
