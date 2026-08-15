import { Body, Controller, HttpCode, HttpStatus, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from '../../application/services/auth.service';
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
import { successResponse } from '@auvora/nest-common';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResendVerificationDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from '../dto/auth.dto';

/** Native (non-browser) clients cannot use httpOnly cookies and receive the refresh token in the body. */
function isNativeClient(devicePlatform?: string): boolean {
  const p = (devicePlatform ?? '').trim().toLowerCase();
  return p === 'android' || p === 'ios';
}

// Keep DTO classes as runtime values for Nest ValidationPipe.
const _authDtoRuntime = {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResendVerificationDto,
  ResetPasswordDto,
  VerifyEmailDto,
};
void _authDtoRuntime;

@ApiTags('auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
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
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, extractRequestContext(req));
    setRefreshTokenCookie(res, this.env, result.refreshToken);
    setCsrfTokenCookie(res, this.env, result.csrfToken);
    // Browsers use the httpOnly refresh cookie (never in body — XSS surface). Native
    // clients (android/ios) cannot use httpOnly cookies, so they receive the refresh
    // token in the body; web (devicePlatform web/unset) keeps cookie-only behavior.
    return successResponse({
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      tokenType: result.tokenType,
      csrfToken: result.csrfToken,
      sessionId: result.sessionId,
      ...(isNativeClient(dto.devicePlatform) ? { refreshToken: result.refreshToken } : {}),
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
    // Native clients pass the refresh token in the body; browsers use the cookie.
    const usedBodyToken = Boolean(dto.refreshToken);
    const refreshToken =
      dto.refreshToken ?? getRefreshTokenFromRequest(req.cookies as Record<string, string>);
    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token required');
    }
    const result = await this.authService.refresh(refreshToken, extractRequestContext(req));
    setRefreshTokenCookie(res, this.env, result.refreshToken);
    setCsrfTokenCookie(res, this.env, result.csrfToken);
    return successResponse({
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      tokenType: result.tokenType,
      csrfToken: result.csrfToken,
      sessionId: result.sessionId,
      // Rotate the refresh token back to native callers (body in → body out).
      ...(usedBodyToken ? { refreshToken: result.refreshToken } : {}),
    });
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
