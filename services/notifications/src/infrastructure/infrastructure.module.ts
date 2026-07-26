import { Module } from '@nestjs/common';
import { PrismaModule } from '@auvora/database';
import { ConfigModule } from '../config/config.module';
import { CLOCK, ID_GENERATOR, RATE_LIMITER } from '../application/ports/clock.port';
import { CHANNEL_PROVIDER_REGISTRY } from '../application/ports/provider.tokens';
import { EVENT_BUS } from '../domain';
import { AI_PUBLISHER, AiPublisherAdapter } from './ai/ai-publisher.adapter';
import { ANALYTICS_PUBLISHER, AnalyticsPublisherAdapter } from './analytics/analytics-publisher.adapter';
import { AesFieldEncryptionAdapter, FIELD_ENCRYPTION } from './crypto/field-encryption.adapter';
import { EventBusService } from './events/event-bus.service';
import { LoggerInfrastructureModule } from './logging/logger.module';
import { ChannelProviderRegistry } from './providers/provider-registry';
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
    EventBusService,
    ChannelProviderRegistry,
    AiPublisherAdapter,
    AnalyticsPublisherAdapter,
    { provide: REDIS_PORT, useExisting: RedisAdapter },
    { provide: RATE_LIMITER, useExisting: RedisAdapter },
    { provide: CLOCK, useExisting: SystemClockAdapter },
    { provide: ID_GENERATOR, useExisting: UuidIdGeneratorAdapter },
    { provide: FIELD_ENCRYPTION, useExisting: AesFieldEncryptionAdapter },
    { provide: EVENT_BUS, useExisting: EventBusService },
    { provide: CHANNEL_PROVIDER_REGISTRY, useExisting: ChannelProviderRegistry },
    { provide: AI_PUBLISHER, useExisting: AiPublisherAdapter },
    { provide: ANALYTICS_PUBLISHER, useExisting: AnalyticsPublisherAdapter },
  ],
  exports: [
    REDIS_PORT,
    RATE_LIMITER,
    CLOCK,
    ID_GENERATOR,
    FIELD_ENCRYPTION,
    EVENT_BUS,
    CHANNEL_PROVIDER_REGISTRY,
    AI_PUBLISHER,
    ANALYTICS_PUBLISHER,
    LoggerInfrastructureModule,
    PrismaModule,
  ],
})
export class InfrastructureModule {}
