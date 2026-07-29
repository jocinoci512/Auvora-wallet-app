import { Body, Controller, Delete, Get, Inject, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { JwtAccessClaims } from '@auvora/types';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { PriceAlertService } from '../../application/services/price-alert.service';
import {
  PERMISSION_MARKET_DATA_ALERTS,
  PERMISSION_MARKET_DATA_READ,
} from '../../domain/permission-codes';
import { successResponse } from '@auvora/nest-common';
import { Permissions } from '../decorators/auth.decorators';
import { CurrentUser } from '../decorators/current-user.decorator';

class CreateAlertDto {
  @IsOptional()
  @IsString()
  metadataId?: string;

  @IsOptional()
  @IsString()
  symbol?: string;

  @IsOptional()
  @IsString()
  network?: string;

  @IsString()
  @MinLength(3)
  condition!: string;

  @IsString()
  @MinLength(1)
  threshold!: string;

  @IsOptional()
  @IsString()
  quoteCurrency?: string;

  @IsOptional()
  @IsInt()
  @Min(60)
  cooldownSeconds?: number;
}

@ApiTags('market-data-alerts')
@ApiBearerAuth()
@Controller('api/v1/market-data/alerts')
export class PriceAlertController {
  constructor(@Inject(PriceAlertService) private readonly alerts: PriceAlertService) {}

  @Get()
  @Permissions(PERMISSION_MARKET_DATA_READ, PERMISSION_MARKET_DATA_ALERTS)
  async list(@CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.alerts.list(user.sub));
  }

  @Post()
  @Permissions(PERMISSION_MARKET_DATA_ALERTS)
  async create(@CurrentUser() user: JwtAccessClaims, @Body() body: CreateAlertDto) {
    return successResponse(await this.alerts.create(user.sub, body));
  }

  @Delete(':alertId')
  @Permissions(PERMISSION_MARKET_DATA_ALERTS)
  async cancel(@CurrentUser() user: JwtAccessClaims, @Param('alertId') alertId: string) {
    return successResponse(await this.alerts.cancel(user.sub, alertId));
  }
}
