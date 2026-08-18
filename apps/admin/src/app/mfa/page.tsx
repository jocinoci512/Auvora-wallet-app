'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactElement } from 'react';
import { Alert, Button, Field, Input } from '@auvora/ui';
import { AuthScreen } from '../../components/AdminChrome';
import { adminVerifyMfa } from '../../lib/admin-session';
import { formatMfaAuthError, normalizeTotpInput } from '../../lib/mfa-enrollment';

export default function MfaPage(): ReactElement {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const mfaToken = sessionStorage.getItem('auvora_admin_mfa_token');
    if (!mfaToken) {
      router.replace('/login');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await adminVerifyMfa(mfaToken, code);
      sessionStorage.removeItem('auvora_admin_mfa_token');
      router.replace('/dashboard');
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401 && /expired/i.test((err as Error).message)) {
        router.replace('/session-expired');
        return;
      }
      setError(formatMfaAuthError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthScreen
      title="Two-factor authentication"
      description="Enter the 6-digit code from Google Authenticator."
    >
      {error ? (
        <Alert tone="error" title="Verification failed">
          {error}
        </Alert>
      ) : null}
      <form className="admin-auth-form" onSubmit={(e) => void onSubmit(e)}>
        <Field label="6-digit code" htmlFor="admin-totp-challenge">
          <Input
            id="admin-totp-challenge"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            value={code}
            onChange={(e) => setCode(normalizeTotpInput(e.target.value))}
            required
          />
        </Field>
        <Button type="submit" disabled={pending || code.length !== 6}>
          {pending ? 'Verifying…' : 'Verify & Continue'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push('/recovery')}>
          Use a recovery code
        </Button>
      </form>
    </AuthScreen>
  );
}
