import { Module } from '@nestjs/common';
import { PrismaModule } from '@auvora/database';
import { ConfigModule } from '../config/config.module';
import { CLOCK, ID_GENERATOR, RATE_LIMITER } from '../application/ports/clock.port';
import { CONNECTION_PROVIDER } from '../domain/connection-provider.port';
import { AI_PUBLISHER, AiPublisherAdapter } from './ai/ai-publisher.adapter';
import {
  ANALYTICS_PUBLISHER,
  AnalyticsPublisherAdapter,
} from './analytics/analytics-publisher.adapter';
import { AesFieldEncryptionAdapter, FIELD_ENCRYPTION } from './crypto/field-encryption.adapter';
import { LoggerInfrastructureModule } from './logging/logger.module';
import {
  NOTIFICATIONS_PUBLISHER,
  NotificationsPublisherAdapter,
} from './notifications/notifications-publisher.adapter';
import {
  OBSERVABILITY_PUBLISHER,
  ObservabilityPublisherAdapter,
} from './observability/observability-publisher.adapter';
import { ConnectionProviderRegistry } from './providers/provider-registry';
import { LedgerStyleProvider } from './providers/ledger-style.provider';
import { SimulatorConnectionProvider } from './providers/simulator-connection.provider';
import { WalletConnectStyleProvider } from './providers/walletconnect-style.provider';
import { RedisAdapter } from './redis/redis.adapter';
import { REDIS_PORT } from './redis/redis.port';
import { SystemClockAdapter, UuidIdGeneratorAdapter } from './system/system.adapters';
import {
  ADMIN_EVENT_PUBLISHER,
  RedisAdminEventPublisher,
} from './realtime/admin-event-publisher.adapter';

@Module({
  imports: [ConfigModule, PrismaModule, LoggerInfrastructureModule],
  providers: [
    RedisAdapter,
    SystemClockAdapter,
    UuidIdGeneratorAdapter,
    AesFieldEncryptionAdapter,
    ObservabilityPublisherAdapter,
    NotificationsPublisherAdapter,
    AnalyticsPublisherAdapter,
    AiPublisherAdapter,
    SimulatorConnectionProvider,
    LedgerStyleProvider,
    WalletConnectStyleProvider,
    ConnectionProviderRegistry,
    { provide: REDIS_PORT, useExisting: RedisAdapter },
    { provide: RATE_LIMITER, useExisting: RedisAdapter },
    { provide: CLOCK, useExisting: SystemClockAdapter },
    { provide: ID_GENERATOR, useExisting: UuidIdGeneratorAdapter },
    { provide: FIELD_ENCRYPTION, useExisting: AesFieldEncryptionAdapter },
    { provide: OBSERVABILITY_PUBLISHER, useExisting: ObservabilityPublisherAdapter },
    { provide: NOTIFICATIONS_PUBLISHER, useExisting: NotificationsPublisherAdapter },
    { provide: ANALYTICS_PUBLISHER, useExisting: AnalyticsPublisherAdapter },
    { provide: AI_PUBLISHER, useExisting: AiPublisherAdapter },
    { provide: CONNECTION_PROVIDER, useExisting: ConnectionProviderRegistry },
    RedisAdminEventPublisher,
    { provide: ADMIN_EVENT_PUBLISHER, useExisting: RedisAdminEventPublisher },
  ],
  exports: [
    REDIS_PORT,
    ADMIN_EVENT_PUBLISHER,
    RATE_LIMITER,
    CLOCK,
    ID_GENERATOR,
    FIELD_ENCRYPTION,
    OBSERVABILITY_PUBLISHER,
    NOTIFICATIONS_PUBLISHER,
    ANALYTICS_PUBLISHER,
    AI_PUBLISHER,
    CONNECTION_PROVIDER,
    ConnectionProviderRegistry,
    SimulatorConnectionProvider,
    LoggerInfrastructureModule,
    PrismaModule,
  ],
})
export class InfrastructureModule {}
