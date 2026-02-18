import React, { useState, useEffect } from 'react';
import { useContractTemplate, useCreateContract, useAnalyzeContract } from '../hooks/useContracts';
import RedFlagReport from './RedFlagReport';
import type { RedFlag } from '@shared/types/finance';

interface ContractEditorProps {
  templateId: string;
  onSaved?: () => void;
  onCancel?: () => void;
}

const ContractEditor: React.FC<ContractEditorProps> = ({ templateId, onSaved, onCancel }) => {
  const { data: template, isLoading } = useContractTemplate(templateId);
  const createMutation = useCreateContract();
  const analyzeMutation = useAnalyzeContract();

  const [counterparty, setCounterparty] = useState('');
  const [filledText, setFilledText] = useState('');
  const [redFlags, setRedFlags] = useState<RedFlag[]>([]);
  const [analyzed, setAnalyzed] = useState(false);

  useEffect(() => {
    if (template) {
      setFilledText(template.templateText);
      setRedFlags(template.redFlags);
      setAnalyzed(false);
    }
  }, [template]);

  const handleAnalyze = () => {
    analyzeMutation.mutate(filledText, {
      onSuccess: (res) => {
        setRedFlags(res.data);
        setAnalyzed(true);
      },
    });
  };

  const handleSave = () => {
    if (!counterparty.trim() || !filledText.trim()) return;
    createMutation.mutate(
      { templateId, counterparty, filledText },
      { onSuccess: () => onSaved?.() }
    );
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 w-40 rounded bg-gray-200" />
        <div className="h-64 rounded bg-gray-100" />
      </div>
    );
  }

  if (!template) {
    return <p className="text-sm text-gray-500">Template not found.</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-gray-900">{template.name}</h3>
        <p className="text-xs text-gray-500 mt-0.5 capitalize">{template.category} contract</p>
      </div>

      {/* Counterparty */}
      <div>
        <label htmlFor="counterparty" className="block text-sm font-medium text-gray-700">
          Counterparty Name
        </label>
        <input
          id="counterparty"
          type="text"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Company or individual name"
          value={counterparty}
          onChange={(e) => setCounterparty(e.target.value)}
        />
      </div>

      {/* Contract text editor */}
      <div>
        <label htmlFor="contract-text" className="block text-sm font-medium text-gray-700">
          Contract Text
        </label>
        <p className="text-xs text-gray-500 mt-0.5">
          Fill in the placeholders (marked with [BRACKETS]) with your specific terms.
        </p>
        <textarea
          id="contract-text"
          rows={16}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={filledText}
          onChange={(e) => { setFilledText(e.target.value); setAnalyzed(false); }}
          aria-label="Contract text editor"
        />
      </div>

      {/* Red flag analysis */}
      <div>
        <button
          type="button"
          className="rounded-md border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:opacity-50 transition-colors"
          onClick={handleAnalyze}
          disabled={analyzeMutation.isPending || !filledText.trim()}
          aria-busy={analyzeMutation.isPending}
        >
          {analyzeMutation.isPending ? 'Analyzing...' : 'Analyze for Red Flags'}
        </button>

        {analyzed && (
          <div className="mt-3">
            <RedFlagReport redFlags={redFlags} />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 transition-colors"
          onClick={handleSave}
          disabled={createMutation.isPending || !counterparty.trim() || !filledText.trim()}
          aria-busy={createMutation.isPending}
        >
          {createMutation.isPending ? 'Saving...' : 'Save Contract'}
        </button>
        {onCancel && (
          <button
            type="button"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>

      {createMutation.isError && (
        <p className="text-sm text-red-600" role="alert">
          Failed to save contract. Please try again.
        </p>
      )}
    </div>
  );
};

export default ContractEditor;
