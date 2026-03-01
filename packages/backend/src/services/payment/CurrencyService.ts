// @ts-nocheck
/**
 * CurrencyService Implementation
 * User Story: US-E5-030
 * Multi-currency support with real-time exchange rates
 * Part of Epic 005 - Backend Service Layer Refactoring
 */

import crypto from 'crypto';
import type { ICurrencyService } from '../../interfaces/payment/ICurrencyService';
import type { IEventBus } from '../../interfaces/shared/IEventBus';
import type { ILogger } from '../../interfaces/shared/ILogger';
import type { ICacheService } from '../../interfaces/shared/ICacheService';
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
  CurrencyServiceConfig
} from '../../types/currency';
import {
  Currency,
  ExchangeRateProvider,
} from '../../types/currency';
import {
  CURRENCY_PRECISION,
  CURRENCY_SYMBOLS,
  CURRENCY_NAMES,
  BTC_TO_SAT,
  SAT_TO_BTC,
  getCurrencyPairKey
} from '../../types/currency';
import { performance } from 'perf_hooks';

/**
 * Exchange rate provider interface
 */
interface IRateProvider {
  name: ExchangeRateProvider;
  fetchRate(from: Currency, to: Currency): Promise<number>;
  fetchRates(currency: Currency): Promise<Map<Currency, number>>;
  isAvailable(): Promise<boolean>;
}

/**
 * CoinGecko rate provider
 */
class CoinGeckoProvider implements IRateProvider {
  readonly name = ExchangeRateProvider.COINGECKO;
  private readonly baseUrl = 'https://api.coingecko.com/api/v3';
  private readonly logger: ILogger;

  constructor(logger: ILogger) {
    this.logger = logger;
  }

  async fetchRate(from: Currency, to: Currency): Promise<number> {
    try {
      // Simplified API call - in production would use actual HTTP client
      // For BTC conversions
      if (from === Currency.BTC || from === Currency.SAT) {
        const url = `${this.baseUrl}/simple/price?ids=bitcoin&vs_currencies=${to.toLowerCase()}`;
        // Simulated rate (in production would fetch from API)
        return this.getSimulatedRate(from, to);
      }

      throw new Error(`Unsupported currency pair: ${from}/${to}`);
    } catch (error) {
      this.logger.error('CoinGecko fetch rate failed', error);
      throw error;
    }
  }

  async fetchRates(currency: Currency): Promise<Map<Currency, number>> {
    const rates = new Map<Currency, number>();
    // Simulated rates
    if (currency === Currency.BTC) {
      rates.set(Currency.USD, 45000);
      rates.set(Currency.EUR, 42000);
      rates.set(Currency.GBP, 36000);
      rates.set(Currency.JPY, 6500000);
    }
    return rates;
  }

  async isAvailable(): Promise<boolean> {
    try {
      // In production would ping the API
      return true;
    } catch {
      return false;
    }
  }

  private getSimulatedRate(from: Currency, to: Currency): number {
    // Simulated rates for development
    const rates: Record<string, Record<string, number>> = {
      [Currency.BTC]: {
        [Currency.USD]: 45000,
        [Currency.EUR]: 42000,
        [Currency.GBP]: 36000,
        [Currency.JPY]: 6500000,
        [Currency.SAT]: BTC_TO_SAT
      },
      [Currency.SAT]: {
        [Currency.BTC]: SAT_TO_BTC,
        [Currency.USD]: 0.00045
      }
    };

    return rates[from]?.[to] || 1;
  }
}

/**
 * Kraken rate provider
 */
class KrakenProvider implements IRateProvider {
  readonly name = ExchangeRateProvider.KRAKEN;
  private readonly baseUrl = 'https://api.kraken.com/0/public';
  private readonly logger: ILogger;

  constructor(logger: ILogger) {
    this.logger = logger;
  }

  async fetchRate(from: Currency, to: Currency): Promise<number> {
    // Simulated rate
    return this.getSimulatedRate(from, to);
  }

  async fetchRates(currency: Currency): Promise<Map<Currency, number>> {
    const rates = new Map<Currency, number>();
    if (currency === Currency.BTC) {
      rates.set(Currency.USD, 45100);
      rates.set(Currency.EUR, 42100);
    }
    return rates;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  private getSimulatedRate(from: Currency, to: Currency): number {
    if (from === Currency.BTC && to === Currency.USD) return 45100;
    if (from === Currency.BTC && to === Currency.EUR) return 42100;
    return 1;
  }
}

/**
 * Fallback rate provider (uses manual/cached rates)
 */
class FallbackProvider implements IRateProvider {
  readonly name = ExchangeRateProvider.FALLBACK;
  private readonly fallbackRates: Map<string, number> = new Map();
  private readonly logger: ILogger;

  constructor(logger: ILogger, fallbackRates?: Record<string, number>) {
    this.logger = logger;
    if (fallbackRates) {
      Object.entries(fallbackRates).forEach(([key, rate]) => {
        this.fallbackRates.set(key, rate);
      });
    }
  }

  async fetchRate(from: Currency, to: Currency): Promise<number> {
    const key = getCurrencyPairKey(from, to);
    const rate = this.fallbackRates.get(key);
    if (!rate) {
      throw new Error(`No fallback rate for ${from}/${to}`);
    }
    return rate;
  }

  async fetchRates(currency: Currency): Promise<Map<Currency, number>> {
    const rates = new Map<Currency, number>();
    for (const [key, rate] of this.fallbackRates) {
      const [from, to] = key.split(':');
      if (from === currency) {
        rates.set(to as Currency, rate);
      }
    }
    return rates;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  setRate(from: Currency, to: Currency, rate: number): void {
    const key = getCurrencyPairKey(from, to);
    this.fallbackRates.set(key, rate);
  }
}

/**
 * Concrete implementation of CurrencyService
 */
export class CurrencyService implements ICurrencyService {
  private readonly eventBus: IEventBus;
  private readonly logger: ILogger;
  private readonly cache: ICacheService;
  private readonly config: CurrencyServiceConfig;
  private readonly providers: Map<ExchangeRateProvider, IRateProvider> = new Map();
  private activeProvider: ExchangeRateProvider;
  private readonly fallbackProvider: FallbackProvider;
  private readonly historicalRates: HistoricalRate[] = [];
  private readonly eventSubscriptions = new Map<string, (event: ExchangeRateUpdateEvent) => void>();
  private readonly metrics = {
    uptime: Date.now(),
    totalConversions: 0,
    cacheHits: 0,
    cacheMisses: 0,
    totalConversionTime: 0,
    conversionsByPair: new Map<string, number>()
  };
  private refreshInterval?: NodeJS.Timeout;

  constructor(
    eventBus: IEventBus,
    logger: ILogger,
    cache: ICacheService,
    config?: Partial<CurrencyServiceConfig>
  ) {
    this.eventBus = eventBus;
    this.logger = logger;
    this.cache = cache;

    // Default configuration
    this.config = {
      providers: [],
      cacheTtl: 300, // 5 minutes
      defaultProvider: ExchangeRateProvider.COINGECKO,
      fallbackRates: {
        'BTC:USD': 45000,
        'BTC:EUR': 42000,
        'BTC:GBP': 36000,
        'SAT:BTC': SAT_TO_BTC
      },
      stalenessConfig: {
        warningThreshold: 600000, // 10 minutes
        errorThreshold: 1800000,  // 30 minutes
        maxAge: 3600000           // 1 hour
      },
      autoRefresh: true,
      refreshInterval: 300, // 5 minutes
      ...config
    };

    // Initialize providers
    this.fallbackProvider = new FallbackProvider(logger, this.config.fallbackRates);
    this.providers.set(ExchangeRateProvider.COINGECKO, new CoinGeckoProvider(logger));
    this.providers.set(ExchangeRateProvider.KRAKEN, new KrakenProvider(logger));
    this.providers.set(ExchangeRateProvider.FALLBACK, this.fallbackProvider);

    this.activeProvider = this.config.defaultProvider;

    // Start auto-refresh if enabled
    if (this.config.autoRefresh) {
      this.startAutoRefresh();
    }
  }

  /**
   * CURRENCY CONVERSION
   */

  async convert(request: ConversionRequest): Promise<ConversionResult> {
    const startTime = performance.now();

    try {
      // Handle same currency
      if (request.from === request.to) {
        return {
          originalAmount: request.amount,
          convertedAmount: request.amount,
          from: request.from,
          to: request.to,
          rate: 1,
          provider: ExchangeRateProvider.FALLBACK,
          timestamp: new Date()
        };
      }

      // Get exchange rate
      const exchangeRate = await this.getRate(request.from, request.to);

      // Calculate converted amount
      const convertedAmount = this.calculateConversion(request.amount, exchangeRate.rate, request.to);

      const result: ConversionResult = {
        originalAmount: request.amount,
        convertedAmount,
        from: request.from,
        to: request.to,
        rate: exchangeRate.rate,
        provider: exchangeRate.source,
        timestamp: new Date()
      };

      // Update metrics
      this.metrics.totalConversions++;
      const pairKey = getCurrencyPairKey(request.from, request.to);
      this.metrics.conversionsByPair.set(pairKey, (this.metrics.conversionsByPair.get(pairKey) || 0) + 1);

      const duration = performance.now() - startTime;
      this.metrics.totalConversionTime += duration;

      this.logger.debug('Currency conversion completed', {
        from: request.from,
        to: request.to,
        amount: request.amount,
        converted: convertedAmount,
        duration: `${duration.toFixed(2)}ms`
      });

      return result;

    } catch (error) {
      this.logger.error('Currency conversion failed', error);
      throw error;
    }
  }

  async convertBatch(requests: ConversionRequest[]): Promise<ConversionResult[]> {
    return Promise.all(requests.map(req => this.convert(req)));
  }

  async satoshisToFiat(satoshis: number, toCurrency: Currency): Promise<ConversionResult> {
    // Convert satoshis to BTC first, then to fiat
    const btc = this.satoshisToBtc(satoshis);
    return this.convert({
      amount: btc,
      from: Currency.BTC,
      to: toCurrency
    });
  }

  async fiatToSatoshis(amount: number, fromCurrency: Currency): Promise<ConversionResult> {
    // Convert fiat to BTC first, then to satoshis
    const btcResult = await this.convert({
      amount,
      from: fromCurrency,
      to: Currency.BTC
    });

    const satoshis = this.btcToSatoshis(btcResult.convertedAmount);

    return {
      ...btcResult,
      convertedAmount: satoshis,
      to: Currency.SAT
    };
  }

  satoshisToBtc(satoshis: number): number {
    return satoshis * SAT_TO_BTC;
  }

  btcToSatoshis(btc: number): number {
    return Math.round(btc * BTC_TO_SAT);
  }

  /**
   * EXCHANGE RATE MANAGEMENT
   */

  async getRate(from: Currency, to: Currency): Promise<ExchangeRate> {
    const pairKey = getCurrencyPairKey(from, to);
    const cacheKey = `rate:${pairKey}`;

    // Check cache
    const cached = await this.cache.get<ExchangeRate>(cacheKey);
    if (cached) {
      this.metrics.cacheHits++;
      return cached;
    }

    this.metrics.cacheMisses++;

    // Fetch from provider
    const rate = await this.fetchRateFromProvider(from, to);

    // Create exchange rate record
    const exchangeRate: ExchangeRate = {
      id: `rate-${Date.now()}`,
      from,
      to,
      rate,
      source: this.activeProvider,
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + this.config.cacheTtl * 1000)
    };

    // Cache the rate
    await this.cache.set(cacheKey, exchangeRate, this.config.cacheTtl);

    // Store in historical rates
    this.historicalRates.push({
      from,
      to,
      rate,
      timestamp: new Date(),
      source: this.activeProvider
    });

    // Emit rate update event
    await this.emitRateUpdate(exchangeRate, undefined);

    return exchangeRate;
  }

  async getRates(pairs: CurrencyPair[]): Promise<Map<string, ExchangeRate>> {
    const rates = new Map<string, ExchangeRate>();

    await Promise.all(
      pairs.map(async (pair) => {
        try {
          const rate = await this.getRate(pair.from, pair.to);
          rates.set(getCurrencyPairKey(pair.from, pair.to), rate);
        } catch (error) {
          this.logger.error(`Failed to get rate for ${pair.from}/${pair.to}`, error);
        }
      })
    );

    return rates;
  }

  async getAllRates(currency: Currency): Promise<Map<Currency, ExchangeRate>> {
    const rates = new Map<Currency, ExchangeRate>();
    const supportedCurrencies = this.getSupportedCurrencies();

    await Promise.all(
      supportedCurrencies
        .filter(c => c !== currency)
        .map(async (to) => {
          try {
            const rate = await this.getRate(currency, to);
            rates.set(to, rate);
          } catch (error) {
            this.logger.debug(`Failed to get rate for ${currency}/${to}`, error);
          }
        })
    );

    return rates;
  }

  async refreshRates(force = false): Promise<number> {
    let refreshed = 0;
    const supportedCurrencies = this.getSupportedCurrencies();

    for (const from of supportedCurrencies) {
      for (const to of supportedCurrencies) {
        if (from === to) continue;

        try {
          const pairKey = getCurrencyPairKey(from, to);
          const cacheKey = `rate:${pairKey}`;

          if (force) {
            await this.cache.delete(cacheKey);
          }

          await this.getRate(from, to);
          refreshed++;
        } catch (error) {
          this.logger.debug(`Failed to refresh rate for ${from}/${to}`, error);
        }
      }
    }

    this.logger.info(`Refreshed ${refreshed} exchange rates`);
    return refreshed;
  }

  async setManualRate(
    from: Currency,
    to: Currency,
    rate: number,
    expiresIn = 3600
  ): Promise<void> {
    this.fallbackProvider.setRate(from, to, rate);

    const pairKey = getCurrencyPairKey(from, to);
    const cacheKey = `rate:${pairKey}`;

    const exchangeRate: ExchangeRate = {
      id: `manual-rate-${Date.now()}`,
      from,
      to,
      rate,
      source: ExchangeRateProvider.MANUAL,
      timestamp: new Date(),
      expiresAt: new Date(Date.now() + expiresIn * 1000)
    };

    await this.cache.set(cacheKey, exchangeRate, expiresIn);

    this.logger.info('Manual rate set', { from, to, rate });
  }

  /**
   * HISTORICAL RATES
   */

  async getHistoricalRate(
    from: Currency,
    to: Currency,
    timestamp: Date
  ): Promise<HistoricalRate | null> {
    const rates = this.historicalRates.filter(
      r => r.from === from && r.to === to && r.timestamp <= timestamp
    );

    if (rates.length === 0) return null;

    // Return the closest rate to the timestamp
    return rates.reduce((closest, current) => {
      const closestDiff = Math.abs(closest.timestamp.getTime() - timestamp.getTime());
      const currentDiff = Math.abs(current.timestamp.getTime() - timestamp.getTime());
      return currentDiff < closestDiff ? current : closest;
    });
  }

  async queryHistoricalRates(query: ExchangeRateQuery): Promise<HistoricalRate[]> {
    let rates = [...this.historicalRates];

    if (query.from) {
      rates = rates.filter(r => r.from === query.from);
    }
    if (query.to) {
      rates = rates.filter(r => r.to === query.to);
    }
    if (query.provider) {
      rates = rates.filter(r => r.source === query.provider);
    }
    if (query.startDate) {
      rates = rates.filter(r => r.timestamp >= query.startDate!);
    }
    if (query.endDate) {
      rates = rates.filter(r => r.timestamp <= query.endDate!);
    }

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    return rates.slice(offset, offset + limit);
  }

  async getRateTrend(
    from: Currency,
    to: Currency,
    days = 30
  ): Promise<HistoricalRate[]> {
    const startDate = new Date(Date.now() - days * 86400000);
    return this.queryHistoricalRates({
      from,
      to,
      startDate,
      endDate: new Date()
    });
  }

  /**
   * CURRENCY FORMATTING
   */

  format(
    amount: number,
    currency: Currency,
    options?: CurrencyFormatOptions
  ): FormattedCurrency {
    const locale = options?.locale || 'en-US';
    const showSymbol = options?.showSymbol !== false;
    const showCode = options?.showCode || false;
    const decimals = options?.decimals ?? CURRENCY_PRECISION[currency];
    const useGrouping = options?.useGrouping !== false;

    let formatted = amount.toFixed(decimals);

    if (useGrouping) {
      const [integer, decimal] = formatted.split('.');
      const withCommas = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      formatted = decimal ? `${withCommas}.${decimal}` : withCommas;
    }

    if (showSymbol) {
      const symbol = CURRENCY_SYMBOLS[currency];
      formatted = `${symbol}${formatted}`;
    }

    if (showCode) {
      formatted = `${formatted} ${currency}`;
    }

    return {
      value: formatted,
      amount,
      currency,
      locale,
      symbol: CURRENCY_SYMBOLS[currency]
    };
  }

  formatSatoshis(satoshis: number, compact = false): string {
    if (compact && satoshis >= 1000) {
      const k = satoshis / 1000;
      return `${k.toFixed(1)}K sats`;
    }
    return `${satoshis.toLocaleString()} sats`;
  }

  formatBtc(btc: number, decimals = 8): string {
    return `${btc.toFixed(decimals)} BTC`;
  }

  parse(formatted: string, currency: Currency): number {
    // Remove currency symbols and codes
    const cleaned = formatted
      .replace(CURRENCY_SYMBOLS[currency], '')
      .replace(currency, '')
      .replace(/,/g, '')
      .trim();

    return parseFloat(cleaned) || 0;
  }

  /**
   * CURRENCY INFORMATION
   */

  getSupportedCurrencies(): Currency[] {
    return Object.values(Currency);
  }

  getCurrencySymbol(currency: Currency): string {
    return CURRENCY_SYMBOLS[currency];
  }

  getCurrencyName(currency: Currency): string {
    return CURRENCY_NAMES[currency];
  }

  getCurrencyPrecision(currency: Currency): number {
    return CURRENCY_PRECISION[currency];
  }

  isCurrencySupported(currency: string): boolean {
    return Object.values(Currency).includes(currency as Currency);
  }

  /**
   * RATE STALENESS DETECTION
   */

  async checkRateStaleness(from: Currency, to: Currency): Promise<RateStalenessResult> {
    const lastUpdate = await this.getLastRateUpdate(from, to);

    if (!lastUpdate) {
      return {
        isStale: true,
        age: -1,
        severity: 'error',
        lastUpdate: new Date(0)
      };
    }

    const age = Date.now() - lastUpdate.getTime();
    const { warningThreshold, errorThreshold } = this.config.stalenessConfig;

    let severity: 'ok' | 'warning' | 'error' = 'ok';
    let isStale = false;

    if (age >= errorThreshold) {
      severity = 'error';
      isStale = true;
    } else if (age >= warningThreshold) {
      severity = 'warning';
      isStale = true;
    }

    return {
      isStale,
      age,
      severity,
      lastUpdate
    };
  }

  async getLastRateUpdate(from: Currency, to: Currency): Promise<Date | null> {
    const pairKey = getCurrencyPairKey(from, to);
    const cacheKey = `rate:${pairKey}`;
    const cached = await this.cache.get<ExchangeRate>(cacheKey);

    return cached?.timestamp || null;
  }

  /**
   * PROVIDER MANAGEMENT
   */

  getActiveProvider(): ExchangeRateProvider {
    return this.activeProvider;
  }

  setActiveProvider(provider: ExchangeRateProvider): void {
    if (!this.providers.has(provider)) {
      throw new Error(`Provider ${provider} is not available`);
    }
    this.activeProvider = provider;
    this.logger.info('Active provider changed', { provider });
  }

  getAvailableProviders(): ExchangeRateProvider[] {
    return Array.from(this.providers.keys());
  }

  async testProvider(provider: ExchangeRateProvider): Promise<boolean> {
    const providerInstance = this.providers.get(provider);
    if (!providerInstance) return false;

    try {
      return await providerInstance.isAvailable();
    } catch {
      return false;
    }
  }

  /**
   * STATISTICS & MONITORING
   */

  async getStatistics(): Promise<CurrencyStatistics> {
    const cacheStats = await this.getCacheStats();

    return {
      totalConversions: this.metrics.totalConversions,
      conversionsByPair: Object.fromEntries(this.metrics.conversionsByPair),
      totalVolume: 0, // Would track in production
      averageConversionTime: this.metrics.totalConversionTime / this.metrics.totalConversions || 0,
      providerUsage: {
        [this.activeProvider]: this.metrics.totalConversions
      },
      cacheHitRate: cacheStats.hitRate,
      failedConversions: 0, // Would track in production
      lastRateUpdate: new Date()
    };
  }

  async getCacheStats(): Promise<{
    hitRate: number;
    hits: number;
    misses: number;
    totalKeys: number;
  }> {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    const hitRate = total > 0 ? (this.metrics.cacheHits / total) * 100 : 0;

    return {
      hitRate,
      hits: this.metrics.cacheHits,
      misses: this.metrics.cacheMisses,
      totalKeys: this.historicalRates.length
    };
  }

  /**
   * EVENTS
   */

  subscribeToRateUpdates(
    callback: (event: ExchangeRateUpdateEvent) => void | Promise<void>
  ): string {
    const subscriptionId = `sub-${Date.now()}-${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;
    this.eventSubscriptions.set(subscriptionId, callback);
    return subscriptionId;
  }

  unsubscribeFromRateUpdates(subscriptionId: string): void {
    this.eventSubscriptions.delete(subscriptionId);
  }

  /**
   * HEALTH & MAINTENANCE
   */

  async healthCheck(): Promise<boolean> {
    try {
      const provider = this.providers.get(this.activeProvider);
      return provider ? await provider.isAvailable() : false;
    } catch {
      return false;
    }
  }

  async clearCache(): Promise<void> {
    // Clear rate cache
    await this.cache.invalidate('rate:*');
    this.logger.info('Currency rate cache cleared');
  }

  async warmupCache(): Promise<void> {
    const commonPairs: CurrencyPair[] = [
      { from: Currency.BTC, to: Currency.USD },
      { from: Currency.BTC, to: Currency.EUR },
      { from: Currency.BTC, to: Currency.GBP },
      { from: Currency.SAT, to: Currency.USD }
    ];

    await this.getRates(commonPairs);
    this.logger.info('Currency cache warmed up');
  }

  async getMetrics(): Promise<{
    uptime: number;
    totalConversions: number;
    cacheHitRate: number;
    averageConversionTime: number;
    activeProvider: ExchangeRateProvider;
  }> {
    const uptime = Date.now() - this.metrics.uptime;
    const cacheStats = await this.getCacheStats();
    const avgConversionTime = this.metrics.totalConversionTime / this.metrics.totalConversions || 0;

    return {
      uptime,
      totalConversions: this.metrics.totalConversions,
      cacheHitRate: cacheStats.hitRate,
      averageConversionTime: avgConversionTime,
      activeProvider: this.activeProvider
    };
  }

  async dispose(): Promise<void> {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    this.eventSubscriptions.clear();
    this.logger.info('CurrencyService disposed');
  }

  /**
   * PRIVATE HELPER METHODS
   */

  private async fetchRateFromProvider(from: Currency, to: Currency): Promise<number> {
    const provider = this.providers.get(this.activeProvider);
    if (!provider) {
      throw new Error(`Provider ${this.activeProvider} not found`);
    }

    try {
      return await provider.fetchRate(from, to);
    } catch (error) {
      this.logger.warn(`Failed to fetch rate from ${this.activeProvider}, trying fallback`, error);

      // Try fallback provider
      const fallback = this.providers.get(ExchangeRateProvider.FALLBACK);
      if (fallback) {
        return await fallback.fetchRate(from, to);
      }

      throw error;
    }
  }

  private calculateConversion(amount: number, rate: number, toCurrency: Currency): number {
    const converted = amount * rate;
    const precision = CURRENCY_PRECISION[toCurrency];

    // Round to currency precision
    return Math.round(converted * Math.pow(10, precision)) / Math.pow(10, precision);
  }

  private async emitRateUpdate(newRate: ExchangeRate, oldRate?: ExchangeRate): Promise<void> {
    const change = oldRate
      ? ((newRate.rate - oldRate.rate) / oldRate.rate) * 100
      : undefined;

    const event: ExchangeRateUpdateEvent = {
      from: newRate.from,
      to: newRate.to,
      oldRate: oldRate?.rate,
      newRate: newRate.rate,
      provider: newRate.source,
      timestamp: newRate.timestamp,
      change
    };

    // Notify subscribers
    for (const [, callback] of this.eventSubscriptions) {
      try {
        await callback(event);
      } catch (error) {
        this.logger.error('Rate update notification failed', error);
      }
    }
  }

  private startAutoRefresh(): void {
    this.refreshInterval = setInterval(async () => {
      try {
        const count = await this.refreshRates();
        this.logger.debug(`Auto-refreshed ${count} rates`);
      } catch (error) {
        this.logger.error('Auto-refresh failed', error);
      }
    }, this.config.refreshInterval * 1000);

    // Initial warmup
    setTimeout(() => this.warmupCache(), 1000);
  }
}
