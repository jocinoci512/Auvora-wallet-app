import { Body, Controller, Get, Inject, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';
import type { Request } from 'express';
import { Public, SkipCsrf } from '../decorators/auth.decorators';
import { CurrentUser, extractRequestContext } from '../decorators/current-user.decorator';
import type { JwtAccessClaims } from '@auvora/types';
import { successResponse } from '@auvora/nest-common';
import { VaultDeviceRecoveryService } from '../../application/services/vault-device-recovery.service';

class CreateVaultRecoveryDto {
  @IsString()
  @MinLength(20)
  resetToken!: string;

  @IsString()
  @MinLength(8)
  requestingDeviceFingerprint!: string;

  @IsOptional()
  @IsString()
  requestingPlatform?: string;

  @IsString()
  @MinLength(32)
  requestingPublicKey!: string;
}

class ApproveVaultRecoveryDto {
  @IsString()
  @MinLength(16)
  ciphertext!: string;

  @IsString()
  @MinLength(8)
  nonce!: string;

  @IsString()
  @MinLength(16)
  ephemeralPublicKey!: string;

  @IsString()
  @MinLength(8)
  aad!: string;

  @IsOptional()
  @IsUUID()
  approvingDeviceId?: string;
}

class CollectVaultRecoveryDto {
  @IsString()
  @MinLength(20)
  resetToken!: string;

  @IsString()
  @MinLength(8)
  requestingDeviceFingerprint!: string;
}

class CompleteVaultRecoveryDto {
  @IsString()
  @MinLength(20)
  resetToken!: string;

  @IsUUID()
  requestId!: string;

  @IsString()
  @MinLength(12)
  newPassword!: string;

  @IsInt()
  @Min(1)
  expectedVaultEpoch!: number;
}

class RequestIdParamDto {
  @IsUUID()
  id!: string;
}

const _dtoRuntime = {
  CreateVaultRecoveryDto,
  ApproveVaultRecoveryDto,
  CollectVaultRecoveryDto,
  CompleteVaultRecoveryDto,
  RequestIdParamDto,
};
void _dtoRuntime;

@ApiTags('vault-recovery')
@Controller('api/v1/me/vault-recovery')
export class VaultRecoveryController {
  constructor(
    @Inject(VaultDeviceRecoveryService) private readonly recovery: VaultDeviceRecoveryService,
  ) {}

  @Public()
  @SkipCsrf()
  @Post('requests')
  async create(
    @Body() dto: CreateVaultRecoveryDto,
    @Req() req: Request,
  ): Promise<ReturnType<typeof successResponse>> {
    const data = await this.recovery.createRequest({
      resetToken: dto.resetToken,
      requestingDeviceFingerprint: dto.requestingDeviceFingerprint,
      requestingPlatform: dto.requestingPlatform,
      requestingPublicKey: dto.requestingPublicKey,
      ctx: extractRequestContext(req),
    });
    return successResponse(data);
  }

  @Get('requests/pending')
  async pending(@CurrentUser() user: JwtAccessClaims): Promise<ReturnType<typeof successResponse>> {
    const data = await this.recovery.listPendingForOwner(user.sub);
    return successResponse(data);
  }

  @Post('requests/:id/approve')
  async approve(
    @CurrentUser() user: JwtAccessClaims,
    @Param() params: RequestIdParamDto,
    @Body() dto: ApproveVaultRecoveryDto,
    @Req() req: Request,
  ) {
    const data = await this.recovery.approve({
      ownerUserId: user.sub,
      requestId: params.id,
      approvingDeviceId: dto.approvingDeviceId,
      ciphertext: dto.ciphertext,
      nonce: dto.nonce,
      ephemeralPublicKey: dto.ephemeralPublicKey,
      aad: dto.aad,
      ctx: extractRequestContext(req),
    });
    return successResponse(data);
  }

  @Post('requests/:id/deny')
  async deny(
    @CurrentUser() user: JwtAccessClaims,
    @Param() params: RequestIdParamDto,
    @Req() req: Request,
  ) {
    const data = await this.recovery.deny({
      ownerUserId: user.sub,
      requestId: params.id,
      ctx: extractRequestContext(req),
    });
    return successResponse(data);
  }

  @Public()
  @SkipCsrf()
  @Post('requests/:id/collect')
  async collect(
    @Param() params: RequestIdParamDto,
    @Body() dto: CollectVaultRecoveryDto,
    @Req() req: Request,
  ) {
    const data = await this.recovery.collect({
      resetToken: dto.resetToken,
      requestId: params.id,
      requestingDeviceFingerprint: dto.requestingDeviceFingerprint,
      ctx: extractRequestContext(req),
    });
    return successResponse(data);
  }

  @Public()
  @SkipCsrf()
  @Post('complete')
  async complete(@Body() dto: CompleteVaultRecoveryDto, @Req() req: Request) {
    const epoch = Number(dto.expectedVaultEpoch);
    const data = await this.recovery.complete({
      resetToken: dto.resetToken,
      requestId: dto.requestId,
      newPassword: dto.newPassword,
      expectedVaultEpoch: epoch,
      ctx: extractRequestContext(req),
    });
    return successResponse(data);
  }
}
