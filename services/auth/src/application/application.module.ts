import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { AuthService } from './services/auth.service';
import { AdminAuthService } from './services/admin-auth.service';
import { AdminSystemHealthService } from './services/admin-system-health.service';
import { VaultDeviceRecoveryService } from './services/vault-device-recovery.service';
import { AcceptanceAdminService } from './services/acceptance-admin.service';

@Module({
  imports: [InfrastructureModule],
  providers: [
    AuthService,
    AdminAuthService,
    AdminSystemHealthService,
    VaultDeviceRecoveryService,
    AcceptanceAdminService,
  ],
  exports: [
    AuthService,
    AdminAuthService,
    AdminSystemHealthService,
    VaultDeviceRecoveryService,
    AcceptanceAdminService,
  ],
})
export class ApplicationModule {}
