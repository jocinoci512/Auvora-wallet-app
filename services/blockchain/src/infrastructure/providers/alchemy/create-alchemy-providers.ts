import { ChainNetwork } from '@auvora/database';
import type { BlockchainProvider } from '../../../domain';
import type { ServiceEnv } from '../../../config/env.schema';
import { AlchemyBitcoinProvider } from './alchemy-bitcoin.provider';
import { AlchemyEvmProvider } from './alchemy-evm.provider';
import { resolveAlchemyRpcUrls } from './alchemy-rpc.config';
import { AlchemySolanaProvider } from './alchemy-solana.provider';
import { AlchemyTronProvider } from './alchemy-tron.provider';
import type { JsonRpcMetrics } from './json-rpc.client';

export type AlchemyLiveProvider = BlockchainProvider & {
  getRpcMetrics(): JsonRpcMetrics;
  getSafeEndpoint(): string;
};

export function createAlchemyProviders(env: ServiceEnv): Map<ChainNetwork, AlchemyLiveProvider> {
  const urls = resolveAlchemyRpcUrls(env);
  const providers = new Map<ChainNetwork, AlchemyLiveProvider>();
  const timeoutMs = env.ALCHEMY_RPC_TIMEOUT_MS;

  const ethUrl = urls.get(ChainNetwork.ETHEREUM);
  if (ethUrl) {
    providers.set(
      ChainNetwork.ETHEREUM,
      new AlchemyEvmProvider(ChainNetwork.ETHEREUM, ethUrl, 'ETH', timeoutMs),
    );
  }

  const polygonUrl = urls.get(ChainNetwork.POLYGON);
  if (polygonUrl) {
    providers.set(
      ChainNetwork.POLYGON,
      new AlchemyEvmProvider(ChainNetwork.POLYGON, polygonUrl, 'POL', timeoutMs),
    );
  }

  const bscUrl = urls.get(ChainNetwork.BNB_SMART_CHAIN);
  if (bscUrl) {
    providers.set(
      ChainNetwork.BNB_SMART_CHAIN,
      new AlchemyEvmProvider(ChainNetwork.BNB_SMART_CHAIN, bscUrl, 'BNB', timeoutMs),
    );
  }

  const solUrl = urls.get(ChainNetwork.SOLANA);
  if (solUrl) {
    providers.set(ChainNetwork.SOLANA, new AlchemySolanaProvider(solUrl, timeoutMs));
  }

  const tronUrl = urls.get(ChainNetwork.TRON);
  if (tronUrl) {
    providers.set(ChainNetwork.TRON, new AlchemyTronProvider(tronUrl, timeoutMs));
  }

  const btcUrl = urls.get(ChainNetwork.BITCOIN);
  if (btcUrl) {
    providers.set(ChainNetwork.BITCOIN, new AlchemyBitcoinProvider(btcUrl, timeoutMs));
  }

  return providers;
}
