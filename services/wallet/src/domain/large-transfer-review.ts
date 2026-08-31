/** Self-custody transfer policy: KYC gate + Admin large-transfer review. Admin never receives keys. */

export const DEFAULT_LARGE_TRANSFER_USD_CENTS = 1_000_000n; // $10,000.00 Admin review
export const DEFAULT_KYC_REQUIRED_USD_CENTS = 500_000n; // $5,000.00 KYC gate
/** Default Sepolia/QA threshold so small testnet sends exercise Admin review. */
export const DEFAULT_TESTNET_LARGE_TRANSFER_USD_CENTS = 100n; // $1.00
export const MAX_PRICE_AGE_MS = 5 * 60 * 1000;
export const USER_TRANSFER_SOURCE_TYPE = 'USER_TRANSFER';
export const SIMULATION_TRANSFER_SOURCE_TYPE = 'SIMULATION_TRANSACTION';

function parseEnvCents(raw: string | undefined): bigint | null {
  if (!raw?.trim()) return null;
  try {
    const value = BigInt(raw.trim());
    return value >= 0n ? value : null;
  } catch {
    return null;
  }
}

/**
 * Admin review threshold. Mainnet stays at $10k (or LARGE_TRANSFER_USD_CENTS).
 * Testnet clients send `networkEnv: 'testnet'` so QA can create persisted reviews
 * with small amounts without lowering production mainnet policy.
 */
export function resolveLargeTransferThresholdCents(networkEnv?: string): bigint {
  if (networkEnv === 'testnet') {
    return (
      parseEnvCents(process.env.TESTNET_LARGE_TRANSFER_USD_CENTS) ??
      DEFAULT_TESTNET_LARGE_TRANSFER_USD_CENTS
    );
  }
  return parseEnvCents(process.env.LARGE_TRANSFER_USD_CENTS) ?? DEFAULT_LARGE_TRANSFER_USD_CENTS;
}

/** Product KYC gate ($5k). Optional TESTNET_KYC_REQUIRED_USD_CENTS for QA. */
export function resolveKycRequiredThresholdCents(networkEnv?: string): bigint {
  if (networkEnv === 'testnet') {
    return (
      parseEnvCents(process.env.TESTNET_KYC_REQUIRED_USD_CENTS) ??
      parseEnvCents(process.env.KYC_REQUIRED_USD_CENTS) ??
      DEFAULT_KYC_REQUIRED_USD_CENTS
    );
  }
  return parseEnvCents(process.env.KYC_REQUIRED_USD_CENTS) ?? DEFAULT_KYC_REQUIRED_USD_CENTS;
}

export type LargeTransferStatus =
  'below_threshold' | 'kyc_required' | 'review_required' | 'price_unavailable' | 'stale_price';

export interface LargeTransferDecision {
  status: LargeTransferStatus;
  notionalUsdCents?: bigint;
  message?: string;
  requiresKyc?: boolean;
  requiresAdminReview?: boolean;
}

/**
 * Evaluates notional against KYC ($5k) and Admin review ($10k) thresholds.
 * Price failures fail closed (cannot skip policy).
 */
/** Local QA only. Never accepted on mainnet or when the env flag is unset. */
export function resolveQaNotionalUsdCents(input: {
  networkEnv?: string;
  raw?: string;
}): bigint | null {
  if (process.env.AUVORA_QA_TRANSFER_VALUATION !== 'true') return null;
  if (input.networkEnv !== 'testnet') return null;
  if (!input.raw?.trim()) return null;
  try {
    const value = BigInt(input.raw.trim());
    return value >= 0n ? value : null;
  } catch {
    return null;
  }
}

export function evaluateLargeTransferUsdCents(input: {
  amountSmallest: bigint;
  decimals: number;
  usdCentsPerWholeToken: bigint | null;
  priceAt: Date | null;
  now?: Date;
  /** Admin review threshold (default $10k / testnet QA). */
  thresholdCents?: bigint;
  /** KYC gate threshold (default $5k). */
  kycThresholdCents?: bigint;
  /** Local QA notional override. Skips market-price math only. */
  notionalUsdCentsOverride?: bigint;
}): LargeTransferDecision {
  const reviewThreshold = input.thresholdCents ?? DEFAULT_LARGE_TRANSFER_USD_CENTS;
  const kycThreshold = input.kycThresholdCents ?? DEFAULT_KYC_REQUIRED_USD_CENTS;

  let notional: bigint;
  if (input.notionalUsdCentsOverride != null && input.notionalUsdCentsOverride >= 0n) {
    notional = input.notionalUsdCentsOverride;
  } else {
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
    notional = (input.amountSmallest * input.usdCentsPerWholeToken) / scale;
  }

  if (reviewThreshold > 0n && notional >= reviewThreshold) {
    return {
      status: 'review_required',
      notionalUsdCents: notional,
      requiresKyc: kycThreshold > 0n && notional >= kycThreshold,
      requiresAdminReview: true,
      message:
        'This transfer is at or above the Auvora review threshold. An administrator must approve before the user device may broadcast. Keys stay on the device. This is not a blockchain freeze.',
    };
  }

  if (kycThreshold > 0n && notional >= kycThreshold) {
    return {
      status: 'kyc_required',
      notionalUsdCents: notional,
      requiresKyc: true,
      requiresAdminReview: false,
      message:
        'Identity verification is required for transfers at or above the Auvora verification threshold. Complete verification to continue. Keys stay on the device.',
    };
  }

  return { status: 'below_threshold', notionalUsdCents: notional };
}

export function blocksUnauditedBroadcast(status: LargeTransferStatus): boolean {
  return status !== 'below_threshold';
}

export function isKycApprovedStatus(status: string | null | undefined): boolean {
  return status === 'APPROVED';
}
