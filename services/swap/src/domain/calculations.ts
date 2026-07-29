import { SwapValidationError } from './errors';

export function parseAmount(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new SwapValidationError('sellAmount must be a positive number', { sellAmount: value });
  }
  return n;
}

export function applySlippage(amountOut: string, slippageBps: number): string {
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > 10_000) {
    throw new SwapValidationError('slippageBps must be an integer between 0 and 10000');
  }
  const out = parseAmount(amountOut);
  const min = out * (1 - slippageBps / 10_000);
  return min.toFixed(8).replace(/\.?0+$/, '') || '0';
}

export function priceImpactBps(midMarketOut: number, quotedOut: number): number {
  if (midMarketOut <= 0) return 0;
  const impact = ((midMarketOut - quotedOut) / midMarketOut) * 10_000;
  return Math.max(0, Math.round(impact));
}

export function compareQuotesByOutput<T extends { amountOut: string; priceImpactBps: number }>(
  a: T,
  b: T,
): number {
  const diff = Number(b.amountOut) - Number(a.amountOut);
  if (Math.abs(diff) > 1e-12) return diff > 0 ? 1 : -1;
  return a.priceImpactBps - b.priceImpactBps;
}
