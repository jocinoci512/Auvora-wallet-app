'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactElement } from 'react';
import { Alert, Button, Field, Input } from '@auvora/ui';
import { AuthScreen } from '../../components/AdminChrome';
import { formatApiError } from '../../lib/api-client';
import { adminStepUp } from '../../lib/admin-session';

export default function StepUpFormPage(): ReactElement {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await adminStepUp(password, code);
      router.replace('/');
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthScreen
      title="Confirm it is you"
      description="High-risk actions need your password and authenticator code. This confirmation lasts 10 minutes."
    >
      {error ? (
        <Alert tone="error" title="Step-up failed">
          {error}
        </Alert>
      ) : null}
      <form className="admin-auth-form" onSubmit={(e) => void onSubmit(e)}>
        <Field label="Password">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <Field label="Authenticator code">
          <Input
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? 'Confirming…' : 'Confirm'}
        </Button>
      </form>
    </AuthScreen>
  );
}
