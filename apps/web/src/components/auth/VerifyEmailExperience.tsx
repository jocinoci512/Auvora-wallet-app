'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type ReactElement } from 'react';
import { humanizeAuthError } from '../../lib/auth/error-copy';
import { verifyEmail } from '../../lib/auth/session';
import { AuthShell } from './AuthShell';

function VerifyBody(): ReactElement {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [busy, setBusy] = useState(Boolean(token));
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('This verification link is missing or incomplete. Open the latest email we sent.');
      setBusy(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await verifyEmail(token);
        if (!cancelled) setInfo('Email verified. You can sign in.');
      } catch (err) {
        if (!cancelled)
          setError(humanizeAuthError(err, 'This verification link could not be used.'));
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <AuthShell
      title="Verify email"
      lede="Confirm your email to activate sign-in for this Auvora account."
    >
      {busy ? (
        <p className="as-info" role="status">
          Verifying…
        </p>
      ) : null}
      {error ? (
        <p className="as-error" role="alert">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="as-info" role="status">
          {info}
        </p>
      ) : null}
      <p className="as-switch">
        <Link href="/auth/login">Continue to sign in</Link>
      </p>
    </AuthShell>
  );
}

export function VerifyEmailExperience(): ReactElement {
  return (
    <Suspense
      fallback={
        <AuthShell title="Verify email" lede="Verifying…">
          <p className="as-hint">Please wait…</p>
        </AuthShell>
      }
    >
      <VerifyBody />
    </Suspense>
  );
}
