import { Module } from '@nestjs/common';
import { PrismaModule } from '@auvora/database';
import { ConfigModule } from '../config/config.module';
import { CLOCK, ID_GENERATOR, RATE_LIMITER } from '../application/ports/clock.port';
import { CHAIN_ADDRESS_REPOSITORY } from '../application/ports/chain-address-repository.port';
import { CHAIN_BLOCK_REPOSITORY } from '../application/ports/chain-block-repository.port';
import { CHAIN_TRANSACTION_REPOSITORY } from '../application/ports/chain-transaction-repository.port';
import { EVENT_LOG_REPOSITORY } from '../application/ports/event-log-repository.port';
import { NETWORK_CONFIG_REPOSITORY } from '../application/ports/network-config-repository.port';
import { PROVIDER_FACTORY, PROVIDER_RESOLVER } from '../application/ports/provider-factory.port';
import { PROVIDER_HEALTH_REPOSITORY } from '../application/ports/provider-health-repository.port';
import { PROVIDER_RECORD_REPOSITORY } from '../application/ports/provider-record-repository.port';
import { SIMULATOR_LEDGER } from '../application/ports/simulator-ledger.port';
import { SYNC_JOB_REPOSITORY } from '../application/ports/sync-job-repository.port';
import { EVENT_BUS } from '../domain';
import { EventBusService } from './events/event-bus.service';
import { LoggerInfrastructureModule } from './logging/logger.module';
import { AI_PUBLISHER, AiPublisherAdapter } from './ai/ai-publisher.adapter';
import { ANALYTICS_PUBLISHER, AnalyticsPublisherAdapter } from './analytics/analytics-publisher.adapter';
import { NOTIFICATIONS_PUBLISHER, NotificationsPublisherAdapter } from './notifications/notifications-publisher.adapter';
import { PrismaChainAddressRepository } from './persistence/prisma-chain-address.repository';
import { PrismaChainBlockRepository } from './persistence/prisma-chain-block.repository';
import { PrismaChainTransactionRepository } from './persistence/prisma-chain-transaction.repository';
import { PrismaEventLogRepository } from './persistence/prisma-event-log.repository';
import { PrismaNetworkConfigRepository } from './persistence/prisma-network-config.repository';
import { PrismaProviderHealthRepository } from './persistence/prisma-provider-health.repository';
import { PrismaProviderRecordRepository } from './persistence/prisma-provider-record.repository';
import { PrismaSyncJobRepository } from './persistence/prisma-sync-job.repository';
import { CHAIN_PROVIDERS, PROVIDER_REGISTRY, type ProviderRegistry } from './providers/provider-registry';
import { ProviderFactory } from './providers/provider-factory.service';
import { ProviderHealthMonitor } from './providers/provider-health-monitor.service';
import { ProviderResolver } from './providers/provider-resolver.service';
import { SimulatorLedgerAdapter } from './providers/simulator-ledger.adapter';
import { RedisAdapter } from './redis/redis.adapter';
import { REDIS_PORT } from './redis/redis.port';
import { SystemClockAdapter, UuidIdGeneratorAdapter } from './system/system.adapters';
import {
  CUSTODY_SIGNING_CLIENT,
  CustodySigningHttpClient,
  NoopCustodySigningAdapter,
} from './custody/custody-signing-http.client';
import { ENV, type ServiceEnv } from '../config/env.schema';

@Module({
  imports: [ConfigModule, PrismaModule, LoggerInfrastructureModule],
  providers: [
    RedisAdapter,
    SystemClockAdapter,
    UuidIdGeneratorAdapter,
    SimulatorLedgerAdapter,
    PrismaNetworkConfigRepository,
    PrismaChainAddressRepository,
    PrismaChainTransactionRepository,
    PrismaChainBlockRepository,
    PrismaSyncJobRepository,
    PrismaProviderHealthRepository,
    PrismaProviderRecordRepository,
    PrismaEventLogRepository,
    ...CHAIN_PROVIDERS,
    ProviderFactory,
    ProviderResolver,
    ProviderHealthMonitor,
    EventBusService,
    NotificationsPublisherAdapter,
    AiPublisherAdapter,
    AnalyticsPublisherAdapter,
    CustodySigningHttpClient,
    NoopCustodySigningAdapter,
    {
      provide: CUSTODY_SIGNING_CLIENT,
      useFactory: (env: ServiceEnv, http: CustodySigningHttpClient, noop: NoopCustodySigningAdapter) =>
        env.CUSTODY_SERVICE_URL && env.INTERNAL_API_KEY ? http : noop,
      inject: [ENV, CustodySigningHttpClient, NoopCustodySigningAdapter],
    },
    {
      provide: PROVIDER_REGISTRY,
      useFactory: (...providers: InstanceType<(typeof CHAIN_PROVIDERS)[number]>[]) => {
        const registry: ProviderRegistry = new Map();
        for (const provider of providers) {
          registry.set(provider.getChain(), provider);
        }
        return registry;
      },
      inject: [...CHAIN_PROVIDERS],
    },
    { provide: REDIS_PORT, useExisting: RedisAdapter },
    { provide: RATE_LIMITER, useExisting: RedisAdapter },
    { provide: CLOCK, useExisting: SystemClockAdapter },
    { provide: ID_GENERATOR, useExisting: UuidIdGeneratorAdapter },
    { provide: SIMULATOR_LEDGER, useExisting: SimulatorLedgerAdapter },
    { provide: NETWORK_CONFIG_REPOSITORY, useExisting: PrismaNetworkConfigRepository },
    { provide: CHAIN_ADDRESS_REPOSITORY, useExisting: PrismaChainAddressRepository },
    { provide: CHAIN_TRANSACTION_REPOSITORY, useExisting: PrismaChainTransactionRepository },
    { provide: CHAIN_BLOCK_REPOSITORY, useExisting: PrismaChainBlockRepository },
    { provide: SYNC_JOB_REPOSITORY, useExisting: PrismaSyncJobRepository },
    { provide: PROVIDER_HEALTH_REPOSITORY, useExisting: PrismaProviderHealthRepository },
    { provide: PROVIDER_RECORD_REPOSITORY, useExisting: PrismaProviderRecordRepository },
    { provide: EVENT_LOG_REPOSITORY, useExisting: PrismaEventLogRepository },
    { provide: PROVIDER_FACTORY, useExisting: ProviderFactory },
    { provide: PROVIDER_RESOLVER, useExisting: ProviderResolver },
    { provide: EVENT_BUS, useExisting: EventBusService },
    { provide: NOTIFICATIONS_PUBLISHER, useExisting: NotificationsPublisherAdapter },
    { provide: AI_PUBLISHER, useExisting: AiPublisherAdapter },
    { provide: ANALYTICS_PUBLISHER, useExisting: AnalyticsPublisherAdapter },
  ],
  exports: [
    REDIS_PORT,
    RATE_LIMITER,
    CLOCK,
    ID_GENERATOR,
    SIMULATOR_LEDGER,
    NETWORK_CONFIG_REPOSITORY,
    CHAIN_ADDRESS_REPOSITORY,
    CHAIN_TRANSACTION_REPOSITORY,
    CHAIN_BLOCK_REPOSITORY,
    SYNC_JOB_REPOSITORY,
    PROVIDER_HEALTH_REPOSITORY,
    PROVIDER_RECORD_REPOSITORY,
    EVENT_LOG_REPOSITORY,
    PROVIDER_FACTORY,
    PROVIDER_RESOLVER,
    EVENT_BUS,
    NOTIFICATIONS_PUBLISHER,
    AI_PUBLISHER,
    ANALYTICS_PUBLISHER,
    CUSTODY_SIGNING_CLIENT,
    LoggerInfrastructureModule,
    PrismaModule,
  ],
})
export class InfrastructureModule {}
