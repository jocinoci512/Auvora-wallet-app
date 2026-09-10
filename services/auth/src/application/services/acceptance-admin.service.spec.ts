import { AcceptanceAdminService } from './acceptance-admin.service';
import { ROLE_SUPER_ADMIN } from '../../domain/permission-codes';

describe('AcceptanceAdminService RBAC', () => {
  const prisma = {
    simulationAccount: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
    },
    encryptedVaultBlob: {
      findUnique: jest.fn(),
    },
    vaultDeviceRecoveryRequest: {
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    vaultDeviceRecoveryPayload: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<void>) =>
      fn({
        vaultDeviceRecoveryRequest: { update: jest.fn() },
        vaultDeviceRecoveryPayload: { updateMany: jest.fn() },
      }),
    ),
  };
  const users = {
    findById: jest.fn(),
    markEmailVerified: jest.fn(),
    updateStatus: jest.fn(),
    createPasswordResetToken: jest.fn(),
  };
  const audit = { create: jest.fn() };
  const sessions = { revokeAllForUser: jest.fn() };
  const refreshTokens = { revokeAllForUser: jest.fn() };

  function build() {
    return new AcceptanceAdminService(
      prisma as never,
      users as never,
      audit as never,
      sessions as never,
      refreshTokens as never,
    );
  }

  beforeEach(() => jest.clearAllMocks());

  it('rejects non-SUPER_ADMIN actors', async () => {
    const svc = build();
    await expect(
      svc.verifyEmail({
        actorUserId: 'admin-1',
        actorRoles: ['admin'],
        userId: 'user-1',
        ctx: {},
      }),
    ).rejects.toThrow(/SUPER_ADMIN/);
  });

  it('rejects non-acceptance email domains', async () => {
    users.findById.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.com',
    });
    const svc = build();
    await expect(
      svc.verifyEmail({
        actorUserId: 'admin-1',
        actorRoles: [ROLE_SUPER_ADMIN],
        userId: 'user-1',
        ctx: {},
      }),
    ).rejects.toThrow(/auvora-acceptance\.test/);
  });

  it('bootstraps acceptance users with simulation ACTIVE and verified email', async () => {
    users.findById.mockResolvedValue({
      id: 'user-1',
      email: 'qa@auvora-acceptance.test',
    });
    prisma.simulationAccount.upsert.mockResolvedValue({ status: 'ACTIVE' });
    const svc = build();
    const result = await svc.bootstrapAcceptanceUser({
      actorUserId: 'system:acceptance-runner',
      actorRoles: [ROLE_SUPER_ADMIN],
      userId: 'user-1',
      ctx: {},
    });
    expect(result.simulationStatus).toBe('ACTIVE');
    expect(prisma.simulationAccount.upsert).toHaveBeenCalled();
    expect(users.markEmailVerified).toHaveBeenCalledWith('user-1');
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ACCEPTANCE_EMAIL_VERIFIED',
        metadata: expect.objectContaining({ bootstrap: true }),
      }),
    );
  });

  it('returns scrubbed safe status for acceptance users', async () => {
    users.findById.mockResolvedValue({
      id: 'user-1',
      email: 'qa@auvora-acceptance.test',
    });
    prisma.encryptedVaultBlob.findUnique.mockResolvedValue({
      epoch: 1,
      algorithmId: 'v1',
      version: 1,
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      uploadedByDeviceId: 'device-1',
    });
    prisma.vaultDeviceRecoveryRequest.count.mockResolvedValue(3);
    const svc = build();
    const result = await svc.getSafeUserStatus({
      actorUserId: 'system:acceptance-runner',
      actorRoles: [ROLE_SUPER_ADMIN],
      userId: 'user-1',
    });
    expect(result.vault.exists).toBe(true);
    expect(result.vault.epoch).toBe(1);
    expect(result.recoveryRequestCount).toBe(3);
    expect(result.vault).not.toHaveProperty('ciphertext');
  });

  it('verifies only ACTIVE simulation acceptance users', async () => {
    users.findById.mockResolvedValue({
      id: 'user-1',
      email: 'qa@auvora-acceptance.test',
    });
    prisma.simulationAccount.findUnique.mockResolvedValue({ status: 'ACTIVE' });
    const svc = build();
    const result = await svc.verifyEmail({
      actorUserId: 'admin-1',
      actorRoles: [ROLE_SUPER_ADMIN],
      userId: 'user-1',
      ctx: {},
    });
    expect(result.emailVerified).toBe(true);
    expect(users.markEmailVerified).toHaveBeenCalledWith('user-1');
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ACCEPTANCE_EMAIL_VERIFIED' }),
    );
  });

  it('mints password reset token for ACTIVE acceptance users', async () => {
    users.findById.mockResolvedValue({
      id: 'user-1',
      email: 'qa@auvora-acceptance.test',
    });
    prisma.simulationAccount.findUnique.mockResolvedValue({ status: 'ACTIVE' });
    const svc = build();
    const result = await svc.mintPasswordResetToken({
      actorUserId: 'admin-1',
      actorRoles: [ROLE_SUPER_ADMIN],
      userId: 'user-1',
      ctx: {},
    });
    expect(result.resetToken.length).toBeGreaterThan(20);
    expect(result.expiresAt).toBeTruthy();
    expect(users.createPasswordResetToken).toHaveBeenCalled();
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ACCEPTANCE_PASSWORD_RESET_MINTED' }),
    );
  });

  it('force-expires vault recovery for acceptance users', async () => {
    prisma.vaultDeviceRecoveryRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      ownerUserId: 'user-1',
    });
    users.findById.mockResolvedValue({
      id: 'user-1',
      email: 'qa@auvora-acceptance.test',
    });
    prisma.simulationAccount.findUnique.mockResolvedValue({ status: 'ACTIVE' });
    const svc = build();
    const result = await svc.forceExpireVaultRecoveryRequest({
      actorUserId: 'admin-1',
      actorRoles: [ROLE_SUPER_ADMIN],
      requestId: 'req-1',
      ctx: {},
    });
    expect(result.requestId).toBe('req-1');
    expect(result.status).toBe('EXPIRED');
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ACCEPTANCE_VAULT_RECOVERY_FORCE_EXPIRED' }),
    );
  });
});
