import { Inject, Injectable } from '@nestjs/common';
import type { ChainNetwork } from '@auvora/database';
import type { ProviderFactoryPort } from '../../application/ports/provider-factory.port';
import { type BlockchainProvider, NotFoundError } from '../../domain';
import { PROVIDER_REGISTRY, type ProviderRegistry } from './provider-registry';

@Injectable()
export class ProviderFactory implements ProviderFactoryPort {
  constructor(@Inject(PROVIDER_REGISTRY) private readonly registry: ProviderRegistry) {}

  getProvider(chain: ChainNetwork): BlockchainProvider {
    const provider = this.registry.get(chain);
    if (!provider) {
      throw new NotFoundError(`No provider registered for chain ${chain}`);
    }
    return provider;
  }

  getSupportedChains(): ChainNetwork[] {
    return Array.from(this.registry.keys());
  }

  hasProvider(chain: ChainNetwork): boolean {
    return this.registry.has(chain);
  }
}
