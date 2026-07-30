/** Shared Digital Asset Engine quote simulator — provider-swappable surface. */

export type EngineOp = 'buy' | 'sell' | 'swap' | 'bridge' | 'stake';

export type FeeLine = {
  label: string;
  amount: number;
  asset: string;
  fiatUsd: number;
};

export type AssetQuote = {
  id: string;
  op: EngineOp;
  provider: string;
  fromAsset: string;
  toAsset: string;
  fromAmount: number;
  toAmount: number;
  minReceived: number;
  rate: number;
  fees: FeeLine[];
  expiresAt: number;
  estimatedSeconds: number;
  sourceNetwork: string;
  destNetwork?: string;
  slippageBps?: number;
  apyPct?: number;
  validatorName?: string;
  lockDays?: number;
  routeSummary?: string;
};

export const ENGINE_STATUS_STAGES = [
  'Preparing',
  'Waiting for confirmation',
  'Processing',
  'Completed',
] as const;

const PRICES: Record<string, number> = {
  BTC: 68420,
  ETH: 3420,
  SOL: 148,
  USDC: 1,
  POL: 0.52,
  AVAX: 28,
};

export function assetPriceUsd(symbol: string): number {
  return PRICES[symbol] ?? 100;
}

export function quoteExpired(q: AssetQuote, now = Date.now()): boolean {
  return now >= q.expiresAt;
}

export function secondsRemaining(q: AssetQuote, now = Date.now()): number {
  return Math.max(0, Math.ceil((q.expiresAt - now) / 1000));
}

export function totalFeesUsd(q: AssetQuote): number {
  return q.fees.reduce((s, f) => s + f.fiatUsd, 0);
}

export function arrivalLabel(seconds: number): string {
  if (seconds < 60) return 'Usually under a minute';
  if (seconds < 3600) return `About ${Math.ceil(seconds / 60)} minutes`;
  return `About ${Math.ceil(seconds / 3600)} hours`;
}

function id(): string {
  return `q-${crypto.randomUUID().slice(0, 8)}`;
}

export function quoteBuy(input: {
  asset: string;
  fiatUsd: number;
  method: 'card' | 'bank' | 'provider';
  providerCode?: string;
}): AssetQuote {
  const fiat = Math.max(0, input.fiatUsd);
  const providerFeePct = input.method === 'bank' ? 0.005 : 0.015;
  const providerFee = fiat * providerFeePct;
  const networkFee = 1.2;
  const net = Math.max(0, fiat - providerFee - networkFee);
  const price = assetPriceUsd(input.asset);
  const crypto = price <= 0 ? 0 : net / price;
  return {
    id: id(),
    op: 'buy',
    provider: input.providerCode ?? 'auvora-sim',
    fromAsset: 'USD',
    toAsset: input.asset,
    fromAmount: fiat,
    toAmount: crypto,
    minReceived: crypto * 0.995,
    rate: price,
    fees: [
      { label: 'Service fee', amount: providerFee, asset: 'USD', fiatUsd: providerFee },
      { label: 'Network fee (estimated)', amount: networkFee, asset: 'USD', fiatUsd: networkFee },
    ],
    expiresAt: Date.now() + 45_000,
    estimatedSeconds: input.method === 'bank' ? 7200 : 180,
    sourceNetwork: 'ETHEREUM',
    routeSummary: `${input.method} → ${input.asset}`,
  };
}

export function quoteSell(input: {
  asset: string;
  cryptoAmount: number;
  destination: 'bank' | 'card' | 'balance';
}): AssetQuote {
  const amount = Math.max(0, input.cryptoAmount);
  const gross = amount * assetPriceUsd(input.asset);
  const providerFee = gross * 0.012;
  const networkFee = 1.4;
  const payout = Math.max(0, gross - providerFee - networkFee);
  return {
    id: id(),
    op: 'sell',
    provider: 'auvora-sim',
    fromAsset: input.asset,
    toAsset: 'USD',
    fromAmount: amount,
    toAmount: payout,
    minReceived: payout * 0.99,
    rate: assetPriceUsd(input.asset),
    fees: [
      { label: 'Service fee', amount: providerFee, asset: 'USD', fiatUsd: providerFee },
      { label: 'Network fee (estimated)', amount: networkFee, asset: 'USD', fiatUsd: networkFee },
    ],
    expiresAt: Date.now() + 45_000,
    estimatedSeconds: input.destination === 'bank' ? 259200 : 7200,
    sourceNetwork: 'ETHEREUM',
    routeSummary: `${input.asset} → ${input.destination}`,
  };
}

export function quoteSwap(input: {
  fromAsset: string;
  toAsset: string;
  fromAmount: number;
  slippageBps?: number;
}): AssetQuote {
  const slip = input.slippageBps ?? 50;
  const fromAmount = Math.max(0, input.fromAmount);
  const grossUsd = fromAmount * assetPriceUsd(input.fromAsset);
  const networkFee = 1.8;
  const impact = grossUsd * 0.0012;
  const outUsd = Math.max(0, grossUsd - networkFee - impact);
  const toPrice = assetPriceUsd(input.toAsset);
  const out = toPrice <= 0 ? 0 : outUsd / toPrice;
  return {
    id: id(),
    op: 'swap',
    provider: 'auvora-sim',
    fromAsset: input.fromAsset,
    toAsset: input.toAsset,
    fromAmount,
    toAmount: out,
    minReceived: out * (1 - slip / 10_000),
    rate: assetPriceUsd(input.fromAsset) / Math.max(toPrice, 1e-9),
    fees: [
      { label: 'Network fee (estimated)', amount: 0.0014, asset: 'ETH', fiatUsd: networkFee },
      { label: 'Price impact (estimated)', amount: impact, asset: 'USD', fiatUsd: impact },
    ],
    expiresAt: Date.now() + 20_000,
    estimatedSeconds: 45,
    sourceNetwork: 'ETHEREUM',
    slippageBps: slip,
    routeSummary: `${input.fromAsset} → ${input.toAsset}`,
  };
}

export function humanizeQuoteError(raw: string | null | undefined): string {
  if (!raw) return 'Something went wrong. Nothing was submitted — you can safely try again.';
  const t = raw.toLowerCase();
  if (t.includes('expired')) return 'This quote expired. Refresh for an updated price.';
  if (t.includes('liquidity')) {
    return 'There isn’t enough liquidity right now. Try a smaller amount or another pair.';
  }
  if (t.includes('provider') || t.includes('unavailable')) {
    return 'The payment partner is temporarily unavailable. Try again in a moment.';
  }
  if (t.includes('congest')) {
    return 'The network is busy. Fees or arrival times may be higher than usual.';
  }
  if (t.includes('bridge') && t.includes('timeout')) {
    return 'The bridge transfer is delayed. Keep this receipt — funds can usually be claimed or refunded.';
  }
  return raw.length > 160
    ? 'Something went wrong. Nothing was submitted — you can safely try again.'
    : raw;
}

export function providerLabel(provider: string): string {
  if (provider === 'auvora-sim' || provider.endsWith('-sim') || provider === 'simulator') {
    return 'Auvora preview';
  }
  return provider;
}
