'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactElement } from 'react';
import { Alert, Button, Field, Input } from '@auvora/ui';
import { AuthScreen } from '../../components/AdminChrome';
import { formatApiError } from '../../lib/api-client';
import { adminVerifyMfa } from '../../lib/admin-session';

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
      router.replace('/');
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthScreen
      title="Authenticator code"
      description="Enter the 6-digit code from your authenticator app."
    >
      {error ? (
        <Alert tone="error" title="Verification failed">
          {error}
        </Alert>
      ) : null}
      <form className="admin-auth-form" onSubmit={(e) => void onSubmit(e)}>
        <Field label="One-time code">
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? 'Verifying…' : 'Verify'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push('/recovery')}>
          Use a recovery code
        </Button>
      </form>
    </AuthScreen>
  );
}
