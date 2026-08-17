import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { AuthService } from './services/auth.service';
import { AdminAuthService } from './services/admin-auth.service';

@Module({
  imports: [InfrastructureModule],
  providers: [AuthService, AdminAuthService],
  exports: [AuthService, AdminAuthService],
})
export class ApplicationModule {}
