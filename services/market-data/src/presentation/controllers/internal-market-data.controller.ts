import { Body, Controller, Get, Inject, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsArray, IsIn, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MarketDataEngineService } from '../../application/services/market-data-engine.service';
import {
  PortfolioIntelligenceService,
  type HoldingInput,
} from '../../application/services/portfolio-intelligence.service';
import type { SupportedMarketNetwork } from '../../domain/market-provider.port';
import { successResponse } from '@auvora/nest-common';
import { Public, SkipCsrf } from '../decorators/auth.decorators';
import { InternalApiKeyGuard } from '../guards/internal-api-key.guard';

class QuoteItemDto {
  @IsString()
  @MinLength(1)
  symbol!: string;

  @IsString()
  @IsIn(['ETHEREUM', 'BNB_SMART_CHAIN', 'SOLANA', 'TRON', 'BITCOIN'])
  network!: SupportedMarketNetwork;
}

class QuotesBodyDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items!: QuoteItemDto[];
}

class ValuationBodyDto {
  @IsString()
  @MinLength(1)
  ownerUserId!: string;

  @IsArray()
  holdings!: HoldingInput[];
}

@ApiTags('internal-market-data')
@Controller('api/v1/internal/market-data')
@Public()
@SkipCsrf()
@UseGuards(InternalApiKeyGuard)
export class InternalMarketDataController {
  constructor(
    @Inject(MarketDataEngineService) private readonly engine: MarketDataEngineService,
    @Inject(PortfolioIntelligenceService)
    private readonly portfolio: PortfolioIntelligenceService,
  ) {}

  @Get('quotes')
  async quotes(
    @Query('symbol') symbol?: string,
    @Query('network') network?: SupportedMarketNetwork,
  ) {
    if (symbol && network) {
      return successResponse(await this.engine.getQuote(symbol, network));
    }
    return successResponse(await this.engine.getMarketOverview());
  }

  @Post('quotes')
  async quotesBatch(@Body() body: QuotesBodyDto) {
    return successResponse(await this.engine.getQuotes(body.items ?? []));
  }

  @Post('valuation')
  async valuation(@Body() body: ValuationBodyDto) {
    return successResponse(
      await this.portfolio.valueHoldings(body.ownerUserId, body.holdings ?? []),
    );
  }

  @Get('observability')
  observability() {
    return successResponse(this.engine.getObservabilitySnapshot());
  }
}
