import { Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SwapEngineService } from '../../application/services/swap-engine.service';
import { Public, SkipCsrf } from '../decorators/auth.decorators';
import { InternalApiKeyGuard } from '../guards/internal-api-key.guard';
import { successResponse } from '@auvora/nest-common';
import { type SwapQuoteDto } from '../dto/swap.dto';

@ApiTags('internal-swaps')
@Controller('api/v1/internal/swaps')
@Public()
@SkipCsrf()
@UseGuards(InternalApiKeyGuard)
export class InternalSwapsController {
  constructor(@Inject(SwapEngineService) private readonly engine: SwapEngineService) {}

  @Post('quote')
  async quote(@Body() body: SwapQuoteDto & { userId: string }) {
    return successResponse(await this.engine.quote(body.userId, body));
  }

  @Get('executions/:id')
  async status(@Param('id') id: string) {
    return successResponse(await this.engine.monitor(id));
  }
}
