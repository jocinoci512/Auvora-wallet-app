'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent, type ReactElement } from 'react';
import { Alert, Button, Field, Input } from '@auvora/ui';
import { AuthScreen } from '../../components/AdminChrome';
import { formatApiError } from '../../lib/api-client';
import { adminStepUp } from '../../lib/admin-session';

function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

function StepUpForm(): ReactElement {
  const router = useRouter();
  const params = useSearchParams();
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
      router.replace(safeNext(params.get('next')));
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <Field label="Authenticator code">
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? 'Confirming…' : 'Confirm identity'}
        </Button>
      </form>
    </AuthScreen>
  );
}

export default function StepUpFormPage(): ReactElement {
  return (
    <Suspense>
      <StepUpForm />
    </Suspense>
  );
}
