import type { AdminOperator } from './admin-session';
import { adminRequest } from './admin-session';

export interface AdminUserAccount {
  id: string;
  email: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
  roles: string[];
  permissions: string[];
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  platforms?: string[];
  deviceCount?: number;
  activeSessionCount?: number;
}

export interface AdminUserDevice {
  id: string;
  fingerprint: string;
  name: string | null;
  platform: string | null;
  appVersion: string | null;
  userAgent: string | null;
  trusted: boolean;
  lastSeenAt: string;
  revokedAt: string | null;
  createdAt: string;
}

export interface AdminUserSession {
  id: string;
  deviceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  active: boolean;
}

export interface OperatorListResult {
  total: number;
  operators: AdminOperator[];
}

export async function adminListUserDevices(userId: string): Promise<AdminUserDevice[]> {
  return adminRequest(`/api/v1/admin/users/${encodeURIComponent(userId)}/devices`);
}

export async function adminListUserSessions(userId: string): Promise<AdminUserSession[]> {
  return adminRequest(`/api/v1/admin/users/${encodeURIComponent(userId)}/sessions`);
}

export async function adminListOperators(
  query: {
    query?: string;
    skip?: number;
    take?: number;
  } = {},
): Promise<OperatorListResult> {
  const params = new URLSearchParams();
  if (query.query) params.set('query', query.query);
  if (query.skip != null) params.set('skip', String(query.skip));
  if (query.take != null) params.set('take', String(query.take));
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return adminRequest(`/api/v1/admin/operators${suffix}`);
}

export async function adminAssignOperatorRoles(
  userId: string,
  roles: string[],
  reason: string,
): Promise<AdminOperator> {
  return adminRequest(`/api/v1/admin/operators/${encodeURIComponent(userId)}/roles`, {
    method: 'PATCH',
    body: JSON.stringify({ roles, reason }),
  });
}

export async function adminUpdateOperatorStatus(
  userId: string,
  status: string,
  reason: string,
): Promise<AdminOperator> {
  return adminRequest(`/api/v1/admin/operators/${encodeURIComponent(userId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason }),
  });
}

export async function adminRevokeOperatorSessions(
  userId: string,
  reason: string,
): Promise<{ revoked: number }> {
  return adminRequest(`/api/v1/admin/operators/${encodeURIComponent(userId)}/revoke-sessions`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function adminResetOperatorMfa(
  userId: string,
  reason: string,
): Promise<AdminOperator> {
  return adminRequest(`/api/v1/admin/operators/${encodeURIComponent(userId)}/mfa/reset`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export interface SafeConnectionRow {
  id: string;
  userId: string;
  kind: string;
  status: string;
  providerCode: string;
  label: string | null;
  createdAt: string;
  updatedAt: string;
  connectedAt: string | null;
}

const SECRET_KEYS = /secret|seed|mnemonic|private|symkey|sessionkey|ciphertext|token|password|otp/i;

export function toSafeConnection(row: Record<string, unknown>): SafeConnectionRow {
  return {
    id: String(row.id ?? ''),
    userId: String(row.userId ?? ''),
    kind: String(row.kind ?? 'unknown'),
    status: String(row.status ?? 'unknown'),
    providerCode: String(row.providerCode ?? 'unknown'),
    label: typeof row.label === 'string' ? row.label : null,
    createdAt: String(row.createdAt ?? ''),
    updatedAt: String(row.updatedAt ?? ''),
    connectedAt: typeof row.connectedAt === 'string' ? row.connectedAt : null,
  };
}

export function isUnsafeField(key: string): boolean {
  return SECRET_KEYS.test(key);
}
