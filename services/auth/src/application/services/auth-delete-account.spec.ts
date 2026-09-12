jest.mock(
  '@auvora/database',
  () => ({
    PrismaService: class PrismaService {},
    VerificationStatus: {
      APPROVED: 'APPROVED',
      IN_REVIEW: 'IN_REVIEW',
      DRAFT: 'DRAFT',
    },
    Prisma: {},
  }),
  { virtual: true },
);

import { UserStatus } from '@auvora/types';
import { UnauthorizedError, ValidationError } from '../../domain';
import { AuthService } from './auth.service';

// Minimal harness mirroring auth.service.spec.ts constructor wiring.
function createService(overrides: {
  users?: Record<string, jest.Mock>;
  passwordHasher?: Record<string, jest.Mock>;
  sessions?: Record<string, jest.Mock>;
  devices?: Record<string, jest.Mock>;
  refreshTokens?: Record<string, jest.Mock>;
  audit?: Record<string, jest.Mock>;
  accountDeletion?: Record<string, jest.Mock>;
}): AuthService {
  const env = {
    NODE_ENV: 'test',
    LOCKOUT_MAX_ATTEMPTS: 5,
    LOCKOUT_DURATION_SECONDS: 900,
    JWT_ACCESS_TTL_SECONDS: 900,
    JWT_REFRESH_TTL_SECONDS: 604800,
    APP_PUBLIC_URL: 'https://auvorawallet.com',
    RATE_LIMIT_MAX: 100,
    RATE_LIMIT_WINDOW_SECONDS: 60,
    MAIL_RATE_LIMIT_MAX: 5,
    MAIL_RATE_LIMIT_WINDOW_SECONDS: 900,
  };

  return new AuthService(
    env as never,
    {
      findById: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'reviewer@example.com',
        username: 'reviewer',
        passwordHash: 'hash',
        firstName: 'R',
        lastName: 'E',
        phoneNumber: null,
        avatarUrl: null,
        preferredLanguage: 'en',
        timeZone: 'UTC',
        country: null,
        status: UserStatus.Active,
        emailVerified: true,
        mfaEnabled: false,
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        roles: ['user'],
        permissions: [],
      }),
      anonymizeAndSoftDelete: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'deleted+user1@deleted.invalid',
        username: 'deleted_user1',
        passwordHash: 'tombstone',
        firstName: null,
        lastName: null,
        phoneNumber: null,
        avatarUrl: null,
        preferredLanguage: 'en',
        timeZone: 'UTC',
        country: null,
        status: UserStatus.Deleted,
        emailVerified: false,
        mfaEnabled: false,
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date('2026-09-12T00:00:00.000Z'),
        roles: ['user'],
        permissions: [],
      }),
      ...overrides.users,
    } as never,
    (overrides.sessions ?? { revokeAllForUser: jest.fn() }) as never,
    (overrides.devices ?? { revokeAllForUser: jest.fn().mockResolvedValue(1) }) as never,
    (overrides.refreshTokens ?? { revokeAllForUser: jest.fn() }) as never,
    { record: jest.fn() } as never,
    (overrides.audit ?? { create: jest.fn() }) as never,
    (overrides.passwordHasher ?? {
      hash: jest.fn().mockResolvedValue('tombstone-hash'),
      verify: jest.fn().mockResolvedValue(true),
    }) as never,
    {
      issueAccessToken: jest.fn(),
      generateRefreshToken: jest.fn(),
      hashRefreshToken: jest.fn(),
    } as never,
    { send: jest.fn() } as never,
    { consume: jest.fn().mockResolvedValue({ allowed: true, remaining: 99 }) } as never,
    { now: jest.fn().mockReturnValue(new Date('2026-09-12T00:00:00.000Z')) } as never,
    { uuid: jest.fn().mockReturnValue('id') } as never,
    { publishEvent: jest.fn().mockResolvedValue(undefined) } as never,
    { publishEvent: jest.fn().mockResolvedValue(undefined) } as never,
    { publish: jest.fn().mockResolvedValue(undefined) } as never,
    (overrides.accountDeletion ?? {
      purgeEligibleCloudData: jest.fn().mockResolvedValue({
        vaultPurged: true,
        vaultRecoveryRequestsPurged: 0,
        mfaCleared: true,
        notificationPreferencesDeleted: true,
        kycAction: 'NONE',
      }),
    }) as never,
  );
}

describe('AuthService.deleteMyAccount', () => {
  it('requires typed DELETE confirmation', async () => {
    const service = createService({});
    await expect(
      service.deleteMyAccount('user-1', 'password', 'please', {}),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects incorrect password', async () => {
    const service = createService({
      passwordHasher: {
        hash: jest.fn(),
        verify: jest.fn().mockResolvedValue(false),
      },
    });
    await expect(service.deleteMyAccount('user-1', 'wrong', 'DELETE', {})).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('revokes access, purges eligible data, and anonymizes the user', async () => {
    const sessions = { revokeAllForUser: jest.fn() };
    const refreshTokens = { revokeAllForUser: jest.fn() };
    const devices = { revokeAllForUser: jest.fn().mockResolvedValue(2) };
    const audit = { create: jest.fn() };
    const anonymizeAndSoftDelete = jest.fn().mockResolvedValue({
      id: 'user-1',
      email: 'deleted+user1@deleted.invalid',
      username: 'deleted_user1',
      passwordHash: 'tombstone',
      firstName: null,
      lastName: null,
      phoneNumber: null,
      avatarUrl: null,
      preferredLanguage: 'en',
      timeZone: 'UTC',
      country: null,
      status: UserStatus.Deleted,
      emailVerified: false,
      mfaEnabled: false,
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: new Date('2026-09-12T00:00:00.000Z'),
      roles: ['user'],
      permissions: [],
    });
    const purgeEligibleCloudData = jest.fn().mockResolvedValue({
      vaultPurged: true,
      vaultRecoveryRequestsPurged: 1,
      mfaCleared: true,
      notificationPreferencesDeleted: true,
      kycAction: 'PURGED_IMMEDIATELY',
    });

    const service = createService({
      users: { anonymizeAndSoftDelete },
      sessions,
      refreshTokens,
      devices,
      audit,
      accountDeletion: { purgeEligibleCloudData },
    });

    const result = await service.deleteMyAccount('user-1', 'correct-password', 'delete', {
      ipAddress: '1.2.3.4',
    });

    expect(sessions.revokeAllForUser).toHaveBeenCalledWith('user-1');
    expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith('user-1');
    expect(devices.revokeAllForUser).toHaveBeenCalledWith('user-1');
    expect(purgeEligibleCloudData).toHaveBeenCalledWith('user-1');
    expect(anonymizeAndSoftDelete).toHaveBeenCalled();
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_SOFT_DELETED',
        metadata: expect.objectContaining({ selfService: true, anonymized: true }),
      }),
    );
    expect(result.dataSummary.vaultPurged).toBe(true);
    expect(result.deletedAt).toBe('2026-09-12T00:00:00.000Z');
  });
});
