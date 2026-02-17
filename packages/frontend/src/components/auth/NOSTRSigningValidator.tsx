import { AnimatePresence, motion } from 'framer-motion';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';

// Core NOSTR imports
import { verifyEvent } from 'nostr-tools/pure';

// Internal imports
import { useAuth } from '../../features/auth/services/AuthContext';

// Simple logger for development
const logger = {
  info: (message: string, data?: any) => console.log(`[INFO] ${message}`, data),
  error: (message: string, data?: any) => console.error(`[ERROR] ${message}`, data),
  warn: (message: string, data?: any) => console.warn(`[WARN] ${message}`, data),
};

// 🔐 NOSTR Signing Validation Schemas
const NostrEventSchema = z.object({
  id: z.string().length(64, 'Event ID must be 64 characters'),
  pubkey: z.string().length(64, 'Public key must be 64 characters'),
  created_at: z.number().positive('Created timestamp must be positive'),
  kind: z.number().int().min(0, 'Kind must be non-negative integer'),
  tags: z.array(z.array(z.string())),
  content: z.string(),
  sig: z.string().length(128, 'Signature must be 128 characters'),
});

const SigningRequirementsSchema = z.object({
  min_key_age: z.number().default(3600), // 1 hour minimum
  max_signature_age: z.number().default(300), // 5 minutes maximum
  required_kinds: z.array(z.number()).default([1, 22242]), // Text note and auth
  entropy_threshold: z.number().default(128),
  rate_limit: z.number().default(10), // Max signatures per minute
});

const ChallengeResponseSchema = z.object({
  challenge: z.string().min(32, 'Challenge must be at least 32 characters'),
  response: z.string().min(1, 'Response is required'),
  timestamp: z.number(),
  pubkey: z.string().length(64, 'Public key must be 64 characters'),
  difficulty: z.number().default(1),
});

// Types
type NostrEvent = z.infer<typeof NostrEventSchema>;
type SigningRequirements = z.infer<typeof SigningRequirementsSchema>;
type ChallengeResponse = z.infer<typeof ChallengeResponseSchema>;

interface SignatureAttempt {
  timestamp: number;
  pubkey: string;
  success: boolean;
  error?: string;
}

interface CompromisedKey {
  pubkey: string;
  detected_at: number;
  reason: string;
  confidence: number; // 0-1 scale
}

interface SigningValidatorProps {
  onValidSignature?: (event: NostrEvent) => void;
  onInvalidSignature?: (error: string, event?: Partial<NostrEvent>) => void;
  onCompromisedKey?: (compromised: CompromisedKey) => void;
  requirements?: Partial<SigningRequirements>;
  className?: string;
}

// 🚀 NOSTR Signing Validator Component
export const NOSTRSigningValidator: React.FC<SigningValidatorProps> = ({
  onValidSignature,
  onInvalidSignature,
  onCompromisedKey,
  requirements = {},
  className = '',
}) => {
  // State management
  const [currentRequirements, setCurrentRequirements] = useState<SigningRequirements>(() =>
    SigningRequirementsSchema.parse(requirements)
  );
  const [pendingChallenge, setPendingChallenge] = useState<string | null>(null);
  const [challengeTimestamp, setChallengeTimestamp] = useState<number>(0);
  const [signatureAttempts, setSignatureAttempts] = useState<SignatureAttempt[]>([]);
  const [compromisedKeys, setCompromisedKeys] = useState<CompromisedKey[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testEvent, setTestEvent] = useState<string>('');
  const [validationResults, setValidationResults] = useState<any>(null);

  // Refs for performance tracking
  const rateLimitRef = useRef<Map<string, number[]>>(new Map());
  const compromisedKeysRef = useRef<Set<string>>(new Set());

  // Hooks
  const { user } = useAuth();

  // 🎯 Generate Cryptographic Challenge
  const generateChallenge = useCallback(async (difficulty: number = 1): Promise<string> => {
    try {
      // Generate random challenge with specified difficulty
      const entropy = crypto.getRandomValues(new Uint8Array(32));
      const baseChallenge = Array.from(entropy)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      // For difficulty > 1, require hash to have leading zeros
      let challenge = baseChallenge;
      if (difficulty > 1) {
        const requiredZeros = Math.floor(Math.log2(difficulty));
        let attempts = 0;

        while (attempts < 10000) {
          // Prevent infinite loops
          const testChallenge = baseChallenge + attempts.toString(16);
          const hash = await crypto.subtle.digest(
            'SHA-256',
            new TextEncoder().encode(testChallenge)
          );
          const hashArray = Array.from(new Uint8Array(hash));
          const hexHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

          if (hexHash.startsWith('0'.repeat(requiredZeros))) {
            challenge = testChallenge;
            break;
          }
          attempts++;
        }
      }

      setPendingChallenge(challenge);
      setChallengeTimestamp(Date.now());

      logger.info('Challenge generated', {
        challenge: challenge.slice(0, 16) + '...',
        difficulty,
        timestamp: Date.now(),
      });

      return challenge;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Challenge generation failed';
      logger.error('Challenge generation failed', { error: errorMsg });
      throw new Error(errorMsg);
    }
  }, []);

  // 🔍 NIP-01 Event Validation
  const validateNIP01Event = useCallback(
    (event: any): { valid: boolean; errors: string[] } => {
      const errors: string[] = [];

      try {
        // Basic structure validation
        if (!event || typeof event !== 'object') {
          errors.push('Event must be an object');
          return { valid: false, errors };
        }

        // Required fields
        const requiredFields = ['id', 'pubkey', 'created_at', 'kind', 'tags', 'content', 'sig'];
        for (const field of requiredFields) {
          if (!(field in event)) {
            errors.push(`Missing required field: ${field}`);
          }
        }

        // Field type validation
        if (typeof event.id !== 'string' || event.id.length !== 64) {
          errors.push('Invalid event ID format');
        }

        if (typeof event.pubkey !== 'string' || event.pubkey.length !== 64) {
          errors.push('Invalid public key format');
        }

        if (typeof event.created_at !== 'number' || event.created_at <= 0) {
          errors.push('Invalid created_at timestamp');
        }

        if (typeof event.kind !== 'number' || event.kind < 0) {
          errors.push('Invalid event kind');
        }

        if (!Array.isArray(event.tags)) {
          errors.push('Tags must be an array');
        } else {
          event.tags.forEach((tag: any, index: number) => {
            if (!Array.isArray(tag)) {
              errors.push(`Tag at index ${index} must be an array`);
            } else {
              tag.forEach((item: any, itemIndex: number) => {
                if (typeof item !== 'string') {
                  errors.push(`Tag ${index}[${itemIndex}] must be a string`);
                }
              });
            }
          });
        }

        if (typeof event.content !== 'string') {
          errors.push('Content must be a string');
        }

        if (typeof event.sig !== 'string' || event.sig.length !== 128) {
          errors.push('Invalid signature format');
        }

        // Event ID and signature validation via verifyEvent (validates hash + sig)
        if (errors.length === 0) {
          if (!verifyEvent(event)) {
            errors.push('Event ID or signature verification failed');
          }
        }

        // Age validation
        const eventAge = Date.now() / 1000 - event.created_at;
        if (eventAge > currentRequirements.max_signature_age) {
          errors.push(`Event too old: ${eventAge}s > ${currentRequirements.max_signature_age}s`);
        }

        // Kind validation
        if (
          currentRequirements.required_kinds.length > 0 &&
          !currentRequirements.required_kinds.includes(event.kind)
        ) {
          errors.push(`Invalid event kind: ${event.kind}`);
        }

        return { valid: errors.length === 0, errors };
      } catch (err) {
        errors.push(`Validation error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        return { valid: false, errors };
      }
    },
    [currentRequirements]
  );

  // 🔐 Signature Verification
  const verifySignature = useCallback(
    async (event: any): Promise<{ valid: boolean; error?: string }> => {
      try {
        // First validate event structure
        const structureValidation = validateNIP01Event(event);
        if (!structureValidation.valid) {
          return { valid: false, error: structureValidation.errors.join(', ') };
        }

        // Check for compromised key
        if (compromisedKeysRef.current.has(event.pubkey)) {
          return { valid: false, error: 'Public key is marked as compromised' };
        }

        // Rate limiting check
        const now = Date.now();
        const attempts = rateLimitRef.current.get(event.pubkey) || [];
        const recentAttempts = attempts.filter((time) => now - time < 60000); // Last minute

        if (recentAttempts.length >= currentRequirements.rate_limit) {
          return { valid: false, error: 'Rate limit exceeded for this public key' };
        }

        // Update rate limiting
        recentAttempts.push(now);
        rateLimitRef.current.set(event.pubkey, recentAttempts);

        // Cryptographic verification
        const isValid = verifyEvent(event);

        // Record attempt
        const attempt: SignatureAttempt = {
          timestamp: now,
          pubkey: event.pubkey,
          success: isValid,
          error: isValid ? undefined : 'Cryptographic verification failed',
        };

        setSignatureAttempts((prev) => [...prev.slice(-99), attempt]); // Keep last 100

        // Check for potential compromise patterns
        await detectCompromisedKey(event.pubkey, attempt);

        return { valid: isValid, error: isValid ? undefined : 'Invalid signature' };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Signature verification failed';
        return { valid: false, error: errorMsg };
      }
    },
    [currentRequirements, validateNIP01Event]
  );

  // 🚨 Compromised Key Detection
  const detectCompromisedKey = useCallback(
    async (pubkey: string, attempt: SignatureAttempt) => {
      try {
        const userAttempts = signatureAttempts.filter((a) => a.pubkey === pubkey);
        const recentFailures = userAttempts.filter(
          (a) => !a.success && Date.now() - a.timestamp < 300000 // Last 5 minutes
        ).length;

        // Detection heuristics
        let compromiseReasons: string[] = [];
        let confidence = 0;

        // Too many recent failures
        if (recentFailures >= 5) {
          compromiseReasons.push('Multiple signature failures');
          confidence += 0.3;
        }

        // Rapid signing attempts (bot behavior)
        const rapidAttempts = userAttempts.filter(
          (a) => Date.now() - a.timestamp < 10000 // Last 10 seconds
        ).length;

        if (rapidAttempts > 3) {
          compromiseReasons.push('Rapid signing attempts detected');
          confidence += 0.4;
        }

        // Unusual signing patterns (simplified heuristic)
        const totalAttempts = userAttempts.length;
        const successRate =
          totalAttempts > 0 ? userAttempts.filter((a) => a.success).length / totalAttempts : 1;

        if (totalAttempts > 10 && successRate < 0.5) {
          compromiseReasons.push('Low success rate');
          confidence += 0.3;
        }

        // Mark as compromised if confidence is high
        if (confidence >= 0.7) {
          const compromised: CompromisedKey = {
            pubkey,
            detected_at: Date.now(),
            reason: compromiseReasons.join(', '),
            confidence,
          };

          setCompromisedKeys((prev) => [...prev, compromised]);
          compromisedKeysRef.current.add(pubkey);
          onCompromisedKey?.(compromised);

          logger.warn('Compromised key detected', {
            pubkey: pubkey.slice(0, 16) + '...',
            reasons: compromiseReasons,
            confidence,
          });
        }
      } catch (err) {
        logger.error('Compromise detection failed', {
          error: err instanceof Error ? err.message : 'Unknown error',
          pubkey: pubkey.slice(0, 16) + '...',
        });
      }
    },
    [signatureAttempts, onCompromisedKey]
  );

  // 🧪 Test Event Validation
  const testEventValidation = useCallback(async () => {
    if (!testEvent.trim()) {
      setError('Please enter an event to test');
      return;
    }

    setIsValidating(true);
    setError(null);
    setValidationResults(null);

    try {
      const event = JSON.parse(testEvent);

      // Structure validation
      const structureValidation = validateNIP01Event(event);

      // Signature verification
      const signatureValidation = await verifySignature(event);

      const results = {
        structure: structureValidation,
        signature: signatureValidation,
        event: event,
        timestamp: Date.now(),
      };

      setValidationResults(results);

      if (structureValidation.valid && signatureValidation.valid) {
        setSuccess('Event validation successful');
        onValidSignature?.(event);
      } else {
        const errors = [
          ...structureValidation.errors,
          ...(signatureValidation.error ? [signatureValidation.error] : []),
        ];
        setError(errors.join(', '));
        onInvalidSignature?.(errors.join(', '), event);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Invalid JSON';
      setError(errorMsg);
      onInvalidSignature?.(errorMsg);
    } finally {
      setIsValidating(false);
    }
  }, [testEvent, validateNIP01Event, verifySignature, onValidSignature, onInvalidSignature]);

  // 🎨 Auto-clear messages
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  return (
    <div className={`nostr-signing-validator ${className}`}>
      <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
        {/* Header */}
        <div className="border-b pb-4">
          <h2 className="text-2xl font-bold text-gray-900">NOSTR Signing Validator</h2>
          <p className="text-gray-600 mt-1">
            Validate NOSTR signatures and enforce cryptographic requirements
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

        {/* Signing Requirements */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Signing Requirements</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-sm text-blue-700 font-medium">Max Signature Age</div>
              <div className="text-xl font-bold text-blue-600">
                {currentRequirements.max_signature_age}s
              </div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="text-sm text-green-700 font-medium">Rate Limit</div>
              <div className="text-xl font-bold text-green-600">
                {currentRequirements.rate_limit}/min
              </div>
            </div>
            <div className="bg-yellow-50 p-3 rounded-lg">
              <div className="text-sm text-yellow-700 font-medium">Min Key Age</div>
              <div className="text-xl font-bold text-yellow-600">
                {currentRequirements.min_key_age}s
              </div>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <div className="text-sm text-purple-700 font-medium">Allowed Kinds</div>
              <div className="text-xl font-bold text-purple-600">
                {currentRequirements.required_kinds.length}
              </div>
            </div>
          </div>
        </div>

        {/* Challenge Generation */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Challenge Generation</h3>
          <div className="flex items-center gap-4">
            <button
              onClick={() => generateChallenge(1)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Generate Challenge
            </button>
            <button
              onClick={() => generateChallenge(2)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Hard Challenge
            </button>
            {pendingChallenge && (
              <div className="text-sm text-gray-600">
                Challenge active ({Math.floor((Date.now() - challengeTimestamp) / 1000)}s ago)
              </div>
            )}
          </div>

          {pendingChallenge && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm font-medium text-gray-700 mb-1">Current Challenge:</div>
              <div className="font-mono text-sm break-all">{pendingChallenge}</div>
            </div>
          )}
        </div>

        {/* Event Testing */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Test Event Validation</h3>
          <div className="space-y-3">
            <textarea
              value={testEvent}
              onChange={(e) => setTestEvent(e.target.value)}
              placeholder="Paste NOSTR event JSON here..."
              className="w-full h-32 p-3 border border-gray-300 rounded-lg font-mono text-sm"
            />
            <button
              onClick={testEventValidation}
              disabled={isValidating || !testEvent.trim()}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
            >
              {isValidating ? 'Validating...' : 'Validate Event'}
            </button>
          </div>
        </div>

        {/* Validation Results */}
        {validationResults && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Validation Results</h3>
            <div className="space-y-3">
              <div
                className={`p-3 rounded-lg ${validationResults.structure.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}
              >
                <div className="font-medium">Structure Validation</div>
                <div
                  className={validationResults.structure.valid ? 'text-green-700' : 'text-red-700'}
                >
                  {validationResults.structure.valid
                    ? '✓ Valid NIP-01 structure'
                    : validationResults.structure.errors.join(', ')}
                </div>
              </div>

              <div
                className={`p-3 rounded-lg ${validationResults.signature.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}
              >
                <div className="font-medium">Signature Validation</div>
                <div
                  className={validationResults.signature.valid ? 'text-green-700' : 'text-red-700'}
                >
                  {validationResults.signature.valid
                    ? '✓ Valid cryptographic signature'
                    : validationResults.signature.error}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Attempts */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Signature Attempts</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {signatureAttempts
              .slice(-10)
              .reverse()
              .map((attempt, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg text-sm ${attempt.success ? 'bg-green-50' : 'bg-red-50'}`}
                >
                  <div className="flex justify-between items-center">
                    <div className="font-mono">{attempt.pubkey.slice(0, 16)}...</div>
                    <div className={attempt.success ? 'text-green-600' : 'text-red-600'}>
                      {attempt.success ? '✓' : '✗'}
                    </div>
                  </div>
                  <div className="text-gray-600">
                    {new Date(attempt.timestamp).toLocaleTimeString()}
                    {attempt.error && ` - ${attempt.error}`}
                  </div>
                </div>
              ))}
            {signatureAttempts.length === 0 && (
              <div className="text-gray-500 text-center py-4">No signature attempts yet</div>
            )}
          </div>
        </div>

        {/* Compromised Keys */}
        {compromisedKeys.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Compromised Keys Detected</h3>
            <div className="space-y-2">
              {compromisedKeys.map((key, index) => (
                <div key={index} className="bg-red-50 border border-red-200 p-3 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div className="font-mono text-sm">{key.pubkey.slice(0, 16)}...</div>
                    <div className="text-red-600 font-medium">
                      {Math.round(key.confidence * 100)}% confidence
                    </div>
                  </div>
                  <div className="text-red-700 text-sm">{key.reason}</div>
                  <div className="text-gray-600 text-xs">
                    Detected: {new Date(key.detected_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NOSTRSigningValidator;
