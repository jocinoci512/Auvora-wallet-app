export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGOUT'
  | 'REGISTER'
  | 'EMAIL_VERIFIED'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET_COMPLETED'
  | 'ACCOUNT_ACTIVATED'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_UNLOCKED'
  | 'SESSION_REVOKED'
  | 'DEVICE_REVOKED'
  | 'USER_SOFT_DELETED'
  | 'USER_RESTORED'
  | 'USER_STATUS_CHANGED'
  | 'ROLES_UPDATED'
  | 'MFA_TOGGLED'
  | 'TOKEN_REFRESH'
  | 'REFRESH_REUSE_DETECTED'
  | 'ADMIN_LOGIN_SUCCESS'
  | 'ADMIN_LOGIN_FAILED'
  | 'ADMIN_LOGOUT'
  | 'ADMIN_MFA_ENROLLED'
  | 'ADMIN_MFA_FAILED'
  | 'ADMIN_MFA_RECOVERY_USED'
  | 'ADMIN_MFA_RESET'
  | 'ADMIN_STEP_UP_SUCCESS'
  | 'ADMIN_STEP_UP_FAILED'
  | 'ADMIN_ROLE_CHANGED'
  | 'ADMIN_STATUS_CHANGED'
  | 'ADMIN_SESSION_REVOKED';

export interface AuditLogRecord {
  id: string;
  action: AuditAction;
  actorUserId: string | null;
  targetUserId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface CreateAuditLogInput {
  action: AuditAction;
  actorUserId?: string;
  targetUserId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditSearchFilters {
  action?: AuditAction;
  actorUserId?: string;
  targetUserId?: string;
  from?: Date;
  to?: Date;
  skip?: number;
  take?: number;
}

export interface AuditSearchResult {
  logs: AuditLogRecord[];
  total: number;
}

export const AUDIT_REPOSITORY = Symbol('AUDIT_REPOSITORY');

export interface AuditRepositoryPort {
  create(input: CreateAuditLogInput): Promise<void>;
  search(filters: AuditSearchFilters): Promise<AuditSearchResult>;
}
