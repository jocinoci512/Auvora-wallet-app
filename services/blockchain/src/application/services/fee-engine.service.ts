import { Inject, Injectable } from '@nestjs/common';
import { type ChainNetwork, FeePriority } from '@auvora/database';
import { PROVIDER_FACTORY, type ProviderFactoryPort } from '../ports/provider-factory.port';

export interface FeeEstimate {
  amount: string;
  unit: string;
}

const PRIORITY_ORDER: FeePriority[] = [
  FeePriority.SLOW,
  FeePriority.STANDARD,
  FeePriority.FAST,
  FeePriority.PRIORITY,
];

@Injectable()
export class FeeEngine {
  constructor(@Inject(PROVIDER_FACTORY) private readonly providerFactory: ProviderFactoryPort) {}

  async estimateFee(chain: ChainNetwork, priority: FeePriority): Promise<FeeEstimate> {
    const provider = this.providerFactory.getProvider(chain);
    return provider.estimateFee(priority);
  }

  async getFeeSchedule(chain: ChainNetwork): Promise<Record<FeePriority, FeeEstimate>> {
    const provider = this.providerFactory.getProvider(chain);
    const entries = await Promise.all(
      PRIORITY_ORDER.map(async (priority) => [priority, await provider.estimateFee(priority)] as const),
    );
    return Object.fromEntries(entries) as Record<FeePriority, FeeEstimate>;
  }
}
