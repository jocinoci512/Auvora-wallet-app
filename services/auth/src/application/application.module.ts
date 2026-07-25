import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { AuthService } from './services/auth.service';

@Module({
  imports: [InfrastructureModule],
  providers: [AuthService],
  exports: [AuthService],
})
export class ApplicationModule {}
