import { Inject, Injectable } from '@nestjs/common';
import { UserStatus, type AuthTokens } from '@auvora/types';
import { generateOpaqueToken, hashToken } from '@auvora/security';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import {
  ConflictError,
  ForbiddenError,
  LockedError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
  assertPasswordPolicy,
  computeLockedUntil,
  isCurrentlyLocked,
  shouldLock,
} from '../../domain';
import { AUDIT_REPOSITORY, type AuditRepositoryPort } from '../ports/audit-repository.port';
import { CLOCK, ID_GENERATOR, type ClockPort, type IdGeneratorPort } from '../ports/clock.port';
import { DEVICE_REPOSITORY, type DeviceRepositoryPort } from '../ports/device-repository.port';
import {
  LOGIN_HISTORY_REPOSITORY,
  type LoginHistoryRepositoryPort,
} from '../ports/login-history-repository.port';
import { MAIL_PORT, type MailPort } from '../ports/mail.port';
import { PASSWORD_HASHER, type PasswordHasherPort } from '../ports/password-hasher.port';
import { RATE_LIMITER, type RateLimiterPort } from '../ports/rate-limiter.port';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepositoryPort,
} from '../ports/refresh-token-repository.port';
import { SESSION_REPOSITORY, type SessionRepositoryPort } from '../ports/session-repository.port';
import { TOKEN_SERVICE, type TokenServicePort } from '../ports/token-service.port';
import {
  USER_REPOSITORY,
  type AuthUser,
  type UpdateProfileInput,
  type UserRepositoryPort,
} from '../ports/user-repository.port';

export interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface LoginInput {
  email: string;
  password: string;
  deviceFingerprint: string;
  deviceName?: string;
}

export interface AuthResult extends AuthTokens {
  csrfToken: string;
  sessionId: string;
}

export interface UserProfileDto {
  id: string;
  email: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string | null;
  avatarUrl: string | null;
  preferredLanguage: string;
  timeZone: string;
  country: string | null;
  status: UserStatus;
  emailVerified: boolean;
  mfaEnabled: boolean;
  roles: string[];
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepositoryPort,
    @Inject(DEVICE_REPOSITORY) private readonly devices: DeviceRepositoryPort,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepositoryPort,
    @Inject(LOGIN_HISTORY_REPOSITORY) private readonly loginHistory: LoginHistoryRepositoryPort,
    @Inject(AUDIT_REPOSITORY) private readonly audit: AuditRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenServicePort,
    @Inject(MAIL_PORT) private readonly mail: MailPort,
    @Inject(RATE_LIMITER) private readonly rateLimiter: RateLimiterPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
  ) {}

  async register(input: RegisterInput, ctx: RequestContext): Promise<{ userId: string; message: string }> {
    await this.enforceRateLimit(`register:${ctx.ipAddress ?? 'unknown'}`);

    assertPasswordPolicy(input.password);

    const email = input.email.trim().toLowerCase();
    const username = input.username.trim().toLowerCase();

    if (await this.users.findByEmail(email)) {
      throw new ConflictError('Email is already registered');
    }
    if (await this.users.findByUsername(username)) {
      throw new ConflictError('Username is already taken');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = await this.users.create({
      email,
      username,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
    });

    const rawToken = generateOpaqueToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(this.clock.now().getTime() + 24 * 60 * 60 * 1000);
    await this.users.createEmailVerificationToken(user.id, tokenHash, expiresAt);

    const verifyUrl = `${this.env.APP_PUBLIC_URL}/verify-email?token=${rawToken}`;
    await this.mail.send({
      to: email,
      subject: 'Verify your Auvora Wallet account',
      text: `Welcome! Verify your email: ${verifyUrl}`,
      html: `<p>Welcome! <a href="${verifyUrl}">Verify your email</a></p>`,
    });

    await this.audit.create({
      action: 'REGISTER',
      actorUserId: user.id,
      targetUserId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return { userId: user.id, message: 'Registration successful. Please verify your email.' };
  }

  async login(input: LoginInput, ctx: RequestContext): Promise<AuthResult> {
    await this.enforceRateLimit(`login:${ctx.ipAddress ?? 'unknown'}`);

    const email = input.email.trim().toLowerCase();
    const user = await this.users.findByEmail(email);

    if (!user || user.deletedAt) {
      await this.recordLoginFailure(undefined, email, ctx, 'invalid_credentials');
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.status === UserStatus.Suspended || user.status === UserStatus.Deactivated) {
      throw new ForbiddenError('Account is not permitted to sign in');
    }

    if (isCurrentlyLocked(user.lockedUntil, this.clock.now())) {
      throw new LockedError('Account is temporarily locked due to failed login attempts');
    }

    const valid = await this.passwordHasher.verify(input.password, user.passwordHash);
    if (!valid) {
      const failedCount = user.failedLoginCount + 1;
      let lockedUntil: Date | null = null;
      if (shouldLock(failedCount, this.env.LOCKOUT_MAX_ATTEMPTS)) {
        lockedUntil = computeLockedUntil(this.clock.now(), this.env.LOCKOUT_DURATION_SECONDS);
        await this.audit.create({
          action: 'ACCOUNT_LOCKED',
          actorUserId: user.id,
          targetUserId: user.id,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          metadata: { failedCount },
        });
      }
      await this.users.recordFailedLogin(user.id, failedCount, lockedUntil);
      await this.recordLoginFailure(user.id, email, ctx, 'invalid_credentials');
      if (lockedUntil) {
        throw new LockedError('Account is temporarily locked due to failed login attempts');
      }
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.emailVerified) {
      throw new ForbiddenError('Email address must be verified before signing in');
    }

    await this.users.resetFailedLogin(user.id);
    await this.users.updateLastLogin(user.id, this.clock.now());

    const device = await this.devices.upsert({
      userId: user.id,
      fingerprint: input.deviceFingerprint,
      name: input.deviceName,
      userAgent: ctx.userAgent,
    });

    const sessionExpiresAt = new Date(
      this.clock.now().getTime() + this.env.JWT_REFRESH_TTL_SECONDS * 1000,
    );
    const session = await this.sessions.create({
      userId: user.id,
      deviceId: device.id,
      ipAddress: ctx.ipAddress ?? null,
      userAgent: ctx.userAgent ?? null,
      expiresAt: sessionExpiresAt,
    });

    const familyId = this.ids.uuid();
    const refreshToken = this.tokenService.generateRefreshToken();
    const refreshHash = this.tokenService.hashRefreshToken(refreshToken);
    const refreshExpiresAt = sessionExpiresAt;

    await this.refreshTokens.create({
      userId: user.id,
      sessionId: session.id,
      deviceId: device.id,
      tokenHash: refreshHash,
      familyId,
      expiresAt: refreshExpiresAt,
    });

    const accessToken = await this.tokenService.issueAccessToken({
      sub: user.id,
      email: user.email,
      sessionId: session.id,
      roles: user.roles,
      permissions: user.permissions,
    });

    const csrfToken = generateOpaqueToken(32);

    await this.loginHistory.record({
      userId: user.id,
      email,
      outcome: 'SUCCESS',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    await this.audit.create({
      action: 'LOGIN_SUCCESS',
      actorUserId: user.id,
      targetUserId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { sessionId: session.id, deviceId: device.id },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.env.JWT_ACCESS_TTL_SECONDS,
      tokenType: 'Bearer',
      csrfToken,
      sessionId: session.id,
    };
  }

  async refresh(refreshToken: string, ctx: RequestContext): Promise<AuthTokens & { csrfToken: string }> {
    await this.enforceRateLimit(`refresh:${ctx.ipAddress ?? 'unknown'}`);

    const tokenHash = this.tokenService.hashRefreshToken(refreshToken);
    const stored = await this.refreshTokens.findByHash(tokenHash);

    if (!stored) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    if (stored.revokedAt) {
      await this.refreshTokens.revokeFamily(stored.familyId);
      await this.sessions.revoke(stored.sessionId);
      await this.audit.create({
        action: 'REFRESH_REUSE_DETECTED',
        actorUserId: stored.userId,
        targetUserId: stored.userId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { familyId: stored.familyId, tokenId: stored.id },
      });
      throw new UnauthorizedError('Refresh token reuse detected; session family revoked');
    }

    if (stored.expiresAt.getTime() <= this.clock.now().getTime()) {
      throw new UnauthorizedError('Refresh token expired');
    }

    const session = await this.sessions.findById(stored.sessionId);
    if (!session || session.revokedAt) {
      throw new UnauthorizedError('Session is no longer valid');
    }

    const user = await this.users.findById(stored.userId);
    if (!user || user.deletedAt || user.status !== UserStatus.Active) {
      throw new UnauthorizedError('User account is not active');
    }

    const newRefreshToken = this.tokenService.generateRefreshToken();
    const newHash = this.tokenService.hashRefreshToken(newRefreshToken);
    const newRecord = await this.refreshTokens.create({
      userId: user.id,
      sessionId: session.id,
      deviceId: stored.deviceId,
      tokenHash: newHash,
      familyId: stored.familyId,
      expiresAt: stored.expiresAt,
    });

    await this.refreshTokens.revoke(stored.id, newRecord.id);

    const accessToken = await this.tokenService.issueAccessToken({
      sub: user.id,
      email: user.email,
      sessionId: session.id,
      roles: user.roles,
      permissions: user.permissions,
    });

    await this.audit.create({
      action: 'TOKEN_REFRESH',
      actorUserId: user.id,
      targetUserId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { sessionId: session.id },
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: this.env.JWT_ACCESS_TTL_SECONDS,
      tokenType: 'Bearer',
      csrfToken: generateOpaqueToken(32),
    };
  }

  async logout(userId: string, sessionId: string, ctx: RequestContext): Promise<{ message: string }> {
    await this.sessions.revoke(sessionId);
    await this.refreshTokens.revokeAllForSession(sessionId);

    await this.audit.create({
      action: 'LOGOUT',
      actorUserId: userId,
      targetUserId: userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { sessionId },
    });

    return { message: 'Logged out successfully' };
  }

  async verifyEmail(token: string, ctx: RequestContext): Promise<{ message: string }> {
    const tokenHash = hashToken(token);
    const userId = await this.users.consumeEmailVerificationToken(tokenHash);
    if (!userId) {
      throw new ValidationError('Invalid or expired verification token');
    }

    await this.users.markEmailVerified(userId);
    await this.users.updateStatus(userId, UserStatus.Active);

    await this.audit.create({
      action: 'EMAIL_VERIFIED',
      actorUserId: userId,
      targetUserId: userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return { message: 'Email verified successfully' };
  }

  async resendVerification(email: string, _ctx: RequestContext): Promise<{ message: string }> {
    await this.enforceRateLimit(`resend:${email}`);

    const user = await this.users.findByEmail(email.trim().toLowerCase());
    if (!user || user.emailVerified) {
      return { message: 'If the account exists and is unverified, a verification email has been sent.' };
    }

    const rawToken = generateOpaqueToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(this.clock.now().getTime() + 24 * 60 * 60 * 1000);
    await this.users.createEmailVerificationToken(user.id, tokenHash, expiresAt);

    const verifyUrl = `${this.env.APP_PUBLIC_URL}/verify-email?token=${rawToken}`;
    await this.mail.send({
      to: user.email,
      subject: 'Verify your Auvora Wallet account',
      text: `Verify your email: ${verifyUrl}`,
      html: `<p><a href="${verifyUrl}">Verify your email</a></p>`,
    });

    return { message: 'If the account exists and is unverified, a verification email has been sent.' };
  }

  async forgotPassword(email: string, ctx: RequestContext): Promise<{ message: string }> {
    await this.enforceRateLimit(`forgot:${email}`);

    const user = await this.users.findByEmail(email.trim().toLowerCase());
    if (user && !user.deletedAt) {
      const rawToken = generateOpaqueToken();
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(this.clock.now().getTime() + 60 * 60 * 1000);
      await this.users.createPasswordResetToken(user.id, tokenHash, expiresAt);

      const resetUrl = `${this.env.APP_PUBLIC_URL}/reset-password?token=${rawToken}`;
      await this.mail.send({
        to: user.email,
        subject: 'Reset your Auvora Wallet password',
        text: `Reset your password: ${resetUrl}`,
        html: `<p><a href="${resetUrl}">Reset your password</a></p>`,
      });

      await this.audit.create({
        action: 'PASSWORD_RESET_REQUESTED',
        actorUserId: user.id,
        targetUserId: user.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    }

    return { message: 'If the account exists, a password reset email has been sent.' };
  }

  async resetPassword(token: string, newPassword: string, ctx: RequestContext): Promise<{ message: string }> {
    assertPasswordPolicy(newPassword);

    const tokenHash = hashToken(token);
    const userId = await this.users.consumePasswordResetToken(tokenHash);
    if (!userId) {
      throw new ValidationError('Invalid or expired reset token');
    }

    const passwordHash = await this.passwordHasher.hash(newPassword);
    await this.users.updatePassword(userId, passwordHash);
    await this.sessions.revokeAllForUser(userId);
    await this.refreshTokens.revokeAllForUser(userId);

    await this.audit.create({
      action: 'PASSWORD_RESET_COMPLETED',
      actorUserId: userId,
      targetUserId: userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return { message: 'Password reset successfully' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ctx: RequestContext,
  ): Promise<{ message: string }> {
    assertPasswordPolicy(newPassword);

    const user = await this.requireActiveUser(userId);
    const valid = await this.passwordHasher.verify(currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    const passwordHash = await this.passwordHasher.hash(newPassword);
    await this.users.updatePassword(userId, passwordHash);
    await this.refreshTokens.revokeAllForUser(userId);

    await this.audit.create({
      action: 'PASSWORD_CHANGED',
      actorUserId: userId,
      targetUserId: userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return { message: 'Password changed successfully' };
  }

  async getProfile(userId: string): Promise<UserProfileDto> {
    const user = await this.requireActiveUser(userId);
    return this.toProfile(user);
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<UserProfileDto> {
    const user = await this.users.updateProfile(userId, input);
    return this.toProfile(user);
  }

  async listSessions(userId: string) {
    const sessions = await this.sessions.listByUserId(userId);
    return sessions.map((s) => ({
      id: s.id,
      deviceId: s.deviceId,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      expiresAt: s.expiresAt.toISOString(),
      revokedAt: s.revokedAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
      active: !s.revokedAt && s.expiresAt.getTime() > this.clock.now().getTime(),
    }));
  }

  async revokeSession(userId: string, sessionId: string, ctx: RequestContext): Promise<{ message: string }> {
    const session = await this.sessions.findById(sessionId);
    if (!session || session.userId !== userId) {
      throw new NotFoundError('Session not found');
    }
    await this.sessions.revoke(sessionId);
    await this.refreshTokens.revokeAllForSession(sessionId);

    await this.audit.create({
      action: 'SESSION_REVOKED',
      actorUserId: userId,
      targetUserId: userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { sessionId },
    });

    return { message: 'Session revoked' };
  }

  async listDevices(userId: string) {
    const devices = await this.devices.listByUserId(userId);
    return devices.map((d) => ({
      id: d.id,
      fingerprint: d.fingerprint,
      name: d.name,
      userAgent: d.userAgent,
      trusted: d.trusted,
      lastSeenAt: d.lastSeenAt.toISOString(),
      revokedAt: d.revokedAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
    }));
  }

  async revokeDevice(userId: string, deviceId: string, ctx: RequestContext): Promise<{ message: string }> {
    const devices = await this.devices.listByUserId(userId);
    const device = devices.find((d) => d.id === deviceId);
    if (!device) {
      throw new NotFoundError('Device not found');
    }
    await this.devices.revoke(deviceId);

    await this.audit.create({
      action: 'DEVICE_REVOKED',
      actorUserId: userId,
      targetUserId: userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { deviceId },
    });

    return { message: 'Device revoked' };
  }

  async getLoginHistory(userId: string, skip = 0, take = 50) {
    const records = await this.loginHistory.listByUserId(userId, skip, take);
    return records.map((r) => ({
      id: r.id,
      outcome: r.outcome,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      reason: r.reason,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async adminSearchUsers(filters: Parameters<UserRepositoryPort['search']>[0]) {
    const result = await this.users.search(filters);
    return {
      total: result.total,
      users: result.users.map((u) => this.toProfile(u)),
    };
  }

  async adminGetUser(userId: string): Promise<UserProfileDto> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return this.toProfile(user);
  }

  async adminUpdateStatus(
    actorId: string,
    userId: string,
    status: UserStatus,
    ctx: RequestContext,
  ): Promise<UserProfileDto> {
    const user = await this.users.updateStatus(userId, status);
    await this.audit.create({
      action: 'USER_STATUS_CHANGED',
      actorUserId: actorId,
      targetUserId: userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { status },
    });
    return this.toProfile(user);
  }

  async adminSoftDelete(actorId: string, userId: string, ctx: RequestContext): Promise<UserProfileDto> {
    const user = await this.users.softDelete(userId);
    await this.sessions.revokeAllForUser(userId);
    await this.refreshTokens.revokeAllForUser(userId);
    await this.audit.create({
      action: 'USER_SOFT_DELETED',
      actorUserId: actorId,
      targetUserId: userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return this.toProfile(user);
  }

  async adminRestore(actorId: string, userId: string, ctx: RequestContext): Promise<UserProfileDto> {
    const user = await this.users.restore(userId);
    await this.audit.create({
      action: 'USER_RESTORED',
      actorUserId: actorId,
      targetUserId: userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return this.toProfile(user);
  }

  async adminAssignRoles(
    actorId: string,
    userId: string,
    roleNames: string[],
    ctx: RequestContext,
  ): Promise<UserProfileDto> {
    const user = await this.users.assignRoles(userId, roleNames);
    await this.audit.create({
      action: 'ROLES_UPDATED',
      actorUserId: actorId,
      targetUserId: userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { roles: roleNames },
    });
    return this.toProfile(user);
  }

  async adminForceLogout(actorId: string, userId: string, ctx: RequestContext): Promise<{ revoked: number }> {
    const revoked = await this.sessions.revokeAllForUser(userId);
    await this.refreshTokens.revokeAllForUser(userId);
    await this.audit.create({
      action: 'SESSION_REVOKED',
      actorUserId: actorId,
      targetUserId: userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { forced: true, revoked },
    });
    return { revoked };
  }

  async adminListAudit(filters: Parameters<AuditRepositoryPort['search']>[0]) {
    const result = await this.audit.search(filters);
    return {
      total: result.total,
      logs: result.logs.map((log) => ({
        id: log.id,
        action: log.action,
        actorUserId: log.actorUserId,
        targetUserId: log.targetUserId,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        metadata: log.metadata,
        createdAt: log.createdAt.toISOString(),
      })),
    };
  }

  async adminToggleMfa(
    actorId: string,
    userId: string,
    enabled: boolean,
    ctx: RequestContext,
  ): Promise<UserProfileDto> {
    const user = await this.users.toggleMfa(userId, enabled);
    await this.audit.create({
      action: 'MFA_TOGGLED',
      actorUserId: actorId,
      targetUserId: userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { enabled },
    });
    return this.toProfile(user);
  }

  private async requireActiveUser(userId: string): Promise<AuthUser> {
    const user = await this.users.findById(userId);
    if (!user || user.deletedAt) {
      throw new NotFoundError('User not found');
    }
    return user;
  }

  private toProfile(user: AuthUser): UserProfileDto {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      avatarUrl: user.avatarUrl,
      preferredLanguage: user.preferredLanguage,
      timeZone: user.timeZone,
      country: user.country,
      status: user.status,
      emailVerified: user.emailVerified,
      mfaEnabled: user.mfaEnabled,
      roles: user.roles,
      permissions: user.permissions,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private async enforceRateLimit(key: string): Promise<void> {
    const result = await this.rateLimiter.consume(
      key,
      this.env.RATE_LIMIT_MAX,
      this.env.RATE_LIMIT_WINDOW_SECONDS,
    );
    if (!result.allowed) {
      throw new RateLimitError('Too many requests');
    }
  }

  private async recordLoginFailure(
    userId: string | undefined,
    email: string,
    ctx: RequestContext,
    reason: string,
  ): Promise<void> {
    await this.loginHistory.record({
      userId,
      email,
      outcome: 'FAILURE',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      reason,
    });
    if (userId) {
      await this.audit.create({
        action: 'LOGIN_FAILURE',
        actorUserId: userId,
        targetUserId: userId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { reason },
      });
    }
  }
}
