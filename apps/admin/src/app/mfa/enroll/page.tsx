'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { Alert, Button, Field, Input } from '@auvora/ui';
import { AuthScreen } from '../../../components/AdminChrome';
import { formatApiError } from '../../../lib/api-client';
import { adminEnrollConfirm, adminEnrollStart } from '../../../lib/admin-session';

export default function MfaEnrollPage(): ReactElement {
  const router = useRouter();
  const [secret, setSecret] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const mfaToken = sessionStorage.getItem('auvora_admin_mfa_token');
    if (!mfaToken) {
      router.replace('/login');
      return;
    }
    void adminEnrollStart(mfaToken)
      .then((data) => {
        setSecret(data.secret);
        setOtpauthUrl(data.otpauthUrl);
      })
      .catch((err: unknown) => setError(formatApiError(err)));
  }, [router]);

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const mfaToken = sessionStorage.getItem('auvora_admin_mfa_token');
    if (!mfaToken) return;
    setPending(true);
    setError(null);
    try {
      const data = await adminEnrollConfirm(mfaToken, code);
      sessionStorage.removeItem('auvora_admin_mfa_token');
      setRecovery(data.recoveryCodes);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setPending(false);
    }
  }

  if (recovery) {
    return (
      <AuthScreen
        title="Save recovery codes"
        description="These recovery codes are shown once. Store them offline. They will not be displayed again and are never written to application logs."
      >
        <ol className="admin-recovery-codes">
          {recovery.map((item) => (
            <li key={item}>
              <code>{item}</code>
            </li>
          ))}
        </ol>
        <Button type="button" onClick={() => router.replace('/')}>
          I have saved these codes
        </Button>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Enroll authenticator"
      description="Scan the otpauth URL or enter the enrollment secret, then confirm a code. This secret is shown once and is never stored in this browser."
    >
      {error ? (
        <Alert tone="error" title="Enrollment failed">
          {error}
        </Alert>
      ) : null}
      {secret ? (
        <p className="admin-auth-secret">
          Secret (shown once): <code>{secret}</code>
        </p>
      ) : null}
      {otpauthUrl ? (
        <p className="admin-auth-copy">
          <a href={otpauthUrl}>Open in authenticator</a>
        </p>
      ) : null}
      <form className="admin-auth-form" onSubmit={(e) => void onSubmit(e)}>
        <Field label="Confirmation code">
          <Input
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? 'Confirming…' : 'Confirm enrollment'}
        </Button>
      </form>
    </AuthScreen>
  );
}
