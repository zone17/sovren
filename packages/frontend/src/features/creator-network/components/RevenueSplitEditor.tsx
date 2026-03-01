import React, { useMemo } from 'react';
import type { RevenueSplitEntry } from '../types/community';

/**
 * Largest-remainder algorithm for distributing sats across splits.
 * Guarantees the sum of allocations exactly equals totalSats.
 */
function allocateSats(totalSats: number, splitsBps: number[]): number[] {
  const exact = splitsBps.map((bps) => (totalSats * bps) / 10000);
  const floored = exact.map(Math.floor);
  const remainder = totalSats - floored.reduce((a, b) => a + b, 0);
  const fractions = exact.map((e, i) => ({ i, frac: e - floored[i] }));
  fractions.sort((a, b) => b.frac - a.frac);
  for (let j = 0; j < remainder; j++) {
    floored[fractions[j].i]++;
  }
  return floored;
}

interface RevenueSplitEditorProps {
  entries: RevenueSplitEntry[];
  onChange: (entries: RevenueSplitEntry[]) => void;
  previewSats?: number;
  disabled?: boolean;
}

const RevenueSplitEditor: React.FC<RevenueSplitEditorProps> = ({
  entries,
  onChange,
  previewSats = 10000,
  disabled = false,
}) => {
  const totalBps = entries.reduce((sum, e) => sum + e.splitBps, 0);
  const isValid = totalBps === 10000;

  const allocations = useMemo(() => {
    if (entries.length === 0) return [];
    return allocateSats(
      previewSats,
      entries.map((e) => e.splitBps)
    );
  }, [entries, previewSats]);

  const updateEntry = (index: number, pctString: string) => {
    const pct = parseFloat(pctString);
    if (isNaN(pct)) return;
    const bps = Math.round(pct * 100);
    const next = entries.map((e, i) => (i === index ? { ...e, splitBps: bps } : e));
    onChange(next);
  };

  const addEntry = () => {
    onChange([...entries, { creatorId: '', splitBps: 0 }]);
  };

  const removeEntry = (index: number) => {
    onChange(entries.filter((_, i) => i !== index));
  };

  const updateCreatorId = (index: number, creatorId: string) => {
    onChange(entries.map((e, i) => (i === index ? { ...e, creatorId } : e)));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Revenue Split</h3>
        <span
          className={`text-xs font-medium ${
            isValid ? 'text-green-600' : totalBps > 10000 ? 'text-red-600' : 'text-yellow-600'
          }`}
          role="status"
          aria-live="polite"
        >
          {(totalBps / 100).toFixed(2)}% / 100%
          {isValid ? ' — Valid' : totalBps > 10000 ? ' — Exceeds 100%' : ' — Does not sum to 100%'}
        </span>
      </div>

      {/* Entries */}
      <ul className="space-y-3" role="list">
        {entries.map((entry, i) => (
          <li key={i} className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Creator ID"
              value={entry.creatorId}
              onChange={(e) => updateCreatorId(i, e.target.value)}
              disabled={disabled}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-gray-50"
              aria-label={`Collaborator ${i + 1} creator ID`}
            />
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={(entry.splitBps / 100).toFixed(2)}
                onChange={(e) => updateEntry(i, e.target.value)}
                disabled={disabled}
                className="w-20 rounded-md border border-gray-300 px-2 py-2 text-sm text-right focus:border-indigo-500 focus:outline-none disabled:bg-gray-50"
                aria-label={`Split percentage for collaborator ${i + 1}`}
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
            {!disabled && (
              <button
                onClick={() => removeEntry(i)}
                className="text-gray-400 hover:text-red-500 text-lg leading-none"
                aria-label={`Remove collaborator ${i + 1}`}
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>

      {!disabled && (
        <button
          onClick={addEntry}
          className="text-sm text-indigo-600 hover:underline"
          aria-label="Add collaborator"
        >
          + Add collaborator
        </button>
      )}

      {/* Preview */}
      {entries.length > 0 && (
        <div
          className={`rounded-lg p-3 text-sm ${
            isValid ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
          }`}
          aria-label="Split preview"
        >
          <p className="text-xs font-semibold text-gray-700 mb-2">
            Preview: For a {previewSats.toLocaleString()} sat payment
          </p>
          <ul className="space-y-1">
            {entries.map((entry, i) => (
              <li key={i} className="flex justify-between text-xs text-gray-600">
                <span className="truncate max-w-[180px]">
                  {entry.displayName ?? (entry.creatorId || `Collaborator ${i + 1}`)}
                </span>
                <span className="font-mono">{allocations[i]?.toLocaleString() ?? '0'} sats</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default RevenueSplitEditor;
