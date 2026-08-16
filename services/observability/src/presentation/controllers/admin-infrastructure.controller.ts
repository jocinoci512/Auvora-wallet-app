import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { InfraEnvironmentCode } from '@auvora/database';
import type { JwtAccessClaims } from '@auvora/types';
import { IsBoolean, IsNumber, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { InfrastructureService } from '../../application/services/infrastructure.service';
import {
  PERMISSION_INFRASTRUCTURE_ADMIN,
  PERMISSION_INFRASTRUCTURE_BACKUP,
  PERMISSION_INFRASTRUCTURE_DEPLOY,
  PERMISSION_INFRASTRUCTURE_READ,
  ADMIN_PORTAL_ROLES,
} from '../../domain';
import { successResponse } from '@auvora/nest-common';
import { Permissions, Roles } from '../decorators/auth.decorators';
import { CurrentUser } from '../decorators/current-user.decorator';

class CreateDeploymentDto {
  @IsString() environmentCode!: InfraEnvironmentCode;
  @IsString() @MinLength(1) version!: string;
  @IsString() strategy!: 'BLUE_GREEN' | 'CANARY' | 'ROLLING';
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

class RecordBackupDto {
  @IsString() environmentCode!: InfraEnvironmentCode;
  @IsString() componentKind!: 'SERVICE' | 'DATABASE' | 'REDIS' | 'STORAGE' | 'CLUSTER' | 'INGRESS';
  @IsString() @MinLength(1) componentName!: string;
  @IsOptional() @IsString() status?: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'VERIFIED';
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() checksum?: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

class StartRecoveryDrillDto {
  @IsString() environmentCode!: InfraEnvironmentCode;
  @IsString() @MinLength(2) name!: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsNumber() rtoMinutes?: number;
  @IsOptional() @IsNumber() rpoMinutes?: number;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

class UpdateFeatureFlagDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

const _infraDtoRuntime = {
  CreateDeploymentDto,
  RecordBackupDto,
  StartRecoveryDrillDto,
  UpdateFeatureFlagDto,
};
void _infraDtoRuntime;

@ApiTags('admin-infrastructure')
@ApiBearerAuth()
@Roles(...ADMIN_PORTAL_ROLES)
@Controller('api/v1/admin/infrastructure')
export class AdminInfrastructureController {
  constructor(
    @Inject(InfrastructureService) private readonly infrastructure: InfrastructureService,
  ) {}

  @Get('dashboard')
  @Permissions(PERMISSION_INFRASTRUCTURE_READ)
  async dashboard() {
    return successResponse(await this.infrastructure.dashboardSummary());
  }

  @Get('cluster-health')
  @Permissions(PERMISSION_INFRASTRUCTURE_READ)
  async clusterHealth() {
    return successResponse(await this.infrastructure.clusterHealth());
  }

  @Get('environments')
  @Permissions(PERMISSION_INFRASTRUCTURE_READ)
  async environments() {
    return successResponse(await this.infrastructure.listEnvironments());
  }

  @Get('deployments')
  @Permissions(PERMISSION_INFRASTRUCTURE_READ)
  async deployments(@Query('environmentCode') environmentCode?: InfraEnvironmentCode) {
    return successResponse(await this.infrastructure.listDeployments(environmentCode));
  }

  @Get('backups')
  @Permissions(PERMISSION_INFRASTRUCTURE_READ)
  async backups(@Query('environmentCode') environmentCode?: InfraEnvironmentCode) {
    return successResponse(await this.infrastructure.listBackups(environmentCode));
  }

  @Get('recovery')
  @Permissions(PERMISSION_INFRASTRUCTURE_READ)
  async recovery(@Query('environmentCode') environmentCode?: InfraEnvironmentCode) {
    return successResponse(await this.infrastructure.listRecoveryDrills(environmentCode));
  }

  @Get('feature-flags')
  @Permissions(PERMISSION_INFRASTRUCTURE_READ)
  async featureFlags(@Query('environmentCode') environmentCode?: InfraEnvironmentCode) {
    return successResponse(await this.infrastructure.listFeatureFlags(environmentCode));
  }

  @Post('deployments')
  @Permissions(PERMISSION_INFRASTRUCTURE_DEPLOY)
  async createDeployment(@Body() dto: CreateDeploymentDto, @CurrentUser() user: JwtAccessClaims) {
    return successResponse(
      await this.infrastructure.createDeployment({
        ...dto,
        actorUserId: user.sub,
      }),
    );
  }

  @Post('backups')
  @Permissions(PERMISSION_INFRASTRUCTURE_BACKUP)
  async recordBackup(@Body() dto: RecordBackupDto, @CurrentUser() user: JwtAccessClaims) {
    return successResponse(
      await this.infrastructure.recordBackup({
        ...dto,
        actorUserId: user.sub,
      }),
    );
  }

  @Post('recovery-drills')
  @Permissions(PERMISSION_INFRASTRUCTURE_ADMIN)
  async startRecoveryDrill(
    @Body() dto: StartRecoveryDrillDto,
    @CurrentUser() user: JwtAccessClaims,
  ) {
    return successResponse(
      await this.infrastructure.startRecoveryDrill({
        ...dto,
        actorUserId: user.sub,
      }),
    );
  }

  @Patch('feature-flags/:code')
  @Permissions(PERMISSION_INFRASTRUCTURE_ADMIN)
  async updateFeatureFlag(
    @Param('code') code: string,
    @Body() dto: UpdateFeatureFlagDto,
    @CurrentUser() user: JwtAccessClaims,
  ) {
    return successResponse(
      await this.infrastructure.updateFeatureFlag(code, {
        ...dto,
        actorUserId: user.sub,
      }),
    );
  }
}
