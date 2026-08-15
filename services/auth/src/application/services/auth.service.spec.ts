import { UserStatus } from '@auvora/types';
import { AuthService } from './auth.service';
import { ForbiddenError, UnauthorizedError, ValidationError } from '../../domain';

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

  const activeUser = () => ({
    id: 'user-1',
    email: 'a@b.com',
    passwordHash: 'stored-hash',
    deletedAt: null,
    status: UserStatus.Active,
    emailVerified: true,
    failedLoginCount: 0,
    lockedUntil: null,
    roles: ['user'],
    permissions: ['wallets:read'],
  });

  it('successful login updates lastLoginAt and records the android device platform', async () => {
    const users = {
      findByEmail: jest.fn().mockResolvedValue(activeUser()),
      resetFailedLogin: jest.fn(),
      updateLastLogin: jest.fn(),
    };
    const passwordHasher = { hash: jest.fn(), verify: jest.fn().mockResolvedValue(true) };
    const devices = {
      upsert: jest.fn().mockResolvedValue({ id: 'device-1' }),
      findByFingerprint: jest.fn().mockResolvedValue(null),
    };
    const sessions = {
      create: jest.fn().mockResolvedValue({ id: 'session-1' }),
      revokeAllForUser: jest.fn(),
    };
    const service = createAuthService({ users, passwordHasher, devices, sessions });

    const result = await service.login(
      {
        email: 'a@b.com',
        password: 'SecurePass1!',
        deviceFingerprint: 'fp-12345678',
        devicePlatform: 'android',
      },
      { ipAddress: '10.0.0.1' },
    );

    expect(result.accessToken).toBe('access-token');
    expect(users.updateLastLogin).toHaveBeenCalledWith('user-1', expect.any(Date));
    expect(devices.upsert).toHaveBeenCalledWith(expect.objectContaining({ platform: 'android' }));
  });

  it('failed login does not update lastLoginAt', async () => {
    const users = {
      findByEmail: jest.fn().mockResolvedValue(activeUser()),
      recordFailedLogin: jest.fn(),
      updateLastLogin: jest.fn(),
    };
    const passwordHasher = { hash: jest.fn(), verify: jest.fn().mockResolvedValue(false) };
    const service = createAuthService({ users, passwordHasher });

    await expect(
      service.login({ email: 'a@b.com', password: 'wrong', deviceFingerprint: 'fp-12345678' }, {}),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(users.updateLastLogin).not.toHaveBeenCalled();
  });

  it('adminGetUser returns lastLoginAt, distinct platforms, counts, and never passwordHash', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const future = new Date(now.getTime() + 3_600_000);
    const past = new Date(now.getTime() - 3_600_000);
    const users = {
      findById: jest.fn().mockResolvedValue({
        ...activeUser(),
        firstName: 'A',
        lastName: 'B',
        phoneNumber: null,
        avatarUrl: null,
        preferredLanguage: 'en',
        timeZone: 'UTC',
        country: null,
        mfaEnabled: false,
        lastLoginAt: now,
        createdAt: now,
        updatedAt: now,
      }),
    };
    const devices = {
      listByUserId: jest.fn().mockResolvedValue([
        { id: 'd1', platform: 'android', lastSeenAt: now, createdAt: now },
        { id: 'd2', platform: 'web', lastSeenAt: now, createdAt: now },
        { id: 'd3', platform: 'android', lastSeenAt: now, createdAt: now },
      ]),
    };
    const sessions = {
      listByUserId: jest.fn().mockResolvedValue([
        { id: 's1', revokedAt: null, expiresAt: future, createdAt: now },
        { id: 's2', revokedAt: past, expiresAt: future, createdAt: now },
      ]),
    };
    const service = createAuthService({ users, devices, sessions });

    const account = await service.adminGetUser('user-1');

    expect(account.lastLoginAt).toBe(now.toISOString());
    expect(account.platforms).toEqual(['android', 'web']);
    expect(account.deviceCount).toBe(3);
    expect(account.activeSessionCount).toBe(1);
    expect((account as Record<string, unknown>).passwordHash).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Phase 1: lastLoginAt, admin platform/counts, and secret serialization.
// ---------------------------------------------------------------------------
const SECRET_KEYS = [
  'passwordHash',
  'password',
  'refreshToken',
  'refresh_token',
  'accessToken',
  'sessionSecret',
  'mnemonic',
  'seedPhrase',
  'privateKey',
  'symKey',
  'fieldEncryptionKey',
  'internalApiKey',
  'csrfSecret',
  'resetTokenHash',
  'emailVerificationTokenHash',
];

// A full backend user record as returned by the repository — deliberately carries
// a passwordHash so tests prove it is never serialized to admin/profile responses.
function fullUser(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'user-1',
    email: 'a@b.com',
    username: 'alice',
    passwordHash: 'argon2-secret-hash',
    firstName: 'A',
    lastName: 'B',
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
    lastLoginAt: now,
    roles: ['user'],
    permissions: ['wallets:read'],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function assertNoSecrets(obj: unknown) {
  const json = JSON.stringify(obj);
  for (const key of SECRET_KEYS) {
    expect(json).not.toContain(`"${key}"`);
  }
  // Value-level guard: the stored hash must never appear anywhere in the payload.
  expect(json).not.toContain('argon2-secret-hash');
}

describe('AuthService Phase 1 — lastLoginAt', () => {
  function loginService(
    userOverrides: Record<string, unknown> = {},
    extra: Record<string, unknown> = {},
  ) {
    const users = {
      findByEmail: jest.fn().mockResolvedValue(fullUser(userOverrides)),
      resetFailedLogin: jest.fn(),
      updateLastLogin: jest.fn(),
      recordFailedLogin: jest.fn(),
      create: jest.fn(),
      ...(extra.users as object),
    };
    const passwordHasher = { hash: jest.fn(), verify: jest.fn().mockResolvedValue(true) };
    const devices = {
      upsert: jest.fn().mockResolvedValue({ id: 'device-1' }),
      findByFingerprint: jest.fn().mockResolvedValue(null),
    };
    const sessions = {
      create: jest.fn().mockResolvedValue({ id: 'session-1' }),
      revokeAllForUser: jest.fn(),
    };
    const service = createAuthService({ users, passwordHasher, devices, sessions });
    return { service, users, devices };
  }

  it('successful login updates lastLoginAt using the authenticated user id and creates no new user', async () => {
    const { service, users } = loginService();
    await service.login(
      {
        email: 'a@b.com',
        password: 'SecurePass1!',
        deviceFingerprint: 'fp-12345678',
        devicePlatform: 'android',
      },
      { ipAddress: '10.0.0.1' },
    );
    expect(users.updateLastLogin).toHaveBeenCalledWith('user-1', expect.any(Date));
    expect(users.create).not.toHaveBeenCalled();
  });

  it('failed login does not update lastLoginAt', async () => {
    const users = {
      findByEmail: jest.fn().mockResolvedValue(fullUser()),
      recordFailedLogin: jest.fn(),
      updateLastLogin: jest.fn(),
    };
    const svc = createAuthService({
      users,
      passwordHasher: { hash: jest.fn(), verify: jest.fn().mockResolvedValue(false) },
    });
    await expect(
      svc.login({ email: 'a@b.com', password: 'wrong', deviceFingerprint: 'fp-12345678' }, {}),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(users.updateLastLogin).not.toHaveBeenCalled();
  });

  it('suspended account cannot sign in and does not update lastLoginAt', async () => {
    const users = {
      findByEmail: jest.fn().mockResolvedValue(fullUser({ status: UserStatus.Suspended })),
      updateLastLogin: jest.fn(),
    };
    const svc = createAuthService({
      users,
      passwordHasher: { hash: jest.fn(), verify: jest.fn().mockResolvedValue(true) },
    });
    await expect(
      svc.login(
        {
          email: 'a@b.com',
          password: 'SecurePass1!',
          deviceFingerprint: 'fp-12345678',
          devicePlatform: 'android',
        },
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(users.updateLastLogin).not.toHaveBeenCalled();
  });

  it('repeated successful logins move lastLoginAt forward', async () => {
    const t1 = new Date('2026-01-01T00:00:00.000Z');
    const t2 = new Date('2026-01-02T00:00:00.000Z');
    const clock = { now: jest.fn().mockReturnValueOnce(t1).mockReturnValue(t2) };
    const users = {
      findByEmail: jest.fn().mockResolvedValue(fullUser()),
      resetFailedLogin: jest.fn(),
      updateLastLogin: jest.fn(),
    };
    const svc = createAuthService({
      users,
      passwordHasher: { hash: jest.fn(), verify: jest.fn().mockResolvedValue(true) },
      devices: {
        upsert: jest.fn().mockResolvedValue({ id: 'd1' }),
        findByFingerprint: jest.fn().mockResolvedValue(null),
      },
      sessions: { create: jest.fn().mockResolvedValue({ id: 's1' }), revokeAllForUser: jest.fn() },
      clock,
    });
    const login = () =>
      svc.login(
        { email: 'a@b.com', password: 'SecurePass1!', deviceFingerprint: 'fp-12345678' },
        {},
      );
    await login();
    await login();
    const calls = users.updateLastLogin.mock.calls.map((c) => (c[1] as Date).getTime());
    expect(calls.length).toBe(2);
    expect(calls[1]).toBeGreaterThanOrEqual(calls[0]);
  });

  it('web login (no devicePlatform) still works and defaults platform to web', async () => {
    const { service, devices } = loginService();
    const result = await service.login(
      { email: 'a@b.com', password: 'SecurePass1!', deviceFingerprint: 'fp-web-12345678' },
      {},
    );
    expect(result.accessToken).toBe('access-token');
    expect(devices.upsert).toHaveBeenCalledWith(expect.objectContaining({ platform: 'web' }));
  });
});

describe('AuthService Phase 1 — admin platform/counts + serialization', () => {
  function adminService(
    searchResult: { total: number; users: unknown[] },
    detailDeps: Record<string, unknown> = {},
  ) {
    const users = {
      search: jest.fn().mockResolvedValue(searchResult),
      findById: jest.fn().mockResolvedValue(detailDeps.user ?? fullUser()),
    };
    const devices = { listByUserId: jest.fn().mockResolvedValue(detailDeps.devices ?? []) };
    const sessions = { listByUserId: jest.fn().mockResolvedValue(detailDeps.sessions ?? []) };
    return { service: createAuthService({ users, devices, sessions }), users, devices, sessions };
  }

  it('empty database returns 0 users (no fake/demo counts)', async () => {
    const { service } = adminService({ total: 0, users: [] });
    const res = await service.adminSearchUsers({ skip: 0, take: 25 });
    expect(res.total).toBe(0);
    expect(res.users).toEqual([]);
  });

  it('android + web users appear in the same canonical users list; total comes from the repo', async () => {
    const { service, users } = adminService({
      total: 2,
      users: [
        fullUser({ id: 'u-web', email: 'web@b.com', username: 'web' }),
        fullUser({ id: 'u-and', email: 'and@b.com', username: 'and' }),
      ],
    });
    const res = await service.adminSearchUsers({ skip: 0, take: 25 });
    expect(res.total).toBe(2);
    expect(res.users.map((u) => u.id).sort()).toEqual(['u-and', 'u-web']);
    expect(users.search).toHaveBeenCalledWith({ skip: 0, take: 25 });
  });

  it('status filter is passed to the repo so filtered totals are not corrupted', async () => {
    const { service, users } = adminService({ total: 1, users: [fullUser()] });
    await service.adminSearchUsers({ status: UserStatus.Active, skip: 0, take: 10 });
    expect(users.search).toHaveBeenCalledWith({ status: UserStatus.Active, skip: 0, take: 10 });
  });

  it('a single cross-platform user (android+web devices) is ONE user with both platforms, not double-counted', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const { service } = adminService(
      { total: 1, users: [fullUser()] },
      {
        devices: [
          { id: 'd1', platform: 'web', lastSeenAt: now, createdAt: now },
          { id: 'd2', platform: 'android', lastSeenAt: now, createdAt: now },
        ],
        sessions: [
          {
            id: 's1',
            revokedAt: null,
            expiresAt: new Date(now.getTime() + 3_600_000),
            createdAt: now,
          },
        ],
      },
    );
    const search = await service.adminSearchUsers({ skip: 0, take: 25 });
    expect(search.total).toBe(1);
    const detail = await service.adminGetUser('user-1');
    expect(detail.platforms).toEqual(['android', 'web']);
    expect(detail.deviceCount).toBe(2);
    expect(detail.activeSessionCount).toBe(1);
  });

  it('GET /admin/users list never serializes passwordHash or other secrets', async () => {
    const { service } = adminService({ total: 1, users: [fullUser()] });
    const res = await service.adminSearchUsers({ skip: 0, take: 25 });
    assertNoSecrets(res);
  });

  it('GET /admin/users/:id detail never serializes passwordHash or other secrets', async () => {
    const { service } = adminService({ total: 1, users: [fullUser()] }, { user: fullUser() });
    const detail = await service.adminGetUser('user-1');
    assertNoSecrets(detail);
  });

  it('current-user profile never serializes passwordHash or other secrets', async () => {
    const users = { findById: jest.fn().mockResolvedValue(fullUser()) };
    const service = createAuthService({ users });
    const profile = await service.getProfile('user-1');
    assertNoSecrets(profile);
  });

  it('profile serializer whitelists exactly the safe fields (no accidental extras)', async () => {
    const users = { findById: jest.fn().mockResolvedValue(fullUser()) };
    const service = createAuthService({ users });
    const profile = await service.getProfile('user-1');
    expect(Object.keys(profile).sort()).toEqual(
      [
        'avatarUrl',
        'country',
        'createdAt',
        'email',
        'emailVerified',
        'firstName',
        'id',
        'lastLoginAt',
        'lastName',
        'mfaEnabled',
        'permissions',
        'phoneNumber',
        'preferredLanguage',
        'roles',
        'status',
        'timeZone',
        'updatedAt',
        'username',
      ].sort(),
    );
  });
});
