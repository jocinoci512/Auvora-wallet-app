import type { PermissionCode } from '@auvora/types';

export const PERMISSION_ANALYTICS_READ: PermissionCode = 'analytics:read';
export const PERMISSION_ANALYTICS_WRITE: PermissionCode = 'analytics:write';
export const PERMISSION_ANALYTICS_ADMIN: PermissionCode = 'analytics:admin';
export const PERMISSION_ANALYTICS_REPORTS: PermissionCode = 'analytics:reports';
export const PERMISSION_ANALYTICS_DASHBOARDS: PermissionCode = 'analytics:dashboards';
export const PERMISSION_ANALYTICS_KPIS: PermissionCode = 'analytics:kpis';

export const ALL_ANALYTICS_PERMISSION_CODES: readonly PermissionCode[] = [
  PERMISSION_ANALYTICS_READ,
  PERMISSION_ANALYTICS_WRITE,
  PERMISSION_ANALYTICS_ADMIN,
  PERMISSION_ANALYTICS_REPORTS,
  PERMISSION_ANALYTICS_DASHBOARDS,
  PERMISSION_ANALYTICS_KPIS,
] as const;

export const ROLE_ADMIN = 'admin';
export const ROLE_SUPER_ADMIN = 'super_admin';
