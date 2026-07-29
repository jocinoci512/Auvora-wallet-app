import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type ChainNetwork } from '@auvora/database';
import type { JwtAccessClaims } from '@auvora/types';
import { SwapEngineService } from '../../application/services/swap-engine.service';
import { Permissions } from '../decorators/auth.decorators';
import { CurrentUser } from '../decorators/current-user.decorator';
import { successResponse } from '@auvora/nest-common';
import { type ExecuteSwapDto, type PrepareSwapDto, type SwapQuoteDto } from '../dto/swap.dto';
import { SWAP_PERMISSIONS } from '../../domain/permission-codes';

@ApiTags('swaps')
@ApiBearerAuth()
@Controller('api/v1/swaps')
export class SwapsController {
  constructor(@Inject(SwapEngineService) private readonly engine: SwapEngineService) {}

  @Get('networks')
  @Permissions(SWAP_PERMISSIONS.READ)
  networks() {
    return successResponse(this.engine.listNetworks());
  }

  @Get('assets')
  @Permissions(SWAP_PERMISSIONS.READ)
  async assets(@Query('network') network: ChainNetwork) {
    return successResponse(await this.engine.listAssets(network));
  }

  @Post('quote')
  @Permissions(SWAP_PERMISSIONS.READ)
  async quote(@CurrentUser() user: JwtAccessClaims, @Body() body: SwapQuoteDto) {
    return successResponse(await this.engine.quote(user.sub, body));
  }

  @Post('routes')
  @Permissions(SWAP_PERMISSIONS.READ)
  async routes(@CurrentUser() user: JwtAccessClaims, @Body() body: SwapQuoteDto) {
    return successResponse(await this.engine.routes(user.sub, body));
  }

  @Post('prepare')
  @Permissions(SWAP_PERMISSIONS.EXECUTE)
  async prepare(@CurrentUser() user: JwtAccessClaims, @Body() body: PrepareSwapDto) {
    return successResponse(await this.engine.prepare(user.sub, body));
  }

  @Post('execute')
  @Permissions(SWAP_PERMISSIONS.EXECUTE)
  async execute(@CurrentUser() user: JwtAccessClaims, @Body() body: ExecuteSwapDto) {
    return successResponse(await this.engine.execute(user.sub, body));
  }

  @Get('executions/:id')
  @Permissions(SWAP_PERMISSIONS.READ)
  async status(@Param('id') id: string) {
    return successResponse(await this.engine.monitor(id));
  }

  @Get('history')
  @Permissions(SWAP_PERMISSIONS.READ)
  async history(@CurrentUser() user: JwtAccessClaims, @Query('limit') limit?: string) {
    return successResponse(await this.engine.history(user.sub, limit ? Number(limit) : 50));
  }

  @Get('receipts/:executionId')
  @Permissions(SWAP_PERMISSIONS.READ)
  async receipt(@CurrentUser() user: JwtAccessClaims, @Param('executionId') executionId: string) {
    return successResponse(await this.engine.receipt(user.sub, executionId));
  }
}
