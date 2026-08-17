export enum HealthStatus {
  Ok = 'ok',
  Degraded = 'degraded',
  Unhealthy = 'unhealthy',
}

export interface HealthCheckResponse {
  status: HealthStatus;
  service: string;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
  checks?: Record<string, HealthStatus>;
}

export type Result<T, E = Error> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok;
}

export enum UserStatus {
  PendingVerification = 'PENDING_VERIFICATION',
  Active = 'ACTIVE',
  Suspended = 'SUSPENDED',
  Locked = 'LOCKED',
  Deactivated = 'DEACTIVATED',
  Deleted = 'DELETED',
}

export type PermissionCode =
  | 'users:read'
  | 'users:write'
  | 'users:delete'
  | 'roles:manage'
  | 'audit:read'
  | 'sessions:revoke'
  | 'wallets:read'
  | 'wallets:write'
  | 'wallets:admin'
  | 'wallets:suspend'
  | 'wallets:archive'
  | 'blockchain:read'
  | 'blockchain:write'
  | 'blockchain:admin'
  | 'blockchain:sync'
  | 'payment:read'
  | 'payment:write'
  | 'payment:admin'
  | 'payment:settle'
  | 'payment:reconcile'
  | 'compliance:read'
  | 'compliance:write'
  | 'compliance:admin'
  | 'compliance:review'
  | 'compliance:cases'
  | 'compliance:rules'
  | 'custody:read'
  | 'custody:write'
  | 'custody:admin'
  | 'custody:sign'
  | 'custody:approve'
  | 'custody:policies'
  | 'custody:recovery'
  | 'notification:read'
  | 'notification:write'
  | 'notification:admin'
  | 'notification:templates'
  | 'notification:webhooks'
  | 'notification:broadcast'
  | 'ai:read'
  | 'ai:write'
  | 'ai:admin'
  | 'ai:prompts'
  | 'ai:knowledge'
  | 'ai:chat'
  | 'analytics:read'
  | 'analytics:write'
  | 'analytics:admin'
  | 'analytics:reports'
  | 'analytics:dashboards'
  | 'analytics:kpis'
  | 'market-data:read'
  | 'market-data:write'
  | 'market-data:admin'
  | 'market-data:alerts'
  | 'observability:read'
  | 'observability:write'
  | 'observability:admin'
  | 'observability:alerts'
  | 'observability:incidents'
  | 'observability:slo'
  | 'infrastructure:read'
  | 'infrastructure:admin'
  | 'infrastructure:deploy'
  | 'infrastructure:backup'
  // Admin control-plane RBAC (Phase 3 increment 2) — granular operational permissions.
  | 'users:suspend'
  | 'users:reactivate'
  | 'sessions:read'
  | 'devices:read'
  | 'devices:revoke'
  | 'connections:read'
  | 'connections:revoke'
  | 'security:read'
  | 'security:manage'
  | 'support:read'
  | 'support:write'
  | 'admins:read'
  | 'admins:manage'
  | 'roles:read'
  | 'health:read'
  | 'realtime:read';

export const ROLE_USER = 'user';
export const ROLE_ADMIN = 'admin';
export const ROLE_SUPER_ADMIN = 'super_admin';
export const ROLE_SUPPORT = 'support';
export const ROLE_SECURITY_ANALYST = 'security_analyst';
export const ROLE_READ_ONLY = 'read_only';

/** Roles that may enter the Admin control plane. Normal `user` is never included. */
export const ADMIN_PORTAL_ROLES = [
  ROLE_SUPER_ADMIN,
  ROLE_ADMIN,
  ROLE_SUPPORT,
  ROLE_SECURITY_ANALYST,
  ROLE_READ_ONLY,
] as const;

export type AdminPortalRole = (typeof ADMIN_PORTAL_ROLES)[number];

export function isAdminPortalRole(role: string): boolean {
  return (ADMIN_PORTAL_ROLES as readonly string[]).includes(role);
}

export type AuthSurface = 'consumer' | 'admin';

export interface JwtAccessClaims {
  sub: string;
  email: string;
  sessionId: string;
  roles: string[];
  permissions: PermissionCode[];
  /** Token audience surface. Admin APIs require `admin`. */
  surface?: AuthSurface;
  /** Epoch seconds until which step-up is valid. Absent when not stepped up. */
  stepUpExp?: number;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  /** Present only for non-browser clients that cannot use httpOnly cookies. */
  refreshToken?: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponseMeta {
  requestId?: string;
  timestamp: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: ApiErrorBody | null;
  meta: ApiResponseMeta;
}
