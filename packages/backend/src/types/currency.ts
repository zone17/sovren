/**
 * Currency Type Definitions
 * User Story: US-E5-030 (CurrencyService)
 * Multi-currency support with real-time exchange rates
 * Part of Epic 005 - Backend Service Layer Refactoring
 */

/**
 * Supported currencies
 */
export enum Currency {
  BTC = 'BTC',     // Bitcoin
  USD = 'USD',     // US Dollar
  EUR = 'EUR',     // Euro
  GBP = 'GBP',     // British Pound
  JPY = 'JPY',     // Japanese Yen
  CNY = 'CNY',     // Chinese Yuan
  INR = 'INR',     // Indian Rupee
  CAD = 'CAD',     // Canadian Dollar
  AUD = 'AUD',     // Australian Dollar
  CHF = 'CHF',     // Swiss Franc
  KRW = 'KRW',     // South Korean Won
  BRL = 'BRL',     // Brazilian Real
  MXN = 'MXN',     // Mexican Peso
  SAT = 'SAT'      // Satoshis
}

/**
 * Currency precision (decimal places)
 */
export const CURRENCY_PRECISION: Record<Currency, number> = {
  [Currency.BTC]: 8,    // Bitcoin: 8 decimal places
  [Currency.SAT]: 0,    // Satoshis: No decimal places
  [Currency.USD]: 2,    // USD: 2 decimal places
  [Currency.EUR]: 2,
  [Currency.GBP]: 2,
  [Currency.JPY]: 0,    // JPY: No decimal places
  [Currency.CNY]: 2,
  [Currency.INR]: 2,
  [Currency.CAD]: 2,
  [Currency.AUD]: 2,
  [Currency.CHF]: 2,
  [Currency.KRW]: 0,    // KRW: No decimal places
  [Currency.BRL]: 2,
  [Currency.MXN]: 2
};

/**
 * Currency symbols
 */
export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  [Currency.BTC]: '₿',
  [Currency.SAT]: 'sats',
  [Currency.USD]: '$',
  [Currency.EUR]: '€',
  [Currency.GBP]: '£',
  [Currency.JPY]: '¥',
  [Currency.CNY]: '¥',
  [Currency.INR]: '₹',
  [Currency.CAD]: '$',
  [Currency.AUD]: '$',
  [Currency.CHF]: 'CHF',
  [Currency.KRW]: '₩',
  [Currency.BRL]: 'R$',
  [Currency.MXN]: '$'
};

/**
 * Currency display names
 */
export const CURRENCY_NAMES: Record<Currency, string> = {
  [Currency.BTC]: 'Bitcoin',
  [Currency.SAT]: 'Satoshis',
  [Currency.USD]: 'US Dollar',
  [Currency.EUR]: 'Euro',
  [Currency.GBP]: 'British Pound',
  [Currency.JPY]: 'Japanese Yen',
  [Currency.CNY]: 'Chinese Yuan',
  [Currency.INR]: 'Indian Rupee',
  [Currency.CAD]: 'Canadian Dollar',
  [Currency.AUD]: 'Australian Dollar',
  [Currency.CHF]: 'Swiss Franc',
  [Currency.KRW]: 'South Korean Won',
  [Currency.BRL]: 'Brazilian Real',
  [Currency.MXN]: 'Mexican Peso'
};

/**
 * Exchange rate between two currencies
 */
export interface ExchangeRate {
  id: string;                    // Rate ID
  from: Currency;                // Source currency
  to: Currency;                  // Target currency
  rate: number;                  // Exchange rate
  source: ExchangeRateProvider;  // Rate provider
  timestamp: Date;               // Rate timestamp
  expiresAt: Date;               // Rate expiration
  metadata?: Record<string, any>; // Additional metadata
}

/**
 * Exchange rate provider
 */
export enum ExchangeRateProvider {
  COINGECKO = 'coingecko',       // CoinGecko API
  KRAKEN = 'kraken',             // Kraken API
  COINBASE = 'coinbase',         // Coinbase API
  BINANCE = 'binance',           // Binance API
  FALLBACK = 'fallback',         // Fallback rates
  MANUAL = 'manual'              // Manually set rates
}

/**
 * Exchange rate provider configuration
 */
export interface ExchangeRateProviderConfig {
  name: ExchangeRateProvider;    // Provider name
  apiKey?: string;               // API key (if required)
  baseUrl: string;               // API base URL
  enabled: boolean;              // Whether provider is enabled
  priority: number;              // Provider priority (lower = higher priority)
  timeout: number;               // Request timeout (ms)
  rateLimit?: RateLimitConfig;   // Rate limiting configuration
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  maxRequests: number;           // Maximum requests
  windowMs: number;              // Time window in ms
}

/**
 * Currency conversion request
 */
export interface ConversionRequest {
  amount: number;                // Amount to convert
  from: Currency;                // Source currency
  to: Currency;                  // Target currency
  timestamp?: Date;              // Historical rate timestamp (optional)
}

/**
 * Currency conversion result
 */
export interface ConversionResult {
  originalAmount: number;        // Original amount
  convertedAmount: number;       // Converted amount
  from: Currency;                // Source currency
  to: Currency;                  // Target currency
  rate: number;                  // Exchange rate used
  provider: ExchangeRateProvider; // Rate provider
  timestamp: Date;               // Conversion timestamp
  metadata?: Record<string, any>; // Additional metadata
}

/**
 * Historical exchange rate
 */
export interface HistoricalRate {
  from: Currency;                // Source currency
  to: Currency;                  // Target currency
  rate: number;                  // Exchange rate
  timestamp: Date;               // Rate timestamp
  source: ExchangeRateProvider;  // Rate provider
}

/**
 * Exchange rate query parameters
 */
export interface ExchangeRateQuery {
  from?: Currency;               // Filter by source currency
  to?: Currency;                 // Filter by target currency
  provider?: ExchangeRateProvider; // Filter by provider
  startDate?: Date;              // Start date range
  endDate?: Date;                // End date range
  limit?: number;                // Result limit
  offset?: number;               // Result offset
}

/**
 * Currency formatting options
 */
export interface CurrencyFormatOptions {
  locale?: string;               // Locale for formatting (e.g., 'en-US')
  showSymbol?: boolean;          // Whether to show currency symbol
  showCode?: boolean;            // Whether to show currency code
  decimals?: number;             // Number of decimal places (override default)
  compact?: boolean;             // Use compact notation (e.g., 1.5K)
  useGrouping?: boolean;         // Use thousands separator
}

/**
 * Formatted currency value
 */
export interface FormattedCurrency {
  value: string;                 // Formatted value
  amount: number;                // Original amount
  currency: Currency;            // Currency
  locale: string;                // Locale used
  symbol?: string;               // Currency symbol
}

/**
 * Currency statistics
 */
export interface CurrencyStatistics {
  totalConversions: number;      // Total conversion count
  conversionsByPair: Record<string, number>; // Conversions by currency pair
  totalVolume: number;           // Total volume converted (in BTC)
  averageConversionTime: number; // Average conversion time (ms)
  providerUsage: Record<ExchangeRateProvider, number>; // Provider usage count
  cacheHitRate: number;          // Cache hit rate percentage
  failedConversions: number;     // Failed conversion count
  lastRateUpdate: Date;          // Last rate update timestamp
}

/**
 * Satoshi conversion utilities
 */
export interface SatoshiConversion {
  satoshis: number;              // Amount in satoshis
  btc: number;                   // Amount in BTC
}

/**
 * Rate staleness detection
 */
export interface RateStalenessConfig {
  warningThreshold: number;      // Threshold for warning (ms)
  errorThreshold: number;        // Threshold for error (ms)
  maxAge: number;                // Maximum acceptable age (ms)
}

/**
 * Rate staleness check result
 */
export interface RateStalenessResult {
  isStale: boolean;              // Whether rate is stale
  age: number;                   // Age of rate (ms)
  severity: 'ok' | 'warning' | 'error'; // Staleness severity
  lastUpdate: Date;              // Last update timestamp
}

/**
 * Currency service configuration
 */
export interface CurrencyServiceConfig {
  providers: ExchangeRateProviderConfig[]; // Rate providers
  cacheTtl: number;              // Cache TTL for rates (seconds)
  defaultProvider: ExchangeRateProvider; // Default provider
  fallbackRates?: Record<string, number>; // Fallback rates
  stalenessConfig: RateStalenessConfig; // Staleness configuration
  autoRefresh: boolean;          // Auto-refresh rates
  refreshInterval: number;       // Refresh interval (seconds)
}

/**
 * Exchange rate update event
 */
export interface ExchangeRateUpdateEvent {
  from: Currency;                // Source currency
  to: Currency;                  // Target currency
  oldRate?: number;              // Previous rate
  newRate: number;               // New rate
  provider: ExchangeRateProvider; // Rate provider
  timestamp: Date;               // Update timestamp
  change?: number;               // Rate change percentage
}

/**
 * Currency pair
 */
export interface CurrencyPair {
  from: Currency;                // Source currency
  to: Currency;                  // Target currency
}

/**
 * Currency pair key (for caching)
 */
export type CurrencyPairKey = `${Currency}:${Currency}`;

/**
 * Helper to create currency pair key
 */
export function getCurrencyPairKey(from: Currency, to: Currency): CurrencyPairKey {
  return `${from}:${to}`;
}

/**
 * Helper to parse currency pair key
 */
export function parseCurrencyPairKey(key: CurrencyPairKey): CurrencyPair {
  const [from, to] = key.split(':') as [Currency, Currency];
  return { from, to };
}

/**
 * Bitcoin unit conversion constants
 */
export const BTC_TO_SAT = 100_000_000; // 1 BTC = 100,000,000 satoshis
export const SAT_TO_BTC = 0.00000001;  // 1 satoshi = 0.00000001 BTC

/**
 * Helper to convert BTC to satoshis
 */
export function btcToSatoshis(btc: number): number {
  return Math.round(btc * BTC_TO_SAT);
}

/**
 * Helper to convert satoshis to BTC
 */
export function satoshisToBtc(satoshis: number): number {
  return satoshis * SAT_TO_BTC;
}

/**
 * Helper to format satoshis with unit
 */
export function formatSatoshis(satoshis: number, compact: boolean = false): string {
  if (compact && satoshis >= 1000) {
    const k = satoshis / 1000;
    return `${k.toFixed(1)}K sats`;
  }
  return `${satoshis.toLocaleString()} sats`;
}

/**
 * Helper to format BTC amount
 */
export function formatBtc(btc: number, decimals: number = 8): string {
  return `${btc.toFixed(decimals)} BTC`;
}

/**
 * Currency validation error
 */
export interface CurrencyValidationError {
  field: string;                 // Field with error
  message: string;               // Error message
  code: string;                  // Error code
}

/**
 * Currency conversion error
 */
export interface CurrencyConversionError {
  message: string;               // Error message
  code: string;                  // Error code
  from: Currency;                // Source currency
  to: Currency;                  // Target currency
  retryable: boolean;            // Whether conversion can be retried
  provider?: ExchangeRateProvider; // Failed provider
}
