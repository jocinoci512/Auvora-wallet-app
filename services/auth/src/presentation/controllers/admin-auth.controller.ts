import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { successResponse } from '@auvora/nest-common';
import type { JwtAccessClaims } from '@auvora/types';
import { AdminAuthService } from '../../application/services/admin-auth.service';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { Public, SkipCsrf } from '../decorators/auth.decorators';
import { extractRequestContext } from '../decorators/current-user.decorator';
import {
  clearAdminAuthCookies,
  getAdminRefreshTokenFromRequest,
  setAdminAccessTokenCookie,
  setAdminCsrfTokenCookie,
  setAdminRefreshTokenCookie,
} from '../common/cookie.helper';
import {
  AdminLoginDto,
  AdminMfaCodeDto,
  AdminMfaTokenDto,
  AdminRecoveryDto,
  AdminStepUpDto,
} from '../dto/admin-auth.dto';
import { UnauthorizedError } from '../../domain';

const _dto = { AdminLoginDto, AdminMfaCodeDto, AdminMfaTokenDto, AdminRecoveryDto, AdminStepUpDto };
void _dto;

function applyAdminCookies(
  res: Response,
  env: ServiceEnv,
  tokens: { refreshToken: string; accessToken: string; csrfToken: string },
): void {
  setAdminRefreshTokenCookie(res, env, tokens.refreshToken);
  setAdminAccessTokenCookie(res, env, tokens.accessToken);
  setAdminCsrfTokenCookie(res, env, tokens.csrfToken);
}

function publicSessionBody(tokens: {
  csrfToken: string;
  sessionId: string;
  expiresIn: number;
}): Record<string, unknown> {
  return {
    csrfToken: tokens.csrfToken,
    sessionId: tokens.sessionId,
    expiresIn: tokens.expiresIn,
    tokenType: 'Bearer',
  };
}

@ApiTags('admin-auth')
@Controller('api/v1/auth/admin')
export class AdminAuthController {
  constructor(
    @Inject(AdminAuthService) private readonly adminAuth: AdminAuthService,
    @Inject(ENV) private readonly env: ServiceEnv,
  ) {}

  @Public()
  @SkipCsrf()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: AdminLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.adminAuth.login(dto, extractRequestContext(req));
    if (result.status === 'authenticated') {
      applyAdminCookies(res, this.env, result.tokens);
      return successResponse({ status: result.status, ...publicSessionBody(result.tokens) });
    }
    return successResponse({ status: result.status, mfaToken: result.mfaToken });
  }

  @Public()
  @SkipCsrf()
  @Post('mfa/enroll/start')
  @HttpCode(HttpStatus.OK)
  async enrollStart(@Body() dto: AdminMfaTokenDto, @Req() req: Request) {
    const data = await this.adminAuth.startEnrollment(dto.mfaToken, extractRequestContext(req));
    return successResponse(data);
  }

  @Public()
  @SkipCsrf()
  @Post('mfa/enroll/confirm')
  @HttpCode(HttpStatus.OK)
  async enrollConfirm(
    @Body() dto: AdminMfaCodeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.adminAuth.confirmEnrollment(
      dto.mfaToken,
      dto.code,
      extractRequestContext(req),
    );
    applyAdminCookies(res, this.env, data.tokens);
    return successResponse({
      ...publicSessionBody(data.tokens),
      recoveryCodes: data.recoveryCodes,
    });
  }

  @Public()
  @SkipCsrf()
  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  async verifyMfa(
    @Body() dto: AdminMfaCodeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.adminAuth.verifyMfa(
      dto.mfaToken,
      dto.code,
      extractRequestContext(req),
    );
    applyAdminCookies(res, this.env, tokens);
    return successResponse(publicSessionBody(tokens));
  }

  @Public()
  @SkipCsrf()
  @Post('mfa/recovery')
  @HttpCode(HttpStatus.OK)
  async recovery(
    @Body() dto: AdminRecoveryDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.adminAuth.verifyRecovery(
      dto.mfaToken,
      dto.recoveryCode,
      extractRequestContext(req),
    );
    applyAdminCookies(res, this.env, tokens);
    return successResponse(publicSessionBody(tokens));
  }

  @Public()
  @SkipCsrf()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = getAdminRefreshTokenFromRequest(req.cookies as Record<string, string>);
    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token required');
    }
    const tokens = await this.adminAuth.refresh(refreshToken, extractRequestContext(req));
    applyAdminCookies(res, this.env, tokens);
    return successResponse(publicSessionBody(tokens));
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request & { user?: JwtAccessClaims },
    @Res({ passthrough: true }) res: Response,
  ) {
    if (req.user) {
      await this.adminAuth.logout(req.user.sub, req.user.sessionId, extractRequestContext(req));
    }
    clearAdminAuthCookies(res, this.env);
    return successResponse({ message: 'Logged out successfully' });
  }

  @Get('session')
  async session(@Req() req: Request & { user: JwtAccessClaims }) {
    const data = await this.adminAuth.getSession(req.user.sub, req.user.sessionId);
    return successResponse(data);
  }

  @Post('step-up')
  @HttpCode(HttpStatus.OK)
  async stepUp(
    @Body() dto: AdminStepUpDto,
    @Req() req: Request & { user: JwtAccessClaims },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.adminAuth.stepUp(
      req.user.sub,
      req.user.sessionId,
      { password: dto.password, code: dto.code },
      extractRequestContext(req),
    );
    setAdminAccessTokenCookie(res, this.env, result.accessToken);
    setAdminCsrfTokenCookie(res, this.env, result.csrfToken);
    return successResponse({
      csrfToken: result.csrfToken,
      stepUpExp: result.stepUpExp,
      expiresIn: result.expiresIn,
    });
  }

  @Post('mfa/recovery/regenerate')
  @HttpCode(HttpStatus.OK)
  async regenerateRecovery(@Req() req: Request & { user: JwtAccessClaims }) {
    const data = await this.adminAuth.regenerateRecoveryCodes(
      req.user.sub,
      extractRequestContext(req),
    );
    return successResponse(data);
  }
}
