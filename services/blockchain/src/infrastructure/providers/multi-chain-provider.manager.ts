import { Inject, Injectable, Logger } from '@nestjs/common';
import { ChainNetwork } from '@auvora/database';
import {
  PROVIDER_FACTORY,
  type ProviderFactoryPort,
} from '../../application/ports/provider-factory.port';
import { type BlockchainProvider, NotFoundError, ProviderUnavailableError } from '../../domain';
import {
  ENABLED_MAINNETS,
  resolveBlockchainConfig,
  type EnabledMainnet,
} from '../../config/blockchain.config';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import type { AlchemyLiveProvider } from './alchemy/create-alchemy-providers';
import { PROVIDER_REGISTRY, type ProviderRegistry } from './provider-registry';

export const MULTI_CHAIN_PROVIDER_MANAGER = Symbol('MULTI_CHAIN_PROVIDER_MANAGER');

export type ProviderBackend = 'alchemy' | 'simulator';

export type ChainProviderInfo = {
  chain: ChainNetwork;
  backend: ProviderBackend;
  endpoint?: string;
  enabled: boolean;
};

/**
 * Multi-chain provider manager — selects the correct BlockchainProvider
 * for the active network. Alchemy overrides simulators for configured chains.
 */
@Injectable()
export class MultiChainProviderManager {
  private readonly logger = new Logger(MultiChainProviderManager.name);

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(PROVIDER_FACTORY) private readonly factory: ProviderFactoryPort,
    @Inject(PROVIDER_REGISTRY) private readonly registry: ProviderRegistry,
  ) {
    const cfg = resolveBlockchainConfig(env);
    this.logger.log(
      `Provider manager ready primary=${cfg.primaryProvider} alchemyChains=${cfg.alchemyChains.length} enabledMainnets=${cfg.enabledMainnets.length}`,
    );
  }

  /** Resolve provider for a chain (throws if missing / disabled policy). */
  getProvider(chain: ChainNetwork | string): BlockchainProvider {
    const normalized = this.normalizeChain(chain);
    if (!this.isEnabledMainnet(normalized) && !this.factory.hasProvider(normalized)) {
      throw new ProviderUnavailableError(`Network ${normalized} is not supported`);
    }
    try {
      return this.factory.getProvider(normalized);
    } catch {
      throw new NotFoundError(`No provider registered for chain ${normalized}`);
    }
  }

  /** Switch / select network — returns provider for the target chain. */
  switchNetwork(chain: ChainNetwork | string): BlockchainProvider {
    const provider = this.getProvider(chain);
    this.logger.debug(`Switched active provider context to ${provider.getChain()}`);
    return provider;
  }

  listProviders(): ChainProviderInfo[] {
    return this.factory.getSupportedChains().map((chain) => {
      const provider = this.registry.get(chain);
      const backend = this.detectBackend(provider);
      const endpoint =
        provider && 'getSafeEndpoint' in provider
          ? (provider as AlchemyLiveProvider).getSafeEndpoint()
          : undefined;
      return {
        chain,
        backend,
        endpoint,
        enabled:
          ENABLED_MAINNETS.includes(chain as EnabledMainnet) || this.factory.hasProvider(chain),
      };
    });
  }

  getEnabledMainnets(): EnabledMainnet[] {
    return [...ENABLED_MAINNETS];
  }

  isAlchemyPrimary(): boolean {
    return resolveBlockchainConfig(this.env).primaryProvider === 'alchemy';
  }

  isAlchemyActiveFor(chain: ChainNetwork): boolean {
    const provider = this.registry.get(chain);
    return this.detectBackend(provider) === 'alchemy';
  }

  private detectBackend(provider: BlockchainProvider | undefined): ProviderBackend {
    if (!provider) return 'simulator';
    if (
      'getRpcMetrics' in provider &&
      typeof (provider as AlchemyLiveProvider).getRpcMetrics === 'function'
    ) {
      return 'alchemy';
    }
    return 'simulator';
  }

  private isEnabledMainnet(chain: ChainNetwork): boolean {
    return (ENABLED_MAINNETS as readonly ChainNetwork[]).includes(chain);
  }

  private normalizeChain(chain: ChainNetwork | string): ChainNetwork {
    if (typeof chain !== 'string') return chain;
    const key = chain.trim().toUpperCase().replace(/[-\s]/g, '_');
    const aliases: Record<string, ChainNetwork> = {
      ETH: ChainNetwork.ETHEREUM,
      ETHEREUM: ChainNetwork.ETHEREUM,
      MATIC: ChainNetwork.POLYGON,
      POL: ChainNetwork.POLYGON,
      POLYGON: ChainNetwork.POLYGON,
      BSC: ChainNetwork.BNB_SMART_CHAIN,
      BNB: ChainNetwork.BNB_SMART_CHAIN,
      BNB_SMART_CHAIN: ChainNetwork.BNB_SMART_CHAIN,
      SOL: ChainNetwork.SOLANA,
      SOLANA: ChainNetwork.SOLANA,
      TRX: ChainNetwork.TRON,
      TRON: ChainNetwork.TRON,
      BTC: ChainNetwork.BITCOIN,
      BITCOIN: ChainNetwork.BITCOIN,
    };
    const resolved = aliases[key];
    if (!resolved) {
      throw new ProviderUnavailableError(`Unknown network: ${chain}`);
    }
    return resolved;
  }
}
