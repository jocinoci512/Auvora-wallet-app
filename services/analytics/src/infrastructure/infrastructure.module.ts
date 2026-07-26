import { Module } from '@nestjs/common';
import { PrismaModule } from '@auvora/database';
import { ConfigModule } from '../config/config.module';
import { CLOCK, ID_GENERATOR, RATE_LIMITER } from '../application/ports/clock.port';
import { EVENT_BUS } from '../domain';
import { AesFieldEncryptionAdapter, FIELD_ENCRYPTION } from './crypto/field-encryption.adapter';
import { EventBusService } from './events/event-bus.service';
import { LoggerInfrastructureModule } from './logging/logger.module';
import {
  OBSERVABILITY_PUBLISHER,
  ObservabilityPublisherAdapter,
} from './observability/observability-publisher.adapter';
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
    ObservabilityPublisherAdapter,
    { provide: REDIS_PORT, useExisting: RedisAdapter },
    { provide: RATE_LIMITER, useExisting: RedisAdapter },
    { provide: CLOCK, useExisting: SystemClockAdapter },
    { provide: ID_GENERATOR, useExisting: UuidIdGeneratorAdapter },
    { provide: FIELD_ENCRYPTION, useExisting: AesFieldEncryptionAdapter },
    { provide: EVENT_BUS, useExisting: EventBusService },
    { provide: OBSERVABILITY_PUBLISHER, useExisting: ObservabilityPublisherAdapter },
  ],
  exports: [
    REDIS_PORT,
    RATE_LIMITER,
    CLOCK,
    ID_GENERATOR,
    FIELD_ENCRYPTION,
    EVENT_BUS,
    OBSERVABILITY_PUBLISHER,
    LoggerInfrastructureModule,
    PrismaModule,
  ],
})
export class InfrastructureModule {}
