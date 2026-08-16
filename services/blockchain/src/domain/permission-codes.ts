import type { PermissionCode } from '@auvora/types';

export const PERMISSION_BLOCKCHAIN_READ: PermissionCode = 'blockchain:read';
export const PERMISSION_BLOCKCHAIN_WRITE: PermissionCode = 'blockchain:write';
export const PERMISSION_BLOCKCHAIN_ADMIN: PermissionCode = 'blockchain:admin';
export const PERMISSION_BLOCKCHAIN_SYNC: PermissionCode = 'blockchain:sync';

export const ALL_BLOCKCHAIN_PERMISSION_CODES: readonly PermissionCode[] = [
  PERMISSION_BLOCKCHAIN_READ,
  PERMISSION_BLOCKCHAIN_WRITE,
  PERMISSION_BLOCKCHAIN_ADMIN,
  PERMISSION_BLOCKCHAIN_SYNC,
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
