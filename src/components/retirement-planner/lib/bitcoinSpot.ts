/** Fetch live spot prices for Bitcoin and precious metals (USD). */

import {
  bitcoinModelPriceUsd,
  type BitcoinPricingModelId,
} from './bitcoinPricingModels';

export async function fetchBitcoinSpotUsd(): Promise<number> {
  const res = await fetch('https://api.coinbase.com/v2/prices/BTC-USD/spot', { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Bitcoin price fetch failed (${res.status})`);
  const json = (await res.json()) as { data?: { amount?: string } };
  const n = Number(json?.data?.amount);
  if (!Number.isFinite(n) || n <= 0) throw new Error('Invalid Bitcoin price response');
  return n;
}

/** Model-implied BTC/USD today (no network — uses pricing-model formulas). */
export function fetchBitcoinModelSpotUsd(
  model: BitcoinPricingModelId = 'amalgam',
  mix?: Parameters<typeof bitcoinModelPriceUsd>[2]
): number {
  const price = bitcoinModelPriceUsd(model, new Date(), mix);
  if (price == null || price <= 0) {
    throw new Error(`Could not compute ${model} model price for today`);
  }
  return price;
}

/** Gold (XAU) spot USD per troy ounce via gold-api.com */
export async function fetchGoldSpotUsd(): Promise<number> {
  return fetchMetalSpotUsd('XAU', 'Gold');
}

/** Silver (XAG) spot USD per troy ounce via gold-api.com */
export async function fetchSilverSpotUsd(): Promise<number> {
  return fetchMetalSpotUsd('XAG', 'Silver');
}

async function fetchMetalSpotUsd(symbol: 'XAU' | 'XAG', label: string): Promise<number> {
  const res = await fetch(`https://api.gold-api.com/price/${symbol}`, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`${label} price fetch failed (${res.status})`);
  const json = (await res.json()) as { price?: number };
  const n = Number(json?.price);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid ${label} price response`);
  return n;
}
