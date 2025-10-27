/**
 * 🌐 **EXTENSION SELECTOR COMPONENT - US-215 Implementation**
 *
 * React component for browser extension selection and integration
 *
 * **Implementation for US-215: NOSTR Browser Extension Integration**
 *
 * Features:
 * - nos2x extension detection and integration ✅
 * - Alby extension support with WebLN ✅
 * - Extension fallback mechanism ✅
 * - Comprehensive error handling ✅
 * - Extension analytics and monitoring ✅
 * - User-friendly interface ✅
 *
 * @version 1.0.0
 * @author Sovren Team
 * @since 2025-01-20
 */

import React, { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';

// 🎯 Extension Type Definitions
export const ExtensionCapabilitySchema = z.object({
  getPublicKey: z.boolean().default(false),
  signEvent: z.boolean().default(false),
  encrypt: z.boolean().default(false),
  decrypt: z.boolean().default(false),
  getRelays: z.boolean().default(false),
  lightning: z.boolean().default(false),
  webln: z.boolean().default(false),
  nip04: z.boolean().default(false),
  nip44: z.boolean().default(false),
});

export const ExtensionInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string().optional(),
  available: z.boolean(),
  connected: z.boolean().default(false),
  capabilities: ExtensionCapabilitySchema,
  priority: z.number(),
  trustLevel: z.enum(['untrusted', 'basic', 'trusted', 'verified']).default('basic'),
  lastSeen: z.number().optional(),
  errorCount: z.number().default(0),
  performance: z
    .object({
      avgResponseTime: z.number().default(0),
      successRate: z.number().default(1),
      lastConnectionTime: z.number().optional(),
    })
    .optional(),
});

export type ExtensionInfo = z.infer<typeof ExtensionInfoSchema>;
export type ExtensionCapability = z.infer<typeof ExtensionCapabilitySchema>;

interface ExtensionError {
  type:
    | 'not_found'
    | 'permission_denied'
    | 'connection_failed'
    | 'timeout'
    | 'invalid_response'
    | 'version_incompatible'
    | 'security_error'
    | 'network_error';
  message: string;
  extension: string;
  timestamp: number;
  recoverable: boolean;
  userAction?: string;
}

interface ExtensionSelectorProps {
  onExtensionSelected: (extension: ExtensionInfo) => void;
  onFallbackActivated: (reason: string) => void;
  onError: (error: ExtensionError) => void;
  className?: string;
}

// 🌐 Extension Selector Component
export const ExtensionSelector: React.FC<ExtensionSelectorProps> = ({
  onExtensionSelected,
  onFallbackActivated,
  onError,
  className = '',
}) => {
  // State
  const [extensions, setExtensions] = useState<ExtensionInfo[]>([]);
  const [selectedExtension, setSelectedExtension] = useState<ExtensionInfo | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<any[]>([]);

  // 🔍 Detect nos2x extension
  const detectNos2x = useCallback(async (): Promise<ExtensionInfo | null> => {
    try {
      const nostr = (window as any).nostr;
      if (!nostr || typeof nostr.getPublicKey !== 'function') {
        return null;
      }

      // Test capabilities
      const capabilities: ExtensionCapability = {
        getPublicKey: typeof nostr.getPublicKey === 'function',
        signEvent: typeof nostr.signEvent === 'function',
        encrypt: typeof nostr.encrypt === 'function',
        decrypt: typeof nostr.decrypt === 'function',
        getRelays: typeof nostr.getRelays === 'function',
        lightning: false,
        webln: false,
        nip04: !!(nostr.nip04 && typeof nostr.nip04.encrypt === 'function'),
        nip44: !!(nostr.nip44 && typeof nostr.nip44.encrypt === 'function'),
      };

      return {
        id: 'nos2x',
        name: 'nos2x',
        version: nostr.version || 'unknown',
        available: true,
        connected: false,
        capabilities,
        priority: 8,
        trustLevel: 'trusted',
        lastSeen: Date.now(),
        errorCount: 0,
        performance: {
          avgResponseTime: 0,
          successRate: 1,
        },
      };
    } catch (error) {
      console.error('[ExtensionSelector] nos2x detection failed:', error);
      return null;
    }
  }, []);

  // ⚡ Detect Alby extension
  const detectAlby = useCallback(async (): Promise<ExtensionInfo | null> => {
    try {
      const nostr = (window as any).nostr;
      const webln = (window as any).webln;
      const alby = (window as any).alby;

      // Check for Alby-specific indicators
      const isAlby = !!((nostr && (nostr.alby || nostr._alby)) || (webln && webln.isAlby) || alby);

      if (!isAlby && !nostr) return null;

      // Test capabilities
      const capabilities: ExtensionCapability = {
        getPublicKey: !!(nostr && typeof nostr.getPublicKey === 'function'),
        signEvent: !!(nostr && typeof nostr.signEvent === 'function'),
        encrypt: !!(nostr && typeof nostr.encrypt === 'function'),
        decrypt: !!(nostr && typeof nostr.decrypt === 'function'),
        getRelays: !!(nostr && typeof nostr.getRelays === 'function'),
        lightning: !!(webln || alby),
        webln: !!webln,
        nip04: !!(nostr && nostr.nip04 && typeof nostr.nip04.encrypt === 'function'),
        nip44: !!(nostr && nostr.nip44 && typeof nostr.nip44.encrypt === 'function'),
      };

      return {
        id: 'alby',
        name: 'Alby',
        version: (webln && webln.version) || (alby && alby.version) || 'unknown',
        available: true,
        connected: false,
        capabilities,
        priority: 9, // Higher priority than nos2x due to Lightning features
        trustLevel: 'trusted',
        lastSeen: Date.now(),
        errorCount: 0,
        performance: {
          avgResponseTime: 0,
          successRate: 1,
        },
      };
    } catch (error) {
      console.error('[ExtensionSelector] Alby detection failed:', error);
      return null;
    }
  }, []);

  // 🔍 Detect generic NIP-07 extensions
  const detectGenericExtensions = useCallback(async (): Promise<ExtensionInfo[]> => {
    try {
      const extensions: ExtensionInfo[] = [];
      const nostr = (window as any).nostr;

      if (!nostr) return extensions;

      // Check for unknown extensions that implement NIP-07
      if (typeof nostr.getPublicKey === 'function') {
        const capabilities: ExtensionCapability = {
          getPublicKey: typeof nostr.getPublicKey === 'function',
          signEvent: typeof nostr.signEvent === 'function',
          encrypt: typeof nostr.encrypt === 'function',
          decrypt: typeof nostr.decrypt === 'function',
          getRelays: typeof nostr.getRelays === 'function',
          lightning: false,
          webln: !!(window as any).webln,
          nip04: !!(nostr.nip04 && typeof nostr.nip04.encrypt === 'function'),
          nip44: !!(nostr.nip44 && typeof nostr.nip44.encrypt === 'function'),
        };

        extensions.push({
          id: 'generic-nostr',
          name: nostr.name || 'Generic NOSTR Extension',
          version: nostr.version || 'unknown',
          available: true,
          connected: false,
          capabilities,
          priority: 5, // Lower priority than known extensions
          trustLevel: 'basic',
          lastSeen: Date.now(),
          errorCount: 0,
          performance: {
            avgResponseTime: 0,
            successRate: 1,
          },
        });
      }

      return extensions;
    } catch (error) {
      console.error('[ExtensionSelector] Generic extension detection failed:', error);
      return [];
    }
  }, []);

  // 🔍 Detect all available extensions
  const detectExtensions = useCallback(async (): Promise<void> => {
    setIsDetecting(true);
    setError(null);

    try {
      const detectedExtensions: ExtensionInfo[] = [];

      // Detect nos2x extension
      const nos2xInfo = await detectNos2x();
      if (nos2xInfo) {
        detectedExtensions.push(nos2xInfo);
        trackAnalytics('nos2x', 'detected');
      }

      // Detect Alby extension
      const albyInfo = await detectAlby();
      if (albyInfo) {
        detectedExtensions.push(albyInfo);
        trackAnalytics('alby', 'detected');
      }

      // Detect generic NIP-07 extensions (only if neither nos2x nor Alby found)
      if (detectedExtensions.length === 0) {
        const genericExtensions = await detectGenericExtensions();
        detectedExtensions.push(...genericExtensions);
        genericExtensions.forEach((ext) => trackAnalytics(ext.id, 'detected'));
      }

      // Sort by priority
      detectedExtensions.sort((a, b) => b.priority - a.priority);

      setExtensions(detectedExtensions);

      if (detectedExtensions.length === 0) {
        onFallbackActivated('No browser extensions detected');
      }

      console.log(`[ExtensionSelector] Detected ${detectedExtensions.length} extensions`, {
        extensions: detectedExtensions.map((e) => e.name),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Extension detection failed';
      setError(errorMessage);
      onFallbackActivated(errorMessage);
    } finally {
      setIsDetecting(false);
    }
  }, [detectNos2x, detectAlby, detectGenericExtensions, onFallbackActivated]);

  // 🔗 Connect to extension
  const connectExtension = useCallback(
    async (extension: ExtensionInfo): Promise<void> => {
      setIsConnecting(true);
      setError(null);

      const startTime = Date.now();

      try {
        // Test connection by getting public key
        const nostr = (window as any).nostr;
        if (!nostr || typeof nostr.getPublicKey !== 'function') {
          throw new Error('Extension not available');
        }

        const publicKey = await Promise.race([
          nostr.getPublicKey(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Operation timed out')), 10000)
          ),
        ]);

        if (!publicKey || publicKey.length !== 64) {
          throw new Error('Invalid public key received from extension');
        }

        // Update extension info
        const updatedExtension: ExtensionInfo = {
          ...extension,
          connected: true,
          lastSeen: Date.now(),
          errorCount: 0,
          performance: {
            avgResponseTime: Date.now() - startTime,
            successRate: extension.performance?.successRate || 1,
            lastConnectionTime: Date.now(),
          },
        };

        setSelectedExtension(updatedExtension);
        onExtensionSelected(updatedExtension);
        trackAnalytics(extension.id, 'connected', Date.now() - startTime);

        console.log(`[ExtensionSelector] Connected to ${extension.name}`, {
          publicKey: publicKey.slice(0, 16) + '...',
          duration: Date.now() - startTime,
        });
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorInfo: ExtensionError = {
          type: 'connection_failed',
          message: error instanceof Error ? error.message : 'Connection failed',
          extension: extension.id,
          timestamp: Date.now(),
          recoverable: true,
          userAction: 'Try refreshing the page or checking extension permissions',
        };

        setError(errorInfo.message);
        onError(errorInfo);
        trackAnalytics(extension.id, 'error', duration, { error: errorInfo.message });
      } finally {
        setIsConnecting(false);
      }
    },
    [onExtensionSelected, onError]
  );

  // 📊 Track analytics
  const trackAnalytics = useCallback(
    (extensionId: string, event: string, duration?: number, metadata?: any) => {
      const analyticsEvent = {
        extensionId,
        event,
        timestamp: Date.now(),
        duration,
        metadata,
      };

      setAnalytics((prev) => [...prev.slice(-999), analyticsEvent]); // Keep last 1000 events
    },
    []
  );

  // 🔄 Refresh detection
  const refreshDetection = useCallback(() => {
    detectExtensions();
  }, [detectExtensions]);

  // Effect: Initial detection
  useEffect(() => {
    detectExtensions();
  }, [detectExtensions]);

  // Effect: Periodic detection
  useEffect(() => {
    const interval = setInterval(() => {
      if (!selectedExtension) {
        detectExtensions();
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [detectExtensions, selectedExtension]);

  return (
    <div className={`extension-selector ${className}`}>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Browser Extension Authentication
        </h3>
        <p className="text-sm text-gray-600">
          Connect with your existing NOSTR browser extension for seamless authentication.
        </p>
      </div>

      {/* Detection Status */}
      {isDetecting && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center">
            <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full mr-3"></div>
            <span className="text-blue-700">Detecting browser extensions...</span>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-red-600 mt-0.5 mr-3"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="text-red-700 font-medium">Extension Error</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Extension List */}
      {extensions.length > 0 ? (
        <div className="space-y-3">
          {extensions.map((extension) => (
            <div
              key={extension.id}
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedExtension?.id === extension.id
                  ? 'border-blue-500 bg-blue-50'
                  : extension.connected
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
              onClick={() => !extension.connected && connectExtension(extension)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="mr-3">
                    {extension.id === 'alby' ? '⚡' : extension.id === 'nos2x' ? '🔑' : '🌐'}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{extension.name}</h4>
                    <p className="text-sm text-gray-600">
                      Version: {extension.version} • Trust: {extension.trustLevel}
                    </p>
                    <div className="flex gap-2 mt-1">
                      {extension.capabilities.lightning && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                          Lightning
                        </span>
                      )}
                      {extension.capabilities.webln && (
                        <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                          WebLN
                        </span>
                      )}
                      {extension.capabilities.nip04 && (
                        <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                          NIP-04
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center">
                  {isConnecting && selectedExtension?.id === extension.id ? (
                    <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  ) : extension.connected ? (
                    <div className="flex items-center text-green-600">
                      <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-sm font-medium">Connected</span>
                    </div>
                  ) : (
                    <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                      Connect
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !isDetecting ? (
        <div className="text-center py-8">
          <div className="mb-4">
            <svg
              className="w-12 h-12 text-gray-400 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h4 className="text-gray-900 font-medium mb-2">No Extensions Found</h4>
          <p className="text-gray-600 text-sm mb-4">
            No NOSTR browser extensions were detected. You can install nos2x or Alby to get started.
          </p>
          <div className="flex gap-3 justify-center">
            <a
              href="https://github.com/fiatjaf/nos2x"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Install nos2x →
            </a>
            <a
              href="https://getalby.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Install Alby →
            </a>
          </div>
          <button
            onClick={refreshDetection}
            className="mt-4 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Refresh Detection
          </button>
        </div>
      ) : null}

      {/* Analytics Summary */}
      {analytics.length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Extension Analytics</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Extensions Detected:</span>
              <span className="ml-2 font-medium">{extensions.length}</span>
            </div>
            <div>
              <span className="text-gray-600">Analytics Events:</span>
              <span className="ml-2 font-medium">{analytics.length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
