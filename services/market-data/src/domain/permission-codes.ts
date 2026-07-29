import type { PermissionCode } from '@auvora/types';

export const PERMISSION_MARKET_DATA_READ: PermissionCode = 'market-data:read';
export const PERMISSION_MARKET_DATA_WRITE: PermissionCode = 'market-data:write';
export const PERMISSION_MARKET_DATA_ADMIN: PermissionCode = 'market-data:admin';
export const PERMISSION_MARKET_DATA_ALERTS: PermissionCode = 'market-data:alerts';

export const ALL_MARKET_DATA_PERMISSION_CODES: readonly PermissionCode[] = [
  PERMISSION_MARKET_DATA_READ,
  PERMISSION_MARKET_DATA_WRITE,
  PERMISSION_MARKET_DATA_ADMIN,
  PERMISSION_MARKET_DATA_ALERTS,
] as const;

export const ROLE_ADMIN = 'admin';
export const ROLE_SUPER_ADMIN = 'super_admin';
