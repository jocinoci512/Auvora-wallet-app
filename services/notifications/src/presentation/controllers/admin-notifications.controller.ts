import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  NotificationCategory,
  NotificationChannel,
  NotificationPriority,
  TemplateFormat,
  type NotificationStatus,
  type WebhookDeliveryStatus,
} from '@auvora/database';
import type { JwtAccessClaims } from '@auvora/types';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { BroadcastService } from '../../application/services/broadcast.service';
import { DashboardService } from '../../application/services/dashboard.service';
import { QueueService } from '../../application/services/queue.service';
import { TemplateService } from '../../application/services/template.service';
import { WebhookService } from '../../application/services/webhook.service';
import {
  PERMISSION_NOTIFICATION_ADMIN,
  PERMISSION_NOTIFICATION_BROADCAST,
  PERMISSION_NOTIFICATION_TEMPLATES,
  PERMISSION_NOTIFICATION_WEBHOOKS,
  ROLE_ADMIN,
  ROLE_SUPER_ADMIN,
} from '../../domain';
import { successResponse } from '../common/api-response';
import { Permissions, Roles } from '../decorators/auth.decorators';
import { CurrentUser } from '../decorators/current-user.decorator';

export class PageQueryDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  take?: number;
}

export class CreateTemplateDto {
  @IsString()
  @MinLength(2)
  code!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(NotificationCategory)
  category!: NotificationCategory;

  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @IsOptional()
  @IsEnum(TemplateFormat)
  format?: TemplateFormat;

  @IsOptional()
  @IsString()
  locale?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;
}

export class PreviewTemplateDto {
  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;
}

export class BroadcastDto {
  @IsEnum(NotificationCategory)
  category!: NotificationCategory;

  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsArray()
  roles?: string[];

  @IsOptional()
  @IsArray()
  userIds?: string[];

  @IsOptional()
  @IsBoolean()
  all?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class DeadLetterDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

const _adminDtoRuntime = {
  PageQueryDto,
  CreateTemplateDto,
  UpdateTemplateDto,
  PreviewTemplateDto,
  BroadcastDto,
  DeadLetterDto,
};
void _adminDtoRuntime;

@ApiTags('admin-notifications')
@ApiBearerAuth()
@Roles(ROLE_ADMIN, ROLE_SUPER_ADMIN)
@Controller('api/v1/admin/notifications')
export class AdminNotificationsController {
  constructor(
    @Inject(DashboardService) private readonly dashboard: DashboardService,
    @Inject(TemplateService) private readonly templates: TemplateService,
    @Inject(QueueService) private readonly queue: QueueService,
    @Inject(WebhookService) private readonly webhooks: WebhookService,
    @Inject(BroadcastService) private readonly broadcast: BroadcastService,
  ) {}

  @Get('dashboard')
  @Permissions(PERMISSION_NOTIFICATION_ADMIN)
  async dashboardMetrics() {
    return successResponse(await this.dashboard.metrics());
  }

  @Get('providers')
  @Permissions(PERMISSION_NOTIFICATION_ADMIN)
  async providers() {
    return successResponse(await this.dashboard.listProviders());
  }

  @Post('providers/:id/enable')
  @Permissions(PERMISSION_NOTIFICATION_ADMIN)
  async enableProvider(@Param('id') id: string) {
    return successResponse(await this.dashboard.setProviderEnabled(id, true));
  }

  @Post('providers/:id/disable')
  @Permissions(PERMISSION_NOTIFICATION_ADMIN)
  async disableProvider(@Param('id') id: string) {
    return successResponse(await this.dashboard.setProviderEnabled(id, false));
  }

  @Post('providers/refresh-health')
  @Permissions(PERMISSION_NOTIFICATION_ADMIN)
  async refreshProviderHealth() {
    return successResponse(await this.dashboard.refreshHealth());
  }

  @Get('audit')
  @Permissions(PERMISSION_NOTIFICATION_ADMIN)
  async audit(@Query() query: PageQueryDto) {
    return successResponse(await this.dashboard.auditTrail(query.skip, query.take));
  }

  @Get('templates')
  @Permissions(PERMISSION_NOTIFICATION_TEMPLATES)
  async listTemplates(@Query() query: PageQueryDto) {
    return successResponse(await this.templates.list(query));
  }

  @Post('templates')
  @Permissions(PERMISSION_NOTIFICATION_TEMPLATES)
  async createTemplate(@Body() dto: CreateTemplateDto) {
    return successResponse(await this.templates.create(dto));
  }

  @Get('templates/:id')
  @Permissions(PERMISSION_NOTIFICATION_TEMPLATES)
  async getTemplate(@Param('id') id: string) {
    return successResponse(await this.templates.get(id));
  }

  @Patch('templates/:id')
  @Permissions(PERMISSION_NOTIFICATION_TEMPLATES)
  async updateTemplate(@Param('id') id: string, @Body() dto: UpdateTemplateDto, @CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.templates.update(id, { ...dto, createdBy: user.sub }));
  }

  @Get('templates/:id/versions')
  @Permissions(PERMISSION_NOTIFICATION_TEMPLATES)
  async templateVersions(@Param('id') id: string) {
    return successResponse(await this.templates.listVersions(id));
  }

  @Post('templates/:id/preview')
  @Permissions(PERMISSION_NOTIFICATION_TEMPLATES)
  async previewTemplate(@Param('id') id: string, @Body() dto: PreviewTemplateDto) {
    return successResponse(await this.templates.preview(id, dto.variables ?? {}));
  }

  @Post('templates/:id/enable')
  @Permissions(PERMISSION_NOTIFICATION_TEMPLATES)
  async enableTemplate(@Param('id') id: string) {
    return successResponse(await this.templates.setEnabled(id, true));
  }

  @Post('templates/:id/disable')
  @Permissions(PERMISSION_NOTIFICATION_TEMPLATES)
  async disableTemplate(@Param('id') id: string) {
    return successResponse(await this.templates.setEnabled(id, false));
  }

  @Get('queue')
  @Permissions(PERMISSION_NOTIFICATION_ADMIN)
  async listQueue(@Query('status') status: NotificationStatus | undefined, @Query() query: PageQueryDto) {
    return successResponse(await this.queue.listQueue({ status, ...query }));
  }

  @Get('failed')
  @Permissions(PERMISSION_NOTIFICATION_ADMIN)
  async listDeadLetter(@Query() query: PageQueryDto) {
    return successResponse(await this.queue.listDeadLetter(query.skip, query.take));
  }

  @Post('queue/:id/requeue')
  @Permissions(PERMISSION_NOTIFICATION_ADMIN)
  async requeue(@Param('id') id: string) {
    return successResponse(await this.queue.requeue(id));
  }

  @Post('queue/:id/dead-letter')
  @Permissions(PERMISSION_NOTIFICATION_ADMIN)
  async deadLetter(@Param('id') id: string, @Body() dto: DeadLetterDto) {
    return successResponse(await this.queue.deadLetter(id, dto.reason));
  }

  @Get('queue/metrics')
  @Permissions(PERMISSION_NOTIFICATION_ADMIN)
  async queueMetrics() {
    return successResponse(await this.queue.metrics());
  }

  @Post('broadcast')
  @Permissions(PERMISSION_NOTIFICATION_BROADCAST)
  async createBroadcast(@CurrentUser() user: JwtAccessClaims, @Body() dto: BroadcastDto) {
    return successResponse(await this.broadcast.broadcast(user.sub, dto));
  }

  @Get('webhooks')
  @Permissions(PERMISSION_NOTIFICATION_WEBHOOKS)
  async listAllWebhooks() {
    return successResponse(await this.webhooks.list());
  }

  @Get('webhooks/:id/deliveries')
  @Permissions(PERMISSION_NOTIFICATION_WEBHOOKS)
  async listWebhookDeliveries(@Param('id') id: string, @Query() query: PageQueryDto) {
    return successResponse(await this.webhooks.listDeliveries(id, query));
  }

  @Post('webhooks/deliveries/:deliveryId/retry')
  @Permissions(PERMISSION_NOTIFICATION_WEBHOOKS)
  async retryWebhookDelivery(@Param('deliveryId') deliveryId: string) {
    return successResponse(await this.webhooks.retry(deliveryId));
  }

  @Post('webhooks/deliveries/:deliveryId/replay')
  @Permissions(PERMISSION_NOTIFICATION_WEBHOOKS)
  async replayWebhookDelivery(@Param('deliveryId') deliveryId: string) {
    return successResponse(await this.webhooks.replay(deliveryId));
  }

  @Get('webhooks/logs')
  @Permissions(PERMISSION_NOTIFICATION_WEBHOOKS)
  async webhookLogs(@Query('status') status: WebhookDeliveryStatus | undefined, @Query() query: PageQueryDto) {
    return successResponse(await this.webhooks.listLogs({ status, ...query }));
  }
}
