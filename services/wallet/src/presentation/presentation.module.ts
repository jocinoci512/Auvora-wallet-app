import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { ApplicationModule } from '../application/application.module';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { AdminWalletsController } from './controllers/admin-wallets.controller';
import { WalletsController } from './controllers/wallets.controller';
import { DomainExceptionFilter } from './filters/domain-exception.filter';
import { CsrfGuard } from './guards/csrf.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtStrategy } from './guards/jwt.strategy';
import { PermissionsGuard } from './guards/permissions.guard';
import { RolesGuard } from './guards/roles.guard';
import { HealthController } from './http/health.controller';

@Module({
  imports: [InfrastructureModule, ApplicationModule, PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [HealthController, WalletsController, AdminWalletsController],
  providers: [
    JwtStrategy,
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class PresentationModule {}
