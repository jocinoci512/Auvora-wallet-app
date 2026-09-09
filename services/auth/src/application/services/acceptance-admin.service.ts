import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@auvora/database';
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

    await this.audit.create({
      action: 'ACCEPTANCE_EMAIL_VERIFIED' as never,
      actorUserId: input.actorUserId,
      targetUserId: user.id,
      ipAddress: input.ctx.ipAddress,
      userAgent: input.ctx.userAgent,
      metadata: { emailDomain: ACCEPTANCE_EMAIL_SUFFIX },
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

    await this.audit.create({
      action: 'ACCEPTANCE_USER_CLEANUP' as never,
      actorUserId: input.actorUserId,
      targetUserId: user.id,
      ipAddress: input.ctx.ipAddress,
      userAgent: input.ctx.userAgent,
      metadata: {},
    });

    return { userId: user.id, message: 'Acceptance account cleaned up' };
  }
}
