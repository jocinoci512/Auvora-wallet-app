import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { ApplicationModule } from '../application/application.module';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { AdminStakingController } from './controllers/admin-staking.controller';
import { InternalStakingController } from './controllers/internal-staking.controller';
import { StakingController } from './controllers/staking.controller';
import { DomainExceptionFilter } from '@auvora/nest-common';
import { CsrfGuard } from './guards/csrf.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtStrategy } from './guards/jwt.strategy';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesGuard } from './guards/roles.guard';
import { HealthController } from './http/health.controller';
import { ObservabilityMetricsInterceptor } from './interceptors/observability-metrics.interceptor';
import { RequestContextMiddleware } from './middleware/request-context.middleware';

@Module({
  imports: [
    InfrastructureModule,
    ApplicationModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [
    HealthController,
    StakingController,
    AdminStakingController,
    InternalStakingController,
  ],
  providers: [
    JwtStrategy,
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: ObservabilityMetricsInterceptor },
  ],
})
export class PresentationModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
