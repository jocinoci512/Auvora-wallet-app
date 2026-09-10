import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@auvora/database';
import { generateOpaqueToken, hashToken } from '@auvora/security';
import { UserStatus } from '@auvora/types';
import { ForbiddenError, NotFoundError, ValidationError } from '../../domain';
import { AUDIT_REPOSITORY, type AuditRepositoryPort } from '../ports/audit-repository.port';
import { SESSION_REPOSITORY, type SessionRepositoryPort } from '../ports/session-repository.port';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepositoryPort,
} from '../ports/refresh-token-repository.port';
import { USER_REPOSITORY, type UserRepositoryPort } from '../ports/user-repository.port';
import type { RequestContext } from './auth.service';
import { ROLE_SUPER_ADMIN } from '../../domain/permission-codes';

const ACCEPTANCE_EMAIL_SUFFIX = '@auvora-acceptance.test';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function auditActorUserId(actorUserId: string): string | undefined {
  return UUID_RE.test(actorUserId) ? actorUserId : undefined;
}

@Injectable()
export class AcceptanceAdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(AUDIT_REPOSITORY) private readonly audit: AuditRepositoryPort,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepositoryPort,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepositoryPort,
  ) {}

  private assertAcceptanceEmail(email: string): void {
    if (!email.toLowerCase().endsWith(ACCEPTANCE_EMAIL_SUFFIX)) {
      throw new ValidationError(
        `Acceptance verify is limited to *${ACCEPTANCE_EMAIL_SUFFIX} synthetic accounts`,
      );
    }
  }

  private async assertSimulationActive(userId: string): Promise<void> {
    const sim = await this.prisma.simulationAccount.findUnique({ where: { ownerUserId: userId } });
    if (!sim || sim.status !== 'ACTIVE') {
      throw new ForbiddenError(
        'User must be classified as an ACTIVE simulation/acceptance account first',
      );
    }
  }

  async bootstrapAcceptanceUser(input: {
    actorUserId: string;
    actorRoles: string[];
    userId: string;
    ctx: RequestContext;
  }) {
    if (!input.actorRoles.includes(ROLE_SUPER_ADMIN)) {
      throw new ForbiddenError('SUPER_ADMIN required');
    }
    const user = await this.users.findById(input.userId);
    if (!user) throw new NotFoundError('User not found');
    this.assertAcceptanceEmail(user.email);

    await this.prisma.simulationAccount.upsert({
      where: { ownerUserId: user.id },
      create: {
        ownerUserId: user.id,
        status: 'ACTIVE',
      },
      update: {
        status: 'ACTIVE',
      },
    });

    await this.users.markEmailVerified(user.id);
    await this.users.updateStatus(user.id, UserStatus.Active);

    const actorUserId = auditActorUserId(input.actorUserId);
    await this.audit.create({
      action: 'ACCEPTANCE_EMAIL_VERIFIED' as never,
      actorUserId,
      targetUserId: user.id,
      ipAddress: input.ctx.ipAddress,
      userAgent: input.ctx.userAgent,
      metadata: {
        emailDomain: ACCEPTANCE_EMAIL_SUFFIX,
        bootstrap: true,
        ...(actorUserId ? {} : { systemActor: input.actorUserId }),
      },
    });

    return {
      userId: user.id,
      emailVerified: true,
      status: 'ACTIVE',
      simulationStatus: 'ACTIVE',
      message: 'Acceptance account bootstrapped',
    };
  }

  async getSafeUserStatus(input: { actorUserId: string; actorRoles: string[]; userId: string }) {
    if (!input.actorRoles.includes(ROLE_SUPER_ADMIN)) {
      throw new ForbiddenError('SUPER_ADMIN required');
    }
    const user = await this.users.findById(input.userId);
    if (!user) throw new NotFoundError('User not found');
    this.assertAcceptanceEmail(user.email);

    const [vaultRow, recoveryRequestCount] = await Promise.all([
      this.prisma.encryptedVaultBlob.findUnique({
        where: { ownerUserId: user.id },
        select: {
          epoch: true,
          algorithmId: true,
          version: true,
          updatedAt: true,
          uploadedByDeviceId: true,
        },
      }),
      this.prisma.vaultDeviceRecoveryRequest.count({
        where: { ownerUserId: user.id },
      }),
    ]);

    const vault = vaultRow
      ? {
          exists: true,
          epoch: vaultRow.epoch,
          algorithmId: vaultRow.algorithmId,
          version: vaultRow.version,
          updatedAt: vaultRow.updatedAt.toISOString(),
          uploadedByDeviceId: vaultRow.uploadedByDeviceId,
        }
      : {
          exists: false,
          epoch: null,
          algorithmId: null,
          version: null,
          updatedAt: null,
          uploadedByDeviceId: null,
        };

    return { vault, recoveryRequestCount };
  }

  async verifyEmail(input: {
    actorUserId: string;
    actorRoles: string[];
    userId: string;
    ctx: RequestContext;
  }) {
    if (!input.actorRoles.includes(ROLE_SUPER_ADMIN)) {
      throw new ForbiddenError('SUPER_ADMIN required');
    }
    const user = await this.users.findById(input.userId);
    if (!user) throw new NotFoundError('User not found');
    this.assertAcceptanceEmail(user.email);
    await this.assertSimulationActive(user.id);

    await this.users.markEmailVerified(user.id);
    await this.users.updateStatus(user.id, UserStatus.Active);

    const actorUserId = auditActorUserId(input.actorUserId);
    await this.audit.create({
      action: 'ACCEPTANCE_EMAIL_VERIFIED' as never,
      actorUserId,
      targetUserId: user.id,
      ipAddress: input.ctx.ipAddress,
      userAgent: input.ctx.userAgent,
      metadata: {
        emailDomain: ACCEPTANCE_EMAIL_SUFFIX,
        ...(actorUserId ? {} : { systemActor: input.actorUserId }),
      },
    });

    return {
      userId: user.id,
      emailVerified: true,
      status: 'ACTIVE',
      message: 'Acceptance account email verified',
    };
  }

  async cleanup(input: {
    actorUserId: string;
    actorRoles: string[];
    userId: string;
    ctx: RequestContext;
  }) {
    if (!input.actorRoles.includes(ROLE_SUPER_ADMIN)) {
      throw new ForbiddenError('SUPER_ADMIN required');
    }
    const user = await this.users.findById(input.userId);
    if (!user) throw new NotFoundError('User not found');
    this.assertAcceptanceEmail(user.email);

    await this.prisma.simulationAccount.updateMany({
      where: { ownerUserId: user.id },
      data: { status: 'DISABLED' },
    });
    await this.sessions.revokeAllForUser(user.id);
    await this.refreshTokens.revokeAllForUser(user.id);
    await this.users.updateStatus(user.id, UserStatus.Suspended);

    const actorUserId = auditActorUserId(input.actorUserId);
    await this.audit.create({
      action: 'ACCEPTANCE_USER_CLEANUP' as never,
      actorUserId,
      targetUserId: user.id,
      ipAddress: input.ctx.ipAddress,
      userAgent: input.ctx.userAgent,
      metadata: {
        ...(actorUserId ? {} : { systemActor: input.actorUserId }),
      },
    });

    return { userId: user.id, message: 'Acceptance account cleaned up' };
  }

  /** Mint a short-lived password-reset token for acceptance harness (never log the raw token). */
  async mintPasswordResetToken(input: {
    actorUserId: string;
    actorRoles: string[];
    userId: string;
    ctx: RequestContext;
  }): Promise<{ resetToken: string; expiresAt: string }> {
    if (!input.actorRoles.includes(ROLE_SUPER_ADMIN)) {
      throw new ForbiddenError('SUPER_ADMIN required');
    }
    const user = await this.users.findById(input.userId);
    if (!user) throw new NotFoundError('User not found');
    this.assertAcceptanceEmail(user.email);
    await this.assertSimulationActive(user.id);

    const rawToken = generateOpaqueToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await this.users.createPasswordResetToken(user.id, tokenHash, expiresAt);

    const actorUserId = auditActorUserId(input.actorUserId);
    await this.audit.create({
      action: 'ACCEPTANCE_PASSWORD_RESET_MINTED' as never,
      actorUserId,
      targetUserId: user.id,
      ipAddress: input.ctx.ipAddress,
      userAgent: input.ctx.userAgent,
      metadata: {
        expiresAt: expiresAt.toISOString(),
        ...(actorUserId ? {} : { systemActor: input.actorUserId }),
      },
    });

    return { resetToken: rawToken, expiresAt: expiresAt.toISOString() };
  }

  /** Force-expire a vault recovery request for acceptance testing only. */
  async forceExpireVaultRecoveryRequest(input: {
    actorUserId: string;
    actorRoles: string[];
    requestId: string;
    ctx: RequestContext;
  }): Promise<{ requestId: string; status: string }> {
    if (!input.actorRoles.includes(ROLE_SUPER_ADMIN)) {
      throw new ForbiddenError('SUPER_ADMIN required');
    }
    const row = await this.prisma.vaultDeviceRecoveryRequest.findUnique({
      where: { id: input.requestId },
    });
    if (!row) throw new NotFoundError('Recovery request not found');

    const user = await this.users.findById(row.ownerUserId);
    if (!user) throw new NotFoundError('User not found');
    this.assertAcceptanceEmail(user.email);
    await this.assertSimulationActive(user.id);

    const past = new Date(Date.now() - 1000);
    await this.prisma.$transaction(async (tx) => {
      await tx.vaultDeviceRecoveryRequest.update({
        where: { id: row.id },
        data: { status: 'EXPIRED', expiresAt: past },
      });
      await tx.vaultDeviceRecoveryPayload.updateMany({
        where: { requestId: row.id },
        data: { expiresAt: past },
      });
    });

    const actorUserId = auditActorUserId(input.actorUserId);
    await this.audit.create({
      action: 'ACCEPTANCE_VAULT_RECOVERY_FORCE_EXPIRED' as never,
      actorUserId,
      targetUserId: user.id,
      ipAddress: input.ctx.ipAddress,
      userAgent: input.ctx.userAgent,
      metadata: {
        requestId: row.id,
        ...(actorUserId ? {} : { systemActor: input.actorUserId }),
      },
    });

    return { requestId: row.id, status: 'EXPIRED' };
  }
}
