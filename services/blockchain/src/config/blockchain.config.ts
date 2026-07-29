import { ChainNetwork } from '@auvora/database';
import {
  ALCHEMY_SUPPORTED_CHAINS,
  type AlchemySupportedChain,
  isAlchemyConfigured,
  redactRpcUrl,
  resolveAlchemyRpcUrls,
} from '../infrastructure/providers/alchemy/alchemy-rpc.config';
import type { ServiceEnv } from './env.schema';

/**
 * Centralized blockchain network configuration for Auvora Wallet.
 * Alchemy is the primary infrastructure provider for the five enabled mainnets.
 */

export const ENABLED_MAINNETS = [
  ChainNetwork.ETHEREUM,
  ChainNetwork.BNB_SMART_CHAIN,
  ChainNetwork.SOLANA,
  ChainNetwork.TRON,
  ChainNetwork.BITCOIN,
] as const;

export type EnabledMainnet = (typeof ENABLED_MAINNETS)[number];

export type NetworkRuntimeConfig = {
  chain: EnabledMainnet;
  displayName: string;
  nativeSymbol: string;
  alchemyHost: string;
  explorerUrl: string;
  requiredConfirmations: number;
  blockTimeSeconds: number;
  /** Libraries used by adapters for this chain family. */
  clientStack: 'evm-json-rpc' | 'solana-json-rpc' | 'tron-json-rpc' | 'bitcoin-json-rpc';
};

export const NETWORK_RUNTIME_CONFIG: Record<EnabledMainnet, NetworkRuntimeConfig> = {
  [ChainNetwork.ETHEREUM]: {
    chain: ChainNetwork.ETHEREUM,
    displayName: 'Ethereum Mainnet',
    nativeSymbol: 'ETH',
    alchemyHost: 'eth-mainnet.g.alchemy.com',
    explorerUrl: 'https://etherscan.io',
    requiredConfirmations: 12,
    blockTimeSeconds: 12,
    clientStack: 'evm-json-rpc',
  },
  [ChainNetwork.BNB_SMART_CHAIN]: {
    chain: ChainNetwork.BNB_SMART_CHAIN,
    displayName: 'BNB Smart Chain Mainnet',
    nativeSymbol: 'BNB',
    alchemyHost: 'bnb-mainnet.g.alchemy.com',
    explorerUrl: 'https://bscscan.com',
    requiredConfirmations: 15,
    blockTimeSeconds: 3,
    clientStack: 'evm-json-rpc',
  },
  [ChainNetwork.SOLANA]: {
    chain: ChainNetwork.SOLANA,
    displayName: 'Solana Mainnet',
    nativeSymbol: 'SOL',
    alchemyHost: 'solana-mainnet.g.alchemy.com',
    explorerUrl: 'https://explorer.solana.com',
    requiredConfirmations: 32,
    blockTimeSeconds: 0.4,
    clientStack: 'solana-json-rpc',
  },
  [ChainNetwork.TRON]: {
    chain: ChainNetwork.TRON,
    displayName: 'Tron Mainnet',
    nativeSymbol: 'TRX',
    alchemyHost: 'tron-mainnet.g.alchemy.com',
    explorerUrl: 'https://tronscan.org',
    requiredConfirmations: 20,
    blockTimeSeconds: 3,
    clientStack: 'tron-json-rpc',
  },
  [ChainNetwork.BITCOIN]: {
    chain: ChainNetwork.BITCOIN,
    displayName: 'Bitcoin Mainnet',
    nativeSymbol: 'BTC',
    alchemyHost: 'bitcoin-mainnet.g.alchemy.com',
    explorerUrl: 'https://mempool.space',
    requiredConfirmations: 3,
    blockTimeSeconds: 600,
    clientStack: 'bitcoin-json-rpc',
  },
};

export type BlockchainProviderMode = 'alchemy' | 'simulator';

export type ResolvedBlockchainConfig = {
  primaryProvider: BlockchainProviderMode;
  alchemyConfigured: boolean;
  alchemyChains: AlchemySupportedChain[];
  enabledMainnets: EnabledMainnet[];
  rpcEndpoints: Array<{ chain: ChainNetwork; endpoint: string }>;
  simulatorEnabled: boolean;
};

/**
 * Resolve runtime blockchain provider policy.
 * When Alchemy credentials exist, Alchemy is the default primary provider
 * for all Alchemy-supported enabled mainnets.
 */
export function resolveBlockchainConfig(env: ServiceEnv): ResolvedBlockchainConfig {
  const urls = resolveAlchemyRpcUrls(env);
  const alchemyConfigured = isAlchemyConfigured(env);
  const preferred = env.BLOCKCHAIN_PRIMARY_PROVIDER;
  const primaryProvider: BlockchainProviderMode =
    preferred === 'simulator'
      ? 'simulator'
      : alchemyConfigured
        ? 'alchemy'
        : preferred === 'alchemy'
          ? 'alchemy'
          : 'simulator';

  return {
    primaryProvider,
    alchemyConfigured,
    alchemyChains: ALCHEMY_SUPPORTED_CHAINS.filter((c) => urls.has(c)),
    enabledMainnets: [...ENABLED_MAINNETS],
    rpcEndpoints: [...urls.entries()].map(([chain, url]) => ({
      chain,
      endpoint: redactRpcUrl(url),
    })),
    simulatorEnabled: env.BLOCKCHAIN_SIMULATOR_ENABLED,
  };
}

export function assertAlchemyReadyForPrimary(env: ServiceEnv): void {
  const config = resolveBlockchainConfig(env);
  const required =
    env.ALCHEMY_REQUIRED === true ||
    (env.ALCHEMY_REQUIRED === undefined &&
      env.NODE_ENV === 'production' &&
      env.BLOCKCHAIN_PRIMARY_PROVIDER === 'alchemy');

  if (required && !config.alchemyConfigured) {
    throw new Error('Alchemy is required but ALCHEMY_API_KEY / ALCHEMY_*_RPC_URL are missing');
  }
  if (
    env.NODE_ENV === 'production' &&
    config.primaryProvider === 'alchemy' &&
    config.alchemyConfigured &&
    config.alchemyChains.length < ENABLED_MAINNETS.length
  ) {
    console.warn(
      `[blockchain] Alchemy primary mode active for ${config.alchemyChains.length}/${ENABLED_MAINNETS.length} enabled mainnets`,
    );
  }
}
