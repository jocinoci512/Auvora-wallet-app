import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { NftDashboardService } from './services/nft-dashboard.service';
import { NftEngineService } from './services/nft-engine.service';
import { NftWorkersService } from './services/nft-workers.service';

@Module({
  imports: [InfrastructureModule],
  providers: [NftEngineService, NftDashboardService, NftWorkersService],
  exports: [NftEngineService, NftDashboardService, NftWorkersService],
})
export class ApplicationModule {}
