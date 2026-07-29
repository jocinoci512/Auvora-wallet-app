import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  PROVIDER_FACTORY,
  type ProviderFactoryPort,
} from '../../application/ports/provider-factory.port';
import {
  PROVIDER_HEALTH_REPOSITORY,
  type ProviderHealthRepositoryPort,
} from '../../application/ports/provider-health-repository.port';
import {
  PROVIDER_RECORD_REPOSITORY,
  type ProviderRecordRepositoryPort,
} from '../../application/ports/provider-record-repository.port';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { EVENT_BUS, type EventBusPort, PaymentEventType } from '../../domain';

@Injectable()
export class ProviderHealthMonitor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProviderHealthMonitor.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @Inject(PROVIDER_FACTORY) private readonly providerFactory: ProviderFactoryPort,
    @Inject(PROVIDER_RECORD_REPOSITORY)
    private readonly providerRecords: ProviderRecordRepositoryPort,
    @Inject(PROVIDER_HEALTH_REPOSITORY) private readonly healthRepo: ProviderHealthRepositoryPort,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    @Inject(ENV) private readonly env: ServiceEnv,
  ) {}

  onModuleInit(): void {
    if (!this.env.PAYMENTS_SIMULATOR_ENABLED) {
      return;
    }
    this.timer = setInterval(() => {
      this.runCheck().catch((error: unknown) => {
        this.logger.error(
          `Provider health sweep failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }, this.env.SETTLEMENT_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async runCheck(): Promise<void> {
    for (const provider of this.providerFactory.listProviders()) {
      const result = await provider.healthCheck();
      const record = await this.providerRecords.findByCode(provider.getCode());

      await this.healthRepo.record({
        providerId: record?.id,
        providerCode: provider.getCode(),
        status: result.healthy ? 'HEALTHY' : 'UNHEALTHY',
        latencyMs: result.latencyMs,
        errorMessage: result.message,
      });

      if (!result.healthy) {
        await this.eventBus.publish({
          type: PaymentEventType.ProviderUnavailable,
          payload: {
            providerCode: provider.getCode(),
            message: result.message ?? 'provider unhealthy',
          },
        });
      }
    }
  }
}
