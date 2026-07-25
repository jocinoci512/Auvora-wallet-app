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
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

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
  | 'wallets:archive';

export interface JwtAccessClaims {
  sub: string;
  email: string;
  sessionId: string;
  roles: string[];
  permissions: PermissionCode[];
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
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
