/**
 * useBtcPrice — fetches the current BTC/USD exchange rate from CoinGecko.
 * Caches the result for 5 minutes to avoid hammering the public API.
 */

import { useState, useEffect } from 'react';

interface BtcPriceState {
  priceUsd: number | null;
  isLoading: boolean;
  error: string | null;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedPrice: number | null = null;
let cacheTimestamp = 0;

export function useBtcPrice(): BtcPriceState {
  const [state, setState] = useState<BtcPriceState>({
    priceUsd: cachedPrice,
    isLoading: cachedPrice === null,
    error: null,
  });

  useEffect(() => {
    const now = Date.now();
    if (cachedPrice !== null && now - cacheTimestamp < CACHE_TTL_MS) {
      setState({ priceUsd: cachedPrice, isLoading: false, error: null });
      return;
    }

    let cancelled = false;

    fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd')
      .then((res) => {
        if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
        return res.json() as Promise<{ bitcoin: { usd: number } }>;
      })
      .then((data) => {
        if (cancelled) return;
        const price = data.bitcoin.usd;
        cachedPrice = price;
        cacheTimestamp = Date.now();
        setState({ priceUsd: price, isLoading: false, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to fetch BTC price';
        console.warn('[useBtcPrice]', message);
        setState((prev) => ({ ...prev, isLoading: false, error: message }));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
