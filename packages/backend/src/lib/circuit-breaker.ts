/**
 * Circuit Breaker — Wraps external service calls to prevent cascading failures.
 *
 * Uses opossum to trip the circuit when an external dependency (Supabase, LNBits,
 * NOSTR relays) becomes slow or unavailable. Prevents request pile-up and allows
 * the system to degrade gracefully.
 *
 * Production Readiness: INFRA-004
 */

import CircuitBreaker from 'opossum';
import logger from './logger';

export interface CircuitBreakerOptions {
  /** Name for logging/metrics */
  name: string;
  /** Time in ms before a request is considered timed out (default: 10000) */
  timeout?: number;
  /** Percentage of failures before the circuit opens (default: 50) */
  errorThresholdPercentage?: number;
  /** Time in ms to wait before trying a request when circuit is open (default: 30000) */
  resetTimeout?: number;
  /** Number of requests to allow through when half-open (default: 1) */
  volumeThreshold?: number;
}

const DEFAULT_OPTIONS: Required<Omit<CircuitBreakerOptions, 'name'>> = {
  timeout: 10000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  volumeThreshold: 5,
};

/**
 * Create a circuit breaker for an async function.
 *
 * Usage:
 * ```ts
 * const fetchUser = createCircuitBreaker({
 *   name: 'supabase-users',
 *   timeout: 5000,
 * }, async (userId: string) => {
 *   return supabase.from('users').select('*').eq('id', userId).single();
 * });
 *
 * // Call it like the original function — circuit breaker is transparent
 * const user = await fetchUser.fire(userId);
 * ```
 */
export function createCircuitBreaker<TArgs extends unknown[], TResult>(
  options: CircuitBreakerOptions,
  fn: (...args: TArgs) => Promise<TResult>
): CircuitBreaker<TArgs, TResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const breaker = new CircuitBreaker(fn, {
    timeout: opts.timeout,
    errorThresholdPercentage: opts.errorThresholdPercentage,
    resetTimeout: opts.resetTimeout,
    volumeThreshold: opts.volumeThreshold,
  });

  breaker.on('open', () => {
    logger.warn(`Circuit breaker OPEN: ${options.name}`, {
      service: options.name,
      state: 'open',
    });
  });

  breaker.on('halfOpen', () => {
    logger.info(`Circuit breaker HALF-OPEN: ${options.name}`, {
      service: options.name,
      state: 'halfOpen',
    });
  });

  breaker.on('close', () => {
    logger.info(`Circuit breaker CLOSED: ${options.name}`, {
      service: options.name,
      state: 'closed',
    });
  });

  breaker.on('fallback', () => {
    logger.warn(`Circuit breaker FALLBACK: ${options.name}`, {
      service: options.name,
    });
  });

  return breaker;
}

/**
 * Pre-configured circuit breakers for common external services.
 */
export const CircuitBreakers = {
  /** Supabase database operations — generous timeout, moderate threshold */
  supabase: (fn: (...args: any[]) => Promise<any>) =>
    createCircuitBreaker(
      { name: 'supabase', timeout: 15000, errorThresholdPercentage: 50, resetTimeout: 30000 },
      fn
    ),

  /** LNBits Lightning API — shorter timeout, sensitive to failures */
  lnbits: (fn: (...args: any[]) => Promise<any>) =>
    createCircuitBreaker(
      { name: 'lnbits', timeout: 10000, errorThresholdPercentage: 40, resetTimeout: 60000 },
      fn
    ),

  /** NOSTR relay connections — longer timeout, tolerant of failures */
  nostrRelay: (fn: (...args: any[]) => Promise<any>) =>
    createCircuitBreaker(
      { name: 'nostr-relay', timeout: 20000, errorThresholdPercentage: 60, resetTimeout: 45000 },
      fn
    ),

  /** Email/SMTP — long timeout, very tolerant */
  email: (fn: (...args: any[]) => Promise<any>) =>
    createCircuitBreaker(
      { name: 'email', timeout: 30000, errorThresholdPercentage: 70, resetTimeout: 60000 },
      fn
    ),
} as const;
