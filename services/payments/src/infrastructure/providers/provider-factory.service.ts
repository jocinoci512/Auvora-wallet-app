import { Inject, Injectable } from '@nestjs/common';
import type { ProviderFactoryPort } from '../../application/ports/provider-factory.port';
import { NotFoundError, type PaymentProvider } from '../../domain';
import { PROVIDER_REGISTRY, type ProviderRegistry } from './provider-registry';

@Injectable()
export class ProviderFactory implements ProviderFactoryPort {
  constructor(@Inject(PROVIDER_REGISTRY) private readonly registry: ProviderRegistry) {}

  getProvider(code: string): PaymentProvider {
    const provider = this.registry.get(code);
    if (!provider) {
      throw new NotFoundError(`No payment provider registered with code ${code}`);
    }
    return provider;
  }

  listProviders(): PaymentProvider[] {
    return Array.from(this.registry.values());
  }

  hasProvider(code: string): boolean {
    return this.registry.has(code);
  }
}
