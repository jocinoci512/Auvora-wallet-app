import { randomUUID } from 'node:crypto';
import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { NotificationCategory, NotificationChannel, NotificationPriority } from '@auvora/database';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  NotificationService,
  type SendNotificationInput,
} from '../../application/services/notification.service';
import { WebhookService } from '../../application/services/webhook.service';
import { successResponse } from '@auvora/nest-common';
import { Public, SkipCsrf } from '../decorators/auth.decorators';
import { InternalApiKeyGuard } from '../guards/internal-api-key.guard';

export class InternalSendNotificationDto {
  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsOptional()
  @IsString()
  templateCode?: string;

  @IsEnum(NotificationCategory)
  category!: NotificationCategory;

  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @IsString()
  @MinLength(1)
  recipient!: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  dedupeKey?: string;

  @IsOptional()
  @IsString()
  correlationId?: string;

  @IsOptional()
  @IsString()
  sourceEventType?: string;

  @IsOptional()
  @IsString()
  sourceEventId?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsDateString()
  delayUntil?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class InternalSendBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InternalSendNotificationDto)
  items!: InternalSendNotificationDto[];
}

export class InternalEventIngestDto {
  @IsString()
  @MinLength(1)
  eventType!: string;

  @IsOptional()
  @IsUUID()
  aggregateId?: string;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  correlationId?: string;
}

const _internalDtoRuntime = {
  InternalSendNotificationDto,
  InternalSendBatchDto,
  InternalEventIngestDto,
};
void _internalDtoRuntime;

function toSendInput(dto: InternalSendNotificationDto): SendNotificationInput {
  return {
    ownerUserId: dto.ownerUserId,
    templateId: dto.templateId,
    templateCode: dto.templateCode,
    category: dto.category,
    channel: dto.channel,
    priority: dto.priority,
    recipient: dto.recipient,
    subject: dto.subject,
    body: dto.body,
    variables: dto.variables,
    dedupeKey: dto.dedupeKey,
    correlationId: dto.correlationId,
    sourceEventType: dto.sourceEventType,
    sourceEventId: dto.sourceEventId,
    scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
    delayUntil: dto.delayUntil ? new Date(dto.delayUntil) : undefined,
    metadata: dto.metadata,
  };
}

@ApiTags('internal-notifications')
@ApiExcludeController()
@Public()
@SkipCsrf()
@UseGuards(InternalApiKeyGuard)
@Controller('api/v1/internal/notifications')
export class InternalNotificationsController {
  constructor(
    @Inject(NotificationService) private readonly notifications: NotificationService,
    @Inject(WebhookService) private readonly webhooks: WebhookService,
  ) {}

  @Post('send')
  async send(@Body() dto: InternalSendNotificationDto) {
    return successResponse(await this.notifications.send(toSendInput(dto)));
  }

  @Post('send-batch')
  async sendBatch(@Body() dto: InternalSendBatchDto) {
    return successResponse(await this.notifications.sendBatch(dto.items.map(toSendInput)));
  }

  /** Fan-out ingestion point for upstream services (auth, wallet, payments, etc.) to trigger webhook delivery. */
  @Post('events')
  async ingestEvent(@Body() dto: InternalEventIngestDto) {
    const correlationId = dto.correlationId ?? randomUUID();
    const endpoints = await this.webhooks.list();
    const deliveries = [];
    for (const endpoint of endpoints) {
      if (!endpoint.isEnabled) continue;
      const delivery = await this.webhooks.deliver(endpoint.id, dto.eventType, {
        eventType: dto.eventType,
        aggregateId: dto.aggregateId,
        payload: dto.payload,
        correlationId,
      });
      if (delivery) deliveries.push(delivery);
    }
    return successResponse({
      eventType: dto.eventType,
      deliveries: deliveries.length,
      correlationId,
    });
  }
}
