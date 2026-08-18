/** Self-custody large-transfer review. Admin never receives keys. */

export const DEFAULT_LARGE_TRANSFER_USD_CENTS = 1_000_000n; // $10,000.00
export const MAX_PRICE_AGE_MS = 5 * 60 * 1000;
export const USER_TRANSFER_SOURCE_TYPE = 'USER_TRANSFER';
export const SIMULATION_TRANSFER_SOURCE_TYPE = 'SIMULATION_TRANSACTION';

export type LargeTransferStatus =
  'below_threshold' | 'review_required' | 'price_unavailable' | 'stale_price';

export interface LargeTransferDecision {
  status: LargeTransferStatus;
  notionalUsdCents?: bigint;
  message?: string;
}

export function evaluateLargeTransferUsdCents(input: {
  amountSmallest: bigint;
  decimals: number;
  usdCentsPerWholeToken: bigint | null;
  priceAt: Date | null;
  now?: Date;
  thresholdCents?: bigint;
}): LargeTransferDecision {
  const threshold = input.thresholdCents ?? DEFAULT_LARGE_TRANSFER_USD_CENTS;
  if (threshold <= 0n) return { status: 'below_threshold' };
  if (input.decimals < 0 || input.decimals > 36) {
    return { status: 'price_unavailable', message: 'Invalid asset decimals.' };
  }
  if (input.usdCentsPerWholeToken == null || input.usdCentsPerWholeToken <= 0n) {
    return {
      status: 'price_unavailable',
      message: 'A reliable USD price is unavailable. Review cannot be skipped.',
    };
  }
  const now = input.now ?? new Date();
  if (!input.priceAt || Math.abs(now.getTime() - input.priceAt.getTime()) > MAX_PRICE_AGE_MS) {
    return {
      status: 'stale_price',
      message: 'USD price is stale. Review cannot be skipped.',
    };
  }
  if (input.amountSmallest <= 0n) return { status: 'below_threshold' };
  const scale = 10n ** BigInt(input.decimals);
  const notional = (input.amountSmallest * input.usdCentsPerWholeToken) / scale;
  if (notional >= threshold) {
    return {
      status: 'review_required',
      notionalUsdCents: notional,
      message:
        'This transfer is at or above the Auvora review threshold. An administrator must approve before the user device may broadcast. Keys stay on the device. This is not a blockchain freeze.',
    };
  }
  return { status: 'below_threshold', notionalUsdCents: notional };
}

export function blocksUnauditedBroadcast(status: LargeTransferStatus): boolean {
  return status !== 'below_threshold';
}
