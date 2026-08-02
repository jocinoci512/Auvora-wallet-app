import { ChainNetwork } from '@auvora/database';
import type { ServiceEnv } from '../../../config/env.schema';

/** Chains wired to Alchemy (or Alchemy-compatible) RPC. */
export const ALCHEMY_SUPPORTED_CHAINS = [
  ChainNetwork.ETHEREUM,
  ChainNetwork.POLYGON,
  ChainNetwork.BNB_SMART_CHAIN,
  ChainNetwork.SOLANA,
  ChainNetwork.TRON,
  ChainNetwork.BITCOIN,
] as const;

export type AlchemySupportedChain = (typeof ALCHEMY_SUPPORTED_CHAINS)[number];

const DEFAULT_HOSTS: Record<AlchemySupportedChain, string> = {
  [ChainNetwork.ETHEREUM]: 'eth-mainnet.g.alchemy.com',
  [ChainNetwork.POLYGON]: 'polygon-mainnet.g.alchemy.com',
  [ChainNetwork.BNB_SMART_CHAIN]: 'bnb-mainnet.g.alchemy.com',
  [ChainNetwork.SOLANA]: 'solana-mainnet.g.alchemy.com',
  [ChainNetwork.TRON]: 'tron-mainnet.g.alchemy.com',
  [ChainNetwork.BITCOIN]: 'bitcoin-mainnet.g.alchemy.com',
};

function buildFromApiKey(chain: AlchemySupportedChain, apiKey: string): string {
  return `https://${DEFAULT_HOSTS[chain]}/v2/${apiKey}`;
}

/**
 * Resolve per-chain RPC URLs from explicit env overrides or ALCHEMY_API_KEY.
 * Never logs the API key — callers must redact URLs before logging.
 */
export function resolveAlchemyRpcUrls(env: ServiceEnv): Map<ChainNetwork, string> {
  const urls = new Map<ChainNetwork, string>();
  const explicit: Partial<Record<AlchemySupportedChain, string | undefined>> = {
    [ChainNetwork.ETHEREUM]: env.ALCHEMY_ETHEREUM_RPC_URL,
    [ChainNetwork.POLYGON]: env.ALCHEMY_POLYGON_RPC_URL,
    [ChainNetwork.BNB_SMART_CHAIN]: env.ALCHEMY_BSC_RPC_URL,
    [ChainNetwork.SOLANA]: env.ALCHEMY_SOLANA_RPC_URL,
    [ChainNetwork.TRON]: env.ALCHEMY_TRON_RPC_URL,
    [ChainNetwork.BITCOIN]: env.ALCHEMY_BITCOIN_RPC_URL,
  };

  for (const chain of ALCHEMY_SUPPORTED_CHAINS) {
    const override = explicit[chain]?.trim();
    if (override) {
      urls.set(chain, override);
      continue;
    }
    if (env.ALCHEMY_API_KEY) {
      urls.set(chain, buildFromApiKey(chain, env.ALCHEMY_API_KEY));
    }
  }
  return urls;
}

/** Strip API key path segment for safe logs. */
export function redactRpcUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && parts[0] === 'v2') {
      parts[1] = '[REDACTED]';
      parsed.pathname = `/${parts.join('/')}`;
    }
    return parsed.toString();
  } catch {
    return '[invalid-rpc-url]';
  }
}

export function isAlchemyConfigured(env: ServiceEnv): boolean {
  return resolveAlchemyRpcUrls(env).size > 0;
}
