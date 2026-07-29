import { Inject, Injectable } from '@nestjs/common';
import { PrismaService, type ApprovalRequestStatus, type Prisma } from '@auvora/database';
import type { JwtAccessClaims } from '@auvora/types';
import {
  ConflictError,
  CustodyEventType,
  EVENT_BUS,
  type EventBusPort,
  ForbiddenError,
  isApprovalSatisfied,
  NotFoundError,
  PERMISSION_CUSTODY_ADMIN,
} from '../../domain';

@Injectable()
export class ApprovalService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
  ) {}

  async approve(signingRequestId: string, approver: JwtAccessClaims, note?: string) {
    const request = await this.prisma.signingRequest.findUnique({
      where: { id: signingRequestId },
    });
    if (!request) throw new NotFoundError('Signing request not found');
    if (request.status !== 'AWAITING_APPROVAL') {
      throw new ConflictError(
        `Signing request is not awaiting approval (status: ${request.status})`,
      );
    }

    const policy = request.approvalPolicyId
      ? await this.prisma.approvalPolicy.findUnique({ where: { id: request.approvalPolicyId } })
      : null;

    if (policy?.signerGroupId) {
      const membership = await this.prisma.signerGroupMember.findFirst({
        where: { groupId: policy.signerGroupId, userId: approver.sub, isActive: true },
      });
      if (!membership) {
        throw new ForbiddenError('Approver is not a member of the required signer group');
      }
    }

    const existing = await this.prisma.approvalRequest.findFirst({
      where: { signingRequestId, approverUserId: approver.sub, status: 'APPROVED' },
    });
    if (existing) {
      throw new ConflictError('Approver has already approved this request');
    }

    await this.prisma.approvalRequest.create({
      data: {
        signingRequestId,
        policyId: request.approvalPolicyId,
        approverUserId: approver.sub,
        status: 'APPROVED',
        decisionNote: note,
        decidedAt: new Date(),
      },
    });

    const receivedApprovals = request.receivedApprovals + 1;
    const satisfied = isApprovalSatisfied(
      {
        kind: policy?.kind ?? 'SINGLE',
        threshold: policy?.threshold ?? (request.requiredApprovals || 1),
      },
      receivedApprovals,
    );

    const updated = await this.prisma.signingRequest.update({
      where: { id: signingRequestId },
      data: {
        receivedApprovals,
        status: satisfied ? 'APPROVED' : 'AWAITING_APPROVAL',
      },
    });

    await this.events.publish({
      type: CustodyEventType.SigningApproved,
      aggregateId: signingRequestId,
      payload: { approverUserId: approver.sub, receivedApprovals, satisfied },
    });

    return updated;
  }

  async reject(signingRequestId: string, approver: JwtAccessClaims, reason: string) {
    const request = await this.prisma.signingRequest.findUnique({
      where: { id: signingRequestId },
    });
    if (!request) throw new NotFoundError('Signing request not found');
    if (request.status !== 'AWAITING_APPROVAL') {
      throw new ConflictError(
        `Signing request is not awaiting approval (status: ${request.status})`,
      );
    }

    await this.prisma.approvalRequest.create({
      data: {
        signingRequestId,
        policyId: request.approvalPolicyId,
        approverUserId: approver.sub,
        status: 'REJECTED',
        decisionNote: reason,
        decidedAt: new Date(),
      },
    });

    const updated = await this.prisma.signingRequest.update({
      where: { id: signingRequestId },
      data: { status: 'REJECTED', failureReason: reason },
    });

    await this.events.publish({
      type: CustodyEventType.SigningRejected,
      aggregateId: signingRequestId,
      payload: { approverUserId: approver.sub, reason },
    });

    return updated;
  }

  async listPending(approver: JwtAccessClaims) {
    return this.prisma.signingRequest.findMany({
      where: {
        status: 'AWAITING_APPROVAL',
        ownerUserId: approver.permissions.includes(PERMISSION_CUSTODY_ADMIN)
          ? undefined
          : approver.sub,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async listQueue(filters: { status?: ApprovalRequestStatus; skip?: number; take?: number } = {}) {
    const skip = filters.skip ?? 0;
    const take = Math.min(filters.take ?? 50, 100);
    const where: Prisma.SigningRequestWhereInput = { status: 'AWAITING_APPROVAL' };
    const [items, total] = await Promise.all([
      this.prisma.signingRequest.findMany({ where, orderBy: { createdAt: 'asc' }, skip, take }),
      this.prisma.signingRequest.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  async history(signingRequestId: string) {
    return this.prisma.approvalRequest.findMany({
      where: { signingRequestId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
