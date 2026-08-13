import { Module } from '@nestjs/common';
import { LoggerInfrastructureModule } from './logging/logger.module';
import { OpenTelemetryLifecycle } from './observability/otel-lifecycle.service';
import { NoopRedisAdapter } from './redis/noop-redis.adapter';
import { REDIS_PORT } from './redis/redis.port';

@Module({
  imports: [LoggerInfrastructureModule],
  providers: [
    OpenTelemetryLifecycle,
    {
      provide: REDIS_PORT,
      useClass: NoopRedisAdapter,
    },
  ],
  exports: [REDIS_PORT, LoggerInfrastructureModule],
})
export class InfrastructureModule {}
