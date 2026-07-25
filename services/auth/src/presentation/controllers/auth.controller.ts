import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { type AuthService } from '../../application/services/auth.service';
import { UnauthorizedError } from '../../domain';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { Public, SkipCsrf } from '../decorators/auth.decorators';
import { extractRequestContext } from '../decorators/current-user.decorator';
import {
  clearAuthCookies,
  getRefreshTokenFromRequest,
  setCsrfTokenCookie,
  setRefreshTokenCookie,
} from '../common/cookie.helper';
import { successResponse } from '../common/api-response';
import {
  type ChangePasswordDto,
  type ForgotPasswordDto,
  type LoginDto,
  type RefreshDto,
  type RegisterDto,
  type ResendVerificationDto,
  type ResetPasswordDto,
  type VerifyEmailDto,
} from '../dto/auth.dto';

@ApiTags('auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(ENV) private readonly env: ServiceEnv,
  ) {}

  @Public()
  @SkipCsrf()
  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const data = await this.authService.register(dto, extractRequestContext(req));
    return successResponse(data);
  }

  @Public()
  @SkipCsrf()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto, extractRequestContext(req));
    setRefreshTokenCookie(res, this.env, result.refreshToken);
    setCsrfTokenCookie(res, this.env, result.csrfToken);
    return successResponse({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      tokenType: result.tokenType,
      csrfToken: result.csrfToken,
      sessionId: result.sessionId,
    });
  }

  @Public()
  @SkipCsrf()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken =
      dto.refreshToken ?? getRefreshTokenFromRequest(req.cookies as Record<string, string>);
    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token required');
    }
    const result = await this.authService.refresh(refreshToken, extractRequestContext(req));
    setRefreshTokenCookie(res, this.env, result.refreshToken);
    setCsrfTokenCookie(res, this.env, result.csrfToken);
    return successResponse(result);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request & { user?: { sub: string; sessionId: string } },
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = req.user;
    if (user) {
      await this.authService.logout(user.sub, user.sessionId, extractRequestContext(req));
    }
    clearAuthCookies(res, this.env);
    return successResponse({ message: 'Logged out successfully' });
  }

  @Public()
  @SkipCsrf()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto, @Req() req: Request) {
    const data = await this.authService.verifyEmail(dto.token, extractRequestContext(req));
    return successResponse(data);
  }

  @Public()
  @SkipCsrf()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body() dto: ResendVerificationDto, @Req() req: Request) {
    const data = await this.authService.resendVerification(dto.email, extractRequestContext(req));
    return successResponse(data);
  }

  @Public()
  @SkipCsrf()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    const data = await this.authService.forgotPassword(dto.email, extractRequestContext(req));
    return successResponse(data);
  }

  @Public()
  @SkipCsrf()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    const data = await this.authService.resetPassword(
      dto.token,
      dto.newPassword,
      extractRequestContext(req),
    );
    return successResponse(data);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() req: Request & { user: { sub: string } },
  ) {
    const data = await this.authService.changePassword(
      req.user.sub,
      dto.currentPassword,
      dto.newPassword,
      extractRequestContext(req),
    );
    return successResponse(data);
  }
}
