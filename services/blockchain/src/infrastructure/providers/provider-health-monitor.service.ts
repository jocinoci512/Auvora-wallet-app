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
  NETWORK_CONFIG_REPOSITORY,
  type NetworkConfigRepositoryPort,
} from '../../application/ports/network-config-repository.port';
import {
  PROVIDER_HEALTH_REPOSITORY,
  type ProviderHealthRepositoryPort,
} from '../../application/ports/provider-health-repository.port';
import {
  PROVIDER_RECORD_REPOSITORY,
  type ProviderRecordRepositoryPort,
} from '../../application/ports/provider-record-repository.port';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { BlockchainEventType, EVENT_BUS, type EventBusPort } from '../../domain';

@Injectable()
export class ProviderHealthMonitor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProviderHealthMonitor.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @Inject(PROVIDER_FACTORY) private readonly providerFactory: ProviderFactoryPort,
    @Inject(NETWORK_CONFIG_REPOSITORY) private readonly networkConfig: NetworkConfigRepositoryPort,
    @Inject(PROVIDER_RECORD_REPOSITORY)
    private readonly providerRecords: ProviderRecordRepositoryPort,
    @Inject(PROVIDER_HEALTH_REPOSITORY) private readonly healthRepo: ProviderHealthRepositoryPort,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    @Inject(ENV) private readonly env: ServiceEnv,
  ) {}

  onModuleInit(): void {
    const intervalMs = this.env.BLOCKCHAIN_SYNC_INTERVAL_MS * 3;
    this.timer = setInterval(() => {
      this.runCheck().catch((error: unknown) => {
        this.logger.error(
          `Provider health sweep failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }, intervalMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async runCheck(): Promise<void> {
    for (const chain of this.providerFactory.getSupportedChains()) {
      const config = await this.networkConfig.findByChain(chain);
      if (!config) {
        continue;
      }
      const provider = this.providerFactory.getProvider(chain);
      const primary = await this.providerRecords.findPrimary(chain);
      const result = await provider.healthCheck();
      const blockHeight = result.healthy ? await provider.getBlockHeight() : undefined;

      await this.healthRepo.record({
        chain,
        networkId: config.id,
        providerId: primary?.id,
        status: result.healthy ? 'HEALTHY' : 'UNHEALTHY',
        latencyMs: result.latencyMs,
        blockHeight: blockHeight !== undefined ? blockHeight.toString() : undefined,
        errorMessage: result.message,
      });

      if (!result.healthy) {
        await this.eventBus.publish({
          type: BlockchainEventType.ProviderUnavailable,
          chain,
          payload: { message: result.message ?? 'provider unhealthy', latencyMs: result.latencyMs },
        });
      }
    }
  }
}
