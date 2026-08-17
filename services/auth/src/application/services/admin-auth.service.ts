import { Inject, Injectable, Logger } from '@nestjs/common';
import { UserStatus, isAdminPortalRole, type AuthSurface } from '@auvora/types';
import { generateOpaqueToken, hashToken } from '@auvora/security';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import {
  ForbiddenError,
  LockedError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
  ADMIN_PORTAL_ROLES,
  MFA_REQUIRED_ROLES,
  ROLE_SUPER_ADMIN,
  adminSessionPermissions,
  buildOtpauthUrl,
  generateRecoveryCodes,
  generateTotpSecret,
  isCurrentlyLocked,
  normalizeRecoveryCode,
  shouldLock,
  computeLockedUntil,
  verifyTotpCode,
} from '../../domain';
import { AUDIT_REPOSITORY, type AuditRepositoryPort } from '../ports/audit-repository.port';
import { CLOCK, ID_GENERATOR, type ClockPort, type IdGeneratorPort } from '../ports/clock.port';
import { DEVICE_REPOSITORY, type DeviceRepositoryPort } from '../ports/device-repository.port';
import {
  LOGIN_HISTORY_REPOSITORY,
  type LoginHistoryRepositoryPort,
} from '../ports/login-history-repository.port';
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
  type UserRepositoryPort,
} from '../ports/user-repository.port';
import {
  MFA_RECOVERY_REPOSITORY,
  MFA_TOTP_REPOSITORY,
  type MfaRecoveryRepositoryPort,
  type MfaTotpRepositoryPort,
} from '../ports/mfa.repository.port';
import {
  ADMIN_EVENT_PUBLISHER,
  type AdminEventPublisherPort,
} from '../ports/admin-event-publisher.port';
import { REDIS_PORT, type RedisPort } from '../../infrastructure/redis/redis.port';
import {
  FIELD_ENCRYPTION,
  type FieldEncryptionPort,
} from '../../infrastructure/crypto/aes-field-encryption.adapter';
import type { RequestContext } from './auth.service';

const CHALLENGE_TTL_SECONDS = 300;
const RECOVERY_CODE_COUNT = 10;

export interface AdminLoginInput {
  email: string;
  password: string;
  deviceFingerprint: string;
  deviceName?: string;
  devicePlatform?: string;
  appVersion?: string;
}

export interface AdminAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  csrfToken: string;
  sessionId: string;
}

export type AdminLoginResult =
  | { status: 'authenticated'; tokens: AdminAuthTokens }
  | { status: 'mfa_required'; mfaToken: string }
  | { status: 'mfa_enrollment_required'; mfaToken: string };

export interface AdminOperatorDto {
  id: string;
  email: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  status: UserStatus;
  mfaEnabled: boolean;
  mfaEnrolled: boolean;
  roles: string[];
  lastLoginAt: string | null;
  activeSessionCount: number;
  createdAt: string;
}

interface AdminChallenge {
  userId: string;
  email: string;
  purpose: 'login' | 'enroll';
  deviceFingerprint: string;
  deviceName?: string;
  devicePlatform?: string;
  appVersion?: string;
  enrollSecretEncrypted?: string;
}

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

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
    @Inject(RATE_LIMITER) private readonly rateLimiter: RateLimiterPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
    @Inject(ADMIN_EVENT_PUBLISHER) private readonly adminEvents: AdminEventPublisherPort,
    @Inject(MFA_TOTP_REPOSITORY) private readonly totp: MfaTotpRepositoryPort,
    @Inject(MFA_RECOVERY_REPOSITORY) private readonly recovery: MfaRecoveryRepositoryPort,
    @Inject(FIELD_ENCRYPTION) private readonly fieldEncryption: FieldEncryptionPort,
    @Inject(REDIS_PORT) private readonly redis: RedisPort,
  ) {}

  async login(input: AdminLoginInput, ctx: RequestContext): Promise<AdminLoginResult> {
    await this.enforceRateLimit(`admin-login:${ctx.ipAddress ?? 'unknown'}`);
    const email = input.email.trim().toLowerCase();
    const user = await this.users.findByEmail(email);

    if (!user || user.deletedAt) {
      await this.recordAdminLoginFailure(undefined, email, ctx, 'invalid_credentials');
      throw new UnauthorizedError('Invalid email or password');
    }

    const portalRoles = user.roles.filter((role) => isAdminPortalRole(role));
    if (portalRoles.length === 0) {
      await this.recordAdminLoginFailure(user.id, email, ctx, 'not_admin');
      throw new ForbiddenError('Administrator access is required');
    }

    if (user.status === UserStatus.Suspended || user.status === UserStatus.Deactivated) {
      await this.recordAdminLoginFailure(user.id, email, ctx, 'suspended');
      throw new ForbiddenError('Administrator account is not permitted to sign in');
    }

    if (isCurrentlyLocked(user.lockedUntil, this.clock.now())) {
      throw new LockedError('Account is temporarily locked due to failed login attempts');
    }

    const valid = await this.passwordHasher.verify(input.password, user.passwordHash);
    if (!valid) {
      await this.handleFailedPassword(user, email, ctx);
    }

    await this.users.resetFailedLogin(user.id);

    const factor = await this.totp.findByUserId(user.id);
    const enrolled = Boolean(factor?.confirmedAt);
    const mfaMandatory = portalRoles.some((role) => MFA_REQUIRED_ROLES.includes(role));
    const mfaRequired = mfaMandatory || user.mfaEnabled || enrolled;

    if (!mfaRequired) {
      const tokens = await this.issueAdminSession(user, input, ctx);
      return { status: 'authenticated', tokens };
    }

    const mfaToken = await this.putChallenge({
      userId: user.id,
      email,
      purpose: enrolled ? 'login' : 'enroll',
      deviceFingerprint: input.deviceFingerprint,
      deviceName: input.deviceName,
      devicePlatform: input.devicePlatform,
      appVersion: input.appVersion,
    });

    if (!enrolled) {
      return { status: 'mfa_enrollment_required', mfaToken };
    }
    return { status: 'mfa_required', mfaToken };
  }

  async startEnrollment(
    mfaToken: string,
    ctx: RequestContext,
  ): Promise<{ otpauthUrl: string; secret: string }> {
    await this.enforceMfaRateLimit(ctx, mfaToken);
    const challenge = await this.getChallenge(mfaToken);
    if (challenge.purpose !== 'enroll' && challenge.purpose !== 'login') {
      throw new UnauthorizedError('Invalid MFA challenge');
    }
    const user = await this.requireAdminUser(challenge.userId);
    const secret = generateTotpSecret();
    const secretEncrypted = this.fieldEncryption.encrypt(secret);
    await this.totp.upsertPending(user.id, secretEncrypted);
    challenge.purpose = 'enroll';
    challenge.enrollSecretEncrypted = secretEncrypted;
    await this.putChallenge(challenge, mfaToken);
    return {
      secret,
      otpauthUrl: buildOtpauthUrl({ secret, accountName: user.email }),
    };
  }

  async confirmEnrollment(
    mfaToken: string,
    code: string,
    ctx: RequestContext,
  ): Promise<{ tokens: AdminAuthTokens; recoveryCodes: string[] }> {
    await this.enforceMfaRateLimit(ctx, mfaToken);
    const challenge = await this.getChallenge(mfaToken);
    const user = await this.requireAdminUser(challenge.userId);
    const factor = await this.totp.findByUserId(user.id);
    if (!factor) {
      throw new ValidationError('MFA enrollment has not been started');
    }
    const secret = this.fieldEncryption.decrypt(factor.secretEncrypted);
    const verified = verifyTotpCode({
      secret,
      code,
      nowMs: this.clock.now().getTime(),
      lastUsedStep: factor.lastUsedStep,
    });
    if (!verified.ok) {
      await this.auditMfaFailure(user.id, ctx, 'enroll');
      throw new UnauthorizedError('Invalid authenticator code');
    }
    await this.totp.confirm(user.id, BigInt(verified.step), this.clock.now());
    await this.users.toggleMfa(user.id, true);
    const recoveryCodes = generateRecoveryCodes(RECOVERY_CODE_COUNT);
    const hashes = await Promise.all(
      recoveryCodes.map((raw) => this.passwordHasher.hash(normalizeRecoveryCode(raw))),
    );
    await this.recovery.replaceAll(user.id, hashes);
    await this.audit.create({
      action: 'ADMIN_MFA_ENROLLED',
      actorUserId: user.id,
      targetUserId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    this.emitSecurity('mfa_enrolled', user.id);
    await this.deleteChallenge(mfaToken);
    const tokens = await this.issueAdminSession(user, challenge, ctx);
    return { tokens, recoveryCodes };
  }

  async verifyMfa(mfaToken: string, code: string, ctx: RequestContext): Promise<AdminAuthTokens> {
    await this.enforceMfaRateLimit(ctx, mfaToken);
    const challenge = await this.getChallenge(mfaToken);
    const user = await this.requireAdminUser(challenge.userId);
    const factor = await this.totp.findByUserId(user.id);
    if (!factor?.confirmedAt) {
      throw new UnauthorizedError('MFA is not enrolled');
    }
    const secret = this.fieldEncryption.decrypt(factor.secretEncrypted);
    const verified = verifyTotpCode({
      secret,
      code,
      nowMs: this.clock.now().getTime(),
      lastUsedStep: factor.lastUsedStep,
    });
    if (!verified.ok) {
      await this.auditMfaFailure(user.id, ctx, 'verify');
      throw new UnauthorizedError('Invalid authenticator code');
    }
    await this.totp.markUsedStep(user.id, BigInt(verified.step));
    await this.deleteChallenge(mfaToken);
    return this.issueAdminSession(user, challenge, ctx);
  }

  async verifyRecovery(
    mfaToken: string,
    recoveryCode: string,
    ctx: RequestContext,
  ): Promise<AdminAuthTokens> {
    await this.enforceMfaRateLimit(ctx, mfaToken);
    const challenge = await this.getChallenge(mfaToken);
    const user = await this.requireAdminUser(challenge.userId);
    const normalized = normalizeRecoveryCode(recoveryCode);
    const active = await this.recovery.listActiveByUserId(user.id);
    let matchedId: string | null = null;
    for (const row of active) {
      if (await this.passwordHasher.verify(normalized, row.codeHash)) {
        matchedId = row.id;
        break;
      }
    }
    if (!matchedId) {
      await this.auditMfaFailure(user.id, ctx, 'recovery');
      throw new UnauthorizedError('Invalid recovery code');
    }
    await this.recovery.consume(matchedId);
    await this.audit.create({
      action: 'ADMIN_MFA_RECOVERY_USED',
      actorUserId: user.id,
      targetUserId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    this.emitSecurity('mfa_recovery_used', user.id, 'warning');
    await this.deleteChallenge(mfaToken);
    return this.issueAdminSession(user, challenge, ctx);
  }

  async stepUp(
    userId: string,
    sessionId: string,
    input: { password: string; code: string },
    ctx: RequestContext,
  ): Promise<{ stepUpExp: number; csrfToken: string; accessToken: string; expiresIn: number }> {
    await this.enforceMfaRateLimit(ctx, userId);
    const user = await this.requireAdminUser(userId);
    const session = await this.sessions.findById(sessionId);
    if (!session || session.revokedAt || session.userId !== userId || session.surface !== 'admin') {
      throw new UnauthorizedError('Admin session is no longer valid');
    }
    const passwordOk = await this.passwordHasher.verify(input.password, user.passwordHash);
    if (!passwordOk) {
      await this.audit.create({
        action: 'ADMIN_STEP_UP_FAILED',
        actorUserId: user.id,
        targetUserId: user.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { reason: 'password' },
      });
      throw new UnauthorizedError('Step-up authentication failed');
    }
    const factor = await this.totp.findByUserId(user.id);
    if (factor?.confirmedAt) {
      const secret = this.fieldEncryption.decrypt(factor.secretEncrypted);
      const verified = verifyTotpCode({
        secret,
        code: input.code,
        nowMs: this.clock.now().getTime(),
        lastUsedStep: factor.lastUsedStep,
      });
      if (!verified.ok) {
        await this.audit.create({
          action: 'ADMIN_STEP_UP_FAILED',
          actorUserId: user.id,
          targetUserId: user.id,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          metadata: { reason: 'mfa' },
        });
        throw new UnauthorizedError('Step-up authentication failed');
      }
      await this.totp.markUsedStep(user.id, BigInt(verified.step));
    } else if (user.roles.some((role) => MFA_REQUIRED_ROLES.includes(role))) {
      throw new ForbiddenError('MFA enrollment is required before step-up');
    }
    const expiresAt = new Date(this.clock.now().getTime() + this.env.STEP_UP_WINDOW_SECONDS * 1000);
    await this.sessions.setStepUpExpiresAt(sessionId, expiresAt);
    const stepUpExp = Math.floor(expiresAt.getTime() / 1000);
    const accessToken = await this.tokenService.issueAccessToken({
      sub: user.id,
      email: user.email,
      sessionId,
      roles: user.roles,
      permissions: adminSessionPermissions(user.roles, user.permissions),
      surface: 'admin',
      stepUpExp,
    });
    await this.audit.create({
      action: 'ADMIN_STEP_UP_SUCCESS',
      actorUserId: user.id,
      targetUserId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    this.emitSecurity('step_up', user.id);
    return {
      stepUpExp,
      csrfToken: generateOpaqueToken(32),
      accessToken,
      expiresIn: this.env.JWT_ACCESS_TTL_SECONDS,
    };
  }

  async refresh(refreshToken: string, ctx: RequestContext): Promise<AdminAuthTokens> {
    await this.enforceRateLimit(`admin-refresh:${ctx.ipAddress ?? 'unknown'}`);
    const tokenHash = this.tokenService.hashRefreshToken(refreshToken);
    const stored = await this.refreshTokens.findByHash(tokenHash);
    if (!stored) {
      throw new UnauthorizedError('Invalid refresh token');
    }
    if (stored.revokedAt) {
      await this.refreshTokens.revokeFamily(stored.familyId);
      await this.sessions.revoke(stored.sessionId);
      throw new UnauthorizedError('Refresh token reuse detected; session family revoked');
    }
    const session = await this.sessions.findById(stored.sessionId);
    if (!session || session.revokedAt || session.surface !== 'admin') {
      throw new UnauthorizedError('Admin session is no longer valid');
    }
    const user = await this.requireAdminUser(stored.userId);
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
    const stepUpExp = session.stepUpExpiresAt
      ? Math.floor(session.stepUpExpiresAt.getTime() / 1000)
      : undefined;
    const accessToken = await this.tokenService.issueAccessToken({
      sub: user.id,
      email: user.email,
      sessionId: session.id,
      roles: user.roles,
      permissions: adminSessionPermissions(user.roles, user.permissions),
      surface: 'admin',
      stepUpExp,
    });
    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: this.env.JWT_ACCESS_TTL_SECONDS,
      tokenType: 'Bearer',
      csrfToken: generateOpaqueToken(32),
      sessionId: session.id,
    };
  }

  async logout(userId: string, sessionId: string, ctx: RequestContext): Promise<void> {
    await this.sessions.revoke(sessionId);
    await this.refreshTokens.revokeAllForSession(sessionId);
    await this.audit.create({
      action: 'ADMIN_LOGOUT',
      actorUserId: userId,
      targetUserId: userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { sessionId },
    });
    this.emitSecurity('logout', userId);
  }

  async getSession(
    userId: string,
    sessionId: string,
  ): Promise<{
    operator: AdminOperatorDto;
    sessionId: string;
    stepUpExp: number | null;
  }> {
    const user = await this.requireAdminUser(userId);
    const session = await this.sessions.findById(sessionId);
    if (!session || session.revokedAt || session.surface !== 'admin') {
      throw new UnauthorizedError('Admin session is no longer valid');
    }
    return {
      operator: await this.toOperatorDto(user),
      sessionId,
      stepUpExp: session.stepUpExpiresAt
        ? Math.floor(session.stepUpExpiresAt.getTime() / 1000)
        : null,
    };
  }

  async listOperators(query: { query?: string; skip?: number; take?: number }): Promise<{
    total: number;
    operators: AdminOperatorDto[];
  }> {
    const result = await this.users.search({
      query: query.query,
      skip: query.skip ?? 0,
      take: query.take ?? 25,
      adminPortalOnly: true,
    });
    const operators = await Promise.all(result.users.map((user) => this.toOperatorDto(user)));
    return { total: result.total, operators };
  }

  async getOperator(userId: string): Promise<AdminOperatorDto> {
    const user = await this.users.findById(userId);
    if (!user || !user.roles.some((role) => isAdminPortalRole(role))) {
      throw new NotFoundError('Administrator not found');
    }
    return this.toOperatorDto(user);
  }

  async assignOperatorRoles(
    actorId: string,
    targetId: string,
    roles: string[],
    reason: string,
    ctx: RequestContext,
  ): Promise<AdminOperatorDto> {
    this.assertReason(reason);
    this.assertPortalRoles(roles);
    const target = await this.requireExistingUser(targetId);
    const actor = await this.requireAdminUser(actorId);
    if (roles.includes(ROLE_SUPER_ADMIN) && !actor.roles.includes(ROLE_SUPER_ADMIN)) {
      throw new ForbiddenError('Only a super administrator may assign that role');
    }
    const updated = await this.users.assignRoles(target.id, roles);
    await this.audit.create({
      action: 'ADMIN_ROLE_CHANGED',
      actorUserId: actorId,
      targetUserId: target.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { roles, reason },
    });
    this.emitSecurity('role_changed', target.id, 'warning');
    return this.toOperatorDto(updated);
  }

  async updateOperatorStatus(
    actorId: string,
    targetId: string,
    status: UserStatus,
    reason: string,
    ctx: RequestContext,
  ): Promise<AdminOperatorDto> {
    this.assertReason(reason);
    const target = await this.requireExistingUser(targetId);
    if (targetId === actorId && status !== UserStatus.Active) {
      throw new ForbiddenError('Administrators cannot suspend their own account');
    }
    const updated = await this.users.updateStatus(target.id, status);
    if (status !== UserStatus.Active) {
      await this.sessions.revokeAllForUser(target.id);
      await this.refreshTokens.revokeAllForUser(target.id);
    }
    await this.audit.create({
      action: 'ADMIN_STATUS_CHANGED',
      actorUserId: actorId,
      targetUserId: target.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { status, reason },
    });
    this.emitSecurity('status_changed', target.id, 'warning');
    return this.toOperatorDto(updated);
  }

  async revokeOperatorSessions(
    actorId: string,
    targetId: string,
    reason: string,
    ctx: RequestContext,
  ): Promise<{ revoked: number }> {
    this.assertReason(reason);
    await this.requireExistingUser(targetId);
    const revoked = await this.sessions.revokeAllForUserSurface(targetId, 'admin');
    await this.refreshTokens.revokeAllForUser(targetId);
    await this.audit.create({
      action: 'ADMIN_SESSION_REVOKED',
      actorUserId: actorId,
      targetUserId: targetId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { reason, revoked },
    });
    this.emitSecurity('session_revoked', targetId, 'warning');
    return { revoked };
  }

  async resetOperatorMfa(
    actorId: string,
    targetId: string,
    reason: string,
    ctx: RequestContext,
  ): Promise<AdminOperatorDto> {
    this.assertReason(reason);
    const target = await this.requireExistingUser(targetId);
    await this.totp.deleteByUserId(target.id);
    await this.recovery.deleteByUserId(target.id);
    const updated = await this.users.toggleMfa(target.id, false);
    await this.sessions.revokeAllForUserSurface(target.id, 'admin');
    await this.refreshTokens.revokeAllForUser(target.id);
    await this.audit.create({
      action: 'ADMIN_MFA_RESET',
      actorUserId: actorId,
      targetUserId: target.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { reason },
    });
    this.emitSecurity('mfa_reset', target.id, 'critical');
    return this.toOperatorDto(updated);
  }

  async regenerateRecoveryCodes(
    userId: string,
    ctx: RequestContext,
  ): Promise<{ recoveryCodes: string[] }> {
    const user = await this.requireAdminUser(userId);
    const factor = await this.totp.findByUserId(user.id);
    if (!factor?.confirmedAt) {
      throw new ValidationError('MFA is not enrolled');
    }
    const recoveryCodes = generateRecoveryCodes(RECOVERY_CODE_COUNT);
    const hashes = await Promise.all(
      recoveryCodes.map((raw) => this.passwordHasher.hash(normalizeRecoveryCode(raw))),
    );
    await this.recovery.replaceAll(user.id, hashes);
    await this.audit.create({
      action: 'ADMIN_MFA_RESET',
      actorUserId: user.id,
      targetUserId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { reason: 'self_recovery_regenerate' },
    });
    return { recoveryCodes };
  }

  serializeOperator(dto: AdminOperatorDto): AdminOperatorDto {
    return { ...dto };
  }

  private async issueAdminSession(
    user: AuthUser,
    device: {
      deviceFingerprint: string;
      deviceName?: string;
      devicePlatform?: string;
      appVersion?: string;
    },
    ctx: RequestContext,
  ): Promise<AdminAuthTokens> {
    const latest = await this.requireAdminUser(user.id);
    await this.users.updateLastLogin(latest.id, this.clock.now());
    const deviceRecord = await this.devices.upsert({
      userId: latest.id,
      fingerprint: device.deviceFingerprint,
      name: device.deviceName,
      platform: device.devicePlatform ?? 'web',
      appVersion: device.appVersion,
      userAgent: ctx.userAgent,
    });
    const sessionExpiresAt = new Date(
      this.clock.now().getTime() + this.env.JWT_REFRESH_TTL_SECONDS * 1000,
    );
    const session = await this.sessions.create({
      userId: latest.id,
      deviceId: deviceRecord.id,
      ipAddress: ctx.ipAddress ?? null,
      userAgent: ctx.userAgent ?? null,
      expiresAt: sessionExpiresAt,
      surface: 'admin',
    });
    await this.sessions.markMfaSatisfied(session.id, this.clock.now());
    const familyId = this.ids.uuid();
    const refreshToken = this.tokenService.generateRefreshToken();
    await this.refreshTokens.create({
      userId: latest.id,
      sessionId: session.id,
      deviceId: deviceRecord.id,
      tokenHash: this.tokenService.hashRefreshToken(refreshToken),
      familyId,
      expiresAt: sessionExpiresAt,
    });
    const accessToken = await this.tokenService.issueAccessToken({
      sub: latest.id,
      email: latest.email,
      sessionId: session.id,
      roles: latest.roles,
      permissions: adminSessionPermissions(latest.roles, latest.permissions),
      surface: 'admin' satisfies AuthSurface,
    });
    await this.loginHistory.record({
      userId: latest.id,
      email: latest.email,
      outcome: 'SUCCESS',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    await this.audit.create({
      action: 'ADMIN_LOGIN_SUCCESS',
      actorUserId: latest.id,
      targetUserId: latest.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { sessionId: session.id, deviceId: deviceRecord.id },
    });
    this.emitSecurity('login', latest.id);
    return {
      accessToken,
      refreshToken,
      expiresIn: this.env.JWT_ACCESS_TTL_SECONDS,
      tokenType: 'Bearer',
      csrfToken: generateOpaqueToken(32),
      sessionId: session.id,
    };
  }

  private async toOperatorDto(user: AuthUser): Promise<AdminOperatorDto> {
    const factor = await this.totp.findByUserId(user.id);
    const activeSessionCount = await this.sessions.countActiveByUserId(user.id);
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      mfaEnabled: user.mfaEnabled,
      mfaEnrolled: Boolean(factor?.confirmedAt),
      roles: user.roles,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      activeSessionCount,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private async requireAdminUser(userId: string): Promise<AuthUser> {
    const user = await this.users.findById(userId);
    if (!user || user.deletedAt) {
      throw new UnauthorizedError('Invalid email or password');
    }
    if (!user.roles.some((role) => isAdminPortalRole(role))) {
      throw new ForbiddenError('Administrator access is required');
    }
    if (user.status === UserStatus.Suspended || user.status === UserStatus.Deactivated) {
      throw new ForbiddenError('Administrator account is not permitted to sign in');
    }
    return user;
  }

  private async requireExistingUser(userId: string): Promise<AuthUser> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundError('Administrator not found');
    }
    return user;
  }

  private assertReason(reason: string): void {
    if (!reason || reason.trim().length < 8) {
      throw new ValidationError('A detailed reason is required');
    }
  }

  private assertPortalRoles(roles: string[]): void {
    if (roles.length === 0) {
      throw new ValidationError('At least one role is required');
    }
    for (const role of roles) {
      if (
        role !== 'user' &&
        !isAdminPortalRole(role) &&
        !(ADMIN_PORTAL_ROLES as readonly string[]).includes(role)
      ) {
        throw new ForbiddenError('Role is not assignable on the Admin control plane');
      }
    }
    if (roles.includes('user') && roles.length === 1) {
      return;
    }
  }

  private async handleFailedPassword(
    user: AuthUser,
    email: string,
    ctx: RequestContext,
  ): Promise<never> {
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
    await this.recordAdminLoginFailure(user.id, email, ctx, 'invalid_credentials');
    if (lockedUntil) {
      throw new LockedError('Account is temporarily locked due to failed login attempts');
    }
    throw new UnauthorizedError('Invalid email or password');
  }

  private async recordAdminLoginFailure(
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
    await this.audit.create({
      action: 'ADMIN_LOGIN_FAILED',
      actorUserId: userId,
      targetUserId: userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { reason },
    });
  }

  private async auditMfaFailure(
    userId: string,
    ctx: RequestContext,
    reason: string,
  ): Promise<void> {
    await this.audit.create({
      action: 'ADMIN_MFA_FAILED',
      actorUserId: userId,
      targetUserId: userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      metadata: { reason },
    });
  }

  private emitSecurity(
    action: string,
    userId: string,
    severity: 'info' | 'warning' | 'critical' = 'info',
  ): void {
    void this.adminEvents
      .publish({
        type: 'SECURITY_EVENT',
        service: 'auth',
        userId,
        severity,
        metadata: { action },
      })
      .catch((error: unknown) => {
        this.logger.warn(
          `admin event failed: ${error instanceof Error ? error.message : 'unknown'}`,
        );
      });
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

  private async enforceMfaRateLimit(ctx: RequestContext, keyPart: string): Promise<void> {
    const result = await this.rateLimiter.consume(
      `admin-mfa:${ctx.ipAddress ?? 'unknown'}:${hashToken(keyPart).slice(0, 16)}`,
      this.env.MFA_RATE_LIMIT_MAX,
      this.env.MFA_RATE_LIMIT_WINDOW_SECONDS,
    );
    if (!result.allowed) {
      throw new RateLimitError('Too many MFA attempts');
    }
  }

  private async putChallenge(challenge: AdminChallenge, existingRaw?: string): Promise<string> {
    const raw = existingRaw ?? generateOpaqueToken(32);
    await this.redis
      .getClient()
      .setex(this.challengeKey(raw), CHALLENGE_TTL_SECONDS, JSON.stringify(challenge));
    return raw;
  }

  private async getChallenge(raw: string): Promise<AdminChallenge> {
    const payload = await this.redis.getClient().get(this.challengeKey(raw));
    if (!payload) {
      throw new UnauthorizedError('MFA challenge expired');
    }
    return JSON.parse(payload) as AdminChallenge;
  }

  private async deleteChallenge(raw: string): Promise<void> {
    await this.redis.getClient().del(this.challengeKey(raw));
  }

  private challengeKey(raw: string): string {
    return `admin:challenge:${hashToken(raw)}`;
  }
}
