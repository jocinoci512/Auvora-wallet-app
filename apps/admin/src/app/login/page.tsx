'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent, type ReactElement } from 'react';
import { Alert, Button, Field, Input } from '@auvora/ui';
import { AuthScreen } from '../../components/AdminChrome';
import { formatApiError } from '../../lib/api-client';
import { adminLogin } from '../../lib/admin-session';

function LoginForm(): ReactElement {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await adminLogin(email, password);
      const next = params.get('next') || '/';
      const dest = next.startsWith('/') && !next.startsWith('//') ? next : '/';
      if (result.status === 'authenticated') {
        router.replace(dest);
        return;
      }
      sessionStorage.setItem('auvora_admin_mfa_token', result.mfaToken ?? '');
      router.replace(result.status === 'mfa_enrollment_required' ? '/mfa/enroll' : '/mfa');
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 423) {
        router.replace('/locked');
        return;
      }
      if (status === 403) {
        setError(formatApiError(err));
        return;
      }
      setError(formatApiError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthScreen
      title="Administrator sign in"
      description="Use your Auvora administrator identity. Wallet customers cannot enter this control plane."
      homeLink={false}
    >
      {error ? (
        <Alert tone="error" title="Sign in failed">
          {error}
        </Alert>
      ) : null}
      <form className="admin-auth-form" onSubmit={(e) => void onSubmit(e)}>
        <Field label="Email">
          <Input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? 'Signing in…' : 'Continue'}
        </Button>
      </form>
    </AuthScreen>
  );
}

export default function LoginPage(): ReactElement {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
