import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import type { ObsHealthStatus, ObsMetricKind, ObsServiceDomain } from '@auvora/database';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { RATE_LIMITER, type RateLimiterPort } from '../../application/ports/clock.port';
import { TelemetryIngestService } from '../../application/services/telemetry-ingest.service';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { RateLimitError } from '../../domain';
import { successResponse } from '../common/api-response';
import { Public, SkipCsrf } from '../decorators/auth.decorators';
import { InternalApiKeyGuard } from '../guards/internal-api-key.guard';

class MetricSampleDto {
  @IsString() code!: string;
  @IsOptional() @IsString() name?: string;
  @IsString() domain!: ObsServiceDomain;
  @IsOptional() @IsString() kind?: ObsMetricKind;
  @IsOptional() @IsString() unit?: string;
  @IsString() serviceName!: string;
  @IsNumber() value!: number;
  @IsOptional() @IsObject() labels?: Record<string, unknown>;
  @IsOptional() @IsString() correlationId?: string;
}

class MetricBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MetricSampleDto)
  samples!: MetricSampleDto[];
}

class SpanDto {
  @IsString() spanId!: string;
  @IsOptional() @IsString() parentSpanId?: string;
  @IsString() serviceName!: string;
  @IsString() operationName!: string;
  @IsOptional() @IsString() statusCode?: string;
  @IsOptional() @IsNumber() durationMs?: number;
  @IsString() startedAt!: string;
  @IsOptional() @IsString() endedAt?: string;
  @IsOptional() @IsObject() attributes?: Record<string, unknown>;
}

class TraceDto {
  @IsString() @MinLength(8) traceId!: string;
  @IsOptional() @IsString() rootService?: string;
  @IsOptional() @IsString() rootOperation?: string;
  @IsOptional() @IsString() correlationId?: string;
  @IsOptional() @IsString() statusCode?: string;
  @IsOptional() @IsNumber() durationMs?: number;
  @IsString() startedAt!: string;
  @IsOptional() @IsString() endedAt?: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpanDto)
  spans!: SpanDto[];
}

class LogDto {
  @IsString() serviceName!: string;
  @IsOptional() @IsString() domain?: ObsServiceDomain;
  @IsString() level!: string;
  @IsString() message!: string;
  @IsOptional() @IsObject() payload?: Record<string, unknown>;
  @IsOptional() @IsString() correlationId?: string;
  @IsOptional() @IsString() traceId?: string;
  @IsOptional() @IsString() spanId?: string;
}

class HealthDto {
  @IsString() serviceName!: string;
  @IsString() checkName!: string;
  @IsString() status!: ObsHealthStatus;
  @IsOptional() @IsNumber() latencyMs?: number;
  @IsOptional() @IsObject() details?: Record<string, unknown>;
}

class CapacityDto {
  @IsString() serviceName!: string;
  @IsOptional() @IsString() domain?: ObsServiceDomain;
  @IsOptional() @IsNumber() cpuPercent?: number;
  @IsOptional() @IsNumber() memoryPercent?: number;
  @IsOptional() @IsNumber() diskPercent?: number;
  @IsOptional() @IsNumber() networkMbps?: number;
  @IsOptional() @IsNumber() dbGrowthMb?: number;
  @IsOptional() @IsNumber() storageGrowthMb?: number;
  @IsOptional() @IsNumber() txThroughput?: number;
  @IsOptional() @IsNumber() queueDepth?: number;
  @IsOptional() @IsNumber() forecastLoad?: number;
}

const _dtoRuntime = { MetricSampleDto, MetricBatchDto, TraceDto, LogDto, HealthDto, CapacityDto };
void _dtoRuntime;

@ApiTags('internal-observability')
@ApiExcludeController()
@Public()
@SkipCsrf()
@UseGuards(InternalApiKeyGuard)
@Controller('api/v1/internal/observability')
export class InternalObservabilityController {
  constructor(
    @Inject(TelemetryIngestService) private readonly ingest: TelemetryIngestService,
    @Inject(RATE_LIMITER) private readonly rateLimiter: RateLimiterPort,
    @Inject(ENV) private readonly env: ServiceEnv,
  ) {}

  private async enforceRateLimit(key: string): Promise<void> {
    const result = await this.rateLimiter.consume(
      key,
      this.env.OBSERVABILITY_RATE_LIMIT_MAX,
      this.env.OBSERVABILITY_RATE_LIMIT_WINDOW_SECONDS,
    );
    if (!result.allowed) {
      throw new RateLimitError();
    }
  }

  @Post('metrics')
  async metrics(@Body() dto: MetricBatchDto) {
    await this.enforceRateLimit('internal:obs:metrics');
    return successResponse(await this.ingest.ingestMetrics(dto.samples));
  }

  @Post('traces')
  async traces(@Body() dto: TraceDto) {
    await this.enforceRateLimit('internal:obs:traces');
    return successResponse(
      await this.ingest.ingestTrace({
        ...dto,
        startedAt: new Date(dto.startedAt),
        endedAt: dto.endedAt ? new Date(dto.endedAt) : undefined,
        spans: dto.spans.map((span) => ({
          ...span,
          startedAt: new Date(span.startedAt),
          endedAt: span.endedAt ? new Date(span.endedAt) : undefined,
        })),
      }),
    );
  }

  @Post('logs')
  async logs(@Body() dto: LogDto) {
    await this.enforceRateLimit('internal:obs:logs');
    return successResponse(await this.ingest.ingestLog(dto));
  }

  @Post('health')
  async health(@Body() dto: HealthDto) {
    await this.enforceRateLimit('internal:obs:health');
    return successResponse(await this.ingest.ingestHealth(dto));
  }

  @Post('capacity')
  async capacity(@Body() dto: CapacityDto) {
    await this.enforceRateLimit('internal:obs:capacity');
    return successResponse(await this.ingest.ingestCapacity(dto));
  }
}
