import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import type { AnalyticsDomain } from '@auvora/database';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { RATE_LIMITER, type RateLimiterPort } from '../../application/ports/clock.port';
import { AggregationService } from '../../application/services/aggregation.service';
import { EventIngestService } from '../../application/services/event-ingest.service';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { RateLimitError } from '../../domain';
import { successResponse } from '../common/api-response';
import { Public, SkipCsrf } from '../decorators/auth.decorators';
import { CorrelationId } from '../decorators/current-user.decorator';
import { InternalApiKeyGuard } from '../guards/internal-api-key.guard';

export class InternalIngestEventDto {
  @IsString()
  @MinLength(1)
  eventType!: string;

  @IsString()
  domain!: AnalyticsDomain;

  @IsOptional()
  @IsString()
  aggregateId?: string;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metrics?: Record<string, number>;

  @IsOptional()
  @IsString()
  correlationId?: string;

  @IsOptional()
  @IsString()
  sourceService?: string;
}

export class InternalBatchIngestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InternalIngestEventDto)
  events!: InternalIngestEventDto[];
}

export class InternalRunAggregationDto {
  @IsOptional()
  @IsString()
  window?: string;

  @IsOptional()
  @IsString()
  domain?: AnalyticsDomain;

  @IsOptional()
  limit?: number;
}

const _internalDtoRuntime = { InternalIngestEventDto, InternalBatchIngestDto, InternalRunAggregationDto };
void _internalDtoRuntime;

@ApiTags('internal-analytics')
@ApiExcludeController()
@Public()
@SkipCsrf()
@UseGuards(InternalApiKeyGuard)
@Controller('api/v1/internal/analytics')
export class InternalAnalyticsController {
  constructor(
    @Inject(EventIngestService) private readonly ingest: EventIngestService,
    @Inject(AggregationService) private readonly aggregation: AggregationService,
    @Inject(RATE_LIMITER) private readonly rateLimiter: RateLimiterPort,
    @Inject(ENV) private readonly env: ServiceEnv,
  ) {}

  private async enforceRateLimit(key: string): Promise<void> {
    const result = await this.rateLimiter.consume(
      key,
      this.env.ANALYTICS_RATE_LIMIT_MAX,
      this.env.ANALYTICS_RATE_LIMIT_WINDOW_SECONDS,
    );
    if (!result.allowed) {
      throw new RateLimitError();
    }
  }

  @Post('events')
  async ingestEvent(@Body() dto: InternalIngestEventDto, @CorrelationId() correlationId?: string) {
    await this.enforceRateLimit('internal:analytics:events');
    return successResponse(
      await this.ingest.ingest({
        ...dto,
        correlationId: dto.correlationId ?? correlationId,
      }),
    );
  }

  @Post('events/batch')
  async ingestBatch(@Body() dto: InternalBatchIngestDto, @CorrelationId() correlationId?: string) {
    await this.enforceRateLimit('internal:analytics:events:batch');
    const events = dto.events.map((event) => ({
      ...event,
      correlationId: event.correlationId ?? correlationId,
    }));
    return successResponse(await this.ingest.ingestBatch(events));
  }

  @Post('aggregate/run')
  async runAggregation(@Body() dto: InternalRunAggregationDto) {
    await this.enforceRateLimit('internal:analytics:aggregate');
    return successResponse(
      await this.aggregation.run({
        window: dto.window as never,
        domain: dto.domain,
        limit: dto.limit,
      }),
    );
  }
}
