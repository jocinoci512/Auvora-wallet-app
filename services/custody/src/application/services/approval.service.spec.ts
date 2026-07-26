import type { JwtAccessClaims } from '@auvora/types';
import { ConflictError, ForbiddenError, NotFoundError } from '../../domain';
import { ApprovalService } from './approval.service';

function buildSigningRequestRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'sr-1',
    ownerUserId: 'user-1',
    status: 'AWAITING_APPROVAL',
    approvalPolicyId: 'policy-1',
    requiredApprovals: 1,
    receivedApprovals: 0,
    ...overrides,
  };
}

function buildPrisma(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    signingRequest: {
      findUnique: jest.fn().mockResolvedValue(buildSigningRequestRow()),
      update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...buildSigningRequestRow(), ...data }),
      ),
    },
    approvalPolicy: { findUnique: jest.fn().mockResolvedValue({ id: 'policy-1', kind: 'SINGLE', threshold: 1, signerGroupId: null }) },
    signerGroupMember: { findFirst: jest.fn().mockResolvedValue({ isActive: true }) },
    approvalRequest: { create: jest.fn().mockResolvedValue({}), findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    ...overrides,
  };
}

const approver: JwtAccessClaims = {
  sub: 'approver-1',
  email: 'approver@auvora.io',
  sessionId: 's1',
  roles: ['approver'],
  permissions: ['custody:approve'] as never,
};

describe('ApprovalService', () => {
  it('throws NotFoundError for a missing signing request', async () => {
    const prisma = buildPrisma({ signingRequest: { findUnique: jest.fn().mockResolvedValue(null) } });
    const service = new ApprovalService(prisma as never, { publish: jest.fn() } as never);

    await expect(service.approve('missing', approver)).rejects.toThrow(NotFoundError);
  });

  it('throws ConflictError when the request is not awaiting approval', async () => {
    const prisma = buildPrisma({
      signingRequest: { findUnique: jest.fn().mockResolvedValue(buildSigningRequestRow({ status: 'SIGNED' })) },
    });
    const service = new ApprovalService(prisma as never, { publish: jest.fn() } as never);

    await expect(service.approve('sr-1', approver)).rejects.toThrow(ConflictError);
  });

  it('rejects approval from a user outside the required signer group', async () => {
    const prisma = buildPrisma({
      approvalPolicy: { findUnique: jest.fn().mockResolvedValue({ id: 'policy-1', kind: 'MULTI', threshold: 2, signerGroupId: 'group-1' }) },
      signerGroupMember: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    const service = new ApprovalService(prisma as never, { publish: jest.fn() } as never);

    await expect(service.approve('sr-1', approver)).rejects.toThrow(ForbiddenError);
  });

  it('prevents the same approver from approving twice', async () => {
    const prisma = buildPrisma({
      approvalRequest: { create: jest.fn(), findFirst: jest.fn().mockResolvedValue({ id: 'existing' }), findMany: jest.fn() },
    });
    const service = new ApprovalService(prisma as never, { publish: jest.fn() } as never);

    await expect(service.approve('sr-1', approver)).rejects.toThrow(ConflictError);
  });

  it('marks a single-approval policy satisfied after one approval', async () => {
    const prisma = buildPrisma();
    const events = { publish: jest.fn().mockResolvedValue(undefined) };
    const service = new ApprovalService(prisma as never, events as never);

    const result = await service.approve('sr-1', approver);
    expect((result as { status: string }).status).toBe('APPROVED');
    expect(events.publish).toHaveBeenCalled();
  });

  it('keeps a dual-approval policy awaiting after only one approval', async () => {
    const prisma = buildPrisma({
      approvalPolicy: { findUnique: jest.fn().mockResolvedValue({ id: 'policy-1', kind: 'DUAL', threshold: 2, signerGroupId: null }) },
    });
    const service = new ApprovalService(prisma as never, { publish: jest.fn() } as never);

    const result = await service.approve('sr-1', approver);
    expect((result as { status: string }).status).toBe('AWAITING_APPROVAL');
  });

  it('rejects a signing request and records the reason', async () => {
    const prisma = buildPrisma();
    const events = { publish: jest.fn().mockResolvedValue(undefined) };
    const service = new ApprovalService(prisma as never, events as never);

    const result = await service.reject('sr-1', approver, 'suspicious destination');
    expect((result as { status: string }).status).toBe('REJECTED');
    expect((result as { failureReason: string }).failureReason).toBe('suspicious destination');
    expect(events.publish).toHaveBeenCalled();
  });
});
