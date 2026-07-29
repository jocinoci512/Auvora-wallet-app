import { Controller, Get, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NftDashboardService } from '../../application/services/nft-dashboard.service';
import { NftWorkersService } from '../../application/services/nft-workers.service';
import { NFT_PERMISSIONS } from '../../domain/permission-codes';
import { Permissions, Roles } from '../decorators/auth.decorators';
import { successResponse } from '@auvora/nest-common';

@ApiTags('admin-nfts')
@ApiBearerAuth()
@Controller('api/v1/admin/nfts')
export class AdminNftsController {
  constructor(
    @Inject(NftDashboardService) private readonly dashboard: NftDashboardService,
    @Inject(NftWorkersService) private readonly workers: NftWorkersService,
  ) {}

  @Get('providers')
  @Roles('admin', 'super_admin')
  @Permissions(NFT_PERMISSIONS.ADMIN)
  async providers() {
    return successResponse(await this.dashboard.providers());
  }

  @Get('collections')
  @Roles('admin', 'super_admin')
  @Permissions(NFT_PERMISSIONS.ADMIN)
  async collections() {
    return successResponse(await this.dashboard.collections());
  }

  @Get('metadata')
  @Roles('admin', 'super_admin')
  @Permissions(NFT_PERMISSIONS.ADMIN)
  async metadata() {
    return successResponse(await this.dashboard.metadataStatus());
  }

  @Get('workers')
  @Roles('admin', 'super_admin')
  @Permissions(NFT_PERMISSIONS.ADMIN)
  workersHealth() {
    return successResponse(this.workers.status());
  }

  @Get('sync-metrics')
  @Roles('admin', 'super_admin')
  @Permissions(NFT_PERMISSIONS.ADMIN)
  async syncMetrics() {
    return successResponse(await this.dashboard.syncMetrics());
  }
}
