import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { ApplicationModule } from '../application/application.module';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { AdminObservabilityController } from './controllers/admin-observability.controller';
import { AdminInfrastructureController } from './controllers/admin-infrastructure.controller';
import { InternalObservabilityController } from './controllers/internal-observability.controller';
import { ObservabilityController } from './controllers/observability.controller';
import { DomainExceptionFilter } from '@auvora/nest-common';
import { CsrfGuard } from './guards/csrf.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtStrategy } from './guards/jwt.strategy';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesGuard } from './guards/roles.guard';
import { HealthController } from './http/health.controller';
import { RequestContextMiddleware } from './middleware/request-context.middleware';

@Module({
  imports: [
    InfrastructureModule,
    ApplicationModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [
    HealthController,
    ObservabilityController,
    AdminObservabilityController,
    AdminInfrastructureController,
    InternalObservabilityController,
  ],
  providers: [
    JwtStrategy,
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class PresentationModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
