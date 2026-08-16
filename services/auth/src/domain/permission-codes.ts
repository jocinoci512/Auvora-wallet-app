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

// --- Admin control-plane granular permissions (Phase 3 increment 2) ---
export const PERMISSION_USERS_SUSPEND: PermissionCode = 'users:suspend';
export const PERMISSION_USERS_REACTIVATE: PermissionCode = 'users:reactivate';
export const PERMISSION_SESSIONS_READ: PermissionCode = 'sessions:read';
export const PERMISSION_DEVICES_READ: PermissionCode = 'devices:read';
export const PERMISSION_DEVICES_REVOKE: PermissionCode = 'devices:revoke';
export const PERMISSION_CONNECTIONS_READ: PermissionCode = 'connections:read';
export const PERMISSION_CONNECTIONS_REVOKE: PermissionCode = 'connections:revoke';
export const PERMISSION_SECURITY_READ: PermissionCode = 'security:read';
export const PERMISSION_SECURITY_MANAGE: PermissionCode = 'security:manage';
export const PERMISSION_SUPPORT_READ: PermissionCode = 'support:read';
export const PERMISSION_SUPPORT_WRITE: PermissionCode = 'support:write';
export const PERMISSION_ADMINS_READ: PermissionCode = 'admins:read';
export const PERMISSION_ADMINS_MANAGE: PermissionCode = 'admins:manage';
export const PERMISSION_ROLES_READ: PermissionCode = 'roles:read';
export const PERMISSION_HEALTH_READ: PermissionCode = 'health:read';
export const PERMISSION_REALTIME_READ: PermissionCode = 'realtime:read';

/** All admin control-plane permission codes introduced for the 5-role model. */
export const ADMIN_CONTROL_PLANE_PERMISSIONS: readonly PermissionCode[] = [
  PERMISSION_USERS_READ,
  PERMISSION_USERS_WRITE,
  PERMISSION_USERS_SUSPEND,
  PERMISSION_USERS_REACTIVATE,
  PERMISSION_SESSIONS_READ,
  PERMISSION_SESSIONS_REVOKE,
  PERMISSION_DEVICES_READ,
  PERMISSION_DEVICES_REVOKE,
  PERMISSION_CONNECTIONS_READ,
  PERMISSION_CONNECTIONS_REVOKE,
  PERMISSION_WALLETS_READ,
  PERMISSION_SECURITY_READ,
  PERMISSION_SECURITY_MANAGE,
  PERMISSION_AUDIT_READ,
  PERMISSION_SUPPORT_READ,
  PERMISSION_SUPPORT_WRITE,
  PERMISSION_ADMINS_READ,
  PERMISSION_ADMINS_MANAGE,
  PERMISSION_ROLES_READ,
  PERMISSION_ROLES_MANAGE,
  PERMISSION_HEALTH_READ,
  PERMISSION_REALTIME_READ,
] as const;

export const ROLE_USER = 'user';
export const ROLE_ADMIN = 'admin';
export const ROLE_SUPER_ADMIN = 'super_admin';
// Phase 3 increment 2: production admin roles.
export const ROLE_SUPPORT = 'support';
export const ROLE_SECURITY_ANALYST = 'security_analyst';
export const ROLE_READ_ONLY = 'read_only';

/**
 * Read-only permission codes safe for the READ_ONLY role and as the read floor
 * for every admin role. NEVER includes any mutate/revoke/manage capability and
 * NEVER any wallet custody/signing permission (custody stays with the user).
 */
export const READ_ONLY_ADMIN_PERMISSIONS: readonly PermissionCode[] = [
  PERMISSION_USERS_READ,
  PERMISSION_SESSIONS_READ,
  PERMISSION_DEVICES_READ,
  PERMISSION_CONNECTIONS_READ,
  PERMISSION_WALLETS_READ,
  PERMISSION_SECURITY_READ,
  PERMISSION_AUDIT_READ,
  PERMISSION_SUPPORT_READ,
  PERMISSION_ADMINS_READ,
  PERMISSION_ROLES_READ,
  PERMISSION_HEALTH_READ,
  PERMISSION_REALTIME_READ,
] as const;

const SUPPORT_PERMISSIONS: readonly PermissionCode[] = [
  ...READ_ONLY_ADMIN_PERMISSIONS,
  PERMISSION_USERS_WRITE,
  PERMISSION_SUPPORT_WRITE,
] as const;

const SECURITY_ANALYST_PERMISSIONS: readonly PermissionCode[] = [
  ...READ_ONLY_ADMIN_PERMISSIONS,
  PERMISSION_SECURITY_MANAGE,
  PERMISSION_SESSIONS_REVOKE,
  PERMISSION_DEVICES_REVOKE,
  PERMISSION_CONNECTIONS_REVOKE,
] as const;

const ADMIN_PERMISSIONS: readonly PermissionCode[] = [
  ...READ_ONLY_ADMIN_PERMISSIONS,
  PERMISSION_USERS_WRITE,
  PERMISSION_USERS_SUSPEND,
  PERMISSION_USERS_REACTIVATE,
  PERMISSION_SESSIONS_REVOKE,
  PERMISSION_DEVICES_REVOKE,
  PERMISSION_CONNECTIONS_REVOKE,
  PERMISSION_SECURITY_MANAGE,
  PERMISSION_SUPPORT_WRITE,
] as const;

// SUPER_ADMIN additionally manages admins and roles (reserved elevation powers).
const SUPER_ADMIN_PERMISSIONS: readonly PermissionCode[] = [
  ...ADMIN_PERMISSIONS,
  PERMISSION_ADMINS_MANAGE,
  PERMISSION_ROLES_MANAGE,
] as const;

/**
 * Authoritative role → permission capability matrix for the admin control plane.
 * No role — including SUPER_ADMIN — is ever granted wallet custody or signing
 * permissions; those do not exist in this catalog by design.
 */
export const ADMIN_ROLE_CAPABILITIES: Readonly<Record<string, readonly PermissionCode[]>> = {
  [ROLE_READ_ONLY]: READ_ONLY_ADMIN_PERMISSIONS,
  [ROLE_SUPPORT]: SUPPORT_PERMISSIONS,
  [ROLE_SECURITY_ANALYST]: SECURITY_ANALYST_PERMISSIONS,
  [ROLE_ADMIN]: ADMIN_PERMISSIONS,
  [ROLE_SUPER_ADMIN]: SUPER_ADMIN_PERMISSIONS,
};

/** Roles for which MFA is mandatory in production. */
export const MFA_REQUIRED_ROLES: readonly string[] = [
  ROLE_SUPER_ADMIN,
  ROLE_ADMIN,
  ROLE_SECURITY_ANALYST,
];
