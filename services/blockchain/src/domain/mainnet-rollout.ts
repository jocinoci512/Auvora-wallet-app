import { ChainNetwork } from '@auvora/database';
import {
  isValidBitcoinAddress,
  isValidEvmAddress,
  isValidSolanaAddress,
  isValidTronAddress,
} from './address-rules';

/**
 * Controlled Mainnet Rollout States.
 * Each chain transitions independently through explicit lifecycle stages:
 * - OFF: Chain broadcast is strictly blocked (default).
 * - READY: Adapter, RPC, fee calculation, and preflight verified; broadcast disabled.
 * - CANARY: Restricted to designated internal test cohorts with strict value caps; user signs locally.
 * - ACTIVE: Production broadcast available for locally signed transactions meeting all policy gates.
 * - PAUSED: Emergency circuit-breaker engaged for this specific chain.
 */
export type ChainRolloutState = 'OFF' | 'READY' | 'CANARY' | 'ACTIVE' | 'PAUSED';

export type SigningLocation = 'client_local_hardware' | 'server';

/**
 * Canonical broadcast lifecycle state machine.
 * Transaction status must never transition directly from SUBMITTED to COMPLETED
 * without cryptographic on-chain receipt / block confirmation.
 */
export type BroadcastLifecycleState =
  | 'PREPARED'
  | 'AWAITING_USER_SIGNATURE'
  | 'SIGNED'
  | 'BROADCAST_PENDING'
  | 'BROADCAST_SUBMITTED'
  | 'CONFIRMING'
  | 'COMPLETED'
  | 'FAILED'
  | 'DROPPED'
  | 'REPLACED';

export interface ChainConfirmationPolicy {
  chain: ChainNetwork;
  name: string;
  nativeSymbol: string;
  caip2: string;
  expectedChainId: number | string;
  standardConfirmations: number;
  finalityMechanism: string;
  reorgSafetyMargin: number;
  nativeFeeAsset: string;
  dryRunSimulationSupported: boolean;
}

export const MAINNET_CHAIN_CONFIRMATION_POLICIES: Record<
  Exclude<ChainNetwork, 'LITECOIN'>,
  ChainConfirmationPolicy
> = {
  [ChainNetwork.ETHEREUM]: {
    chain: ChainNetwork.ETHEREUM,
    name: 'Ethereum Mainnet',
    nativeSymbol: 'ETH',
    caip2: 'eip155:1',
    expectedChainId: 1,
    standardConfirmations: 12,
    finalityMechanism: 'Proof-of-Stake Checkpoint Finality (Gasper / 2 epochs)',
    reorgSafetyMargin: 64,
    nativeFeeAsset: 'ETH',
    dryRunSimulationSupported: true,
  },
  [ChainNetwork.BNB_SMART_CHAIN]: {
    chain: ChainNetwork.BNB_SMART_CHAIN,
    name: 'BNB Smart Chain',
    nativeSymbol: 'BNB',
    caip2: 'eip155:56',
    expectedChainId: 56,
    standardConfirmations: 15,
    finalityMechanism: 'Fast Finality BFT (Proof-of-Staked-Authority)',
    reorgSafetyMargin: 20,
    nativeFeeAsset: 'BNB',
    dryRunSimulationSupported: true,
  },
  [ChainNetwork.POLYGON]: {
    chain: ChainNetwork.POLYGON,
    name: 'Polygon PoS',
    nativeSymbol: 'POL',
    caip2: 'eip155:137',
    expectedChainId: 137,
    standardConfirmations: 32,
    finalityMechanism: 'Milestone Checkpoint Finality (Heimdall layer)',
    reorgSafetyMargin: 64,
    nativeFeeAsset: 'POL',
    dryRunSimulationSupported: true,
  },
  [ChainNetwork.SOLANA]: {
    chain: ChainNetwork.SOLANA,
    name: 'Solana Mainnet-Beta',
    nativeSymbol: 'SOL',
    caip2: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    expectedChainId: 'mainnet-beta',
    standardConfirmations: 32,
    finalityMechanism: 'Tower BFT Finalized Commitment (32+ confirmations / root slot)',
    reorgSafetyMargin: 32,
    nativeFeeAsset: 'SOL',
    dryRunSimulationSupported: true,
  },
  [ChainNetwork.BITCOIN]: {
    chain: ChainNetwork.BITCOIN,
    name: 'Bitcoin Mainnet',
    nativeSymbol: 'BTC',
    caip2: 'bip122:000000000019d6689c085ae165831e93',
    expectedChainId: 'mainnet',
    standardConfirmations: 3,
    finalityMechanism: 'Nakamoto Proof-of-Work Cumulative Difficulty',
    reorgSafetyMargin: 6,
    nativeFeeAsset: 'BTC',
    dryRunSimulationSupported: true,
  },
  [ChainNetwork.TRON]: {
    chain: ChainNetwork.TRON,
    name: 'Tron Mainnet',
    nativeSymbol: 'TRX',
    caip2: 'tron:0x2b6653dc',
    expectedChainId: '0x2b6653dc',
    standardConfirmations: 19,
    finalityMechanism: 'Super Representative Solidified Block Confirmation',
    reorgSafetyMargin: 19,
    nativeFeeAsset: 'TRX',
    dryRunSimulationSupported: true,
  },
};

export interface MainnetDefenseInDepthContext {
  environment: string;
  globalMainnetEnabled: boolean;
  chainRolloutState: ChainRolloutState;
  emergencyPauseActive: boolean;
  chain: ChainNetwork;
  expectedChainId: number | string;
  actualChainId: number | string;
  rpcUrl: string;
  isApprovedRpcEndpoint: boolean;
  signingLocation: SigningLocation;
  isLocallySigned: boolean;
  rawSignedTx: string;
  txHash: string;
  recipientAddress: string;
  amount: number;
  nativeBalance: number;
  nativeFeeBalance: number;
  estimatedFee: number;
  maxFeeSafetyLimit: number;
  nonceOrUtxoFresh: boolean;
  expiresAtMs?: number;
  nowMs: number;
  kycApproved: boolean;
  adminReviewApproved?: boolean;
  isDuplicateTx: boolean;
  safetyPreflightPassed: boolean;
}

export interface MainnetGateEvaluationResult {
  allowed: boolean;
  rejectionCode?: string;
  rejectionReason?: string;
  safeMetadata: {
    chain: ChainNetwork;
    globalSwitch: boolean;
    chainState: ChainRolloutState;
    signingLocation: SigningLocation;
    txHash: string;
    evaluatedAt: string;
  };
}

/**
 * Validates whether an address matches the target chain syntax.
 */
export function validateChainAddress(chain: ChainNetwork, address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  switch (chain) {
    case ChainNetwork.ETHEREUM:
    case ChainNetwork.BNB_SMART_CHAIN:
    case ChainNetwork.POLYGON:
      return isValidEvmAddress(address);
    case ChainNetwork.SOLANA:
      return isValidSolanaAddress(address);
    case ChainNetwork.BITCOIN:
      return isValidBitcoinAddress(address);
    case ChainNetwork.TRON:
      return isValidTronAddress(address);
    default:
      return false;
  }
}

/**
 * Evaluates the comprehensive Defense-in-Depth gate before any broadcast attempt.
 * ALL conditions must evaluate to true. Fails closed on any single violation.
 */
export function evaluateMainnetBroadcastGate(
  ctx: MainnetDefenseInDepthContext,
): MainnetGateEvaluationResult {
  const safeMeta = {
    chain: ctx.chain,
    globalSwitch: ctx.globalMainnetEnabled,
    chainState: ctx.chainRolloutState,
    signingLocation: ctx.signingLocation,
    txHash: ctx.txHash,
    evaluatedAt: new Date(ctx.nowMs).toISOString(),
  };

  // 1. Global emergency kill switch
  if (!ctx.globalMainnetEnabled) {
    return {
      allowed: false,
      rejectionCode: 'GLOBAL_MAINNET_KILL_SWITCH_ACTIVE',
      rejectionReason:
        'Mainnet live broadcast is disabled globally (MAINNET_GLOBAL_ENABLED=false). ' +
        'Emergency kill switch overrides all chain configurations.',
      safeMetadata: safeMeta,
    };
  }

  // 2. Global emergency pause
  if (ctx.emergencyPauseActive) {
    return {
      allowed: false,
      rejectionCode: 'GLOBAL_EMERGENCY_PAUSE_ACTIVE',
      rejectionReason:
        'Global emergency pause is active. All on-chain broadcasts are temporarily halted.',
      safeMetadata: safeMeta,
    };
  }

  // 3. Chain-specific rollout state (Must be CANARY or ACTIVE)
  if (ctx.chainRolloutState === 'OFF') {
    return {
      allowed: false,
      rejectionCode: 'CHAIN_MAINNET_OFF',
      rejectionReason: `Mainnet broadcast for chain ${ctx.chain} is currently OFF.`,
      safeMetadata: safeMeta,
    };
  }
  if (ctx.chainRolloutState === 'PAUSED') {
    return {
      allowed: false,
      rejectionCode: 'CHAIN_MAINNET_PAUSED',
      rejectionReason: `Mainnet broadcast for chain ${ctx.chain} is temporarily PAUSED for maintenance or safety review.`,
      safeMetadata: safeMeta,
    };
  }
  if (ctx.chainRolloutState === 'READY') {
    return {
      allowed: false,
      rejectionCode: 'CHAIN_MAINNET_READY_ONLY',
      rejectionReason: `Mainnet broadcast for chain ${ctx.chain} is in READY state (verification complete; broadcast remains disabled).`,
      safeMetadata: safeMeta,
    };
  }
  if (ctx.chainRolloutState !== 'CANARY' && ctx.chainRolloutState !== 'ACTIVE') {
    return {
      allowed: false,
      rejectionCode: 'CHAIN_MAINNET_INVALID_STATE',
      rejectionReason: `Chain ${ctx.chain} has unsupported rollout state: ${ctx.chainRolloutState}`,
      safeMetadata: safeMeta,
    };
  }

  // 4. Client-side hardware signing boundary (Crucial: server never touches keys)
  if (ctx.signingLocation !== 'client_local_hardware') {
    return {
      allowed: false,
      rejectionCode: 'SERVER_SIGNING_FORBIDDEN',
      rejectionReason:
        'Server-side signing is strictly forbidden. Cryptographic signatures must originate solely from user local hardware.',
      safeMetadata: safeMeta,
    };
  }

  // 5. Signature verification presence
  if (!ctx.isLocallySigned || !ctx.rawSignedTx || ctx.rawSignedTx.trim() === '') {
    return {
      allowed: false,
      rejectionCode: 'UNSIGNED_TRANSACTION_REJECTED',
      rejectionReason:
        'Unsigned transaction rejected. Broadcast requires a complete, locally signed cryptographic payload.',
      safeMetadata: safeMeta,
    };
  }

  // 6. Chain ID and network identity verification
  if (String(ctx.actualChainId) !== String(ctx.expectedChainId)) {
    return {
      allowed: false,
      rejectionCode: 'CHAIN_ID_MISMATCH',
      rejectionReason: `Network identity mismatch: RPC reports chain ${ctx.actualChainId}, expected ${ctx.expectedChainId}.`,
      safeMetadata: safeMeta,
    };
  }

  // 7. Approved RPC endpoint check
  if (!ctx.isApprovedRpcEndpoint) {
    return {
      allowed: false,
      rejectionCode: 'UNAPPROVED_RPC_ENDPOINT',
      rejectionReason: `RPC host ${ctx.rpcUrl} is not on the vetted, approved provider whitelist. Broadcast blocked.`,
      safeMetadata: safeMeta,
    };
  }

  // 8. Address syntax check
  if (!validateChainAddress(ctx.chain, ctx.recipientAddress)) {
    return {
      allowed: false,
      rejectionCode: 'INVALID_RECIPIENT_ADDRESS',
      rejectionReason: `Recipient address ${ctx.recipientAddress} is invalid for chain ${ctx.chain}.`,
      safeMetadata: safeMeta,
    };
  }

  // 9. Balance and fee sufficiency
  if (ctx.amount <= 0) {
    return {
      allowed: false,
      rejectionCode: 'INVALID_AMOUNT',
      rejectionReason: 'Transfer amount must be strictly greater than zero.',
      safeMetadata: safeMeta,
    };
  }
  if (ctx.amount > ctx.nativeBalance) {
    return {
      allowed: false,
      rejectionCode: 'INSUFFICIENT_ASSET_BALANCE',
      rejectionReason: `Insufficient balance: transfer of ${ctx.amount} exceeds available balance ${ctx.nativeBalance}.`,
      safeMetadata: safeMeta,
    };
  }
  if (ctx.estimatedFee > ctx.nativeFeeBalance) {
    return {
      allowed: false,
      rejectionCode: 'INSUFFICIENT_FEE_ASSET_BALANCE',
      rejectionReason: `Insufficient fee balance: estimated network fee ${ctx.estimatedFee} exceeds native fee asset balance ${ctx.nativeFeeBalance}.`,
      safeMetadata: safeMeta,
    };
  }

  // 10. Fee safety limits (protect against abnormal fee spikes)
  if (ctx.estimatedFee > ctx.maxFeeSafetyLimit) {
    return {
      allowed: false,
      rejectionCode: 'EXCESSIVE_FEE_ESTIMATE',
      rejectionReason: `Estimated network fee ${ctx.estimatedFee} exceeds configured safety threshold ${ctx.maxFeeSafetyLimit}.`,
      safeMetadata: safeMeta,
    };
  }

  // 11. Freshness (Nonce / UTXO race protection)
  if (!ctx.nonceOrUtxoFresh) {
    return {
      allowed: false,
      rejectionCode: 'STALE_NONCE_OR_UTXO',
      rejectionReason:
        'Stale nonce or spent UTXO detected. Transaction must be rebuilt and re-signed locally with fresh state.',
      safeMetadata: safeMeta,
    };
  }

  // 12. Blockhash / reference block expiration
  if (ctx.expiresAtMs && ctx.nowMs >= ctx.expiresAtMs) {
    return {
      allowed: false,
      rejectionCode: 'TRANSACTION_EXPIRED',
      rejectionReason:
        'Transaction block reference / blockhash has expired. Re-signing required on customer device.',
      safeMetadata: safeMeta,
    };
  }

  // 13. Duplicate broadcast protection (Idempotency)
  if (ctx.isDuplicateTx) {
    return {
      allowed: false,
      rejectionCode: 'DUPLICATE_BROADCAST_ATTEMPT',
      rejectionReason:
        'Duplicate broadcast attempt rejected. A transaction with identical fingerprint has already been submitted.',
      safeMetadata: safeMeta,
    };
  }

  // 14. Simulation / preflight safety checks
  if (!ctx.safetyPreflightPassed) {
    return {
      allowed: false,
      rejectionCode: 'PREFLIGHT_SIMULATION_FAILED',
      rejectionReason:
        'Preflight node simulation failed. Broadcast blocked to prevent on-chain execution error and fee burn.',
      safeMetadata: safeMeta,
    };
  }

  // 15. Compliance & KYC Policy Gates ($5k KYC, $10k Admin Review)
  if (ctx.amount >= 5000 && !ctx.kycApproved) {
    return {
      allowed: false,
      rejectionCode: 'KYC_APPROVAL_REQUIRED',
      rejectionReason:
        'Transaction requires verified Tier 1 KYC approval ($5,000 threshold). Broadcast blocked.',
      safeMetadata: safeMeta,
    };
  }
  if (ctx.amount >= 10000 && !ctx.adminReviewApproved) {
    return {
      allowed: false,
      rejectionCode: 'ADMIN_POLICY_REVIEW_REQUIRED',
      rejectionReason:
        'High-value transfer requires administrator policy review ($10,000 threshold) before customer device may broadcast.',
      safeMetadata: safeMeta,
    };
  }

  return {
    allowed: true,
    safeMetadata: safeMeta,
  };
}

/**
 * Immutable Activation / Rollout State Transition Audit Event.
 * Contains only safe operational metadata; never records cryptographic keys or seed phrases.
 */
export interface MainnetRolloutAuditEvent {
  eventId: string;
  timestamp: string;
  environment: string;
  target: ChainNetwork | 'GLOBAL';
  oldState: ChainRolloutState;
  newState: ChainRolloutState;
  authorizedBy: string;
  releaseCommit: string;
  justification: string;
}
