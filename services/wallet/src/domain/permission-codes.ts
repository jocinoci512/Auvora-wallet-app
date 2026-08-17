import type { PermissionCode } from '@auvora/types';

export const PERMISSION_WALLETS_READ: PermissionCode = 'wallets:read';
export const PERMISSION_WALLETS_WRITE: PermissionCode = 'wallets:write';
export const PERMISSION_WALLETS_ADMIN: PermissionCode = 'wallets:admin';
export const PERMISSION_WALLETS_SUSPEND: PermissionCode = 'wallets:suspend';
export const PERMISSION_WALLETS_ARCHIVE: PermissionCode = 'wallets:archive';

export const ALL_WALLET_PERMISSION_CODES: readonly PermissionCode[] = [
  PERMISSION_WALLETS_READ,
  PERMISSION_WALLETS_WRITE,
  PERMISSION_WALLETS_ADMIN,
  PERMISSION_WALLETS_SUSPEND,
  PERMISSION_WALLETS_ARCHIVE,
] as const;

export const ROLE_ADMIN = 'admin';
export const ROLE_SUPER_ADMIN = 'super_admin';
export const ROLE_SUPPORT = 'support';
export const ROLE_SECURITY_ANALYST = 'security_analyst';
export const ROLE_READ_ONLY = 'read_only';
export const ADMIN_PORTAL_ROLES = [
  ROLE_SUPER_ADMIN,
  ROLE_ADMIN,
  ROLE_SUPPORT,
  ROLE_SECURITY_ANALYST,
  ROLE_READ_ONLY,
] as const;
export const ADMIN_ROLES = [ROLE_ADMIN, ROLE_SUPER_ADMIN] as const;
