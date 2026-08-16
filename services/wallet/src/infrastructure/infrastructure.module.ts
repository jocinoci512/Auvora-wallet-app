import { Module } from '@nestjs/common';
import { PrismaModule } from '@auvora/database';
import { ConfigModule } from '../config/config.module';
import { CLOCK, ID_GENERATOR, RATE_LIMITER } from '../application/ports/clock.port';
import {
  LEDGER_REPOSITORY,
  TRANSACTION_REPOSITORY,
} from '../application/ports/ledger-repository.port';
import { WALLET_REPOSITORY } from '../application/ports/wallet-repository.port';
import {
  BLOCKCHAIN_PROVIDER_REGISTRY,
  BLOCKCHAIN_PROVIDERS,
  type BlockchainProviderRegistry,
} from './blockchain/blockchain-providers';
import { BLOCKCHAIN_HTTP_CLIENT } from './blockchain/blockchain-client.port';
import { BlockchainHttpClientAdapter } from './blockchain/blockchain-http-client.adapter';
import { AI_PUBLISHER, AiPublisherAdapter } from './ai/ai-publisher.adapter';
import {
  ANALYTICS_PUBLISHER,
  AnalyticsPublisherAdapter,
} from './analytics/analytics-publisher.adapter';
import {
  MARKET_DATA_HTTP_CLIENT,
  MarketDataHttpClientAdapter,
} from './market-data/market-data-http.client';
import {
  OBSERVABILITY_PUBLISHER,
  ObservabilityPublisherAdapter,
} from './observability/observability-publisher.adapter';
import {
  NOTIFICATIONS_PUBLISHER,
  NotificationsPublisherAdapter,
} from './notifications/notifications-publisher.adapter';
import { PrismaLedgerRepository } from './persistence/prisma-ledger.repository';
import { PrismaTransactionRepository } from './persistence/prisma-transaction.repository';
import { PrismaWalletRepository } from './persistence/prisma-wallet.repository';
import { LoggerInfrastructureModule } from './logging/logger.module';
import { OpenTelemetryLifecycle } from './observability/otel-lifecycle.service';
import { REDIS_PORT } from './redis/redis.port';
import { RedisAdapter } from './redis/redis.adapter';
import {
  ADMIN_EVENT_PUBLISHER,
  RedisAdminEventPublisher,
} from './realtime/admin-event-publisher.adapter';
import { SystemClockAdapter, UuidIdGeneratorAdapter } from './system/system.adapters';

@Module({
  imports: [ConfigModule, PrismaModule, LoggerInfrastructureModule],
  providers: [
    OpenTelemetryLifecycle,
    RedisAdapter,
    SystemClockAdapter,
    UuidIdGeneratorAdapter,
    PrismaWalletRepository,
    PrismaLedgerRepository,
    PrismaTransactionRepository,
    BlockchainHttpClientAdapter,
    MarketDataHttpClientAdapter,
    NotificationsPublisherAdapter,
    AiPublisherAdapter,
    AnalyticsPublisherAdapter,
    ObservabilityPublisherAdapter,
    ...BLOCKCHAIN_PROVIDERS,
    {
      provide: BLOCKCHAIN_PROVIDER_REGISTRY,
      useFactory: (...providers: InstanceType<(typeof BLOCKCHAIN_PROVIDERS)[number]>[]) => {
        const registry: BlockchainProviderRegistry = new Map();
        for (const provider of providers) {
          registry.set(provider.getChain(), provider);
        }
        return registry;
      },
      inject: [...BLOCKCHAIN_PROVIDERS],
    },
    {
      provide: REDIS_PORT,
      useExisting: RedisAdapter,
    },
    {
      provide: RATE_LIMITER,
      useExisting: RedisAdapter,
    },
    {
      provide: CLOCK,
      useExisting: SystemClockAdapter,
    },
    {
      provide: ID_GENERATOR,
      useExisting: UuidIdGeneratorAdapter,
    },
    {
      provide: WALLET_REPOSITORY,
      useExisting: PrismaWalletRepository,
    },
    {
      provide: LEDGER_REPOSITORY,
      useExisting: PrismaLedgerRepository,
    },
    {
      provide: TRANSACTION_REPOSITORY,
      useExisting: PrismaTransactionRepository,
    },
    {
      provide: BLOCKCHAIN_HTTP_CLIENT,
      useExisting: BlockchainHttpClientAdapter,
    },
    {
      provide: MARKET_DATA_HTTP_CLIENT,
      useExisting: MarketDataHttpClientAdapter,
    },
    {
      provide: NOTIFICATIONS_PUBLISHER,
      useExisting: NotificationsPublisherAdapter,
    },
    {
      provide: AI_PUBLISHER,
      useExisting: AiPublisherAdapter,
    },
    {
      provide: ANALYTICS_PUBLISHER,
      useExisting: AnalyticsPublisherAdapter,
    },
    {
      provide: OBSERVABILITY_PUBLISHER,
      useExisting: ObservabilityPublisherAdapter,
    },
    RedisAdminEventPublisher,
    {
      provide: ADMIN_EVENT_PUBLISHER,
      useExisting: RedisAdminEventPublisher,
    },
  ],
  exports: [
    REDIS_PORT,
    ADMIN_EVENT_PUBLISHER,
    RATE_LIMITER,
    CLOCK,
    ID_GENERATOR,
    WALLET_REPOSITORY,
    LEDGER_REPOSITORY,
    TRANSACTION_REPOSITORY,
    BLOCKCHAIN_PROVIDER_REGISTRY,
    BLOCKCHAIN_HTTP_CLIENT,
    MARKET_DATA_HTTP_CLIENT,
    NOTIFICATIONS_PUBLISHER,
    AI_PUBLISHER,
    ANALYTICS_PUBLISHER,
    OBSERVABILITY_PUBLISHER,
    LoggerInfrastructureModule,
    PrismaModule,
  ],
})
export class InfrastructureModule {}
