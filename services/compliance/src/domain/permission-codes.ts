import type { PermissionCode } from '@auvora/types';

export const PERMISSION_COMPLIANCE_READ: PermissionCode = 'compliance:read';
export const PERMISSION_COMPLIANCE_WRITE: PermissionCode = 'compliance:write';
export const PERMISSION_COMPLIANCE_ADMIN: PermissionCode = 'compliance:admin';
export const PERMISSION_COMPLIANCE_REVIEW: PermissionCode = 'compliance:review';
export const PERMISSION_COMPLIANCE_CASES: PermissionCode = 'compliance:cases';
export const PERMISSION_COMPLIANCE_RULES: PermissionCode = 'compliance:rules';

export const ALL_COMPLIANCE_PERMISSION_CODES: readonly PermissionCode[] = [
  PERMISSION_COMPLIANCE_READ,
  PERMISSION_COMPLIANCE_WRITE,
  PERMISSION_COMPLIANCE_ADMIN,
  PERMISSION_COMPLIANCE_REVIEW,
  PERMISSION_COMPLIANCE_CASES,
  PERMISSION_COMPLIANCE_RULES,
] as const;

export const ROLE_ADMIN = 'admin';
export const ROLE_SUPER_ADMIN = 'super_admin';
