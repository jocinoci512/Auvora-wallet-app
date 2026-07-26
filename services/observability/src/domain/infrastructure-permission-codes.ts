import type { PermissionCode } from '@auvora/types';

export const PERMISSION_INFRASTRUCTURE_READ: PermissionCode = 'infrastructure:read';
export const PERMISSION_INFRASTRUCTURE_ADMIN: PermissionCode = 'infrastructure:admin';
export const PERMISSION_INFRASTRUCTURE_DEPLOY: PermissionCode = 'infrastructure:deploy';
export const PERMISSION_INFRASTRUCTURE_BACKUP: PermissionCode = 'infrastructure:backup';

export const ALL_INFRASTRUCTURE_PERMISSION_CODES: readonly PermissionCode[] = [
  PERMISSION_INFRASTRUCTURE_READ,
  PERMISSION_INFRASTRUCTURE_ADMIN,
  PERMISSION_INFRASTRUCTURE_DEPLOY,
  PERMISSION_INFRASTRUCTURE_BACKUP,
] as const;
