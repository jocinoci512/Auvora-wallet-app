import { Module } from '@nestjs/common';
import { PrismaModule } from '@auvora/database';
import { ConfigModule } from '../config/config.module';
import { CLOCK, ID_GENERATOR, RATE_LIMITER } from '../application/ports/clock.port';
import { BRIDGE_PROVIDER } from '../domain/bridge-provider.port';
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
import { BridgeProviderRegistry } from './providers/provider-registry';
import { LayerZeroStyleProvider } from './providers/layerzero-style.provider';
import { SimulatorBridgeProvider } from './providers/simulator-bridge.provider';
import { WormholeStyleProvider } from './providers/wormhole-style.provider';
import { RedisAdapter } from './redis/redis.adapter';
import { REDIS_PORT } from './redis/redis.port';
import { SystemClockAdapter, UuidIdGeneratorAdapter } from './system/system.adapters';

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
    SimulatorBridgeProvider,
    LayerZeroStyleProvider,
    WormholeStyleProvider,
    BridgeProviderRegistry,
    { provide: REDIS_PORT, useExisting: RedisAdapter },
    { provide: RATE_LIMITER, useExisting: RedisAdapter },
    { provide: CLOCK, useExisting: SystemClockAdapter },
    { provide: ID_GENERATOR, useExisting: UuidIdGeneratorAdapter },
    { provide: FIELD_ENCRYPTION, useExisting: AesFieldEncryptionAdapter },
    { provide: OBSERVABILITY_PUBLISHER, useExisting: ObservabilityPublisherAdapter },
    { provide: NOTIFICATIONS_PUBLISHER, useExisting: NotificationsPublisherAdapter },
    { provide: ANALYTICS_PUBLISHER, useExisting: AnalyticsPublisherAdapter },
    { provide: AI_PUBLISHER, useExisting: AiPublisherAdapter },
    { provide: BRIDGE_PROVIDER, useExisting: BridgeProviderRegistry },
  ],
  exports: [
    REDIS_PORT,
    RATE_LIMITER,
    CLOCK,
    ID_GENERATOR,
    FIELD_ENCRYPTION,
    OBSERVABILITY_PUBLISHER,
    NOTIFICATIONS_PUBLISHER,
    ANALYTICS_PUBLISHER,
    AI_PUBLISHER,
    BRIDGE_PROVIDER,
    BridgeProviderRegistry,
    SimulatorBridgeProvider,
    LoggerInfrastructureModule,
    PrismaModule,
  ],
})
export class InfrastructureModule {}
