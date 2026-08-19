import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { AuthService } from './services/auth.service';
import { AdminAuthService } from './services/admin-auth.service';
import { AdminSystemHealthService } from './services/admin-system-health.service';

@Module({
  imports: [InfrastructureModule],
  providers: [AuthService, AdminAuthService, AdminSystemHealthService],
  exports: [AuthService, AdminAuthService, AdminSystemHealthService],
})
export class ApplicationModule {}
