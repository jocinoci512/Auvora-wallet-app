import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { HealthController } from './http/health.controller';
import { RequestContextMiddleware } from './middleware/request-context.middleware';

@Module({
  controllers: [HealthController],
})
export class PresentationModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
