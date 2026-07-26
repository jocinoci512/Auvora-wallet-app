import { UserStatus } from '@auvora/types';
import { AuthService } from './auth.service';
import { UnauthorizedError } from '../../domain';

const env = {
  LOCKOUT_MAX_ATTEMPTS: 5,
  LOCKOUT_DURATION_SECONDS: 900,
  JWT_ACCESS_TTL_SECONDS: 900,
  JWT_REFRESH_TTL_SECONDS: 604800,
  APP_PUBLIC_URL: 'http://localhost:3000',
  RATE_LIMIT_MAX: 100,
  RATE_LIMIT_WINDOW_SECONDS: 60,
};

function createAuthService(deps: {
  users?: Record<string, jest.Mock>;
  sessions?: Record<string, jest.Mock>;
  devices?: Record<string, jest.Mock>;
  refreshTokens?: Record<string, jest.Mock>;
  loginHistory?: Record<string, jest.Mock>;
  audit?: Record<string, jest.Mock>;
  passwordHasher?: Record<string, jest.Mock>;
  tokenService?: Record<string, jest.Mock>;
  mail?: Record<string, jest.Mock>;
  rateLimiter?: Record<string, jest.Mock>;
  clock?: Record<string, jest.Mock>;
  ids?: Record<string, jest.Mock>;
  analytics?: Record<string, jest.Mock>;
}): AuthService {
  const users = {
    findByEmail: jest.fn(),
    findByUsername: jest.fn(),
    create: jest.fn(),
    createEmailVerificationToken: jest.fn(),
    findById: jest.fn(),
    resetFailedLogin: jest.fn(),
    updateLastLogin: jest.fn(),
    recordFailedLogin: jest.fn(),
    markEmailVerified: jest.fn(),
    updateStatus: jest.fn(),
    ...deps.users,
  };

  return new AuthService(
    env as never,
    users as never,
    (deps.sessions ?? { create: jest.fn() }) as never,
    (deps.devices ?? { upsert: jest.fn().mockResolvedValue({ id: 'device-1' }) }) as never,
    (deps.refreshTokens ?? { create: jest.fn().mockResolvedValue({ id: 'rt-1' }) }) as never,
    (deps.loginHistory ?? { record: jest.fn() }) as never,
    (deps.audit ?? { create: jest.fn() }) as never,
    (deps.passwordHasher ?? {
      hash: jest.fn().mockResolvedValue('hash'),
      verify: jest.fn(),
    }) as never,
    (deps.tokenService ?? {
      issueAccessToken: jest.fn().mockResolvedValue('access-token'),
      generateRefreshToken: jest.fn().mockReturnValue('refresh-token'),
      hashRefreshToken: jest.fn().mockReturnValue('refresh-hash'),
    }) as never,
    (deps.mail ?? { send: jest.fn() }) as never,
    (deps.rateLimiter ?? {
      consume: jest.fn().mockResolvedValue({ allowed: true, remaining: 99 }),
    }) as never,
    (deps.clock ?? { now: jest.fn().mockReturnValue(new Date('2026-01-01T00:00:00.000Z')) }) as never,
    (deps.ids ?? { uuid: jest.fn().mockReturnValue('family-uuid') }) as never,
    (deps.analytics ?? { publishEvent: jest.fn().mockResolvedValue(undefined) }) as never,
  );
}

describe('AuthService', () => {
  it('registers a new user', async () => {
    const users = {
      findByEmail: jest.fn().mockResolvedValue(null),
      findByUsername: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'user-1', email: 'a@b.com' }),
      createEmailVerificationToken: jest.fn(),
    };
    const mail = { send: jest.fn() };
    const audit = { create: jest.fn() };
    const service = createAuthService({ users, mail, audit });

    const result = await service.register(
      {
        email: 'a@b.com',
        username: 'alice',
        password: 'SecurePass1!',
      },
      { ipAddress: '127.0.0.1' },
    );

    expect(result.userId).toBe('user-1');
    expect(users.create).toHaveBeenCalled();
    expect(mail.send).toHaveBeenCalled();
  });

  it('rejects login for invalid credentials', async () => {
    const users = {
      findByEmail: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        passwordHash: 'hash',
        deletedAt: null,
        status: UserStatus.Active,
        emailVerified: true,
        failedLoginCount: 0,
        lockedUntil: null,
        roles: [],
        permissions: [],
      }),
      recordFailedLogin: jest.fn(),
    };
    const passwordHasher = {
      hash: jest.fn(),
      verify: jest.fn().mockResolvedValue(false),
    };
    const service = createAuthService({ users, passwordHasher });

    await expect(
      service.login(
        { email: 'a@b.com', password: 'wrong', deviceFingerprint: 'fp-12345678' },
        {},
      ),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
