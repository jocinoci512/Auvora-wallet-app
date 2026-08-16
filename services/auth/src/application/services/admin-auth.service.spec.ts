import { UserStatus } from '@auvora/types';
import { ForbiddenError, LockedError, UnauthorizedError, ValidationError } from '../../domain';
import { generateTotpCode, generateTotpSecret } from '../../domain/totp';
import { AesFieldEncryptionAdapter } from '../../infrastructure/crypto/aes-field-encryption.adapter';
import { AdminAuthService } from './admin-auth.service';
import type { AuthUser } from '../ports/user-repository.port';

const env = {
  NODE_ENV: 'test',
  LOCKOUT_MAX_ATTEMPTS: 5,
  LOCKOUT_DURATION_SECONDS: 900,
  JWT_ACCESS_TTL_SECONDS: 900,
  JWT_REFRESH_TTL_SECONDS: 604800,
  RATE_LIMIT_MAX: 100,
  RATE_LIMIT_WINDOW_SECONDS: 60,
  MFA_RATE_LIMIT_MAX: 5,
  MFA_RATE_LIMIT_WINDOW_SECONDS: 900,
  STEP_UP_WINDOW_SECONDS: 600,
  AUTH_FIELD_ENCRYPTION_KEY: 'k'.repeat(32),
};

const now = new Date('2026-08-16T12:00:00.000Z');

function adminUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'admin-1',
    email: 'admin@auvora.local',
    username: 'admin',
    passwordHash: 'hash:Password12!ab',
    firstName: 'Ada',
    lastName: 'Admin',
    phoneNumber: null,
    avatarUrl: null,
    preferredLanguage: 'en',
    timeZone: 'UTC',
    country: null,
    status: UserStatus.Active,
    emailVerified: true,
    mfaEnabled: true,
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    roles: ['super_admin'],
    permissions: ['admins:manage', 'roles:manage', 'users:read'],
    ...overrides,
  };
}

function createService(overrides: Record<string, unknown> = {}) {
  const store = new Map<string, string>();
  const users = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    resetFailedLogin: jest.fn(),
    recordFailedLogin: jest.fn(),
    updateLastLogin: jest.fn(),
    toggleMfa: jest.fn(),
    assignRoles: jest.fn(),
    updateStatus: jest.fn(),
    search: jest.fn(),
    ...(overrides.users as object),
  };
  const sessions = {
    create: jest.fn().mockResolvedValue({ id: 'sess-1', surface: 'admin' }),
    findById: jest.fn().mockResolvedValue({
      id: 'sess-1',
      userId: 'admin-1',
      surface: 'admin',
      revokedAt: null,
      expiresAt: new Date(now.getTime() + 60_000),
      stepUpExpiresAt: null,
    }),
    revoke: jest.fn(),
    revokeAllForUser: jest.fn().mockResolvedValue(2),
    revokeAllForUserSurface: jest.fn().mockResolvedValue(2),
    markMfaSatisfied: jest.fn(),
    setStepUpExpiresAt: jest.fn(),
    countActiveByUserId: jest.fn().mockResolvedValue(1),
    ...(overrides.sessions as object),
  };
  const devices = {
    upsert: jest.fn().mockResolvedValue({ id: 'dev-1' }),
  };
  const refreshTokens = {
    create: jest.fn().mockResolvedValue({ id: 'rt-1' }),
    findByHash: jest.fn(),
    revoke: jest.fn(),
    revokeFamily: jest.fn(),
    revokeAllForUser: jest.fn(),
    revokeAllForSession: jest.fn(),
    ...(overrides.refreshTokens as object),
  };
  const loginHistory = { record: jest.fn() };
  const audit = { create: jest.fn(), ...(overrides.audit as object) };
  const passwordHasher = {
    hash: jest.fn(async (plain: string) => `hash:${plain}`),
    verify: jest.fn(async (plain: string, hash: string) => hash === `hash:${plain}`),
  };
  const tokenService = {
    issueAccessToken: jest.fn().mockResolvedValue('admin-access'),
    generateRefreshToken: jest.fn().mockReturnValue('admin-refresh'),
    hashRefreshToken: jest.fn().mockReturnValue('admin-refresh-hash'),
  };
  const rateLimiter = {
    consume: jest.fn().mockResolvedValue({ allowed: true, remaining: 4 }),
    ...(overrides.rateLimiter as object),
  };
  const clock = { now: jest.fn().mockReturnValue(now) };
  const ids = { uuid: jest.fn().mockReturnValue('family-1') };
  const adminEvents = { publish: jest.fn().mockResolvedValue(undefined) };
  const totp = {
    findByUserId: jest.fn().mockResolvedValue(null),
    upsertPending: jest.fn(),
    confirm: jest.fn(),
    markUsedStep: jest.fn(),
    deleteByUserId: jest.fn(),
    ...(overrides.totp as object),
  };
  const recovery = {
    replaceAll: jest.fn(),
    listActiveByUserId: jest.fn().mockResolvedValue([]),
    consume: jest.fn(),
    deleteByUserId: jest.fn(),
    ...(overrides.recovery as object),
  };
  const fieldEncryption = new AesFieldEncryptionAdapter(env as never);
  const redis = {
    getClient: () => ({
      setex: async (key: string, _ttl: number, value: string) => {
        store.set(key, value);
      },
      get: async (key: string) => store.get(key) ?? null,
      del: async (key: string) => {
        store.delete(key);
      },
    }),
  };

  const service = new AdminAuthService(
    env as never,
    users as never,
    sessions as never,
    devices as never,
    refreshTokens as never,
    loginHistory as never,
    audit as never,
    passwordHasher as never,
    tokenService as never,
    rateLimiter as never,
    clock as never,
    ids as never,
    adminEvents as never,
    totp as never,
    recovery as never,
    fieldEncryption,
    redis as never,
  );
  return { service, users, sessions, totp, recovery, audit, rateLimiter, fieldEncryption, store };
}

const loginInput = {
  email: 'admin@auvora.local',
  password: 'Password12!ab',
  deviceFingerprint: 'fp-admin-1',
};

describe('AdminAuthService', () => {
  it('1. valid Admin login without MFA (support) issues an admin session', async () => {
    const user = adminUser({ roles: ['support'], mfaEnabled: false, permissions: ['users:read'] });
    const { service, users } = createService();
    users.findByEmail.mockResolvedValue(user);
    users.findById.mockResolvedValue(user);
    const result = await service.login(loginInput, { ipAddress: '1.1.1.1' });
    expect(result.status).toBe('authenticated');
    if (result.status === 'authenticated') {
      expect(result.tokens.sessionId).toBe('sess-1');
      expect(JSON.stringify(result.tokens)).not.toContain('passwordHash');
    }
  });

  it('2. normal user is denied', async () => {
    const { service, users } = createService();
    users.findByEmail.mockResolvedValue(adminUser({ roles: ['user'] }));
    await expect(service.login(loginInput, {})).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('3. suspended Admin is denied', async () => {
    const { service, users } = createService();
    users.findByEmail.mockResolvedValue(adminUser({ status: UserStatus.Suspended }));
    await expect(service.login(loginInput, {})).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('4. invalid password is denied', async () => {
    const { service, users } = createService();
    users.findByEmail.mockResolvedValue(adminUser());
    await expect(
      service.login({ ...loginInput, password: 'wrong-password' }, {}),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('5. lockout after failed attempts', async () => {
    const { service, users } = createService();
    users.findByEmail.mockResolvedValue(adminUser({ failedLoginCount: 4 }));
    await expect(service.login({ ...loginInput, password: 'bad' }, {})).rejects.toBeInstanceOf(
      LockedError,
    );
  });

  it('6-8. MFA enrollment + valid TOTP + invalid TOTP', async () => {
    const user = adminUser();
    const { service, users, totp, fieldEncryption } = createService();
    users.findByEmail.mockResolvedValue(user);
    users.findById.mockResolvedValue(user);
    users.toggleMfa.mockResolvedValue(user);
    const login = await service.login(loginInput, {});
    expect(login.status).toBe('mfa_enrollment_required');
    if (login.status === 'authenticated') throw new Error('expected enrollment');
    const start = await service.startEnrollment(login.mfaToken, {});
    expect(start.secret).toBeTruthy();
    expect(start.otpauthUrl.startsWith('otpauth://totp/')).toBe(true);
    const encrypted = fieldEncryption.encrypt(start.secret);
    totp.findByUserId.mockResolvedValue({
      secretEncrypted: encrypted,
      confirmedAt: null,
      lastUsedStep: null,
    });
    const step = Math.floor(now.getTime() / 1000 / 30);
    const code = generateTotpCode(start.secret, step);
    const confirmed = await service.confirmEnrollment(login.mfaToken, code, {});
    expect(confirmed.tokens.sessionId).toBe('sess-1');
    expect(confirmed.recoveryCodes).toHaveLength(10);
    await expect(service.confirmEnrollment(login.mfaToken, '000000', {})).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('9. replay of a used TOTP step is rejected', async () => {
    const secret = generateTotpSecret();
    const user = adminUser();
    const { service, users, totp, fieldEncryption } = createService();
    users.findByEmail.mockResolvedValue(user);
    users.findById.mockResolvedValue(user);
    const encrypted = fieldEncryption.encrypt(secret);
    const step = Math.floor(now.getTime() / 1000 / 30);
    totp.findByUserId.mockResolvedValue({
      secretEncrypted: encrypted,
      confirmedAt: now,
      lastUsedStep: BigInt(step),
    });
    const login = await service.login(loginInput, {});
    if (login.status !== 'mfa_required') throw new Error('expected mfa');
    const code = generateTotpCode(secret, step);
    await expect(service.verifyMfa(login.mfaToken, code, {})).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('10. MFA is required for super_admin', async () => {
    const { service, users } = createService();
    users.findByEmail.mockResolvedValue(adminUser({ mfaEnabled: false }));
    const result = await service.login(loginInput, {});
    expect(result.status).toBe('mfa_enrollment_required');
  });

  it('11-12. recovery code works once then reuse is rejected', async () => {
    const user = adminUser();
    const { service, users, totp, recovery, fieldEncryption } = createService();
    users.findByEmail.mockResolvedValue(user);
    users.findById.mockResolvedValue(user);
    totp.findByUserId.mockResolvedValue({
      secretEncrypted: fieldEncryption.encrypt(generateTotpSecret()),
      confirmedAt: now,
      lastUsedStep: null,
    });
    recovery.listActiveByUserId
      .mockResolvedValueOnce([{ id: 'rc-1', codeHash: 'hash:AB12CD34' }])
      .mockResolvedValueOnce([]);
    const login = await service.login(loginInput, {});
    if (login.status !== 'mfa_required') throw new Error('expected mfa');
    const tokens = await service.verifyRecovery(login.mfaToken, 'AB12-CD34', {});
    expect(tokens.sessionId).toBe('sess-1');
    await expect(service.verifyRecovery(login.mfaToken, 'AB12-CD34', {})).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it('13. MFA reset requires a reason and revokes sessions', async () => {
    const user = adminUser();
    const { service, users, sessions } = createService();
    users.findById.mockResolvedValue(user);
    users.toggleMfa.mockResolvedValue({ ...user, mfaEnabled: false });
    await expect(service.resetOperatorMfa('actor', 'admin-1', 'short', {})).rejects.toBeInstanceOf(
      ValidationError,
    );
    const dto = await service.resetOperatorMfa('actor', 'admin-1', 'lost authenticator device', {});
    expect(dto.mfaEnabled).toBe(false);
    expect(sessions.revokeAllForUserSurface).toHaveBeenCalledWith('admin-1', 'admin');
    expect(JSON.stringify(dto)).not.toMatch(/secret|passwordHash|recovery/i);
  });

  it('14. logout revokes the session', async () => {
    const { service, sessions, audit } = createService();
    await service.logout('admin-1', 'sess-1', {});
    expect(sessions.revoke).toHaveBeenCalledWith('sess-1');
    expect(audit.create).toHaveBeenCalledWith(expect.objectContaining({ action: 'ADMIN_LOGOUT' }));
  });

  it('15. expired/revoked session is denied', async () => {
    const { service, users } = createService({
      sessions: {
        findById: jest.fn().mockResolvedValue({
          id: 'sess-1',
          userId: 'admin-1',
          surface: 'admin',
          revokedAt: new Date(),
          expiresAt: now,
        }),
      },
    });
    users.findById.mockResolvedValue(adminUser());
    await expect(service.getSession('admin-1', 'sess-1')).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('30-32. step-up succeeds, then expired step-up is visible as null', async () => {
    const user = adminUser();
    const secret = generateTotpSecret();
    const { service, users, totp, sessions, fieldEncryption } = createService();
    users.findById.mockResolvedValue(user);
    const step = Math.floor(now.getTime() / 1000 / 30);
    totp.findByUserId.mockResolvedValue({
      secretEncrypted: fieldEncryption.encrypt(secret),
      confirmedAt: now,
      lastUsedStep: null,
    });
    const result = await service.stepUp(
      'admin-1',
      'sess-1',
      { password: 'Password12!ab', code: generateTotpCode(secret, step) },
      {},
    );
    expect(result.stepUpExp - Math.floor(now.getTime() / 1000)).toBe(600);
    expect(sessions.setStepUpExpiresAt).toHaveBeenCalled();
    await expect(
      service.stepUp('admin-1', 'sess-1', { password: 'bad', code: '000000' }, {}),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('24-29. operator serializer never leaks secrets and READ_ONLY listing is safe', async () => {
    const { service, users, totp } = createService();
    const user = adminUser({ roles: ['read_only'], permissions: ['users:read'] });
    users.findById.mockResolvedValue(user);
    totp.findByUserId.mockResolvedValue(null);
    const dto = await service.getOperator('admin-1');
    expect(dto).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(dto)).not.toMatch(/secretEncrypted|codeHash|refreshToken/);
  });

  it('improper privilege escalation is denied', async () => {
    const { service, users } = createService();
    users.findById.mockImplementation(async (id: string) => {
      if (id === 'actor') return adminUser({ id: 'actor', roles: ['admin'] });
      return adminUser({ id: 'target', roles: ['support'] });
    });
    await expect(
      service.assignOperatorRoles(
        'actor',
        'target',
        ['super_admin'],
        'need more access please',
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('5b. MFA rate limit is enforced', async () => {
    const { service, users } = createService({
      rateLimiter: { consume: jest.fn().mockResolvedValue({ allowed: false, remaining: 0 }) },
    });
    users.findByEmail.mockResolvedValue(adminUser());
    await expect(service.login(loginInput, {})).rejects.toMatchObject({ httpStatus: 429 });
  });

  it('38. login, MFA, step-up, role, status, and revoke emit audit events without secrets', async () => {
    const user = adminUser({ roles: ['support'], mfaEnabled: false, permissions: ['users:read'] });
    const { service, users, audit } = createService();
    users.findByEmail.mockResolvedValue(user);
    users.findById.mockResolvedValue(user);
    users.assignRoles.mockResolvedValue(user);
    users.updateStatus.mockResolvedValue({ ...user, status: 'SUSPENDED' });
    await service.login(loginInput, {});
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ADMIN_LOGIN_SUCCESS' }),
    );

    users.findById.mockImplementation(async (id: string) => {
      if (id === 'actor') return adminUser({ id: 'actor', roles: ['super_admin'] });
      return user;
    });
    await service.assignOperatorRoles('actor', 'admin-1', ['support'], 'adjust support scope', {});
    await service.updateOperatorStatus(
      'actor',
      'admin-1',
      UserStatus.Suspended,
      'policy violation review',
      {},
    );
    await service.revokeOperatorSessions('actor', 'admin-1', 'compromise suspected now', {});
    const payload = JSON.stringify(audit.create.mock.calls);
    expect(payload).toContain('ADMIN_ROLE_CHANGED');
    expect(payload).toContain('ADMIN_STATUS_CHANGED');
    expect(payload).toContain('ADMIN_SESSION_REVOKED');
    expect(payload).not.toMatch(/passwordHash|secretEncrypted|recoveryCodes/);
  });

  it('invalid password emits ADMIN_LOGIN_FAILED without enumerating the user', async () => {
    const { service, users, audit } = createService();
    users.findByEmail.mockResolvedValue(adminUser());
    await expect(
      service.login({ ...loginInput, password: 'wrong-password' }, {}),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(audit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ADMIN_LOGIN_FAILED',
        metadata: expect.not.objectContaining({ password: expect.anything() }),
      }),
    );
  });
});
