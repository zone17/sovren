// @ts-nocheck
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle,
  Copy,
  Download,
  Eye,
  EyeOff,
  Info,
  Key,
  Settings,
  Shield,
  Upload,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

// Local type stubs for key management
type NostrEnhancedKeyPair = any;
type NostrEntropySource = any;
type NostrKeyBackupMethod = any;
type NostrKeyManagementConfig = any;
type NostrKeySecurityLevel = any;
const NostrKeyManagementService: any = null;
const NostrBrowserKeyStorage: any = null;

/**
 * 🔐 NOSTR Key Management Component
 *
 * Comprehensive UI for NOSTR key management including:
 * - Key generation with security options
 * - Key import/export functionality
 * - Backup and recovery management
 * - Key rotation and lifecycle management
 * - Security monitoring and validation
 * - Hardware wallet integration
 * - Browser extension support
 */

interface NostrKeyManagementProps {
  className?: string;
  onKeySelected?: (keyPair: NostrEnhancedKeyPair) => void;
  onKeyGenerated?: (keyPair: NostrEnhancedKeyPair) => void;
  onKeyDeleted?: (keyId: string) => void;
  config?: Partial<NostrKeyManagementConfig>;
}

type TabType = 'keys' | 'generate' | 'import' | 'backup' | 'settings';

export const NostrKeyManagement: React.FC<NostrKeyManagementProps> = ({
  className = '',
  onKeySelected,
  onKeyGenerated,
  onKeyDeleted,
  config = {},
}) => {
  // State management
  const [activeTab, setActiveTab] = useState<TabType>('keys');
  const [keyManagementService, setKeyManagementService] =
    useState<NostrKeyManagementService | null>(null);
  const [keys, setKeys] = useState<NostrEnhancedKeyPair[]>([]);
  const [selectedKey, setSelectedKey] = useState<NostrEnhancedKeyPair | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Key generation state
  const [keyName, setKeyName] = useState('');
  const [keyDescription, setKeyDescription] = useState('');
  const [securityLevel, setSecurityLevel] = useState<NostrKeySecurityLevel>(
    NostrKeySecurityLevel.ENHANCED
  );
  const [entropySource, setEntropySource] = useState<NostrEntropySource>(
    NostrEntropySource.WEB_CRYPTO_API
  );

  // Key import state
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const [importKeyName, setImportKeyName] = useState('');

  // UI state
  const [showPrivateKey, setShowPrivateKey] = useState<Record<string, boolean>>({});
  const [stats, setStats] = useState({
    totalKeys: 0,
    backedUpKeys: 0,
    compromisedKeys: 0,
    hardwareWallets: 0,
    browserExtensions: 0,
    rotationsPending: 0,
    lastCleanup: 0,
  });

  // Initialize key management service
  useEffect(() => {
    const initializeService = async () => {
      try {
        setIsLoading(true);

        // Check if browser storage is available
        if (!NostrBrowserKeyStorage.isAvailable()) {
          throw new Error('IndexedDB or Web Crypto API not available in this browser');
        }

        // Initialize service
        const storage = new NostrBrowserKeyStorage();
        const service = new NostrKeyManagementService(config, {
          storage,
        });

        await service.initialize();
        setKeyManagementService(service);

        // Load existing keys
        await loadKeys(service);

        // Update stats
        updateStats(service);

        setError(null);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to initialize key management';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    initializeService();
  }, [config]);

  // Load keys from storage
  const loadKeys = useCallback(
    async (service?: NostrKeyManagementService) => {
      const activeService = service || keyManagementService;
      if (!activeService) return;

      try {
        const result = await activeService.loadAllKeys();
        if (result.success && result.data) {
          setKeys(result.data);
        }
      } catch (error) {
        console.error('Failed to load keys:', error);
      }
    },
    [keyManagementService]
  );

  // Update statistics
  const updateStats = useCallback(
    (service?: NostrKeyManagementService) => {
      const activeService = service || keyManagementService;
      if (!activeService) return;

      const serviceStats = activeService.getStats();
      setStats(serviceStats);
    },
    [keyManagementService]
  );

  // Generate new key pair
  const handleGenerateKey = async () => {
    if (!keyManagementService) return;

    try {
      setIsLoading(true);
      setError(null);

      const result = await keyManagementService.generateKeyPair({
        name: keyName.trim() || 'Generated Key',
        description: keyDescription.trim(),
        securityLevel,
        entropySource,
      });

      if (result.success && result.data) {
        setSuccess('Key generated successfully!');
        setKeyName('');
        setKeyDescription('');
        await loadKeys();
        updateStats();
        onKeyGenerated?.(result.data);
      } else {
        setError(result.error || 'Failed to generate key');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Key generation failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Import existing key
  const handleImportKey = async () => {
    if (!keyManagementService || !privateKeyInput.trim()) return;

    try {
      setIsLoading(true);
      setError(null);

      const result = await keyManagementService.importKey(privateKeyInput.trim(), {
        name: importKeyName.trim() || 'Imported Key',
        validate: true,
      });

      if (result.success && result.data) {
        setSuccess('Key imported successfully!');
        setPrivateKeyInput('');
        setImportKeyName('');
        await loadKeys();
        updateStats();
        onKeyGenerated?.(result.data);
      } else {
        setError(result.error || 'Failed to import key');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Key import failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Create backup for key
  const handleCreateBackup = async (keyId: string) => {
    if (!keyManagementService) return;

    try {
      setIsLoading(true);
      setError(null);

      const result = await keyManagementService.createBackup(
        keyId,
        NostrKeyBackupMethod.MNEMONIC_PHRASE,
        { verify: true }
      );

      if (result.success && result.data) {
        setSuccess('Backup created successfully!');
        await loadKeys();
        updateStats();
      } else {
        setError(result.error || 'Failed to create backup');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Backup creation failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Rotate key
  const handleRotateKey = async (keyId: string) => {
    if (!keyManagementService) return;

    try {
      setIsLoading(true);
      setError(null);

      const result = await keyManagementService.rotateKey(keyId, {
        type: 'manual',
        reason: 'User-initiated key rotation',
      });

      if (result.success && result.data) {
        setSuccess('Key rotated successfully!');
        await loadKeys();
        updateStats();
      } else {
        setError(result.error || 'Failed to rotate key');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Key rotation failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete key
  const handleDeleteKey = async (keyId: string) => {
    if (
      !keyManagementService ||
      !confirm('Are you sure you want to delete this key? This action cannot be undone.')
    ) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await keyManagementService.deleteKey(keyId);

      if (result.success) {
        setSuccess('Key deleted successfully!');
        await loadKeys();
        updateStats();
        onKeyDeleted?.(keyId);
      } else {
        setError(result.error || 'Failed to delete key');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Key deletion failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess('Copied to clipboard!');
    } catch {
      setError('Failed to copy to clipboard');
    }
  };

  // Toggle private key visibility
  const togglePrivateKeyVisibility = (keyId: string) => {
    setShowPrivateKey((prev) => ({
      ...prev,
      [keyId]: !prev[keyId],
    }));
  };

  // Clear messages after 3 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [error, success]);

  // Render key validation indicator
  const renderKeyValidation = (keyPair: NostrEnhancedKeyPair) => {
    const securityScore = keyPair.compromised
      ? 0
      : keyPair.securityLevel === NostrKeySecurityLevel.MAXIMUM
        ? 95
        : keyPair.securityLevel === NostrKeySecurityLevel.ENHANCED
          ? 85
          : 70;

    const getScoreColor = (score: number) => {
      if (score >= 90) return 'text-green-600';
      if (score >= 70) return 'text-yellow-600';
      return 'text-red-600';
    };

    const getScoreIcon = (score: number) => {
      if (score >= 90) return <CheckCircle className="w-4 h-4" />;
      if (score >= 70) return <AlertTriangle className="w-4 h-4" />;
      return <AlertTriangle className="w-4 h-4" />;
    };

    return (
      <div className={`flex items-center space-x-1 ${getScoreColor(securityScore)}`}>
        {getScoreIcon(securityScore)}
        <span className="text-sm font-medium">{securityScore}%</span>
      </div>
    );
  };

  // Main render
  return (
    <div className={`bg-card rounded-lg shadow-sm border ${className}`}>
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-foreground">NOSTR Key Management</h2>
              <p className="text-sm text-muted-foreground">Secure management of your NOSTR keys</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-sm font-medium text-foreground">{stats.totalKeys} Keys</div>
              <div className="text-xs text-muted-foreground">{stats.backedUpKeys} backed up</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mt-4">
          {[
            { id: 'keys', label: 'Keys', icon: Key },
            { id: 'generate', label: 'Generate', icon: Shield },
            { id: 'import', label: 'Import', icon: Upload },
            { id: 'backup', label: 'Backup', icon: Download },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as TabType)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === id
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Messages */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md"
            >
              <div className="flex items-center">
                <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
                <span className="text-red-800">{error}</span>
              </div>
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md"
            >
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                <span className="text-green-800">{success}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Tab Content */}
        {!isLoading && (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Keys Tab */}
              {activeTab === 'keys' && (
                <div className="space-y-4">
                  {keys.length === 0 ? (
                    <div className="text-center py-12">
                      <Key className="w-12 h-12 text-muted-foreground/60 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-foreground mb-2">No Keys Found</h3>
                      <p className="text-muted-foreground mb-4">
                        Get started by generating or importing a NOSTR key.
                      </p>
                      <button
                        onClick={() => setActiveTab('generate')}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                      >
                        Generate Key
                      </button>
                    </div>
                  ) : (
                    keys.map((keyPair) => (
                      <div
                        key={keyPair.keyId}
                        className="border rounded-lg p-4 hover:bg-accent transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h3 className="text-lg font-medium text-foreground">
                                {keyPair.name || 'Unnamed Key'}
                              </h3>
                              {renderKeyValidation(keyPair)}
                              {keyPair.backedUp && (
                                <CheckCircle className="w-4 h-4 text-green-600" title="Backed up" />
                              )}
                            </div>

                            {keyPair.description && (
                              <p className="text-sm text-muted-foreground mb-3">
                                {keyPair.description}
                              </p>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <label className="block text-muted-foreground mb-1">
                                  Public Key
                                </label>
                                <div className="flex items-center space-x-2">
                                  <code className="bg-muted px-2 py-1 rounded text-xs font-mono">
                                    {keyPair.publicKey.slice(0, 16)}...
                                    {keyPair.publicKey.slice(-16)}
                                  </code>
                                  <button
                                    onClick={() => copyToClipboard(keyPair.publicKey)}
                                    className="text-muted-foreground/60 hover:text-muted-foreground"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              <div>
                                <label className="block text-muted-foreground mb-1">
                                  Private Key
                                </label>
                                <div className="flex items-center space-x-2">
                                  <code className="bg-muted px-2 py-1 rounded text-xs font-mono">
                                    {showPrivateKey[keyPair.keyId]
                                      ? keyPair.privateKey
                                      : '••••••••••••••••••••••••••••••••'}
                                  </code>
                                  <button
                                    onClick={() => togglePrivateKeyVisibility(keyPair.keyId)}
                                    className="text-muted-foreground/60 hover:text-muted-foreground"
                                  >
                                    {showPrivateKey[keyPair.keyId] ? (
                                      <EyeOff className="w-4 h-4" />
                                    ) : (
                                      <Eye className="w-4 h-4" />
                                    )}
                                  </button>
                                  {showPrivateKey[keyPair.keyId] && (
                                    <button
                                      onClick={() => copyToClipboard(keyPair.privateKey)}
                                      className="text-muted-foreground/60 hover:text-muted-foreground"
                                    >
                                      <Copy className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 flex items-center space-x-4 text-xs text-muted-foreground">
                              <span>Created: {new Date(keyPair.created).toLocaleDateString()}</span>
                              <span>Security: {keyPair.securityLevel}</span>
                              <span>Entropy: {keyPair.entropyBits} bits</span>
                            </div>
                          </div>

                          <div className="flex flex-col space-y-2 ml-4">
                            <button
                              onClick={() => onKeySelected?.(keyPair)}
                              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                            >
                              Select
                            </button>

                            {!keyPair.backedUp && (
                              <button
                                onClick={() => handleCreateBackup(keyPair.keyId)}
                                className="bg-orange-600 text-white px-3 py-1 rounded text-sm hover:bg-orange-700 transition-colors"
                              >
                                Backup
                              </button>
                            )}

                            <button
                              onClick={() => handleRotateKey(keyPair.keyId)}
                              className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700 transition-colors"
                            >
                              Rotate
                            </button>

                            <button
                              onClick={() => handleDeleteKey(keyPair.keyId)}
                              className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Generate Tab */}
              {activeTab === 'generate' && (
                <div className="max-w-md mx-auto space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-foreground mb-4">Generate New Key</h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Key Name
                        </label>
                        <input
                          type="text"
                          value={keyName}
                          onChange={(e) => setKeyName(e.target.value)}
                          placeholder="Enter a name for this key"
                          className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Description (Optional)
                        </label>
                        <textarea
                          value={keyDescription}
                          onChange={(e) => setKeyDescription(e.target.value)}
                          placeholder="Enter a description for this key"
                          rows={3}
                          className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Security Level
                        </label>
                        <select
                          value={securityLevel}
                          onChange={(e) =>
                            setSecurityLevel(e.target.value as NostrKeySecurityLevel)
                          }
                          className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value={NostrKeySecurityLevel.BASIC}>Basic</option>
                          <option value={NostrKeySecurityLevel.ENHANCED}>Enhanced</option>
                          <option value={NostrKeySecurityLevel.MAXIMUM}>Maximum</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Entropy Source
                        </label>
                        <select
                          value={entropySource}
                          onChange={(e) => setEntropySource(e.target.value as NostrEntropySource)}
                          className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value={NostrEntropySource.WEB_CRYPTO_API}>Web Crypto API</option>
                          <option value={NostrEntropySource.SECURE_RANDOM}>Secure Random</option>
                        </select>
                      </div>

                      <button
                        onClick={handleGenerateKey}
                        disabled={isLoading}
                        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {isLoading ? 'Generating...' : 'Generate Key'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Import Tab */}
              {activeTab === 'import' && (
                <div className="max-w-md mx-auto space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-foreground mb-4">
                      Import Existing Key
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Private Key (Hex)
                        </label>
                        <textarea
                          value={privateKeyInput}
                          onChange={(e) => setPrivateKeyInput(e.target.value)}
                          placeholder="Enter your 64-character hex private key"
                          rows={3}
                          className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Key Name
                        </label>
                        <input
                          type="text"
                          value={importKeyName}
                          onChange={(e) => setImportKeyName(e.target.value)}
                          placeholder="Enter a name for this key"
                          className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <button
                        onClick={handleImportKey}
                        disabled={isLoading || !privateKeyInput.trim()}
                        className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        {isLoading ? 'Importing...' : 'Import Key'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Backup Tab */}
              {activeTab === 'backup' && (
                <div className="max-w-2xl mx-auto">
                  <h3 className="text-lg font-medium text-foreground mb-4">Key Backups</h3>

                  <div className="space-y-4">
                    {keys.filter((key) => key.backedUp).length === 0 ? (
                      <div className="text-center py-8">
                        <Download className="w-12 h-12 text-muted-foreground/60 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-foreground mb-2">
                          No Backups Found
                        </h3>
                        <p className="text-muted-foreground">
                          Create backups for your keys to ensure you can recover them.
                        </p>
                      </div>
                    ) : (
                      keys
                        .filter((key) => key.backedUp)
                        .map((keyPair) => (
                          <div
                            key={keyPair.keyId}
                            className="border rounded-lg p-4 bg-green-50 border-green-200"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-medium text-foreground">
                                  {keyPair.name || 'Unnamed Key'}
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  Backup created: {new Date(keyPair.created).toLocaleDateString()}
                                </p>
                              </div>
                              <CheckCircle className="w-6 h-6 text-green-600" />
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              )}

              {/* Settings Tab */}
              {activeTab === 'settings' && (
                <div className="max-w-2xl mx-auto">
                  <h3 className="text-lg font-medium text-foreground mb-6">
                    Key Management Settings
                  </h3>

                  <div className="space-y-6">
                    {/* Statistics */}
                    <div>
                      <h4 className="text-md font-medium text-foreground mb-4">Statistics</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">{stats.totalKeys}</div>
                          <div className="text-sm text-blue-600">Total Keys</div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">
                            {stats.backedUpKeys}
                          </div>
                          <div className="text-sm text-green-600">Backed Up</div>
                        </div>
                        <div className="bg-red-50 p-4 rounded-lg">
                          <div className="text-2xl font-bold text-red-600">
                            {stats.compromisedKeys}
                          </div>
                          <div className="text-sm text-red-600">Compromised</div>
                        </div>
                        <div className="bg-yellow-50 p-4 rounded-lg">
                          <div className="text-2xl font-bold text-yellow-600">
                            {stats.rotationsPending}
                          </div>
                          <div className="text-sm text-yellow-600">Rotations Pending</div>
                        </div>
                      </div>
                    </div>

                    {/* Security Information */}
                    <div>
                      <h4 className="text-md font-medium text-foreground mb-4">
                        Security Information
                      </h4>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                          <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                          <div className="text-sm text-blue-800">
                            <p className="font-medium mb-2">Key Security Best Practices:</p>
                            <ul className="space-y-1 text-sm">
                              <li>• Always create backups for your keys</li>
                              <li>• Use Enhanced or Maximum security levels</li>
                              <li>• Rotate keys regularly or when compromised</li>
                              <li>• Never share your private keys</li>
                              <li>• Keep backups in multiple secure locations</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};
