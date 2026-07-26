import type { PermissionCode } from '@auvora/types';

export const PERMISSION_USERS_READ: PermissionCode = 'users:read';
export const PERMISSION_USERS_WRITE: PermissionCode = 'users:write';
export const PERMISSION_USERS_DELETE: PermissionCode = 'users:delete';
export const PERMISSION_ROLES_MANAGE: PermissionCode = 'roles:manage';
export const PERMISSION_AUDIT_READ: PermissionCode = 'audit:read';
export const PERMISSION_SESSIONS_REVOKE: PermissionCode = 'sessions:revoke';
export const PERMISSION_WALLETS_READ: PermissionCode = 'wallets:read';
export const PERMISSION_WALLETS_WRITE: PermissionCode = 'wallets:write';
export const PERMISSION_WALLETS_ADMIN: PermissionCode = 'wallets:admin';
export const PERMISSION_WALLETS_SUSPEND: PermissionCode = 'wallets:suspend';
export const PERMISSION_WALLETS_ARCHIVE: PermissionCode = 'wallets:archive';
export const PERMISSION_BLOCKCHAIN_READ: PermissionCode = 'blockchain:read';
export const PERMISSION_BLOCKCHAIN_WRITE: PermissionCode = 'blockchain:write';
export const PERMISSION_BLOCKCHAIN_ADMIN: PermissionCode = 'blockchain:admin';
export const PERMISSION_BLOCKCHAIN_SYNC: PermissionCode = 'blockchain:sync';

export const ALL_PERMISSION_CODES: readonly PermissionCode[] = [
  PERMISSION_USERS_READ,
  PERMISSION_USERS_WRITE,
  PERMISSION_USERS_DELETE,
  PERMISSION_ROLES_MANAGE,
  PERMISSION_AUDIT_READ,
  PERMISSION_SESSIONS_REVOKE,
  PERMISSION_WALLETS_READ,
  PERMISSION_WALLETS_WRITE,
  PERMISSION_WALLETS_ADMIN,
  PERMISSION_WALLETS_SUSPEND,
  PERMISSION_WALLETS_ARCHIVE,
  PERMISSION_BLOCKCHAIN_READ,
  PERMISSION_BLOCKCHAIN_WRITE,
  PERMISSION_BLOCKCHAIN_ADMIN,
  PERMISSION_BLOCKCHAIN_SYNC,
] as const;

export const ROLE_USER = 'user';
export const ROLE_ADMIN = 'admin';
export const ROLE_SUPER_ADMIN = 'super_admin';
