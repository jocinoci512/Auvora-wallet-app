import { VaultDeviceRecoveryService } from './vault-device-recovery.service';

describe('VaultDeviceRecoveryService IDOR guards', () => {
  const prisma = {
    vaultDeviceRecoveryRequest: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    vaultDeviceRecoveryPayload: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    passwordResetToken: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    encryptedVaultBlob: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  };

  const users = { findById: jest.fn(), updatePassword: jest.fn() };
  const audit = { create: jest.fn() };
  const passwordHasher = { hash: jest.fn() };
  const sessions = { revokeAllForUser: jest.fn() };
  const refreshTokens = { revokeAllForUser: jest.fn() };
  const notifications = { publishEvent: jest.fn().mockResolvedValue(undefined) };
  const adminEvents = { publish: jest.fn().mockResolvedValue(undefined) };
  const rateLimiter = { consume: jest.fn().mockResolvedValue({ allowed: true }) };
  const env = { RATE_LIMIT_WINDOW_SECONDS: 60 };

  function build() {
    return new VaultDeviceRecoveryService(
      prisma as never,
      env as never,
      users as never,
      audit as never,
      passwordHasher as never,
      sessions as never,
      refreshTokens as never,
      notifications as never,
      adminEvents as never,
      rateLimiter as never,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('approve refuses requests owned by another user', async () => {
    prisma.vaultDeviceRecoveryRequest.findFirst.mockResolvedValue(null);
    const svc = build();
    await expect(
      svc.approve({
        ownerUserId: 'owner-a',
        requestId: 'req-1',
        ciphertext: 'c'.repeat(24),
        nonce: 'n'.repeat(16),
        ephemeralPublicKey: 'e'.repeat(24),
        aad: 'aad-test',
        ctx: {},
      }),
    ).rejects.toThrow(/not found/i);
  });

  it('collect refuses mismatched ownership token', async () => {
    prisma.vaultDeviceRecoveryRequest.findFirst.mockResolvedValue({
      id: 'req-1',
      ownershipTokenHash: 'other-hash',
      requestingDeviceFingerprint: 'fp-b',
      status: 'APPROVED',
      expiresAt: new Date(Date.now() + 60_000),
      payload: {
        id: 'p1',
        expiresAt: new Date(Date.now() + 60_000),
        consumedAt: null,
        ciphertext: 'x',
        nonce: 'y',
        ephemeralPublicKey: 'z',
        aad: 'a',
      },
    });
    const svc = build();
    await expect(
      svc.collect({
        resetToken: 'reset-token-value-long-enough',
        requestId: 'req-1',
        requestingDeviceFingerprint: 'fp-b',
        ctx: { ipAddress: '1.1.1.1' },
      }),
    ).rejects.toThrow(/Invalid recovery authorization/i);
  });

  it('adminListForUser never selects ciphertext fields', async () => {
    prisma.vaultDeviceRecoveryRequest.findMany.mockResolvedValue([
      {
        id: 'req-1',
        status: 'PENDING',
        requestingPlatform: 'android',
        createdAt: new Date(),
        expiresAt: new Date(),
        deniedAt: null,
        consumedAt: null,
        approvedByDeviceId: null,
      },
    ]);
    const svc = build();
    const rows = await svc.adminListForUser('owner-a');
    expect(rows[0]).toMatchObject({ requestId: 'req-1', status: 'PENDING' });
    expect(rows[0]).not.toHaveProperty('ciphertext');
    expect(prisma.vaultDeviceRecoveryRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          id: true,
          status: true,
        }),
      }),
    );
    const select = prisma.vaultDeviceRecoveryRequest.findMany.mock.calls[0][0].select;
    expect(select).not.toHaveProperty('requestingPublicKey');
    expect(select).not.toHaveProperty('ownershipTokenHash');
  });
});
