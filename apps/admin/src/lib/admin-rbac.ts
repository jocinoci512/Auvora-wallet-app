import type { AdminOperator } from './admin-session';

/** Client convenience only. Auth remains the authority for every mutation. */
export const ADMIN_ROLE_PERMISSIONS: Readonly<Record<string, readonly string[]>> = {
  read_only: [
    'users:read',
    'sessions:read',
    'devices:read',
    'connections:read',
    'wallets:read',
    'security:read',
    'audit:read',
    'support:read',
    'admins:read',
    'roles:read',
    'health:read',
    'realtime:read',
  ],
  support: [
    'users:read',
    'users:write',
    'sessions:read',
    'devices:read',
    'connections:read',
    'wallets:read',
    'security:read',
    'audit:read',
    'support:read',
    'support:write',
    'admins:read',
    'roles:read',
    'health:read',
    'realtime:read',
    'simulation:read',
  ],
  security_analyst: [
    'users:read',
    'sessions:read',
    'sessions:revoke',
    'devices:read',
    'devices:revoke',
    'connections:read',
    'connections:revoke',
    'wallets:read',
    'security:read',
    'security:manage',
    'audit:read',
    'support:read',
    'admins:read',
    'roles:read',
    'health:read',
    'realtime:read',
    'simulation:read',
  ],
  admin: [
    'users:read',
    'users:write',
    'users:suspend',
    'users:reactivate',
    'sessions:read',
    'sessions:revoke',
    'devices:read',
    'devices:revoke',
    'connections:read',
    'connections:revoke',
    'wallets:read',
    'security:read',
    'security:manage',
    'audit:read',
    'support:read',
    'support:write',
    'admins:read',
    'roles:read',
    'health:read',
    'realtime:read',
    'transactions:review:large',
    'simulation:read',
    'simulation:manage',
  ],
  super_admin: [
    'users:read',
    'users:write',
    'users:suspend',
    'users:reactivate',
    'sessions:read',
    'sessions:revoke',
    'devices:read',
    'devices:revoke',
    'connections:read',
    'connections:revoke',
    'wallets:read',
    'security:read',
    'security:manage',
    'audit:read',
    'support:read',
    'support:write',
    'admins:read',
    'admins:manage',
    'roles:read',
    'roles:manage',
    'health:read',
    'realtime:read',
    'transactions:review:large',
    'simulation:read',
    'simulation:manage',
  ],
};

const ROLE_ORDER = ['super_admin', 'admin', 'security_analyst', 'support', 'read_only'] as const;

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  security_analyst: 'Security Analyst',
  support: 'Support',
  read_only: 'Read only',
};

export function primaryRole(operator: AdminOperator | null | undefined): string {
  for (const role of ROLE_ORDER) {
    if (operator?.roles.includes(role)) return role;
  }
  return operator?.roles[0] ?? 'unknown';
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role.replace(/_/g, ' ');
}

export function operatorPermissions(operator: AdminOperator | null | undefined): Set<string> {
  const granted = new Set<string>();
  for (const role of operator?.roles ?? []) {
    for (const permission of ADMIN_ROLE_PERMISSIONS[role] ?? []) {
      granted.add(permission);
    }
  }
  return granted;
}

export function hasPermission(
  operator: AdminOperator | null | undefined,
  permission: string,
): boolean {
  return operatorPermissions(operator).has(permission);
}

export function canEnterAdminControlPlane(operator: AdminOperator | null | undefined): boolean {
  return Boolean(
    operator?.roles.some((role) =>
      ['super_admin', 'admin', 'security_analyst', 'support', 'read_only'].includes(role),
    ),
  );
}

export function canMutate(operator: AdminOperator | null | undefined): boolean {
  const permissions = operatorPermissions(operator);
  return Array.from(permissions).some(
    (permission) =>
      permission.endsWith(':write') ||
      permission.endsWith(':manage') ||
      permission.endsWith(':revoke') ||
      permission.endsWith(':suspend') ||
      permission.endsWith(':reactivate') ||
      permission === 'roles:manage' ||
      permission === 'transactions:review:large' ||
      permission === 'simulation:manage',
  );
}
