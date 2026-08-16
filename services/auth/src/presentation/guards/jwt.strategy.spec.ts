import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy (admin session)', () => {
  const env = { JWT_ACCESS_SECRET: 'a'.repeat(48) };

  function strategy(sessions: { findById: jest.Mock }) {
    return new JwtStrategy(env as never, sessions as never);
  }

  const payload = {
    sub: 'admin-1',
    email: 'admin@auvora.local',
    sessionId: 'sess-1',
    roles: ['super_admin'],
    permissions: ['admins:manage'],
    surface: 'admin' as const,
  };

  it('22. accepts a live Admin session (SSE cookie path uses the same validate)', async () => {
    const sessions = {
      findById: jest.fn().mockResolvedValue({
        id: 'sess-1',
        userId: 'admin-1',
        surface: 'admin',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        stepUpExpiresAt: null,
      }),
    };
    const result = await strategy(sessions).validate(payload);
    expect(result.surface).toBe('admin');
    expect(result.sub).toBe('admin-1');
  });

  it('23. denies a revoked Admin session (SSE cannot reconnect)', async () => {
    const sessions = {
      findById: jest.fn().mockResolvedValue({
        id: 'sess-1',
        userId: 'admin-1',
        surface: 'admin',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      }),
    };
    await expect(strategy(sessions).validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('15b. denies an expired Admin session', async () => {
    const sessions = {
      findById: jest.fn().mockResolvedValue({
        id: 'sess-1',
        userId: 'admin-1',
        surface: 'admin',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1_000),
      }),
    };
    await expect(strategy(sessions).validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('denies a consumer session presented as an Admin surface token', async () => {
    const sessions = {
      findById: jest.fn().mockResolvedValue({
        id: 'sess-1',
        userId: 'admin-1',
        surface: 'consumer',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      }),
    };
    await expect(strategy(sessions).validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
