import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { type AuthService } from '../../application/services/auth.service';
import { CurrentUser, extractRequestContext } from '../decorators/current-user.decorator';
import type { JwtAccessClaims } from '@auvora/types';
import { Req } from '@nestjs/common';
import type { Request } from 'express';
import { successResponse } from '../common/api-response';
import { type UpdateProfileDto } from '../dto/profile.dto';
import { type DeviceIdParamDto, type SessionIdParamDto } from '../dto/admin.dto';

@ApiTags('me')
@Controller('api/v1/me')
export class MeController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  async getProfile(@CurrentUser() user: JwtAccessClaims) {
    const data = await this.authService.getProfile(user.sub);
    return successResponse(data);
  }

  @Patch()
  async updateProfile(@CurrentUser() user: JwtAccessClaims, @Body() dto: UpdateProfileDto) {
    const data = await this.authService.updateProfile(user.sub, dto);
    return successResponse(data);
  }

  @Get('sessions')
  async listSessions(@CurrentUser() user: JwtAccessClaims) {
    const data = await this.authService.listSessions(user.sub);
    return successResponse(data);
  }

  @Delete('sessions/:sessionId')
  async revokeSession(
    @CurrentUser() user: JwtAccessClaims,
    @Param() params: SessionIdParamDto,
    @Req() req: Request,
  ) {
    const data = await this.authService.revokeSession(
      user.sub,
      params.sessionId,
      extractRequestContext(req),
    );
    return successResponse(data);
  }

  @Get('devices')
  async listDevices(@CurrentUser() user: JwtAccessClaims) {
    const data = await this.authService.listDevices(user.sub);
    return successResponse(data);
  }

  @Delete('devices/:deviceId')
  async revokeDevice(
    @CurrentUser() user: JwtAccessClaims,
    @Param() params: DeviceIdParamDto,
    @Req() req: Request,
  ) {
    const data = await this.authService.revokeDevice(
      user.sub,
      params.deviceId,
      extractRequestContext(req),
    );
    return successResponse(data);
  }

  @Get('login-history')
  async getLoginHistory(
    @CurrentUser() user: JwtAccessClaims,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    const data = await this.authService.getLoginHistory(
      user.sub,
      skip ? Number(skip) : 0,
      take ? Number(take) : 50,
    );
    return successResponse(data);
  }
}
