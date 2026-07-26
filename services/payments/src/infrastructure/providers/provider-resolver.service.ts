import { Inject, Injectable } from '@nestjs/common';
import type { PaymentType } from '@auvora/database';
import {
  PROVIDER_FACTORY,
  type ProviderFactoryPort,
  type ProviderResolverPort,
} from '../../application/ports/provider-factory.port';
import {
  PROVIDER_HEALTH_REPOSITORY,
  type ProviderHealthRepositoryPort,
} from '../../application/ports/provider-health-repository.port';
import {
  PROVIDER_RECORD_REPOSITORY,
  type ProviderRecordRepositoryPort,
} from '../../application/ports/provider-record-repository.port';
import { type PaymentProvider, ProviderUnavailableError } from '../../domain';

/**
 * Picks the best enabled provider capable of handling a `PaymentType`,
 * preferring healthy providers and lower `priority` values (matching the
 * blockchain service's provider-selection convention).
 */
@Injectable()
export class ProviderResolver implements ProviderResolverPort {
  constructor(
    @Inject(PROVIDER_FACTORY) private readonly factory: ProviderFactoryPort,
    @Inject(PROVIDER_RECORD_REPOSITORY) private readonly providerRecords: ProviderRecordRepositoryPort,
    @Inject(PROVIDER_HEALTH_REPOSITORY) private readonly health: ProviderHealthRepositoryPort,
  ) {}

  async resolve(paymentType: PaymentType): Promise<PaymentProvider> {
    const candidates = this.factory.listProviders().filter((provider) =>
      provider.listCapabilities().includes(paymentType),
    );
    if (candidates.length === 0) {
      throw new ProviderUnavailableError(`No provider registered for payment type ${paymentType}`);
    }

    const [records, healthSnapshots] = await Promise.all([
      this.providerRecords.listAll(),
      this.health.latestByProvider(),
    ]);
    const recordByCode = new Map(records.map((record) => [record.code, record]));
    const healthByCode = new Map(healthSnapshots.map((snapshot) => [snapshot.providerCode, snapshot]));

    const ranked = candidates
      .map((provider) => {
        const record = recordByCode.get(provider.getCode());
        const isEnabled = record?.isEnabled ?? true;
        const priority = record?.priority ?? 100;
        const isHealthy = healthByCode.get(provider.getCode())?.status !== 'UNHEALTHY';
        return { provider, isEnabled, priority, isHealthy };
      })
      .filter((candidate) => candidate.isEnabled)
      .sort((a, b) => {
        if (a.isHealthy !== b.isHealthy) {
          return a.isHealthy ? -1 : 1;
        }
        return a.priority - b.priority;
      });

    const selected = ranked[0];
    if (!selected) {
      throw new ProviderUnavailableError(`All providers for payment type ${paymentType} are disabled`);
    }
    return selected.provider;
  }
}
