/**
 * CurrencyService Interface
 * User Story: US-E5-030
 * Multi-currency support with real-time exchange rates
 * Part of Epic 005 - Backend Service Layer Refactoring
 */

import type {
  ExchangeRate,
  ConversionRequest,
  ConversionResult,
  HistoricalRate,
  ExchangeRateQuery,
  CurrencyFormatOptions,
  FormattedCurrency,
  CurrencyStatistics,
  RateStalenessResult,
  ExchangeRateUpdateEvent,
  CurrencyPair,
} from '../../types/currency';
import { Currency, ExchangeRateProvider } from '../../types/currency';

/**
 * Currency service interface
 * Handles currency conversion, exchange rates, and formatting
 */
export interface ICurrencyService {
  /**
   * CURRENCY CONVERSION
   */

  /**
   * Convert amount from one currency to another
   * @param request - Conversion request
   * @returns Conversion result
   * @throws Error if conversion fails
   */
  convert(request: ConversionRequest): Promise<ConversionResult>;

  /**
   * Batch convert multiple amounts
   * @param requests - Array of conversion requests
   * @returns Array of conversion results
   */
  convertBatch(requests: ConversionRequest[]): Promise<ConversionResult[]>;

  /**
   * Convert satoshis to fiat currency
   * @param satoshis - Amount in satoshis
   * @param toCurrency - Target currency
   * @returns Conversion result
   */
  satoshisToFiat(satoshis: number, toCurrency: Currency): Promise<ConversionResult>;

  /**
   * Convert fiat currency to satoshis
   * @param amount - Amount in fiat
   * @param fromCurrency - Source currency
   * @returns Conversion result with satoshis
   */
  fiatToSatoshis(amount: number, fromCurrency: Currency): Promise<ConversionResult>;

  /**
   * Convert satoshis to BTC
   * @param satoshis - Amount in satoshis
   * @returns BTC amount
   */
  satoshisToBtc(satoshis: number): number;

  /**
   * Convert BTC to satoshis
   * @param btc - Amount in BTC
   * @returns Satoshi amount
   */
  btcToSatoshis(btc: number): number;

  /**
   * EXCHANGE RATE MANAGEMENT
   */

  /**
   * Get current exchange rate
   * @param from - Source currency
   * @param to - Target currency
   * @returns Exchange rate
   * @throws Error if rate not available
   */
  getRate(from: Currency, to: Currency): Promise<ExchangeRate>;

  /**
   * Get multiple exchange rates
   * @param pairs - Array of currency pairs
   * @returns Map of rates by currency pair
   */
  getRates(pairs: CurrencyPair[]): Promise<Map<string, ExchangeRate>>;

  /**
   * Get all rates for a currency
   * @param currency - Base currency
   * @returns Map of rates to other currencies
   */
  getAllRates(currency: Currency): Promise<Map<Currency, ExchangeRate>>;

  /**
   * Refresh exchange rates from providers
   * @param force - Force refresh even if cache is valid
   * @returns Number of rates updated
   */
  refreshRates(force?: boolean): Promise<number>;

  /**
   * Set manual exchange rate (for testing or fallback)
   * @param from - Source currency
   * @param to - Target currency
   * @param rate - Exchange rate
   * @param expiresIn - Expiration time in seconds (optional)
   */
  setManualRate(from: Currency, to: Currency, rate: number, expiresIn?: number): Promise<void>;

  /**
   * HISTORICAL RATES
   */

  /**
   * Get historical exchange rate
   * @param from - Source currency
   * @param to - Target currency
   * @param timestamp - Historical timestamp
   * @returns Historical rate
   */
  getHistoricalRate(from: Currency, to: Currency, timestamp: Date): Promise<HistoricalRate | null>;

  /**
   * Query historical rates
   * @param query - Query parameters
   * @returns Array of historical rates
   */
  queryHistoricalRates(query: ExchangeRateQuery): Promise<HistoricalRate[]>;

  /**
   * Get rate trend
   * @param from - Source currency
   * @param to - Target currency
   * @param days - Number of days (default: 30)
   * @returns Array of historical rates
   */
  getRateTrend(from: Currency, to: Currency, days?: number): Promise<HistoricalRate[]>;

  /**
   * CURRENCY FORMATTING
   */

  /**
   * Format amount in currency
   * @param amount - Amount to format
   * @param currency - Currency
   * @param options - Formatting options
   * @returns Formatted currency string
   */
  format(amount: number, currency: Currency, options?: CurrencyFormatOptions): FormattedCurrency;

  /**
   * Format satoshis with unit
   * @param satoshis - Amount in satoshis
   * @param compact - Use compact notation (e.g., 1.5K sats)
   * @returns Formatted string
   */
  formatSatoshis(satoshis: number, compact?: boolean): string;

  /**
   * Format BTC amount
   * @param btc - Amount in BTC
   * @param decimals - Number of decimal places (default: 8)
   * @returns Formatted string
   */
  formatBtc(btc: number, decimals?: number): string;

  /**
   * Parse formatted currency string to number
   * @param formatted - Formatted currency string
   * @param currency - Currency
   * @returns Parsed amount
   */
  parse(formatted: string, currency: Currency): number;

  /**
   * CURRENCY INFORMATION
   */

  /**
   * Get supported currencies
   * @returns List of supported currencies
   */
  getSupportedCurrencies(): Currency[];

  /**
   * Get currency symbol
   * @param currency - Currency
   * @returns Currency symbol
   */
  getCurrencySymbol(currency: Currency): string;

  /**
   * Get currency name
   * @param currency - Currency
   * @returns Currency display name
   */
  getCurrencyName(currency: Currency): string;

  /**
   * Get currency precision (decimal places)
   * @param currency - Currency
   * @returns Number of decimal places
   */
  getCurrencyPrecision(currency: Currency): number;

  /**
   * Check if currency is supported
   * @param currency - Currency code
   * @returns Whether currency is supported
   */
  isCurrencySupported(currency: string): boolean;

  /**
   * RATE STALENESS DETECTION
   */

  /**
   * Check if rate is stale
   * @param from - Source currency
   * @param to - Target currency
   * @returns Staleness check result
   */
  checkRateStaleness(from: Currency, to: Currency): Promise<RateStalenessResult>;

  /**
   * Get last rate update time
   * @param from - Source currency
   * @param to - Target currency
   * @returns Last update timestamp
   */
  getLastRateUpdate(from: Currency, to: Currency): Promise<Date | null>;

  /**
   * PROVIDER MANAGEMENT
   */

  /**
   * Get active exchange rate provider
   * @returns Current provider
   */
  getActiveProvider(): ExchangeRateProvider;

  /**
   * Set active exchange rate provider
   * @param provider - Provider to use
   */
  setActiveProvider(provider: ExchangeRateProvider): void;

  /**
   * Get available providers
   * @returns List of available providers
   */
  getAvailableProviders(): ExchangeRateProvider[];

  /**
   * Test provider connectivity
   * @param provider - Provider to test
   * @returns Whether provider is reachable
   */
  testProvider(provider: ExchangeRateProvider): Promise<boolean>;

  /**
   * STATISTICS & MONITORING
   */

  /**
   * Get currency service statistics
   * @returns Service statistics
   */
  getStatistics(): Promise<CurrencyStatistics>;

  /**
   * Get cache statistics
   * @returns Cache hit rate and related metrics
   */
  getCacheStats(): Promise<{
    hitRate: number;
    hits: number;
    misses: number;
    totalKeys: number;
  }>;

  /**
   * EVENTS
   */

  /**
   * Subscribe to rate update events
   * @param callback - Event handler
   * @returns Subscription ID
   */
  subscribeToRateUpdates(
    callback: (event: ExchangeRateUpdateEvent) => void | Promise<void>
  ): string;

  /**
   * Unsubscribe from rate updates
   * @param subscriptionId - Subscription ID
   */
  unsubscribeFromRateUpdates(subscriptionId: string): void;

  /**
   * HEALTH & MAINTENANCE
   */

  /**
   * Health check for currency service
   * @returns Whether service is healthy
   */
  healthCheck(): Promise<boolean>;

  /**
   * Clear rate cache
   */
  clearCache(): Promise<void>;

  /**
   * Warm up cache with common currency pairs
   */
  warmupCache(): Promise<void>;

  /**
   * Get service metrics
   * @returns Service metrics
   */
  getMetrics(): Promise<{
    uptime: number;
    totalConversions: number;
    cacheHitRate: number;
    averageConversionTime: number;
    activeProvider: ExchangeRateProvider;
  }>;

  /**
   * Dispose resources
   */
  dispose(): Promise<void>;
}
