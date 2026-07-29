/** Estimated APY from annual reward rate (bps). */
export function estimatedApyFromBps(rewardRateBps: number): number {
  return Math.max(0, rewardRateBps) / 100;
}

/** Projected earnings over days for a principal at APY percent. */
export function projectedEarnings(principal: number, apyPercent: number, days: number): number {
  if (principal <= 0 || apyPercent <= 0 || days <= 0) return 0;
  return principal * (apyPercent / 100) * (days / 365);
}

/** Rank score: higher APY and uptime, lower commission. */
export function validatorRankScore(input: {
  apyPercent: number;
  uptimePercent: number;
  commissionPercent: number;
}): number {
  return input.apyPercent * 2 + input.uptimePercent - input.commissionPercent * 1.5;
}

export function parseAmount(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error('Invalid amount');
  return n;
}

export function formatAmount(value: number, decimals = 8): string {
  return value.toFixed(decimals).replace(/\.?0+$/, '') || '0';
}
