import { AcceptanceAdminService } from './acceptance-admin.service';
import { ROLE_SUPER_ADMIN } from '../../domain/permission-codes';

describe('AcceptanceAdminService RBAC', () => {
  const prisma = {
    simulationAccount: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const users = {
    findById: jest.fn(),
    markEmailVerified: jest.fn(),
    updateStatus: jest.fn(),
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
});
