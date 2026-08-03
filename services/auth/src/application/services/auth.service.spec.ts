import { UserStatus } from '@auvora/types';
import { AuthService } from './auth.service';
import { UnauthorizedError, ValidationError } from '../../domain';

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
    createPasswordResetToken: jest.fn(),
    consumeEmailVerificationToken: jest.fn(),
    consumePasswordResetToken: jest.fn(),
    markEmailVerified: jest.fn(),
    updateStatus: jest.fn(),
    updatePassword: jest.fn(),
    findById: jest.fn(),
    resetFailedLogin: jest.fn(),
    updateLastLogin: jest.fn(),
    recordFailedLogin: jest.fn(),
    ...deps.users,
  };

  return new AuthService(
    env as never,
    users as never,
    (deps.sessions ?? {
      create: jest.fn(),
      revokeAllForUser: jest.fn(),
      findById: jest.fn(),
      revoke: jest.fn(),
    }) as never,
    (deps.devices ?? {
      upsert: jest.fn().mockResolvedValue({ id: 'device-1' }),
      findByFingerprint: jest.fn().mockResolvedValue(null),
    }) as never,
    (deps.refreshTokens ?? {
      create: jest.fn().mockResolvedValue({ id: 'rt-1' }),
      revokeAllForUser: jest.fn(),
      revokeAllForSession: jest.fn(),
    }) as never,
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
    (deps.clock ?? {
      now: jest.fn().mockReturnValue(new Date('2026-01-01T00:00:00.000Z')),
    }) as never,
    (deps.ids ?? { uuid: jest.fn().mockReturnValue('family-uuid') }) as never,
    (deps.analytics ?? { publishEvent: jest.fn().mockResolvedValue(undefined) }) as never,
  );
}

describe('AuthService', () => {
  it('registers a new user with production verify link and hashed token storage', async () => {
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
    expect(users.createEmailVerificationToken).toHaveBeenCalledWith(
      'user-1',
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.any(Date),
    );
    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'a@b.com',
        html: expect.stringContaining('https://auvorawallet.com/auth/verify-email?token='),
        text: expect.stringMatching(/recovery phrase/i),
      }),
    );
  });

  it('register conflict does not enumerate email vs username', async () => {
    const passwordHasher = {
      hash: jest.fn().mockResolvedValue('hash'),
      verify: jest.fn(),
    };
    const emailConflict = createAuthService({
      users: {
        findByEmail: jest.fn().mockResolvedValue({ id: 'existing' }),
        findByUsername: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      passwordHasher,
    });
    const usernameConflict = createAuthService({
      users: {
        findByEmail: jest.fn().mockResolvedValue(null),
        findByUsername: jest.fn().mockResolvedValue({ id: 'existing' }),
        create: jest.fn(),
      },
      passwordHasher,
    });

    await expect(
      emailConflict.register(
        { email: 'taken@b.com', username: 'alice', password: 'SecurePass1!' },
        { ipAddress: '127.0.0.1' },
      ),
    ).rejects.toMatchObject({
      message: 'Unable to complete registration with the provided details',
    });
    await expect(
      usernameConflict.register(
        { email: 'new@b.com', username: 'taken', password: 'SecurePass1!' },
        { ipAddress: '127.0.0.1' },
      ),
    ).rejects.toMatchObject({
      message: 'Unable to complete registration with the provided details',
    });
    expect(passwordHasher.hash).toHaveBeenCalled();
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
      service.login({ email: 'a@b.com', password: 'wrong', deviceFingerprint: 'fp-12345678' }, {}),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('forgotPassword is enumeration-safe and uses production reset URL', async () => {
    const mail = { send: jest.fn() };
    const missing = createAuthService({
      users: { findByEmail: jest.fn().mockResolvedValue(null) },
      mail,
    });
    const missingMsg = await missing.forgotPassword('nobody@example.com', {});
    expect(missingMsg.message).toMatch(/If the account exists/i);
    expect(mail.send).not.toHaveBeenCalled();

    const users = {
      findByEmail: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        deletedAt: null,
      }),
      createPasswordResetToken: jest.fn(),
    };
    const audit = { create: jest.fn() };
    const present = createAuthService({ users, mail, audit });
    const presentMsg = await present.forgotPassword('a@b.com', { ipAddress: '1.1.1.1' });
    expect(presentMsg.message).toBe(missingMsg.message);
    expect(users.createPasswordResetToken).toHaveBeenCalledWith(
      'user-1',
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.any(Date),
    );
    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('https://auvorawallet.com/auth/reset-password?token='),
      }),
    );
  });

  it('rejects expired or reused verification tokens', async () => {
    const users = {
      consumeEmailVerificationToken: jest.fn().mockResolvedValue(null),
    };
    const service = createAuthService({ users });
    await expect(service.verifyEmail('expired-or-used', {})).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('rejects expired or reused password reset tokens', async () => {
    const users = {
      consumePasswordResetToken: jest.fn().mockResolvedValue(null),
    };
    const service = createAuthService({ users });
    await expect(
      service.resetPassword('expired-or-used', 'SecurePass1!', {}),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('resendVerification is enumeration-safe for unknown emails', async () => {
    const mail = { send: jest.fn() };
    const service = createAuthService({
      users: { findByEmail: jest.fn().mockResolvedValue(null) },
      mail,
    });
    const result = await service.resendVerification('ghost@example.com', {});
    expect(result.message).toMatch(/If the account exists/i);
    expect(mail.send).not.toHaveBeenCalled();
  });
});
