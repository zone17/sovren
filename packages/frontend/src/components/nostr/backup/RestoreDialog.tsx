/**
 * NOSTR Restore Dialog Component
 * US-322: Secure backup and recovery - Restore UI
 *
 * Features:
 * - File upload and validation
 * - Password entry
 * - Backup verification
 * - Recovery options
 * - Progress tracking
 */

import React, { useState, useCallback } from 'react';
import { nostrBackupService } from '../../../services/nostr/NOSTRBackupService';
import type {
  BackupFile,
  BackupVerification,
  RecoveryResult,
  RecoveryOptions,
} from '../../../services/nostr/types/backup';

interface RestoreDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: RecoveryResult) => void;
}

export const RestoreDialog: React.FC<RestoreDialogProps> = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState<
    'upload' | 'verify' | 'options' | 'password' | 'restoring' | 'success' | 'error'
  >('upload');
  const [backupFile, setBackupFile] = useState<BackupFile | null>(null);
  const [verification, setVerification] = useState<BackupVerification | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [recoveryOptions, setRecoveryOptions] = useState<RecoveryOptions>({
    recoverKeys: true,
    recoverEvents: true,
    recoverConfiguration: true,
    overwriteExisting: false,
    mergeWithExisting: true,
    verifyAfterRestore: true,
    testSignature: true,
  });
  const [result, setResult] = useState<RecoveryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const parsed: BackupFile = JSON.parse(content);
        setBackupFile(parsed);
        setError(null);
        setStep('verify');

        // Start verification
        const verificationResult = await nostrBackupService.verifyBackup(parsed);
        setVerification(verificationResult);
      } catch (err) {
        setError('Invalid backup file format');
        setStep('error');
      }
    };
    reader.readAsText(file);
  }, []);

  const handleVerifyWithPassword = async () => {
    if (!backupFile || !password) return;

    try {
      const verificationResult = await nostrBackupService.verifyBackup(backupFile, password);
      setVerification(verificationResult);

      if (verificationResult.valid) {
        setStep('options');
      } else {
        setError('Backup verification failed. Check password and file integrity.');
        setStep('error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      setStep('error');
    }
  };

  const handleRestore = async () => {
    if (!backupFile || !password) return;

    setStep('restoring');
    setError(null);

    try {
      const recoveryResult = await nostrBackupService.restoreBackup(
        backupFile,
        password,
        recoveryOptions
      );

      setResult(recoveryResult);

      if (recoveryResult.success) {
        setStep('success');
        if (onSuccess) {
          onSuccess(recoveryResult);
        }
      } else {
        setError(recoveryResult.errors.join(', '));
        setStep('error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restoration failed');
      setStep('error');
    }
  };

  const handleClose = () => {
    setStep('upload');
    setBackupFile(null);
    setVerification(null);
    setPassword('');
    setShowPassword(false);
    setRecoveryOptions({
      recoverKeys: true,
      recoverEvents: true,
      recoverConfiguration: true,
      overwriteExisting: false,
      mergeWithExisting: true,
      verifyAfterRestore: true,
      testSignature: true,
    });
    setResult(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-2xl font-bold text-foreground">Restore NOSTR Backup</h2>
          <button
            onClick={handleClose}
            className="text-muted-foreground/60 hover:text-muted-foreground"
            aria-label="Close dialog"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-muted-foreground/60 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <label htmlFor="backup-file" className="cursor-pointer">
                  <span className="text-blue-600 dark:text-blue-400 hover:text-blue-500 font-medium">
                    Choose backup file
                  </span>
                  <p className="text-sm text-muted-foreground mt-1">or drag and drop</p>
                </label>
                <input
                  id="backup-file"
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <p className="text-xs text-muted-foreground/60 mt-2">JSON files only</p>
              </div>
            </div>
          )}

          {/* Step 2: Verify */}
          {step === 'verify' && verification && (
            <div className="space-y-6">
              <div
                className={`border rounded-lg p-4 ${
                  verification.valid
                    ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                    : 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20'
                }`}
              >
                <div className="flex items-start">
                  <svg
                    className={`w-5 h-5 mr-3 flex-shrink-0 ${
                      verification.valid
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-yellow-600 dark:text-yellow-400'
                    }`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <p className="font-medium text-foreground">Backup file loaded</p>
                    <ul className="text-sm text-foreground mt-2 space-y-1">
                      <li>Version: {verification.version}</li>
                      <li>Content: {verification.contentType.replace(/_/g, ' ')}</li>
                      {verification.metadata?.keyCount !== undefined && (
                        <li>Keys: {verification.metadata.keyCount}</li>
                      )}
                      {verification.metadata?.eventCount !== undefined && (
                        <li>Events: {verification.metadata.eventCount}</li>
                      )}
                      {verification.metadata?.relayCount !== undefined && (
                        <li>Relays: {verification.metadata.relayCount}</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>

              {verification.warnings.length > 0 && (
                <div className="border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                  <p className="font-medium text-yellow-800 dark:text-yellow-300 mb-2">Warnings:</p>
                  <ul className="text-sm text-yellow-700 dark:text-yellow-400 space-y-1">
                    {verification.warnings.map((warning, index) => (
                      <li key={index}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {verification.encrypted && (
                <div>
                  <label
                    htmlFor="restore-password"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    Backup Password
                  </label>
                  <div className="relative">
                    <input
                      id="restore-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter backup password"
                      className="w-full px-3 py-2 pr-10 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 bg-background text-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={handleVerifyWithPassword}
                disabled={verification.encrypted && !password}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Verify and Continue
              </button>
            </div>
          )}

          {/* Step 3: Options */}
          {step === 'options' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-foreground mb-4">Recovery Options</h3>

                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={recoveryOptions.recoverKeys}
                      onChange={(e) =>
                        setRecoveryOptions({ ...recoveryOptions, recoverKeys: e.target.checked })
                      }
                      className="mr-3"
                    />
                    <span className="text-foreground">Recover keys</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={recoveryOptions.recoverEvents}
                      onChange={(e) =>
                        setRecoveryOptions({ ...recoveryOptions, recoverEvents: e.target.checked })
                      }
                      className="mr-3"
                    />
                    <span className="text-foreground">Recover events</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={recoveryOptions.recoverConfiguration}
                      onChange={(e) =>
                        setRecoveryOptions({
                          ...recoveryOptions,
                          recoverConfiguration: e.target.checked,
                        })
                      }
                      className="mr-3"
                    />
                    <span className="text-foreground">Recover configuration</span>
                  </label>

                  <div className="border-t border-border pt-3 mt-3">
                    <label className="flex items-start">
                      <input
                        type="checkbox"
                        checked={recoveryOptions.overwriteExisting}
                        onChange={(e) =>
                          setRecoveryOptions({
                            ...recoveryOptions,
                            overwriteExisting: e.target.checked,
                          })
                        }
                        className="mr-3 mt-1"
                      />
                      <div>
                        <span className="text-foreground font-medium">Overwrite existing data</span>
                        <p className="text-sm text-muted-foreground">
                          Replace existing keys and configuration (use with caution)
                        </p>
                      </div>
                    </label>
                  </div>

                  <label className="flex items-start">
                    <input
                      type="checkbox"
                      checked={recoveryOptions.verifyAfterRestore}
                      onChange={(e) =>
                        setRecoveryOptions({
                          ...recoveryOptions,
                          verifyAfterRestore: e.target.checked,
                        })
                      }
                      className="mr-3 mt-1"
                    />
                    <div>
                      <span className="text-foreground font-medium">Verify after restore</span>
                      <p className="text-sm text-muted-foreground">
                        Test restored keys and validate signatures
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep('verify')}
                  className="flex-1 px-4 py-2 border border-border text-foreground rounded-lg hover:bg-accent"
                >
                  Back
                </button>
                <button
                  onClick={handleRestore}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Restore Backup
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Restoring */}
          {step === 'restoring' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-lg font-medium text-foreground">Restoring backup...</p>
              <p className="text-sm text-muted-foreground mt-2">
                Please wait while we restore your data
              </p>
            </div>
          )}

          {/* Step 5: Success */}
          {step === 'success' && result && (
            <div className="space-y-6">
              <div className="flex flex-col items-center py-8">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4">
                  <svg
                    className="w-8 h-8 text-green-600 dark:text-green-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-2">
                  Backup Restored Successfully!
                </h3>
              </div>

              <div className="bg-muted rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Keys recovered:</span>
                  <span className="font-medium text-foreground">{result.keysRecovered}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Events recovered:</span>
                  <span className="font-medium text-foreground">{result.eventsRecovered}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Relays recovered:</span>
                  <span className="font-medium text-foreground">{result.relaysRecovered}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="font-medium text-foreground">
                    {(result.duration / 1000).toFixed(2)}s
                  </span>
                </div>
              </div>

              {result.verificationResult && (
                <div className="border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <p className="font-medium text-green-800 dark:text-green-300 mb-2">
                    Verification Results:
                  </p>
                  <ul className="text-sm text-green-700 dark:text-green-400 space-y-1">
                    <li>• Keys valid: {result.verificationResult.keysValid ? 'Yes' : 'No'}</li>
                    <li>
                      • Signatures valid: {result.verificationResult.signaturesValid ? 'Yes' : 'No'}
                    </li>
                    <li>
                      • Configuration valid: {result.verificationResult.configValid ? 'Yes' : 'No'}
                    </li>
                  </ul>
                </div>
              )}

              <button
                onClick={handleClose}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                Done
              </button>
            </div>
          )}

          {/* Step 6: Error */}
          {step === 'error' && (
            <div className="space-y-6">
              <div className="flex flex-col items-center py-8">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
                  <svg
                    className="w-8 h-8 text-red-600 dark:text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-2">Restoration Failed</h3>
                <p className="text-red-600 dark:text-red-400 text-center max-w-md">{error}</p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep('upload')}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Try Again
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 border border-border text-foreground rounded-lg hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
