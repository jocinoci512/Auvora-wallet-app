import { Inject, Injectable } from '@nestjs/common';
import type { ChainNetwork } from '@auvora/database';
import {
  PROVIDER_FACTORY,
  type ProviderFactoryPort,
  type ProviderResolverPort,
} from '../../application/ports/provider-factory.port';
import {
  NETWORK_CONFIG_REPOSITORY,
  type NetworkConfigRepositoryPort,
} from '../../application/ports/network-config-repository.port';
import { type BlockchainProvider, ProviderUnavailableError } from '../../domain';

@Injectable()
export class ProviderResolver implements ProviderResolverPort {
  constructor(
    @Inject(PROVIDER_FACTORY) private readonly factory: ProviderFactoryPort,
    @Inject(NETWORK_CONFIG_REPOSITORY) private readonly networkConfig: NetworkConfigRepositoryPort,
  ) {}

  async resolvePrimary(chain: ChainNetwork): Promise<BlockchainProvider> {
    const config = await this.networkConfig.findByChain(chain);
    if (!config || !config.isEnabled) {
      throw new ProviderUnavailableError(`Network ${chain} is not enabled`);
    }
    return this.factory.getProvider(chain);
  }
}
