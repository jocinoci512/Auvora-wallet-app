import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@auvora/database';
import { hashToken } from '@auvora/security';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import {
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
  assertPasswordPolicy,
} from '../../domain';
import { AUDIT_REPOSITORY, type AuditRepositoryPort } from '../ports/audit-repository.port';
import { PASSWORD_HASHER, type PasswordHasherPort } from '../ports/password-hasher.port';
import { RATE_LIMITER, type RateLimiterPort } from '../ports/rate-limiter.port';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepositoryPort,
} from '../ports/refresh-token-repository.port';
import { SESSION_REPOSITORY, type SessionRepositoryPort } from '../ports/session-repository.port';
import { USER_REPOSITORY, type UserRepositoryPort } from '../ports/user-repository.port';
import {
  NOTIFICATIONS_PUBLISHER,
  type NotificationsPublisherPort,
} from '../../infrastructure/notifications/notifications-publisher.adapter';
import {
  ADMIN_EVENT_PUBLISHER,
  type AdminEventPublisherPort,
} from '../ports/admin-event-publisher.port';
import type { RequestContext } from './auth.service';

const RECOVERY_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class VaultDeviceRecoveryService {
  private readonly logger = new Logger(VaultDeviceRecoveryService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(AUDIT_REPOSITORY) private readonly audit: AuditRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepositoryPort,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepositoryPort,
    @Inject(NOTIFICATIONS_PUBLISHER) private readonly notifications: NotificationsPublisherPort,
    @Inject(ADMIN_EVENT_PUBLISHER) private readonly adminEvents: AdminEventPublisherPort,
    @Inject(RATE_LIMITER) private readonly rateLimiter: RateLimiterPort,
  ) {}

  private async enforceLimit(key: string, limit = 10): Promise<void> {
    const result = await this.rateLimiter.consume(key, limit, this.env.RATE_LIMIT_WINDOW_SECONDS);
    if (!result.allowed) throw new RateLimitError('Too many requests');
  }

  private emitNotification(input: {
    eventType: string;
    aggregateId?: string;
    payload: Record<string, unknown>;
  }): void {
    void this.notifications.publishEvent(input).catch(() => undefined);
  }

  /** Create a pending recovery request using a valid password-reset token as ownership proof. */
  async createRequest(input: {
    resetToken: string;
    requestingDeviceFingerprint: string;
    requestingPlatform?: string;
    requestingPublicKey: string;
    ctx: RequestContext;
  }): Promise<{ requestId: string; expiresAt: string; status: string }> {
    await this.enforceLimit(`vault-recovery:create:${input.ctx.ipAddress ?? 'unknown'}`, 8);
    const tokenHash = hashToken(input.resetToken);
    const reset = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash, consumedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!reset) {
      throw new UnauthorizedError('Invalid or expired recovery authorization');
    }
    const user = await this.users.findById(reset.userId);
    if (!user) {
      throw new UnauthorizedError('Invalid or expired recovery authorization');
    }
    if (!input.requestingPublicKey || input.requestingPublicKey.length < 32) {
      throw new ValidationError('requestingPublicKey is required');
    }
    if (!input.requestingDeviceFingerprint?.trim()) {
      throw new ValidationError('requestingDeviceFingerprint is required');
    }

    await this.prisma.vaultDeviceRecoveryRequest.updateMany({
      where: { ownerUserId: user.id, status: 'PENDING' },
      data: { status: 'EXPIRED' },
    });

    const expiresAt = new Date(Date.now() + RECOVERY_TTL_MS);
    const row = await this.prisma.vaultDeviceRecoveryRequest.create({
      data: {
        ownerUserId: user.id,
        requestingDeviceFingerprint: input.requestingDeviceFingerprint.trim(),
        requestingPlatform: input.requestingPlatform?.trim() || null,
        requestingPublicKey: input.requestingPublicKey.trim(),
        ownershipTokenHash: tokenHash,
        status: 'PENDING',
        expiresAt,
      },
    });

    await this.audit.create({
      action: 'VAULT_RECOVERY_REQUESTED' as never,
      actorUserId: user.id,
      targetUserId: user.id,
      ipAddress: input.ctx.ipAddress,
      userAgent: input.ctx.userAgent,
      metadata: { requestId: row.id, platform: row.requestingPlatform },
    });

    this.emitNotification({
      eventType: 'auth.vault_recovery.requested',
      aggregateId: row.id,
      payload: {
        ownerUserId: user.id,
        requestId: row.id,
        platform: row.requestingPlatform,
      },
    });
    void this.adminEvents
      .publish({
        type: 'SECURITY_EVENT',
        userId: user.id,
        severity: 'warning',
        metadata: { kind: 'VAULT_RECOVERY_REQUESTED', requestId: row.id },
      })
      .catch(() => undefined);

    return {
      requestId: row.id,
      expiresAt: row.expiresAt.toISOString(),
      status: row.status,
    };
  }

  async listPendingForOwner(ownerUserId: string): Promise<
    Array<{
      requestId: string;
      requestingPlatform: string | null;
      requestingDeviceFingerprint: string;
      createdAt: string;
      expiresAt: string;
      status: string;
      requestingPublicKey: string;
    }>
  > {
    const now = new Date();
    await this.prisma.vaultDeviceRecoveryRequest.updateMany({
      where: { ownerUserId, status: 'PENDING', expiresAt: { lt: now } },
      data: { status: 'EXPIRED' },
    });
    const rows = await this.prisma.vaultDeviceRecoveryRequest.findMany({
      where: { ownerUserId, status: 'PENDING', expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    return rows.map((r) => ({
      requestId: r.id,
      requestingPlatform: r.requestingPlatform,
      requestingDeviceFingerprint: `${r.requestingDeviceFingerprint.slice(0, 12)}…`,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      status: r.status,
      requestingPublicKey: r.requestingPublicKey,
    }));
  }

  async approve(input: {
    ownerUserId: string;
    requestId: string;
    approvingDeviceId?: string;
    ciphertext: string;
    nonce: string;
    ephemeralPublicKey: string;
    aad: string;
    ctx: RequestContext;
  }) {
    await this.enforceLimit(`vault-recovery:approve:${input.ownerUserId}`, 20);
    const row = await this.prisma.vaultDeviceRecoveryRequest.findFirst({
      where: { id: input.requestId, ownerUserId: input.ownerUserId },
    });
    if (!row) throw new NotFoundError('Recovery request not found');
    if (row.status !== 'PENDING') {
      throw new ValidationError(`Recovery request is ${row.status}`);
    }
    if (row.expiresAt.getTime() <= Date.now()) {
      await this.prisma.vaultDeviceRecoveryRequest.update({
        where: { id: row.id },
        data: { status: 'EXPIRED' },
      });
      throw new ValidationError('Recovery request expired');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.vaultDeviceRecoveryPayload.upsert({
        where: { requestId: row.id },
        create: {
          requestId: row.id,
          ciphertext: input.ciphertext,
          nonce: input.nonce,
          ephemeralPublicKey: input.ephemeralPublicKey,
          aad: input.aad,
          expiresAt: row.expiresAt,
        },
        update: {
          ciphertext: input.ciphertext,
          nonce: input.nonce,
          ephemeralPublicKey: input.ephemeralPublicKey,
          aad: input.aad,
          expiresAt: row.expiresAt,
          consumedAt: null,
        },
      });
      await tx.vaultDeviceRecoveryRequest.update({
        where: { id: row.id },
        data: {
          status: 'APPROVED',
          approvedByDeviceId: input.approvingDeviceId ?? null,
        },
      });
    });

    await this.audit.create({
      action: 'VAULT_RECOVERY_APPROVED' as never,
      actorUserId: input.ownerUserId,
      targetUserId: input.ownerUserId,
      ipAddress: input.ctx.ipAddress,
      userAgent: input.ctx.userAgent,
      metadata: { requestId: row.id },
    });
    this.emitNotification({
      eventType: 'auth.vault_recovery.approved',
      aggregateId: row.id,
      payload: { ownerUserId: input.ownerUserId, requestId: row.id },
    });
    void this.adminEvents
      .publish({
        type: 'SECURITY_EVENT',
        userId: input.ownerUserId,
        metadata: { kind: 'VAULT_RECOVERY_APPROVED', requestId: row.id },
      })
      .catch(() => undefined);

    return { requestId: row.id, status: 'APPROVED' as const };
  }

  async deny(input: { ownerUserId: string; requestId: string; ctx: RequestContext }) {
    const row = await this.prisma.vaultDeviceRecoveryRequest.findFirst({
      where: { id: input.requestId, ownerUserId: input.ownerUserId },
    });
    if (!row) throw new NotFoundError('Recovery request not found');
    if (row.status !== 'PENDING') {
      throw new ValidationError(`Recovery request is ${row.status}`);
    }
    await this.prisma.vaultDeviceRecoveryRequest.update({
      where: { id: row.id },
      data: { status: 'DENIED', deniedAt: new Date() },
    });
    await this.audit.create({
      action: 'VAULT_RECOVERY_DENIED' as never,
      actorUserId: input.ownerUserId,
      targetUserId: input.ownerUserId,
      ipAddress: input.ctx.ipAddress,
      userAgent: input.ctx.userAgent,
      metadata: { requestId: row.id },
    });
    this.emitNotification({
      eventType: 'auth.vault_recovery.denied',
      aggregateId: row.id,
      payload: { ownerUserId: input.ownerUserId, requestId: row.id },
    });
    return { requestId: row.id, status: 'DENIED' as const };
  }

  async collect(input: {
    resetToken: string;
    requestId: string;
    requestingDeviceFingerprint: string;
    ctx: RequestContext;
  }) {
    await this.enforceLimit(`vault-recovery:collect:${input.ctx.ipAddress ?? 'unknown'}`, 15);
    const tokenHash = hashToken(input.resetToken);
    const row = await this.prisma.vaultDeviceRecoveryRequest.findFirst({
      where: { id: input.requestId },
      include: { payload: true },
    });
    if (!row || row.ownershipTokenHash !== tokenHash) {
      throw new UnauthorizedError('Invalid recovery authorization');
    }
    if (row.requestingDeviceFingerprint !== input.requestingDeviceFingerprint) {
      throw new ForbiddenError('Recovery payload is bound to another device');
    }
    if (row.status !== 'APPROVED' || !row.payload) {
      throw new ValidationError('Recovery is not approved yet');
    }
    if (row.expiresAt.getTime() <= Date.now() || row.payload.expiresAt.getTime() <= Date.now()) {
      await this.prisma.vaultDeviceRecoveryRequest.update({
        where: { id: row.id },
        data: { status: 'EXPIRED' },
      });
      throw new ValidationError('Recovery request expired');
    }
    if (row.payload.consumedAt) {
      throw new ValidationError('Recovery payload already used');
    }

    await this.prisma.vaultDeviceRecoveryPayload.update({
      where: { id: row.payload.id },
      data: { consumedAt: new Date() },
    });
    await this.prisma.vaultDeviceRecoveryRequest.update({
      where: { id: row.id },
      data: { status: 'CONSUMED', consumedAt: new Date() },
    });

    return {
      requestId: row.id,
      ownerUserId: row.ownerUserId,
      wrapped: {
        ciphertext: row.payload.ciphertext,
        nonce: row.payload.nonce,
        ephemeralPublicKey: row.payload.ephemeralPublicKey,
        aad: row.payload.aad,
        algorithmId: 'auvora-device-wrap-v1',
      },
    };
  }

  /**
   * Finalize recovery: password update AFTER client uploaded vault under new password.
   * Prefer vault-first then password so a failed vault upload never rotates credentials.
   */
  async complete(input: {
    resetToken: string;
    requestId: string;
    newPassword: string;
    expectedVaultEpoch: number;
    ctx: RequestContext;
  }) {
    assertPasswordPolicy(input.newPassword);
    const tokenHash = hashToken(input.resetToken);
    const row = await this.prisma.vaultDeviceRecoveryRequest.findFirst({
      where: { id: input.requestId },
    });
    if (!row || row.ownershipTokenHash !== tokenHash) {
      throw new UnauthorizedError('Invalid recovery authorization');
    }
    if (row.status !== 'CONSUMED' && row.status !== 'APPROVED') {
      throw new ValidationError('Recovery must be collected before complete');
    }

    const vault = await this.prisma.encryptedVaultBlob.findUnique({
      where: { ownerUserId: row.ownerUserId },
    });
    if (!vault || vault.epoch < input.expectedVaultEpoch) {
      throw new ValidationError(
        'Encrypted vault must be re-protected under the new password before completing recovery',
      );
    }

    const passwordHash = await this.passwordHasher.hash(input.newPassword);
    await this.users.updatePassword(row.ownerUserId, passwordHash);
    await this.prisma.passwordResetToken.updateMany({
      where: { tokenHash, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await this.sessions.revokeAllForUser(row.ownerUserId);
    await this.refreshTokens.revokeAllForUser(row.ownerUserId);

    await this.audit.create({
      action: 'VAULT_RECOVERY_COMPLETED' as never,
      actorUserId: row.ownerUserId,
      targetUserId: row.ownerUserId,
      ipAddress: input.ctx.ipAddress,
      userAgent: input.ctx.userAgent,
      metadata: { requestId: row.id, vaultEpoch: vault.epoch },
    });
    this.emitNotification({
      eventType: 'auth.vault_recovery.completed',
      aggregateId: row.id,
      payload: { ownerUserId: row.ownerUserId, requestId: row.id },
    });
    this.emitNotification({
      eventType: 'auth.password.changed',
      aggregateId: row.ownerUserId,
      payload: { ownerUserId: row.ownerUserId, via: 'vault_recovery' },
    });

    return { message: 'Recovery completed. Sign in with your new password.' };
  }

  async adminListForUser(ownerUserId: string): Promise<
    Array<{
      requestId: string;
      status: string;
      requestingPlatform: string | null;
      createdAt: string;
      expiresAt: string;
      deniedAt: string | null;
      consumedAt: string | null;
      approvedByDeviceId: string | null;
    }>
  > {
    const rows = await this.prisma.vaultDeviceRecoveryRequest.findMany({
      where: { ownerUserId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        status: true,
        requestingPlatform: true,
        createdAt: true,
        expiresAt: true,
        deniedAt: true,
        consumedAt: true,
        approvedByDeviceId: true,
      },
    });
    return rows.map((r) => ({
      requestId: r.id,
      status: r.status,
      requestingPlatform: r.requestingPlatform,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      deniedAt: r.deniedAt?.toISOString() ?? null,
      consumedAt: r.consumedAt?.toISOString() ?? null,
      approvedByDeviceId: r.approvedByDeviceId,
    }));
  }
}
