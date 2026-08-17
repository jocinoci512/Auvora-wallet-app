import type { PermissionCode } from '@auvora/types';

export const PERMISSION_NOTIFICATION_READ: PermissionCode = 'notification:read';
export const PERMISSION_NOTIFICATION_WRITE: PermissionCode = 'notification:write';
export const PERMISSION_NOTIFICATION_ADMIN: PermissionCode = 'notification:admin';
export const PERMISSION_NOTIFICATION_TEMPLATES: PermissionCode = 'notification:templates';
export const PERMISSION_NOTIFICATION_WEBHOOKS: PermissionCode = 'notification:webhooks';
export const PERMISSION_NOTIFICATION_BROADCAST: PermissionCode = 'notification:broadcast';

export const ALL_NOTIFICATION_PERMISSION_CODES: readonly PermissionCode[] = [
  PERMISSION_NOTIFICATION_READ,
  PERMISSION_NOTIFICATION_WRITE,
  PERMISSION_NOTIFICATION_ADMIN,
  PERMISSION_NOTIFICATION_TEMPLATES,
  PERMISSION_NOTIFICATION_WEBHOOKS,
  PERMISSION_NOTIFICATION_BROADCAST,
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
