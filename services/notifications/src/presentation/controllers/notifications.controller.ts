import { Body, Controller, Get, Inject, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { JwtAccessClaims } from '@auvora/types';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { NotificationService } from '../../application/services/notification.service';
import { PreferenceService } from '../../application/services/preference.service';
import { WebhookService } from '../../application/services/webhook.service';
import {
  PERMISSION_NOTIFICATION_READ,
  PERMISSION_NOTIFICATION_WEBHOOKS,
  PERMISSION_NOTIFICATION_WRITE,
} from '../../domain';
import { successResponse } from '@auvora/nest-common';
import { Permissions } from '../decorators/auth.decorators';
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

export class UpsertPreferenceDto {
  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  timeZone?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  quietHoursStart?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  quietHoursEnd?: number;

  @IsOptional()
  @IsBoolean()
  digestEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  digestHour?: number;

  @IsOptional()
  @IsObject()
  channelToggles?: Record<string, boolean>;

  @IsOptional()
  @IsObject()
  categoryToggles?: Record<string, boolean>;

  @IsOptional()
  @IsObject()
  frequencyLimits?: Record<string, unknown>;
}

export class RegisterWebhookDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(4)
  url!: string;

  @IsOptional()
  @IsArray()
  eventFilters?: string[];
}

const _dtoRuntime = { PageQueryDto, UpsertPreferenceDto, RegisterWebhookDto };
void _dtoRuntime;

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('api/v1/notifications')
export class NotificationsController {
  constructor(
    @Inject(NotificationService) private readonly notifications: NotificationService,
    @Inject(PreferenceService) private readonly preferences: PreferenceService,
    @Inject(WebhookService) private readonly webhooks: WebhookService,
  ) {}

  @Get()
  @Permissions(PERMISSION_NOTIFICATION_READ)
  async listInbox(@CurrentUser() user: JwtAccessClaims, @Query() query: PageQueryDto) {
    return successResponse(await this.notifications.listInbox(user.sub, query));
  }

  @Get('preferences')
  @Permissions(PERMISSION_NOTIFICATION_READ)
  async getPreferences(@CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.preferences.get(user.sub));
  }

  @Put('preferences')
  @Permissions(PERMISSION_NOTIFICATION_WRITE)
  async updatePreferences(@CurrentUser() user: JwtAccessClaims, @Body() dto: UpsertPreferenceDto) {
    return successResponse(await this.preferences.upsert(user.sub, dto));
  }

  @Get('webhooks')
  @Permissions(PERMISSION_NOTIFICATION_WEBHOOKS)
  async listOwnWebhooks(@CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.webhooks.list(user.sub));
  }

  @Post('webhooks')
  @Permissions(PERMISSION_NOTIFICATION_WEBHOOKS)
  async registerOwnWebhook(@CurrentUser() user: JwtAccessClaims, @Body() dto: RegisterWebhookDto) {
    return successResponse(await this.webhooks.register({ ownerUserId: user.sub, ...dto }));
  }

  @Get(':id')
  @Permissions(PERMISSION_NOTIFICATION_READ)
  async getOne(@Param('id') id: string) {
    return successResponse(await this.notifications.get(id));
  }

  @Post(':id/read')
  @Permissions(PERMISSION_NOTIFICATION_WRITE)
  async markRead(@Param('id') id: string, @CurrentUser() user: JwtAccessClaims) {
    return successResponse(await this.notifications.markRead(id, user));
  }
}
