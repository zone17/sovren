import React, { useState } from 'react';
import { useBYOK, useBYOKStatus } from '../hooks/useBYOK';
import type { BYOKSubmitPayload } from '../types/inbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

const FIELD_DESCRIPTIONS: Record<keyof BYOKSubmitPayload, string> = {
  api_key: 'API Key (Consumer Key)',
  api_secret: 'API Secret (Consumer Secret)',
  access_token: 'Access Token',
  access_token_secret: 'Access Token Secret',
};

const FIELD_LABELS: Record<keyof BYOKSubmitPayload, string> = {
  api_key: 'API Key',
  api_secret: 'API Secret',
  access_token: 'Access Token',
  access_token_secret: 'Access Token Secret',
};

const emptyForm: BYOKSubmitPayload = {
  api_key: '',
  api_secret: '',
  access_token: '',
  access_token_secret: '',
};

export const BYOKSetup: React.FC = () => {
  const { data: currentStatus, isLoading: statusLoading } = useBYOKStatus();
  const { status, validationResult, isPending, isRevoking, submit, revoke, reset } = useBYOK();

  const [form, setForm] = useState<BYOKSubmitPayload>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false);

  const isAlreadyConnected = currentStatus?.valid || currentStatus?.write_only;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit(form);
  };

  const handleRevoke = () => {
    setRevokeConfirmOpen(true);
  };

  const handleFieldChange =
    (field: keyof BYOKSubmitPayload) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (status !== 'idle') reset();
    };

  const inputClass =
    'w-full rounded-md border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-muted disabled:text-muted-foreground/60';

  if (statusLoading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-48 rounded bg-muted" />
          <div className="h-12 rounded bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">X / Twitter API Access</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your own X/Twitter API keys to enable inbox reading and analytics. Without keys,
            Sovren operates in write-only mode.
          </p>
        </div>
        {isAlreadyConnected && (
          <span className="ml-4 shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
            {currentStatus?.write_only ? 'Write-only' : 'Connected'}
          </span>
        )}
      </div>

      {/* Current status banner */}
      {isAlreadyConnected && !showForm && (
        <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3">
          <div className="flex items-center justify-between">
            <div>
              {currentStatus?.valid && currentStatus.username && (
                <p className="text-sm font-medium text-green-800">
                  Connected as @{currentStatus.username}
                </p>
              )}
              {currentStatus?.write_only && (
                <p className="text-sm font-medium text-amber-700">
                  Write-only mode — add API keys to enable reading
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-xs text-indigo-600 hover:underline focus:outline-none"
                onClick={() => setShowForm(true)}
                aria-label="Update API keys"
              >
                Update keys
              </button>
              <button
                type="button"
                className="text-xs text-red-600 hover:underline focus:outline-none"
                onClick={handleRevoke}
                disabled={isRevoking}
                aria-label="Remove API keys"
              >
                {isRevoking ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Validation feedback */}
      {status === 'valid' && validationResult && (
        <div role="alert" className="mt-4 rounded-md border border-green-200 bg-green-50 p-3">
          <p className="text-sm font-medium text-green-800">
            Keys validated successfully
            {validationResult.username ? ` — connected as @${validationResult.username}` : ''}.
          </p>
        </div>
      )}

      {status === 'write_only' && (
        <div role="alert" className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-800">
            Keys saved in write-only mode. Read access requires the X/Twitter Basic API ($200/mo).
          </p>
        </div>
      )}

      {status === 'invalid' && (
        <div role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-medium text-red-800">
            Validation failed. Check your keys and try again.
          </p>
          {validationResult?.error && (
            <p className="mt-1 text-xs text-red-600">{validationResult.error}</p>
          )}
        </div>
      )}

      {/* Key entry form */}
      {(!isAlreadyConnected || showForm) && status !== 'valid' && (
        <form
          className="mt-4 space-y-3"
          onSubmit={handleSubmit}
          aria-label="X/Twitter API key configuration"
        >
          {(Object.keys(emptyForm) as Array<keyof BYOKSubmitPayload>).map((field) => (
            <div key={field}>
              <label
                htmlFor={`byok-${field}`}
                className="mb-1 block text-sm font-medium text-foreground"
              >
                {FIELD_LABELS[field]}
              </label>
              <input
                id={`byok-${field}`}
                type="password"
                className={inputClass}
                placeholder={FIELD_DESCRIPTIONS[field]}
                value={form[field]}
                onChange={handleFieldChange(field)}
                disabled={isPending}
                required
                autoComplete="off"
                aria-describedby={`byok-${field}-desc`}
              />
            </div>
          ))}

          <p className="text-xs text-muted-foreground/60">
            Keys are encrypted with AES-256-GCM and stored separately from your OAuth tokens. Sovren
            never uses your keys for any purpose other than reading your X/Twitter data.
          </p>

          <div className="flex justify-end gap-2">
            {showForm && (
              <button
                type="button"
                className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
                onClick={() => {
                  setShowForm(false);
                  setForm(emptyForm);
                  reset();
                }}
                disabled={isPending}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              disabled={
                isPending ||
                !form.api_key.trim() ||
                !form.api_secret.trim() ||
                !form.access_token.trim() ||
                !form.access_token_secret.trim()
              }
              aria-label="Validate and save API keys"
            >
              {isPending ? 'Validating...' : 'Save & Validate'}
            </button>
          </div>
        </form>
      )}

      {!isAlreadyConnected && status === 'idle' && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-700">
            Without API keys, X/Twitter operates in write-only mode. You can still cross-post
            content but cannot read your inbox or view analytics from X/Twitter.
          </p>
        </div>
      )}

      <ConfirmDialog
        open={revokeConfirmOpen}
        onOpenChange={setRevokeConfirmOpen}
        title="Remove API keys"
        description="Remove your X/Twitter API keys? You will lose read access."
        confirmLabel="Remove keys"
        onConfirm={revoke}
      />
    </div>
  );
};

export default BYOKSetup;
