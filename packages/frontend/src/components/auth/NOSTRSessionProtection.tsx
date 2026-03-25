import { AnimatePresence, motion } from 'framer-motion';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';

// Core NOSTR imports

// Internal imports
import { useAuth } from '../../features/auth/services/AuthContext';

// Simple logger for development
const logger = {
  info: (message: string, data?: any) => console.log(`[INFO] ${message}`, data),
  error: (message: string, data?: any) => console.error(`[ERROR] ${message}`, data),
  warn: (message: string, data?: any) => console.warn(`[WARN] ${message}`, data),
};

// 🔐 NOSTR Session Protection Schemas
const SessionValidationSchema = z.object({
  session_id: z.string().min(1, 'Session ID is required'),
  pubkey: z.string().length(64, 'Public key must be 64 characters'),
  created_at: z.number().positive('Creation timestamp must be positive'),
  expires_at: z.number().positive('Expiration timestamp must be positive'),
  ip_address: z.string().ip(),
  user_agent: z.string().min(1, 'User agent is required'),
  device_fingerprint: z.string().min(1, 'Device fingerprint is required'),
  last_activity: z.number().positive('Last activity timestamp must be positive'),
  activity_count: z.number().default(0),
  security_level: z.enum(['low', 'medium', 'high']).default('medium'),
});

const SessionTimeoutConfigSchema = z.object({
  idle_timeout: z.number().default(1800), // 30 minutes
  absolute_timeout: z.number().default(86400), // 24 hours
  activity_extension: z.number().default(300), // 5 minutes
  warning_threshold: z.number().default(120), // 2 minutes before timeout
  max_concurrent_sessions: z.number().default(3),
});

const DeviceFingerprintSchema = z.object({
  screen_resolution: z.string(),
  timezone: z.string(),
  language: z.string(),
  platform: z.string(),
  user_agent: z.string(),
  canvas_fingerprint: z.string().optional(),
  webgl_fingerprint: z.string().optional(),
  plugins: z.array(z.string()),
  cookies_enabled: z.boolean(),
  local_storage_enabled: z.boolean(),
});

// Types
type SessionValidation = z.infer<typeof SessionValidationSchema>;
type SessionTimeoutConfig = z.infer<typeof SessionTimeoutConfigSchema>;
type DeviceFingerprint = z.infer<typeof DeviceFingerprintSchema>;

interface SessionActivity {
  timestamp: number;
  action: string;
  ip_address: string;
  device_fingerprint: string;
}

interface ConcurrentSession {
  session_id: string;
  pubkey: string;
  created_at: number;
  last_activity: number;
  ip_address: string;
  device_info: string;
  is_current: boolean;
}

interface SessionThreat {
  type: 'concurrent_session' | 'ip_change' | 'device_change' | 'suspicious_activity';
  severity: 'low' | 'medium' | 'high';
  description: string;
  detected_at: number;
  session_id: string;
}

interface SessionProtectionProps {
  onSessionExpired?: () => void;
  onThreatDetected?: (threat: SessionThreat) => void;
  onSessionValidated?: (session: SessionValidation) => void;
  timeoutConfig?: Partial<SessionTimeoutConfig>;
  className?: string;
}

// 🚀 NOSTR Session Protection Component
export const NOSTRSessionProtection: React.FC<SessionProtectionProps> = ({
  onSessionExpired,
  onThreatDetected,
  onSessionValidated,
  timeoutConfig = {},
  className = '',
}) => {
  // State management
  const [currentSession, setCurrentSession] = useState<SessionValidation | null>(null);
  const [config, setConfig] = useState<SessionTimeoutConfig>(() =>
    SessionTimeoutConfigSchema.parse(timeoutConfig)
  );
  const [deviceFingerprint, setDeviceFingerprint] = useState<DeviceFingerprint | null>(null);
  const [sessionActivities, setSessionActivities] = useState<SessionActivity[]>([]);
  const [concurrentSessions, setConcurrentSessions] = useState<ConcurrentSession[]>([]);
  const [detectedThreats, setDetectedThreats] = useState<SessionThreat[]>([]);
  const [timeUntilExpiry, setTimeUntilExpiry] = useState<number>(0);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Refs for timers and intervals
  const activityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const validationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutWarningRef = useRef<NodeJS.Timeout | null>(null);

  // Hooks
  const { user } = useAuth();

  // 🖥️ Generate Device Fingerprint
  const generateDeviceFingerprint = useCallback(async (): Promise<DeviceFingerprint> => {
    try {
      // Collect device information
      const fingerprint: DeviceFingerprint = {
        screen_resolution: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        platform: navigator.platform,
        user_agent: navigator.userAgent,
        plugins: Array.from(navigator.plugins).map((plugin) => plugin.name),
        cookies_enabled: navigator.cookieEnabled,
        local_storage_enabled: (() => {
          try {
            localStorage.setItem('test', 'test');
            localStorage.removeItem('test');
            return true;
          } catch {
            return false;
          }
        })(),
      };

      // Canvas fingerprinting (optional)
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.textBaseline = 'top';
          ctx.font = '14px Arial';
          ctx.fillText('NOSTR Session Protection', 2, 2);
          fingerprint.canvas_fingerprint = canvas.toDataURL();
        }
      } catch (err) {
        logger.warn('Canvas fingerprinting failed', { error: err });
      }

      // WebGL fingerprinting (optional)
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl');
        if (gl) {
          const renderer = gl.getParameter(gl.RENDERER);
          const vendor = gl.getParameter(gl.VENDOR);
          fingerprint.webgl_fingerprint = `${vendor} - ${renderer}`;
        }
      } catch (err) {
        logger.warn('WebGL fingerprinting failed', { error: err });
      }

      setDeviceFingerprint(fingerprint);
      return fingerprint;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Device fingerprinting failed';
      logger.error('Device fingerprinting failed', { error: errorMsg });
      throw new Error(errorMsg);
    }
  }, []);

  // 🔐 Create Session Validation
  const createSession = useCallback(
    async (pubkey: string): Promise<SessionValidation> => {
      try {
        // Generate device fingerprint
        const fingerprint = await generateDeviceFingerprint();

        // Get IP address (simplified - would use actual IP detection)
        const ipAddress = '127.0.0.1'; // In real implementation, get from server

        // Create session
        const now = Date.now();
        const session: SessionValidation = {
          session_id: crypto.randomUUID(),
          pubkey,
          created_at: now,
          expires_at: now + config.absolute_timeout * 1000,
          ip_address: ipAddress,
          user_agent: navigator.userAgent,
          device_fingerprint: JSON.stringify(fingerprint),
          last_activity: now,
          activity_count: 1,
          security_level: 'medium',
        };

        // Validate session
        const validatedSession = SessionValidationSchema.parse(session);
        setCurrentSession(validatedSession);

        // Log activity
        const activity: SessionActivity = {
          timestamp: now,
          action: 'session_created',
          ip_address: ipAddress,
          device_fingerprint: JSON.stringify(fingerprint),
        };
        setSessionActivities((prev) => [...prev.slice(-99), activity]);

        logger.info('Session created', {
          session_id: session.session_id,
          pubkey: pubkey.slice(0, 16) + '...',
          expires_at: new Date(session.expires_at).toISOString(),
        });

        onSessionValidated?.(validatedSession);
        return validatedSession;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Session creation failed';
        logger.error('Session creation failed', { error: errorMsg });
        throw new Error(errorMsg);
      }
    },
    [config, generateDeviceFingerprint, onSessionValidated]
  );

  // ✅ Validate Current Session
  const validateSession = useCallback(async (): Promise<boolean> => {
    if (!currentSession) {
      return false;
    }

    try {
      setIsValidating(true);
      const now = Date.now();

      // Check absolute timeout
      if (now > currentSession.expires_at) {
        logger.warn('Session expired (absolute timeout)', {
          session_id: currentSession.session_id,
          expired_at: new Date(currentSession.expires_at).toISOString(),
        });
        onSessionExpired?.();
        return false;
      }

      // Check idle timeout
      const timeSinceActivity = now - currentSession.last_activity;
      if (timeSinceActivity > config.idle_timeout * 1000) {
        logger.warn('Session expired (idle timeout)', {
          session_id: currentSession.session_id,
          idle_time: timeSinceActivity / 1000,
        });
        onSessionExpired?.();
        return false;
      }

      // Check for device fingerprint changes
      const currentFingerprint = await generateDeviceFingerprint();
      const storedFingerprint = JSON.parse(currentSession.device_fingerprint);

      // Compare critical fingerprint elements
      const criticalChanges = [
        currentFingerprint.screen_resolution !== storedFingerprint.screen_resolution,
        currentFingerprint.timezone !== storedFingerprint.timezone,
        currentFingerprint.platform !== storedFingerprint.platform,
      ].filter(Boolean).length;

      if (criticalChanges > 1) {
        const threat: SessionThreat = {
          type: 'device_change',
          severity: 'high',
          description: 'Multiple device characteristics changed',
          detected_at: now,
          session_id: currentSession.session_id,
        };
        setDetectedThreats((prev) => [...prev, threat]);
        onThreatDetected?.(threat);
      }

      // Update time until expiry
      const timeUntilIdle = config.idle_timeout * 1000 - timeSinceActivity;
      const timeUntilAbsolute = currentSession.expires_at - now;
      const timeUntilExpiry = Math.min(timeUntilIdle, timeUntilAbsolute);
      setTimeUntilExpiry(timeUntilExpiry);

      // Show warning if expiry is near
      const showWarning = timeUntilExpiry <= config.warning_threshold * 1000;
      setShowTimeoutWarning(showWarning);

      return true;
    } catch (err) {
      logger.error('Session validation failed', {
        error: err instanceof Error ? err.message : 'Unknown error',
        session_id: currentSession.session_id,
      });
      return false;
    } finally {
      setIsValidating(false);
    }
  }, [currentSession, config, generateDeviceFingerprint, onSessionExpired, onThreatDetected]);

  // 📈 Record Session Activity
  const recordActivity = useCallback(
    async (action: string) => {
      if (!currentSession) {
        return;
      }

      try {
        const now = Date.now();
        const fingerprint = await generateDeviceFingerprint();

        const activity: SessionActivity = {
          timestamp: now,
          action,
          ip_address: currentSession.ip_address, // In real implementation, detect current IP
          device_fingerprint: JSON.stringify(fingerprint),
        };

        setSessionActivities((prev) => [...prev.slice(-99), activity]);

        // Update session last activity
        const updatedSession = {
          ...currentSession,
          last_activity: now,
          activity_count: currentSession.activity_count + 1,
        };

        setCurrentSession(updatedSession);

        // Extend session if within extension window
        const timeSinceActivity = now - currentSession.last_activity;
        if (timeSinceActivity < config.activity_extension * 1000) {
          const newExpiryTime = Math.min(
            now + config.idle_timeout * 1000,
            currentSession.expires_at
          );

          if (newExpiryTime > updatedSession.expires_at) {
            updatedSession.expires_at = newExpiryTime;
            setCurrentSession(updatedSession);
          }
        }

        logger.info('Activity recorded', {
          session_id: currentSession.session_id,
          action,
          activity_count: updatedSession.activity_count,
        });
      } catch (err) {
        logger.error('Activity recording failed', {
          error: err instanceof Error ? err.message : 'Unknown error',
          action,
        });
      }
    },
    [currentSession, config, generateDeviceFingerprint]
  );

  // 🔍 Detect Concurrent Sessions
  const detectConcurrentSessions = useCallback(async () => {
    if (!currentSession) {
      return;
    }

    try {
      // In real implementation, this would query the server for other active sessions
      // For demo purposes, we'll simulate concurrent session detection
      const mockConcurrentSessions: ConcurrentSession[] = [
        {
          session_id: currentSession.session_id,
          pubkey: currentSession.pubkey,
          created_at: currentSession.created_at,
          last_activity: currentSession.last_activity,
          ip_address: currentSession.ip_address,
          device_info: 'Current Device',
          is_current: true,
        },
      ];

      // Simulate detection of suspicious concurrent session
      if (Math.random() < 0.1) {
        // 10% chance for demo
        const suspiciousSession: ConcurrentSession = {
          session_id: crypto.randomUUID(),
          pubkey: currentSession.pubkey,
          created_at: Date.now() - 300000, // 5 minutes ago
          last_activity: Date.now() - 60000, // 1 minute ago
          ip_address: '192.168.1.100', // Different IP
          device_info: 'Unknown Device',
          is_current: false,
        };

        mockConcurrentSessions.push(suspiciousSession);

        const threat: SessionThreat = {
          type: 'concurrent_session',
          severity: 'medium',
          description: 'Concurrent session detected from different IP',
          detected_at: Date.now(),
          session_id: currentSession.session_id,
        };

        setDetectedThreats((prev) => [...prev, threat]);
        onThreatDetected?.(threat);
      }

      setConcurrentSessions(mockConcurrentSessions);

      // Check if we exceed max concurrent sessions
      if (mockConcurrentSessions.length > config.max_concurrent_sessions) {
        const threat: SessionThreat = {
          type: 'concurrent_session',
          severity: 'high',
          description: `Too many concurrent sessions: ${mockConcurrentSessions.length}/${config.max_concurrent_sessions}`,
          detected_at: Date.now(),
          session_id: currentSession.session_id,
        };

        setDetectedThreats((prev) => [...prev, threat]);
        onThreatDetected?.(threat);
      }
    } catch (err) {
      logger.error('Concurrent session detection failed', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [currentSession, config, onThreatDetected]);

  // 🧹 Cleanup Session
  const cleanupSession = useCallback(() => {
    if (currentSession) {
      logger.info('Session cleanup', {
        session_id: currentSession.session_id,
        duration: Date.now() - currentSession.created_at,
        activity_count: currentSession.activity_count,
      });
    }

    setCurrentSession(null);
    setSessionActivities([]);
    setConcurrentSessions([]);
    setTimeUntilExpiry(0);
    setShowTimeoutWarning(false);

    // Clear timers
    if (activityTimerRef.current) {
      clearTimeout(activityTimerRef.current);
    }
    if (validationIntervalRef.current) {
      clearInterval(validationIntervalRef.current);
    }
    if (timeoutWarningRef.current) {
      clearTimeout(timeoutWarningRef.current);
    }
  }, [currentSession]);

  // 🔄 Extend Session
  const extendSession = useCallback(() => {
    if (!currentSession) {
      return;
    }

    const now = Date.now();
    const newExpiryTime = Math.min(
      now + config.idle_timeout * 1000,
      currentSession.created_at + config.absolute_timeout * 1000
    );

    const updatedSession = {
      ...currentSession,
      last_activity: now,
      expires_at: newExpiryTime,
    };

    setCurrentSession(updatedSession);
    setShowTimeoutWarning(false);

    recordActivity('session_extended');

    logger.info('Session extended', {
      session_id: currentSession.session_id,
      new_expiry: new Date(newExpiryTime).toISOString(),
    });
  }, [currentSession, config, recordActivity]);

  // ⏱️ Setup timers and intervals
  useEffect(() => {
    if (currentSession) {
      // Session validation interval
      validationIntervalRef.current = setInterval(() => {
        validateSession();
      }, 30000); // Every 30 seconds

      // Concurrent session detection interval
      const concurrentDetectionInterval = setInterval(() => {
        detectConcurrentSessions();
      }, 60000); // Every minute

      return () => {
        if (validationIntervalRef.current) {
          clearInterval(validationIntervalRef.current);
        }
        clearInterval(concurrentDetectionInterval);
      };
    }
    return undefined;
  }, [currentSession, validateSession, detectConcurrentSessions]);

  // 🎨 Auto-clear messages
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [error, success]);

  // 🧹 Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupSession();
    };
  }, [cleanupSession]);

  // Initialize session for current user
  useEffect(() => {
    if (user?.nostr_pubkey && !currentSession) {
      createSession(user.nostr_pubkey).catch((err) => {
        setError(err.message);
      });
    }
  }, [user, currentSession, createSession]);

  return (
    <div className={`nostr-session-protection ${className}`}>
      <div className="bg-card rounded-xl shadow-lg p-6 space-y-6">
        {/* Header */}
        <div className="border-b border-border pb-4">
          <h2 className="text-2xl font-bold text-foreground">NOSTR Session Protection</h2>
          <p className="text-muted-foreground mt-1">
            Monitor and protect your authentication session
          </p>
        </div>

        {/* Error/Success Messages */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg"
            >
              {error}
            </motion.div>
          )}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg"
            >
              {success}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Timeout Warning */}
        <AnimatePresence>
          {showTimeoutWarning && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-yellow-800 font-medium">Session Expiring Soon</h3>
                  <p className="text-yellow-700 text-sm">
                    Your session will expire in {Math.floor(timeUntilExpiry / 1000)} seconds
                  </p>
                </div>
                <button
                  onClick={extendSession}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Extend Session
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Current Session Info */}
        {currentSession && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Current Session</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-sm text-blue-700 font-medium">Session Age</div>
                <div className="text-xl font-bold text-blue-600">
                  {Math.floor((Date.now() - currentSession.created_at) / 60000)}m
                </div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="text-sm text-green-700 font-medium">Activities</div>
                <div className="text-xl font-bold text-green-600">
                  {currentSession.activity_count}
                </div>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg">
                <div className="text-sm text-yellow-700 font-medium">Time Left</div>
                <div className="text-xl font-bold text-yellow-600">
                  {Math.floor(timeUntilExpiry / 60000)}m
                </div>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg">
                <div className="text-sm text-purple-700 font-medium">Security</div>
                <div className="text-xl font-bold text-purple-600 capitalize">
                  {currentSession.security_level}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-muted p-3 rounded-lg">
                <div className="text-sm font-medium text-foreground mb-1">Session ID:</div>
                <div className="font-mono text-sm break-all">{currentSession.session_id}</div>
              </div>

              <div className="bg-muted p-3 rounded-lg">
                <div className="text-sm font-medium text-foreground mb-1">Public Key:</div>
                <div className="font-mono text-sm break-all">{currentSession.pubkey}</div>
              </div>
            </div>
          </div>
        )}

        {/* Session Configuration */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Session Configuration</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-sm text-foreground font-medium">Idle Timeout</div>
              <div className="text-lg font-bold text-foreground">{config.idle_timeout / 60}m</div>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-sm text-foreground font-medium">Max Duration</div>
              <div className="text-lg font-bold text-foreground">
                {config.absolute_timeout / 3600}h
              </div>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-sm text-foreground font-medium">Warning Time</div>
              <div className="text-lg font-bold text-foreground">{config.warning_threshold}s</div>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-sm text-foreground font-medium">Max Sessions</div>
              <div className="text-lg font-bold text-foreground">
                {config.max_concurrent_sessions}
              </div>
            </div>
          </div>
        </div>

        {/* Concurrent Sessions */}
        {concurrentSessions.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Active Sessions</h3>
            <div className="space-y-2">
              {concurrentSessions.map((session) => (
                <div
                  key={session.session_id}
                  className={`p-3 rounded-lg border ${session.is_current ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">
                        {session.device_info} {session.is_current && '(Current)'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        IP: {session.ip_address} | Last Active:{' '}
                        {new Date(session.last_activity).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {Math.floor((Date.now() - session.created_at) / 60000)}m ago
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activities */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Recent Activities</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {sessionActivities
              .slice(-10)
              .reverse()
              .map((activity, index) => (
                <div key={index} className="bg-muted p-3 rounded-lg text-sm">
                  <div className="flex justify-between items-center">
                    <div className="font-medium">{activity.action}</div>
                    <div className="text-muted-foreground">
                      {new Date(activity.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="text-muted-foreground text-xs">IP: {activity.ip_address}</div>
                </div>
              ))}
            {sessionActivities.length === 0 && (
              <div className="text-muted-foreground text-center py-4">
                No activities recorded yet
              </div>
            )}
          </div>
        </div>

        {/* Security Threats */}
        {detectedThreats.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Security Threats</h3>
            <div className="space-y-2">
              {detectedThreats
                .slice(-5)
                .reverse()
                .map((threat, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${
                      threat.severity === 'high'
                        ? 'bg-red-50 border-red-200'
                        : threat.severity === 'medium'
                          ? 'bg-yellow-50 border-yellow-200'
                          : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium capitalize">
                          {threat.type.replace('_', ' ')}
                        </div>
                        <div className="text-sm">{threat.description}</div>
                      </div>
                      <div
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          threat.severity === 'high'
                            ? 'bg-red-200 text-red-800'
                            : threat.severity === 'medium'
                              ? 'bg-yellow-200 text-yellow-800'
                              : 'bg-blue-200 text-blue-800'
                        }`}
                      >
                        {threat.severity.toUpperCase()}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Detected: {new Date(threat.detected_at).toLocaleString()}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Session Actions */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Session Management</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => recordActivity('manual_activity')}
              disabled={!currentSession}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-muted disabled:text-muted-foreground text-white px-4 py-2 rounded-lg transition-colors"
            >
              Record Activity
            </button>
            <button
              onClick={validateSession}
              disabled={!currentSession || isValidating}
              className="bg-green-600 hover:bg-green-700 disabled:bg-muted disabled:text-muted-foreground text-white px-4 py-2 rounded-lg transition-colors"
            >
              {isValidating ? 'Validating...' : 'Validate Session'}
            </button>
            <button
              onClick={extendSession}
              disabled={!currentSession}
              className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-muted disabled:text-muted-foreground text-white px-4 py-2 rounded-lg transition-colors"
            >
              Extend Session
            </button>
            <button
              onClick={cleanupSession}
              disabled={!currentSession}
              className="bg-red-600 hover:bg-red-700 disabled:bg-muted disabled:text-muted-foreground text-white px-4 py-2 rounded-lg transition-colors"
            >
              End Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NOSTRSessionProtection;
