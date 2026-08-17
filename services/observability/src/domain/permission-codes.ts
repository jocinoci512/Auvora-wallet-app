import type { PermissionCode } from '@auvora/types';

export const PERMISSION_OBSERVABILITY_READ: PermissionCode = 'observability:read';
export const PERMISSION_OBSERVABILITY_WRITE: PermissionCode = 'observability:write';
export const PERMISSION_OBSERVABILITY_ADMIN: PermissionCode = 'observability:admin';
export const PERMISSION_OBSERVABILITY_ALERTS: PermissionCode = 'observability:alerts';
export const PERMISSION_OBSERVABILITY_INCIDENTS: PermissionCode = 'observability:incidents';
export const PERMISSION_OBSERVABILITY_SLO: PermissionCode = 'observability:slo';

export const ALL_OBSERVABILITY_PERMISSION_CODES: readonly PermissionCode[] = [
  PERMISSION_OBSERVABILITY_READ,
  PERMISSION_OBSERVABILITY_WRITE,
  PERMISSION_OBSERVABILITY_ADMIN,
  PERMISSION_OBSERVABILITY_ALERTS,
  PERMISSION_OBSERVABILITY_INCIDENTS,
  PERMISSION_OBSERVABILITY_SLO,
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
