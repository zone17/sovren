import React from 'react';
import type { OrderStatus } from '@shared/types/community';

const ESCROW_STAGES: Array<{ status: OrderStatus; label: string }> = [
  { status: 'pending', label: 'Pending' },
  { status: 'escrow_funded', label: 'Escrow Funded' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'completed', label: 'Completed' },
];

const TERMINAL_STATUSES: OrderStatus[] = ['completed', 'refunded', 'expired', 'disputed'];

const STATUS_INDEX: Partial<Record<OrderStatus, number>> = {
  pending: 0,
  escrow_funded: 1,
  in_progress: 2,
  completed: 3,
};

interface EscrowStatusProps {
  status: OrderStatus;
  expiresAt?: string;
  amountSats: number;
}

function getTimeRemaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h remaining`;
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m remaining`;
}

const EscrowStatus: React.FC<EscrowStatusProps> = ({ status, expiresAt, amountSats }) => {
  const currentIndex = STATUS_INDEX[status] ?? -1;
  const isTerminal = TERMINAL_STATUSES.includes(status);
  const isNegativeTerminal = status === 'refunded' || status === 'expired' || status === 'disputed';

  return (
    <div
      className="rounded-lg border bg-white p-4 space-y-4"
      aria-label="Escrow status"
      role="region"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900">Escrow Status</h4>
        <span className="text-sm font-mono font-semibold text-gray-700">
          {amountSats.toLocaleString()} sats
        </span>
      </div>

      {/* Terminal negative statuses */}
      {isNegativeTerminal && (
        <div
          className={`rounded-md px-3 py-2 text-sm font-medium ${
            status === 'disputed'
              ? 'bg-red-100 text-red-800'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          {status === 'disputed' && 'Order disputed — awaiting resolution'}
          {status === 'refunded' && 'Escrow refunded to buyer'}
          {status === 'expired' && 'Order expired — escrow released'}
        </div>
      )}

      {/* Progress bar for happy path */}
      {!isNegativeTerminal && (
        <div role="progressbar" aria-valuenow={currentIndex + 1} aria-valuemax={4}>
          <div className="flex items-center gap-0">
            {ESCROW_STAGES.map((stage, i) => {
              const isDone = i < currentIndex;
              const isCurrent = i === currentIndex;
              return (
                <React.Fragment key={stage.status}>
                  <div className="flex flex-col items-center">
                    <div
                      className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors ${
                        isDone
                          ? 'bg-green-500 border-green-500 text-white'
                          : isCurrent
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-white border-gray-300 text-gray-400'
                      }`}
                      aria-label={`${stage.label}${isDone ? ' (done)' : isCurrent ? ' (current)' : ''}`}
                    >
                      {isDone ? '✓' : i + 1}
                    </div>
                    <span
                      className={`mt-1 text-xs ${
                        isCurrent ? 'text-indigo-700 font-semibold' : isDone ? 'text-green-600' : 'text-gray-400'
                      }`}
                    >
                      {stage.label}
                    </span>
                  </div>
                  {i < ESCROW_STAGES.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 mx-1 ${isDone ? 'bg-green-400' : 'bg-gray-200'}`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* Time remaining for non-terminal orders */}
      {!isTerminal && expiresAt && (
        <p className="text-xs text-gray-500">
          Auto-expires: {getTimeRemaining(expiresAt)}
        </p>
      )}

      {/* Custodial notice */}
      <p className="text-xs text-gray-400">
        Funds held in Sovren custodial escrow. Auto-refunded after 30 days if not completed.
      </p>
    </div>
  );
};

export default EscrowStatus;
