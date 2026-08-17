import { formatAdminError, isStepUpRequired } from './api-client';
import { hasPermission, primaryRole, roleLabel } from './admin-rbac';
import { toSafeConnection } from './admin-control-plane';

describe('formatAdminError', () => {
  it('maps auth and availability failures without JWT-paste copy', () => {
    expect(formatAdminError({ status: 401, message: 'nope' })).toContain('session expired');
    expect(formatAdminError({ status: 403, message: 'nope' })).toContain('permission');
    expect(formatAdminError({ status: 429, message: 'nope' })).toContain('Too many requests');
    expect(formatAdminError({ status: 503, message: 'nope' })).toContain('unavailable');
    expect(formatAdminError({ status: 401, message: 'nope' })).not.toMatch(
      /JWT|paste|token above/i,
    );
  });

  it('detects step-up requirements', () => {
    expect(isStepUpRequired({ message: 'Step-up authentication required' })).toBe(true);
    expect(isStepUpRequired({ message: 'forbidden' })).toBe(false);
  });
});

describe('admin rbac convenience', () => {
  const operator = {
    id: '1',
    email: 'ops@example.com',
    username: 'ops',
    firstName: 'Ops',
    lastName: 'Lead',
    status: 'ACTIVE',
    mfaEnabled: true,
    mfaEnrolled: true,
    roles: ['read_only'],
    lastLoginAt: null,
    activeSessionCount: 1,
    createdAt: new Date().toISOString(),
  };

  it('hides mutations for read-only and labels roles', () => {
    expect(hasPermission(operator, 'users:read')).toBe(true);
    expect(hasPermission(operator, 'admins:manage')).toBe(false);
    expect(primaryRole(operator)).toBe('read_only');
    expect(roleLabel('super_admin')).toBe('Super Admin');
  });
});

describe('connection sanitization', () => {
  it('keeps only safe connection fields', () => {
    const row = toSafeConnection({
      id: 'abc',
      userId: 'user-1',
      kind: 'WALLETCONNECT',
      status: 'ACTIVE',
      providerCode: 'wc',
      label: 'dApp',
      metadata: { symKey: 'secret' },
      sessionKey: 'nope',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-02',
      connectedAt: '2026-01-01',
    });
    expect(row).toEqual({
      id: 'abc',
      userId: 'user-1',
      kind: 'WALLETCONNECT',
      status: 'ACTIVE',
      providerCode: 'wc',
      label: 'dApp',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-02',
      connectedAt: '2026-01-01',
    });
    expect(JSON.stringify(row)).not.toMatch(/symKey|sessionKey|secret/);
  });
});
