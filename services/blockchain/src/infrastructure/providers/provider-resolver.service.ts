import { Inject, Injectable } from '@nestjs/common';
import type { ChainNetwork } from '@auvora/database';
import type { ProviderResolverPort } from '../../application/ports/provider-factory.port';
import {
  NETWORK_CONFIG_REPOSITORY,
  type NetworkConfigRepositoryPort,
} from '../../application/ports/network-config-repository.port';
import { type BlockchainProvider, ProviderUnavailableError } from '../../domain';
import { MultiChainProviderManager } from './multi-chain-provider.manager';

@Injectable()
export class ProviderResolver implements ProviderResolverPort {
  constructor(
    @Inject(MultiChainProviderManager) private readonly managers: MultiChainProviderManager,
    @Inject(NETWORK_CONFIG_REPOSITORY) private readonly networkConfig: NetworkConfigRepositoryPort,
  ) {}

  async resolvePrimary(chain: ChainNetwork): Promise<BlockchainProvider> {
    const config = await this.networkConfig.findByChain(chain);
    if (!config || !config.isEnabled) {
      throw new ProviderUnavailableError(`Network ${chain} is not enabled`);
    }
    return this.managers.getProvider(chain);
  }
}
