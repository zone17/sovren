/**
 * Shared BTC/USD Rate Utility
 * Extracted from RevenueService and TaxService (Todo #321)
 *
 * H-5: Returns rate + metadata for provenance recording (rate_source + rate_timestamp)
 */

import type { ICacheService } from '../interfaces/shared/ICacheService';
import type { ILogger } from '../interfaces/shared/ILogger';

const BTC_RATE_CACHE_KEY = 'btc:usd:rate';
const BTC_RATE_TTL = 300; // 5 minutes
const DEFAULT_FALLBACK_RATE = 50000;
export const RATE_SOURCE = 'coingecko';

export async function getBtcUsdRate(
  cache: ICacheService,
  logger: ILogger
): Promise<{ rate: number; fetchedAt: string }> {
  const cached = await cache.get<{ rate: number; fetchedAt: string }>(BTC_RATE_CACHE_KEY);
  if (cached !== null) return cached;

  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'
    );
    const json = (await response.json()) as { bitcoin?: { usd?: number } };
    const rate = json?.bitcoin?.usd;

    if (typeof rate !== 'number' || rate <= 0) {
      throw new Error('Invalid BTC/USD rate from API');
    }

    const fetchedAt = new Date().toISOString();
    const entry = { rate, fetchedAt };
    await cache.set(BTC_RATE_CACHE_KEY, entry, BTC_RATE_TTL);
    await cache.set(`${BTC_RATE_CACHE_KEY}:stale`, entry);
    return entry;
  } catch (err) {
    logger.error('BTC/USD rate fetch failed, using stale fallback', { err });
    const stale = await cache.get<{ rate: number; fetchedAt: string }>(
      `${BTC_RATE_CACHE_KEY}:stale`
    );
    return stale ?? { rate: DEFAULT_FALLBACK_RATE, fetchedAt: new Date(0).toISOString() };
  }
}
