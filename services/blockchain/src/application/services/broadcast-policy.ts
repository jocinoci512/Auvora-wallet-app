import { Logger } from '@nestjs/common';
import type { ChainNetwork } from '@auvora/database';
import type { ServiceEnv } from '../../config/env.schema';
import { ValidationError } from '../../domain';
import {
  isAllowedTestnetRpcUrl,
  isAllowlistedTestnetChain,
  isMainnetRpcUrl,
  MAINNET_EVM_CHAIN_IDS,
} from '../../domain/testnet-networks';

const logger = new Logger('MainnetBroadcastKillSwitch');

export type BroadcastAssertContext = {
  chain: ChainNetwork;
  /** Optional resolved RPC URL — used to fail closed on mainnet hosts. */
  rpcUrl?: string;
  /** Optional EVM chain id from eth_chainId — reject 1/56/137. */
  evmChainId?: number;
  /** Optional correlation ID for tracing security events across services. */
  correlationId?: string;
};

/**
 * Mainnet live broadcast remains OFF unless BLOCKCHAIN_LIVE_BROADCAST=true
 * (forbidden in production by env schema).
 *
 * Testnet relay is a separate gate: BLOCKCHAIN_NETWORK_ENV=testnet +
 * BLOCKCHAIN_TESTNET_BROADCAST=true + allowlisted test chain + non-mainnet RPC.
 */
export function assertLiveBroadcastAllowed(env: ServiceEnv): void {
  if (env.BLOCKCHAIN_LIVE_BROADCAST !== true) {
    throw new ValidationError(
      'Live blockchain broadcast is disabled (BLOCKCHAIN_LIVE_BROADCAST=false). ' +
        'Pre-signed broadcast remains unavailable until this flag is intentionally enabled.',
    );
  }
}

/**
 * Unified broadcast gate for withdrawal / rebroadcast paths.
 * Prefer this over assertLiveBroadcastAllowed for new call sites.
 */
export function assertBroadcastAllowed(env: ServiceEnv, ctx: BroadcastAssertContext): void {
  // Absolute mainnet protections — always fail closed.
  if (ctx.evmChainId != null && MAINNET_EVM_CHAIN_IDS.has(ctx.evmChainId)) {
    const reason = `Mainnet EVM chainId ${ctx.evmChainId} broadcast is blocked (hard mainnet protection).`;
    logger.warn({
      event: 'SECURITY_EVENT_MAINNET_BROADCAST_BLOCKED',
      chain: ctx.chain,
      network: env.BLOCKCHAIN_NETWORK_ENV,
      environment: env.NODE_ENV,
      reason,
      correlationId: ctx.correlationId,
      evmChainId: ctx.evmChainId,
    });
    throw new ValidationError(reason);
  }
  if (ctx.rpcUrl && isMainnetRpcUrl(ctx.rpcUrl)) {
    const reason = 'Mainnet RPC host broadcast is blocked (hard mainnet protection).';
    logger.warn({
      event: 'SECURITY_EVENT_MAINNET_BROADCAST_BLOCKED',
      chain: ctx.chain,
      network: env.BLOCKCHAIN_NETWORK_ENV,
      environment: env.NODE_ENV,
      reason,
      correlationId: ctx.correlationId,
      rpcUrl: ctx.rpcUrl,
    });
    throw new ValidationError(reason);
  }

  if (env.BLOCKCHAIN_LIVE_BROADCAST === true) {
    // Legacy mainnet path — still reject if URL looks like an unexpected mainnet marker above.
    return;
  }

  const testnetOk =
    env.BLOCKCHAIN_NETWORK_ENV === 'testnet' &&
    env.BLOCKCHAIN_TESTNET_BROADCAST === true &&
    isAllowlistedTestnetChain(ctx.chain) &&
    (ctx.rpcUrl ? isAllowedTestnetRpcUrl(ctx.chain, ctx.rpcUrl) : true);

  if (testnetOk) {
    return;
  }

  const reason =
    'Broadcast denied. Mainnet live broadcast is OFF (BLOCKCHAIN_LIVE_BROADCAST=false). ' +
    'Testnet relay requires BLOCKCHAIN_NETWORK_ENV=testnet, BLOCKCHAIN_TESTNET_BROADCAST=true, ' +
    'and an allowlisted test network RPC.';
  logger.warn({
    event: 'SECURITY_EVENT_MAINNET_BROADCAST_BLOCKED',
    chain: ctx.chain,
    network: env.BLOCKCHAIN_NETWORK_ENV,
    environment: env.NODE_ENV,
    reason,
    correlationId: ctx.correlationId,
  });
  throw new ValidationError(reason);
}
