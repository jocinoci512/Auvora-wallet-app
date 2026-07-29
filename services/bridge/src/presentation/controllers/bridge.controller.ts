import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { ChainNetwork } from '@auvora/database';
import type { JwtAccessClaims } from '@auvora/types';
import { BridgeEngineService } from '../../application/services/bridge-engine.service';
import { BRIDGE_PERMISSIONS } from '../../domain/permission-codes';
import { Permissions } from '../decorators/auth.decorators';
import { CurrentUser } from '../decorators/current-user.decorator';
import { successResponse } from '@auvora/nest-common';
import {
  type BridgeConfirmDto,
  type BridgePrepareDto,
  type BridgeQuoteDto,
} from '../dto/bridge.dto';

@ApiTags('bridge')
@ApiBearerAuth()
@Controller('api/v1/bridge')
export class BridgeController {
  constructor(@Inject(BridgeEngineService) private readonly engine: BridgeEngineService) {}

  @Get('networks')
  @Permissions(BRIDGE_PERMISSIONS.READ)
  networks() {
    return successResponse(this.engine.listNetworks());
  }

  @Get('routes')
  @Permissions(BRIDGE_PERMISSIONS.READ)
  async routes() {
    return successResponse(await this.engine.listRoutes());
  }

  @Get('assets')
  @Permissions(BRIDGE_PERMISSIONS.READ)
  async assets(@Query('network') network: ChainNetwork) {
    return successResponse(await this.engine.listAssets(network));
  }

  @Post('quote')
  @Permissions(BRIDGE_PERMISSIONS.READ)
  async quote(@CurrentUser() user: JwtAccessClaims, @Body() body: BridgeQuoteDto) {
    return successResponse(await this.engine.quote(user.sub, body));
  }

  @Post('prepare')
  @Permissions(BRIDGE_PERMISSIONS.EXECUTE)
  async prepare(@CurrentUser() user: JwtAccessClaims, @Body() body: BridgePrepareDto) {
    return successResponse(await this.engine.prepare(user.sub, body));
  }

  @Post('confirm')
  @Permissions(BRIDGE_PERMISSIONS.EXECUTE)
  async confirm(@CurrentUser() user: JwtAccessClaims, @Body() body: BridgeConfirmDto) {
    return successResponse(await this.engine.confirm(user.sub, body.transferId, body.confirmed));
  }

  @Post('transfers/:transferId/sync')
  @Permissions(BRIDGE_PERMISSIONS.EXECUTE)
  async sync(@CurrentUser() user: JwtAccessClaims, @Param('transferId') transferId: string) {
    return successResponse(await this.engine.syncStatus(user.sub, transferId));
  }

  @Get('history')
  @Permissions(BRIDGE_PERMISSIONS.READ)
  async history(@CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.engine.history(user.sub));
  }

  @Get('transfers/:transferId')
  @Permissions(BRIDGE_PERMISSIONS.READ)
  async getTransfer(@CurrentUser() user: JwtAccessClaims, @Param('transferId') transferId: string) {
    return successResponse(await this.engine.getTransfer(user.sub, transferId));
  }
}
