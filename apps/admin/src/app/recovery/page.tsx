'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactElement } from 'react';
import { Alert, Button, Field, Input } from '@auvora/ui';
import { AuthScreen } from '../../components/AdminChrome';
import { adminVerifyRecovery } from '../../lib/admin-session';
import { formatMfaAuthError } from '../../lib/mfa-enrollment';

export default function RecoveryPage(): ReactElement {
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
      await adminVerifyRecovery(mfaToken, code);
      sessionStorage.removeItem('auvora_admin_mfa_token');
      router.replace('/dashboard');
    } catch (err) {
      setError(formatMfaAuthError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthScreen
      title="Recovery code"
      description="Use a one-time recovery code. Each code works once and is consumed immediately."
    >
      {error ? (
        <Alert tone="error" title="Recovery failed">
          {error}
        </Alert>
      ) : null}
      <form className="admin-auth-form" onSubmit={(e) => void onSubmit(e)}>
        <Field label="Recovery code">
          <Input value={code} onChange={(e) => setCode(e.target.value)} required />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? 'Verifying…' : 'Continue'}
        </Button>
      </form>
    </AuthScreen>
  );
}
