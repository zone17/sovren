/**
 * NOSTR Backup Dialog Component
 * US-322: Secure backup and recovery - Backup Creation UI
 *
 * Features:
 * - Content type selection (keys, events, config, complete)
 * - Password protection with strength indicator
 * - Backup description
 * - Progress indicator
 * - Download generated backup
 */

import React, { useState } from 'react';
import { nostrBackupService } from '../../../services/nostr/NOSTRBackupService';
import { BackupContentType } from '../../../services/nostr/types/backup';
import type { PasswordStrength } from '../../../services/nostr/types/backup';

interface BackupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (downloadUrl: string) => void;
}

export const BackupDialog: React.FC<BackupDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<'config' | 'password' | 'creating' | 'success' | 'error'>('config');
  const [contentType, setContentType] = useState<BackupContentType>('complete');
  const [description, setDescription] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (value.length > 0) {
      const strength = nostrBackupService.validatePassword(value);
      setPasswordStrength(strength);
    } else {
      setPasswordStrength(null);
    }
  };

  const handleGeneratePassword = () => {
    const generated = nostrBackupService.generateSecurePassword(16);
    setPassword(generated);
    setConfirmPassword(generated);
    setShowPassword(true);
    const strength = nostrBackupService.validatePassword(generated);
    setPasswordStrength(strength);
  };

  const handleNextToPassword = () => {
    setStep('password');
  };

  const handleCreateBackup = async () => {
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!passwordStrength?.valid) {
      setError('Password does not meet security requirements');
      return;
    }

    setStep('creating');
    setError(null);

    try {
      const { file, downloadUrl: url } = await nostrBackupService.createBackup(
        password,
        contentType,
        description || undefined
      );

      setDownloadUrl(url);
      setStep('success');

      if (onSuccess) {
        onSuccess(url);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setStep('error');
    }
  };

  const handleDownload = () => {
    if (downloadUrl) {
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `nostr-backup-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleClose = () => {
    // Clean up
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
    }
    setStep('config');
    setContentType('complete');
    setDescription('');
    setPassword('');
    setConfirmPassword('');
    setPasswordStrength(null);
    setShowPassword(false);
    setDownloadUrl(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  const getPasswordStrengthColor = (): string => {
    if (!passwordStrength) return 'bg-gray-300';
    if (passwordStrength.score >= 80) return 'bg-green-500';
    if (passwordStrength.score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getPasswordStrengthText = (): string => {
    if (!passwordStrength) return 'Not set';
    if (passwordStrength.score >= 80) return 'Strong';
    if (passwordStrength.score >= 60) return 'Good';
    return 'Weak';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Create NOSTR Backup
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Close dialog"
          >
            <svg
              className="w-6 h-6"
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
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Configuration */}
          {step === 'config' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  What to backup?
                </label>
                <div className="space-y-2">
                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="radio"
                      name="contentType"
                      value="complete"
                      checked={contentType === 'complete'}
                      onChange={(e) => setContentType(e.target.value as BackupContentType)}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        Complete Backup
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Keys, events, and configuration (Recommended)
                      </div>
                    </div>
                  </label>

                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="radio"
                      name="contentType"
                      value="keys_only"
                      checked={contentType === 'keys_only'}
                      onChange={(e) => setContentType(e.target.value as BackupContentType)}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        Keys Only
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        NOSTR keys and identity information
                      </div>
                    </div>
                  </label>

                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="radio"
                      name="contentType"
                      value="events_only"
                      checked={contentType === 'events_only'}
                      onChange={(e) => setContentType(e.target.value as BackupContentType)}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        Events Only
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Published events and content
                      </div>
                    </div>
                  </label>

                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="radio"
                      name="contentType"
                      value="config_only"
                      checked={contentType === 'config_only'}
                      onChange={(e) => setContentType(e.target.value as BackupContentType)}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        Configuration Only
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Relays and preferences
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Description (Optional)
                </label>
                <input
                  id="description"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Weekly backup before key rotation"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <button
                onClick={handleNextToPassword}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Next: Set Password
              </button>
            </div>
          )}

          {/* Step 2: Password */}
          {step === 'password' && (
            <div className="space-y-6">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex">
                  <svg
                    className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-3 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                      Important: Store this password securely!
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                      You will need this password to restore your backup. There is no way to recover
                      it if lost.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Backup Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    placeholder="Enter a strong password"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>

                {passwordStrength && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-400">Strength:</span>
                      <span
                        className={`font-medium ${
                          passwordStrength.valid ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {getPasswordStrengthText()} ({passwordStrength.score}/100)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${getPasswordStrengthColor()}`}
                        style={{ width: `${passwordStrength.score}%` }}
                      />
                    </div>
                    {passwordStrength.feedback.length > 0 && (
                      <ul className="mt-2 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                        {passwordStrength.feedback.map((item, index) => (
                          <li key={index}>• {item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">Passwords do not match</p>
                )}
              </div>

              <button
                type="button"
                onClick={handleGeneratePassword}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Generate Secure Password
              </button>

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep('config')}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Back
                </button>
                <button
                  onClick={handleCreateBackup}
                  disabled={!passwordStrength?.valid || password !== confirmPassword}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Backup
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Creating */}
          {step === 'creating' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                Creating encrypted backup...
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                This may take a moment
              </p>
            </div>
          )}

          {/* Step 4: Success */}
          {step === 'success' && (
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
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Backup Created Successfully!
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
                  Your NOSTR backup has been encrypted and is ready to download. Store it in a
                  secure location.
                </p>
              </div>

              <button
                onClick={handleDownload}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 font-medium"
              >
                Download Backup File
              </button>

              <button
                onClick={handleClose}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Done
              </button>
            </div>
          )}

          {/* Step 5: Error */}
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
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Backup Failed
                </h3>
                <p className="text-red-600 dark:text-red-400 text-center max-w-md">
                  {error}
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep('password')}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Try Again
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
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
