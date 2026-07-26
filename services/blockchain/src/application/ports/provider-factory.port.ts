import type { ChainNetwork } from '@auvora/database';
import type { BlockchainProvider } from '../../domain';

export const PROVIDER_FACTORY = Symbol('PROVIDER_FACTORY');

export interface ProviderFactoryPort {
  getProvider(chain: ChainNetwork): BlockchainProvider;
  getSupportedChains(): ChainNetwork[];
  hasProvider(chain: ChainNetwork): boolean;
}

export const PROVIDER_RESOLVER = Symbol('PROVIDER_RESOLVER');

export interface ProviderResolverPort {
  resolvePrimary(chain: ChainNetwork): Promise<BlockchainProvider>;
}
