import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { WalletService } from './services/wallet.service';

@Module({
  imports: [InfrastructureModule],
  providers: [WalletService],
  exports: [WalletService],
})
export class ApplicationModule {}
