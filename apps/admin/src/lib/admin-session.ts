'use client';

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
  error?: { message?: string } | null;
}

function deviceFingerprint(): string {
  if (typeof window === 'undefined') return 'admin-web-unknown';
  return `admin-web-${window.navigator.userAgent.slice(0, 80)}`;
}

async function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.body) {
    headers['Content-Type'] = 'application/json';
  }
  const csrf = typeof window !== 'undefined' ? sessionStorage.getItem('auvora_admin_csrf') : null;
  if (csrf && init.method && init.method !== 'GET') {
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
    const error = new Error(message) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  return payload.data;
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
}> {
  return adminRequest('/api/v1/auth/admin/session', { method: 'GET' });
}

export async function adminStepUp(
  password: string,
  code: string,
): Promise<{ csrfToken: string; stepUpExp: number }> {
  const data = await adminRequest<{ csrfToken: string; stepUpExp: number }>(
    '/api/v1/auth/admin/step-up',
    {
      method: 'POST',
      body: JSON.stringify({ password, code }),
    },
  );
  setAdminCsrfToken(data.csrfToken);
  return data;
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
