'use client';

/** Admin session + CSRF helpers for cookie-authenticated control-plane calls. */
import { env } from '../env';
import { setAdminCsrfToken, setAdminUiMarker } from './api-client';

const API = env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');

export type AdminLoginStatus = 'authenticated' | 'mfa_required' | 'mfa_enrollment_required';

export interface AdminOperator {
  id: string;
  email: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  mfaEnabled: boolean;
  mfaEnrolled: boolean;
  roles: string[];
  lastLoginAt: string | null;
  activeSessionCount: number;
  createdAt: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error?: { message?: string; code?: string } | null;
}

function deviceFingerprint(): string {
  if (typeof window === 'undefined') return 'admin-web-unknown';
  return `admin-web-${window.navigator.userAgent.slice(0, 80)}`;
}

export async function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.body) {
    headers['Content-Type'] = 'application/json';
  }
  const method = (init.method || 'GET').toUpperCase();
  const csrf = typeof window !== 'undefined' ? sessionStorage.getItem('auvora_admin_csrf') : null;
  if (csrf && method !== 'GET' && method !== 'HEAD') {
    headers['x-csrf-token'] = csrf;
  }
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });
  const payload = (await res.json().catch(() => undefined)) as ApiEnvelope<T> | undefined;
  if (!res.ok || !payload?.success || payload.data === null || payload.data === undefined) {
    const message = payload?.error?.message ?? `Request failed (${res.status})`;
    const error = new Error(message) as Error & { status?: number; code?: string };
    error.status = res.status;
    if (typeof payload?.error?.code === 'string') {
      error.code = payload.error.code;
    } else if (res.status === 403 && /csrf/i.test(message)) {
      error.code = 'CSRF_FAILED';
    }
    throw error;
  }
  return payload.data;
}

function isCsrfFailure(error: unknown): boolean {
  const err = error as { status?: number; code?: string; message?: string };
  return (
    err.status === 403 && (err.code === 'CSRF_FAILED' || /csrf/i.test(String(err.message || error)))
  );
}

export async function adminLogin(
  email: string,
  password: string,
): Promise<{
  status: AdminLoginStatus;
  mfaToken?: string;
  csrfToken?: string;
}> {
  const data = await adminRequest<{
    status: AdminLoginStatus;
    mfaToken?: string;
    csrfToken?: string;
  }>('/api/v1/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      deviceFingerprint: deviceFingerprint(),
      devicePlatform: 'web',
      deviceName: 'Auvora Admin',
    }),
  });
  if (data.csrfToken) {
    setAdminCsrfToken(data.csrfToken);
    setAdminUiMarker(true);
  }
  return data;
}

export async function adminEnrollStart(
  mfaToken: string,
): Promise<{ otpauthUrl: string; secret: string }> {
  return adminRequest('/api/v1/auth/admin/mfa/enroll/start', {
    method: 'POST',
    body: JSON.stringify({ mfaToken }),
  });
}

export async function adminEnrollConfirm(
  mfaToken: string,
  code: string,
): Promise<{ csrfToken: string; recoveryCodes: string[] }> {
  const data = await adminRequest<{ csrfToken: string; recoveryCodes: string[] }>(
    '/api/v1/auth/admin/mfa/enroll/confirm',
    { method: 'POST', body: JSON.stringify({ mfaToken, code }) },
  );
  setAdminCsrfToken(data.csrfToken);
  setAdminUiMarker(true);
  return data;
}

export async function adminVerifyMfa(
  mfaToken: string,
  code: string,
): Promise<{ csrfToken: string }> {
  const data = await adminRequest<{ csrfToken: string }>('/api/v1/auth/admin/mfa/verify', {
    method: 'POST',
    body: JSON.stringify({ mfaToken, code }),
  });
  setAdminCsrfToken(data.csrfToken);
  setAdminUiMarker(true);
  return data;
}

export async function adminVerifyRecovery(
  mfaToken: string,
  recoveryCode: string,
): Promise<{ csrfToken: string }> {
  const data = await adminRequest<{ csrfToken: string }>('/api/v1/auth/admin/mfa/recovery', {
    method: 'POST',
    body: JSON.stringify({ mfaToken, recoveryCode }),
  });
  setAdminCsrfToken(data.csrfToken);
  setAdminUiMarker(true);
  return data;
}

export async function adminSession(): Promise<{
  operator: AdminOperator;
  sessionId: string;
  stepUpExp: number | null;
  csrfToken?: string;
}> {
  const data = await adminRequest<{
    operator: AdminOperator;
    sessionId: string;
    stepUpExp: number | null;
    csrfToken?: string;
  }>('/api/v1/auth/admin/session', { method: 'GET' });
  if (data.csrfToken) setAdminCsrfToken(data.csrfToken);
  return data;
}

/**
 * Sync access JWT + CSRF before privileged mutations.
 * Refresh is CSRF-exempt but rotates admin_csrf_token; always persist the body token.
 */
export async function adminEnsureFreshSession(): Promise<void> {
  await adminRefresh();
}

export async function adminStepUp(
  password: string,
  code: string,
): Promise<{ csrfToken: string; stepUpExp: number }> {
  const attempt = () =>
    adminRequest<{ csrfToken: string; stepUpExp: number }>('/api/v1/auth/admin/step-up', {
      method: 'POST',
      body: JSON.stringify({ password, code }),
    });

  // Refresh first so x-csrf-token matches the rotated admin_csrf_token cookie.
  await adminEnsureFreshSession();

  try {
    const data = await attempt();
    setAdminCsrfToken(data.csrfToken);
    return data;
  } catch (error) {
    const status = (error as { status?: number }).status;
    // One recovery path only: expired access JWT or stale CSRF after another refresh.
    if (status !== 401 && !isCsrfFailure(error)) throw error;
    await adminEnsureFreshSession();
    const data = await attempt();
    setAdminCsrfToken(data.csrfToken);
    return data;
  }
}

export async function adminLogout(): Promise<void> {
  try {
    await adminRequest('/api/v1/auth/admin/logout', { method: 'POST' });
  } finally {
    setAdminCsrfToken(null);
    setAdminUiMarker(false);
  }
}

export async function adminRefresh(): Promise<void> {
  const data = await adminRequest<{ csrfToken?: string }>('/api/v1/auth/admin/refresh', {
    method: 'POST',
  });
  if (data.csrfToken) setAdminCsrfToken(data.csrfToken);
}
