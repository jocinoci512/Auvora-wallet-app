import { ChainNetwork } from '@auvora/database';

/**
 * Isolated QA / testnet catalog. Mainnet hosts and chain IDs are never allowlisted.
 * Keep BLOCKCHAIN_LIVE_BROADCAST=false; testnet relay uses BLOCKCHAIN_TESTNET_BROADCAST.
 */

export type NetworkEnvironment = 'mainnet' | 'testnet';

export type TestnetChainDescriptor = {
  chain: ChainNetwork;
  /** Human label — always includes TESTNET / DEVNET / etc. */
  displayName: string;
  nativeSymbol: string;
  /** EIP-155 / CAIP-2 where applicable */
  caip2?: string;
  /** Numeric EVM chain id when applicable */
  evmChainId?: number;
  alchemyHost: string;
  explorerUrl: string;
  /** Hostnames that may appear in RPC URLs for this test network */
  allowedRpcHostSuffixes: string[];
};

/** Explicitly forbidden mainnet Alchemy / public hosts (fail closed). */
export const MAINNET_RPC_HOST_MARKERS = [
  'eth-mainnet',
  'polygon-mainnet',
  'bnb-mainnet',
  'solana-mainnet',
  'tron-mainnet',
  'bitcoin-mainnet',
  'mainnet-beta.solana.com',
  'api.trongrid.io',
  'mempool.space',
  'blockstream.info',
  'ethereum.publicnode.com',
  'polygon-bor.publicnode.com',
  'bsc.publicnode.com',
  'cloudflare-eth.com',
] as const;

/** EVM mainnet chain IDs — broadcast must reject these when testnet mode is active. */
export const MAINNET_EVM_CHAIN_IDS = new Set([1, 56, 137]);

export const TESTNET_NETWORKS: Record<Exclude<ChainNetwork, 'LITECOIN'>, TestnetChainDescriptor> = {
  [ChainNetwork.ETHEREUM]: {
    chain: ChainNetwork.ETHEREUM,
    displayName: 'Ethereum Sepolia (TESTNET)',
    nativeSymbol: 'ETH',
    caip2: 'eip155:11155111',
    evmChainId: 11155111,
    alchemyHost: 'eth-sepolia.g.alchemy.com',
    explorerUrl: 'https://sepolia.etherscan.io',
    allowedRpcHostSuffixes: [
      'eth-sepolia.g.alchemy.com',
      'sepolia.infura.io',
      'rpc.sepolia.org',
      'ethereum-sepolia.publicnode.com',
    ],
  },
  [ChainNetwork.BNB_SMART_CHAIN]: {
    chain: ChainNetwork.BNB_SMART_CHAIN,
    displayName: 'BNB Smart Chain Testnet (TESTNET)',
    nativeSymbol: 'tBNB',
    caip2: 'eip155:97',
    evmChainId: 97,
    alchemyHost: 'bnb-testnet.g.alchemy.com',
    explorerUrl: 'https://testnet.bscscan.com',
    allowedRpcHostSuffixes: [
      'bnb-testnet.g.alchemy.com',
      'data-seed-prebsc',
      'bsc-testnet.publicnode.com',
    ],
  },
  [ChainNetwork.POLYGON]: {
    chain: ChainNetwork.POLYGON,
    displayName: 'Polygon Amoy (TESTNET)',
    nativeSymbol: 'POL',
    caip2: 'eip155:80002',
    evmChainId: 80002,
    alchemyHost: 'polygon-amoy.g.alchemy.com',
    explorerUrl: 'https://amoy.polygonscan.com',
    allowedRpcHostSuffixes: [
      'polygon-amoy.g.alchemy.com',
      'rpc-amoy.polygon.technology',
      'polygon-amoy.publicnode.com',
    ],
  },
  [ChainNetwork.SOLANA]: {
    chain: ChainNetwork.SOLANA,
    displayName: 'Solana Devnet (TESTNET)',
    nativeSymbol: 'SOL',
    caip2: 'solana:devnet',
    alchemyHost: 'solana-devnet.g.alchemy.com',
    explorerUrl: 'https://explorer.solana.com/?cluster=devnet',
    allowedRpcHostSuffixes: ['solana-devnet.g.alchemy.com', 'api.devnet.solana.com'],
  },
  [ChainNetwork.BITCOIN]: {
    chain: ChainNetwork.BITCOIN,
    displayName: 'Bitcoin Testnet3 (TESTNET)',
    nativeSymbol: 'tBTC',
    alchemyHost: 'bitcoin-testnet.g.alchemy.com',
    explorerUrl: 'https://mempool.space/testnet',
    allowedRpcHostSuffixes: ['bitcoin-testnet.g.alchemy.com', 'mempool.space', 'blockstream.info'],
  },
  [ChainNetwork.TRON]: {
    chain: ChainNetwork.TRON,
    displayName: 'Tron Nile (TESTNET)',
    nativeSymbol: 'NileTRX',
    alchemyHost: 'tron-nile.g.alchemy.com',
    explorerUrl: 'https://nile.tronscan.org',
    allowedRpcHostSuffixes: ['tron-nile.g.alchemy.com', 'nile.trongrid.io', 'api.nileex.io'],
  },
};

export const ENABLED_TESTNETS = [
  ChainNetwork.ETHEREUM,
  ChainNetwork.POLYGON,
  ChainNetwork.BNB_SMART_CHAIN,
  ChainNetwork.SOLANA,
  ChainNetwork.TRON,
  ChainNetwork.BITCOIN,
] as const;

export function isMainnetRpcUrl(url: string): boolean {
  const lower = url.toLowerCase();
  // Bitcoin mainnet tip APIs (exclude /testnet path)
  if (lower.includes('mempool.space') && !lower.includes('/testnet')) return true;
  if (lower.includes('blockstream.info') && !lower.includes('/testnet')) return true;
  return MAINNET_RPC_HOST_MARKERS.some((marker) => {
    if (marker === 'mempool.space' || marker === 'blockstream.info') return false;
    return lower.includes(marker);
  });
}

export function isAllowedTestnetRpcUrl(chain: ChainNetwork, url: string): boolean {
  if (chain === ChainNetwork.LITECOIN) return false;
  if (isMainnetRpcUrl(url)) return false;
  const desc = TESTNET_NETWORKS[chain as Exclude<ChainNetwork, 'LITECOIN'>];
  if (!desc) return false;
  const lower = url.toLowerCase();
  // Bitcoin testnet must include testnet path when using mempool/blockstream
  if (chain === ChainNetwork.BITCOIN) {
    if (lower.includes('mempool.space') || lower.includes('blockstream.info')) {
      return lower.includes('/testnet');
    }
  }
  return desc.allowedRpcHostSuffixes.some((suffix) => lower.includes(suffix.toLowerCase()));
}

export function isAllowlistedTestnetChain(chain: ChainNetwork): boolean {
  return (ENABLED_TESTNETS as readonly ChainNetwork[]).includes(chain);
}
