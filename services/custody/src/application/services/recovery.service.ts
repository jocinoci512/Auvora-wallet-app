import { Inject, Injectable } from '@nestjs/common';
import { PrismaService, type RecoveryRequestStatus, type Prisma } from '@auvora/database';
import type { JwtAccessClaims } from '@auvora/types';
import {
  ConflictError,
  CustodyEventType,
  EVENT_BUS,
  type EventBusPort,
  ForbiddenError,
  NotFoundError,
  PERMISSION_CUSTODY_ADMIN,
} from '../../domain';
import { FIELD_ENCRYPTION, type FieldEncryptionPort } from '../../infrastructure/crypto/field-encryption.adapter';

export interface AddRecoveryContactInput {
  policyId: string;
  label: string;
  email?: string;
  phone?: string;
  userId?: string;
}

export interface StartRecoveryInput {
  policyId?: string;
  keyId?: string;
  reason?: string;
}

const OPEN_STATUSES: RecoveryRequestStatus[] = ['PENDING', 'AWAITING_APPROVAL', 'APPROVED'];

@Injectable()
export class RecoveryService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FIELD_ENCRYPTION) private readonly crypto: FieldEncryptionPort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
  ) {}

  async listContacts(ownerUserId: string) {
    return this.prisma.recoveryContact.findMany({
      where: { ownerUserId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addContact(ownerUserId: string, input: AddRecoveryContactInput) {
    const policy = await this.prisma.recoveryPolicy.findUnique({ where: { id: input.policyId } });
    if (!policy) throw new NotFoundError('Recovery policy not found');
    return this.prisma.recoveryContact.create({
      data: {
        policyId: input.policyId,
        ownerUserId,
        label: input.label,
        emailEncrypted: input.email ? this.crypto.encrypt(input.email) : undefined,
        phoneEncrypted: input.phone ? this.crypto.encrypt(input.phone) : undefined,
        userId: input.userId,
      },
    });
  }

  async removeContact(id: string, ownerUserId: string) {
    const contact = await this.prisma.recoveryContact.findUnique({ where: { id } });
    if (!contact) throw new NotFoundError('Recovery contact not found');
    if (contact.ownerUserId !== ownerUserId) {
      throw new ForbiddenError('Access denied');
    }
    return this.prisma.recoveryContact.update({ where: { id }, data: { isActive: false } });
  }

  async getDefaultPolicy(ownerUserId: string) {
    const specific = await this.prisma.recoveryPolicy.findFirst({
      where: { ownerUserId, isEnabled: true },
      orderBy: { createdAt: 'desc' },
    });
    if (specific) return specific;
    const global = await this.prisma.recoveryPolicy.findFirst({
      where: { ownerUserId: null, isEnabled: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!global) throw new NotFoundError('No recovery policy configured');
    return global;
  }

  async startRecovery(ownerUserId: string, input: StartRecoveryInput) {
    const policy = input.policyId
      ? await this.prisma.recoveryPolicy.findUnique({ where: { id: input.policyId } })
      : await this.getDefaultPolicy(ownerUserId);
    if (!policy) throw new NotFoundError('Recovery policy not found');

    if (input.keyId) {
      const key = await this.prisma.cryptographicKey.findUnique({ where: { id: input.keyId } });
      if (!key) throw new NotFoundError('Cryptographic key not found');
      if (key.ownerUserId !== ownerUserId) throw new ForbiddenError('Access denied');
      if (key.status === 'DESTROYED') throw new ConflictError('Cannot recover a destroyed key');
      await this.prisma.cryptographicKey.update({ where: { id: input.keyId }, data: { status: 'RECOVERING' } });
    }

    const requiresApproval = policy.requiredApprovals > 0;
    const created = await this.prisma.recoveryRequest.create({
      data: {
        policyId: policy.id,
        keyId: input.keyId,
        ownerUserId,
        status: requiresApproval ? 'AWAITING_APPROVAL' : 'APPROVED',
        reason: input.reason,
        expiresAt: new Date(Date.now() + policy.timeoutHours * 60 * 60 * 1000),
      },
    });

    await this.events.publish({
      type: CustodyEventType.RecoveryStarted,
      aggregateId: created.id,
      payload: { ownerUserId, keyId: input.keyId, policyId: policy.id },
    });

    return created;
  }

  async approve(requestId: string, approver: JwtAccessClaims) {
    const request = await this.getOrThrow(requestId);
    if (request.status !== 'AWAITING_APPROVAL') {
      throw new ConflictError(`Recovery request is not awaiting approval (status: ${request.status})`);
    }
    const policy = await this.prisma.recoveryPolicy.findUnique({ where: { id: request.policyId } });
    const approvalsCount = request.approvalsCount + 1;
    const satisfied = approvalsCount >= (policy?.requiredApprovals ?? 1);

    const updated = await this.prisma.recoveryRequest.update({
      where: { id: requestId },
      data: { approvalsCount, status: satisfied ? 'APPROVED' : 'AWAITING_APPROVAL' },
    });

    await this.prisma.custodyAuditRecord.create({
      data: {
        action: 'RECOVERY_APPROVED',
        actorUserId: approver.sub,
        subjectUserId: request.ownerUserId,
        resourceType: 'RecoveryRequest',
        resourceId: requestId,
        details: { approvalsCount, satisfied } as Prisma.InputJsonValue,
      },
    });

    return updated;
  }

  async reject(requestId: string, actor: JwtAccessClaims, reason?: string) {
    this.assertAdmin(actor);
    const request = await this.getOrThrow(requestId);
    if (request.keyId) {
      await this.prisma.cryptographicKey.update({ where: { id: request.keyId }, data: { status: 'ACTIVE' } });
    }
    return this.prisma.recoveryRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED', metadata: { reason } as Prisma.InputJsonValue },
    });
  }

  async complete(requestId: string, actor: JwtAccessClaims) {
    const request = await this.getOrThrow(requestId);
    if (request.status !== 'APPROVED') {
      throw new ConflictError(`Recovery request must be approved before completion (status: ${request.status})`);
    }
    const updated = await this.prisma.recoveryRequest.update({
      where: { id: requestId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    if (request.keyId) {
      await this.prisma.cryptographicKey.update({ where: { id: request.keyId }, data: { status: 'ACTIVE' } });
    }
    await this.events.publish({
      type: CustodyEventType.RecoveryCompleted,
      aggregateId: requestId,
      payload: { ownerUserId: request.ownerUserId, keyId: request.keyId, completedByUserId: actor.sub },
    });
    return updated;
  }

  async listOwn(ownerUserId: string) {
    return this.prisma.recoveryRequest.findMany({ where: { ownerUserId }, orderBy: { createdAt: 'desc' } });
  }

  async listQueue(filters: { status?: RecoveryRequestStatus; skip?: number; take?: number } = {}) {
    const skip = filters.skip ?? 0;
    const take = Math.min(filters.take ?? 50, 100);
    const where: Prisma.RecoveryRequestWhereInput = filters.status
      ? { status: filters.status }
      : { status: { in: OPEN_STATUSES } };
    const [items, total] = await Promise.all([
      this.prisma.recoveryRequest.findMany({ where, orderBy: { createdAt: 'asc' }, skip, take }),
      this.prisma.recoveryRequest.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  private async getOrThrow(id: string) {
    const request = await this.prisma.recoveryRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundError('Recovery request not found');
    return request;
  }

  private assertAdmin(requester: JwtAccessClaims) {
    if (!requester.permissions.includes(PERMISSION_CUSTODY_ADMIN)) {
      throw new ForbiddenError('Custody admin permission required');
    }
  }
}
