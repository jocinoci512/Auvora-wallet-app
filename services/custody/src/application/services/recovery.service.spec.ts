import type { JwtAccessClaims } from '@auvora/types';
import { ConflictError, ForbiddenError, NotFoundError } from '../../domain';
import { RecoveryService } from './recovery.service';

function buildPolicy(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: 'policy-1', ownerUserId: null, requiredApprovals: 1, timeoutHours: 72, isEnabled: true, ...overrides };
}

function buildRequest(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'rr-1',
    policyId: 'policy-1',
    keyId: 'key-1',
    ownerUserId: 'user-1',
    status: 'AWAITING_APPROVAL',
    approvalsCount: 0,
    ...overrides,
  };
}

function buildPrisma(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    recoveryPolicy: {
      findUnique: jest.fn().mockResolvedValue(buildPolicy()),
      findFirst: jest.fn().mockResolvedValue(buildPolicy()),
    },
    recoveryContact: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(data)),
      findUnique: jest.fn().mockResolvedValue({ id: 'contact-1', ownerUserId: 'user-1' }),
      update: jest.fn().mockResolvedValue({ isActive: false }),
    },
    cryptographicKey: {
      findUnique: jest.fn().mockResolvedValue({ id: 'key-1', ownerUserId: 'user-1', status: 'ACTIVE' }),
      update: jest.fn().mockResolvedValue({}),
    },
    recoveryRequest: {
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'rr-1', approvalsCount: 0, ...data }),
      ),
      findUnique: jest.fn().mockResolvedValue(buildRequest()),
      update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...buildRequest(), ...data }),
      ),
      findMany: jest.fn().mockResolvedValue([]),
    },
    custodyAuditRecord: { create: jest.fn().mockResolvedValue({}) },
    ...overrides,
  };
}

const crypto = { encrypt: (v: string) => `enc:${v}`, decrypt: (v: string) => v, hash: (v: string) => v };

const actor: JwtAccessClaims = {
  sub: 'admin-1',
  email: 'admin@auvora.io',
  sessionId: 's1',
  roles: ['admin'],
  permissions: ['custody:admin', 'custody:recovery'] as never,
};

describe('RecoveryService', () => {
  it('encrypts contact email and phone before persisting', async () => {
    const prisma = buildPrisma();
    const service = new RecoveryService(prisma as never, crypto as never, { publish: jest.fn() } as never);

    await service.addContact('user-1', { policyId: 'policy-1', label: 'Mom', email: 'mom@example.com', phone: '555-1234' });
    expect(prisma.recoveryContact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ emailEncrypted: 'enc:mom@example.com', phoneEncrypted: 'enc:555-1234' }),
      }),
    );
  });

  it('starts a recovery request awaiting approval and marks the key RECOVERING', async () => {
    const prisma = buildPrisma();
    const events = { publish: jest.fn().mockResolvedValue(undefined) };
    const service = new RecoveryService(prisma as never, crypto as never, events as never);

    const result = await service.startRecovery('user-1', { keyId: 'key-1', reason: 'lost device' });
    expect((result as { status: string }).status).toBe('AWAITING_APPROVAL');
    expect(prisma.cryptographicKey.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'RECOVERING' } }),
    );
    expect(events.publish).toHaveBeenCalled();
  });

  it('auto-approves recovery requests when the policy requires no approvals', async () => {
    const prisma = buildPrisma({
      recoveryPolicy: {
        findUnique: jest.fn().mockResolvedValue(buildPolicy({ requiredApprovals: 0 })),
        findFirst: jest.fn(),
      },
    });
    const service = new RecoveryService(prisma as never, crypto as never, { publish: jest.fn() } as never);

    const result = await service.startRecovery('user-1', { policyId: 'policy-1' });
    expect((result as { status: string }).status).toBe('APPROVED');
  });

  it('refuses to start recovery for a key owned by another user', async () => {
    const prisma = buildPrisma({
      cryptographicKey: { findUnique: jest.fn().mockResolvedValue({ id: 'key-1', ownerUserId: 'someone-else', status: 'ACTIVE' }) },
    });
    const service = new RecoveryService(prisma as never, crypto as never, { publish: jest.fn() } as never);

    await expect(service.startRecovery('user-1', { keyId: 'key-1', policyId: 'policy-1' })).rejects.toThrow(ForbiddenError);
  });

  it('throws ConflictError when approving a request that is not awaiting approval', async () => {
    const prisma = buildPrisma({
      recoveryRequest: {
        findUnique: jest.fn().mockResolvedValue(buildRequest({ status: 'COMPLETED' })),
        update: jest.fn(),
      },
    });
    const service = new RecoveryService(prisma as never, crypto as never, { publish: jest.fn() } as never);

    await expect(service.approve('rr-1', actor)).rejects.toThrow(ConflictError);
  });

  it('marks a recovery request APPROVED once required approvals are met', async () => {
    const prisma = buildPrisma();
    const service = new RecoveryService(prisma as never, crypto as never, { publish: jest.fn() } as never);

    const result = await service.approve('rr-1', actor);
    expect((result as { status: string }).status).toBe('APPROVED');
  });

  it('refuses to complete a recovery request that is not approved', async () => {
    const prisma = buildPrisma({
      recoveryRequest: { findUnique: jest.fn().mockResolvedValue(buildRequest({ status: 'AWAITING_APPROVAL' })), update: jest.fn() },
    });
    const service = new RecoveryService(prisma as never, crypto as never, { publish: jest.fn() } as never);

    await expect(service.complete('rr-1', actor)).rejects.toThrow(ConflictError);
  });

  it('completes an approved recovery request and reactivates the key', async () => {
    const prisma = buildPrisma({
      recoveryRequest: {
        findUnique: jest.fn().mockResolvedValue(buildRequest({ status: 'APPROVED' })),
        update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...buildRequest({ status: 'APPROVED' }), ...data }),
        ),
      },
    });
    const events = { publish: jest.fn().mockResolvedValue(undefined) };
    const service = new RecoveryService(prisma as never, crypto as never, events as never);

    const result = await service.complete('rr-1', actor);
    expect((result as { status: string }).status).toBe('COMPLETED');
    expect(prisma.cryptographicKey.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ACTIVE' } }),
    );
    expect(events.publish).toHaveBeenCalled();
  });

  it('throws NotFoundError for an unknown recovery request', async () => {
    const prisma = buildPrisma({ recoveryRequest: { findUnique: jest.fn().mockResolvedValue(null) } });
    const service = new RecoveryService(prisma as never, crypto as never, { publish: jest.fn() } as never);

    await expect(service.complete('missing', actor)).rejects.toThrow(NotFoundError);
  });
});
