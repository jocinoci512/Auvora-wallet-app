import type { PermissionCode } from '@auvora/types';

export const PERMISSION_CUSTODY_READ: PermissionCode = 'custody:read';
export const PERMISSION_CUSTODY_WRITE: PermissionCode = 'custody:write';
export const PERMISSION_CUSTODY_ADMIN: PermissionCode = 'custody:admin';
export const PERMISSION_CUSTODY_SIGN: PermissionCode = 'custody:sign';
export const PERMISSION_CUSTODY_APPROVE: PermissionCode = 'custody:approve';
export const PERMISSION_CUSTODY_POLICIES: PermissionCode = 'custody:policies';
export const PERMISSION_CUSTODY_RECOVERY: PermissionCode = 'custody:recovery';

export const ALL_CUSTODY_PERMISSION_CODES: readonly PermissionCode[] = [
  PERMISSION_CUSTODY_READ,
  PERMISSION_CUSTODY_WRITE,
  PERMISSION_CUSTODY_ADMIN,
  PERMISSION_CUSTODY_SIGN,
  PERMISSION_CUSTODY_APPROVE,
  PERMISSION_CUSTODY_POLICIES,
  PERMISSION_CUSTODY_RECOVERY,
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
