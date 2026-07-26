import type { PermissionCode } from '@auvora/types';

export const PERMISSION_PAYMENT_READ: PermissionCode = 'payment:read';
export const PERMISSION_PAYMENT_WRITE: PermissionCode = 'payment:write';
export const PERMISSION_PAYMENT_ADMIN: PermissionCode = 'payment:admin';
export const PERMISSION_PAYMENT_SETTLE: PermissionCode = 'payment:settle';
export const PERMISSION_PAYMENT_RECONCILE: PermissionCode = 'payment:reconcile';

export const ALL_PAYMENT_PERMISSION_CODES: readonly PermissionCode[] = [
  PERMISSION_PAYMENT_READ,
  PERMISSION_PAYMENT_WRITE,
  PERMISSION_PAYMENT_ADMIN,
  PERMISSION_PAYMENT_SETTLE,
  PERMISSION_PAYMENT_RECONCILE,
] as const;

export const ROLE_ADMIN = 'admin';
export const ROLE_SUPER_ADMIN = 'super_admin';
export const ADMIN_ROLES = [ROLE_ADMIN, ROLE_SUPER_ADMIN] as const;
