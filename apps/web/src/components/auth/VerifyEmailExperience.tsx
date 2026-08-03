'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type ReactElement } from 'react';
import { formatApiError } from '../../lib/api-client';
import { verifyEmail } from '../../lib/auth/session';

function VerifyBody(): ReactElement {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [busy, setBusy] = useState(Boolean(token));
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Missing verification token. Open the link from your email.');
      setBusy(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const message = await verifyEmail(token);
        if (!cancelled) setInfo(message || 'Email verified. You can sign in.');
      } catch (err) {
        if (!cancelled) setError(formatApiError(err));
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <section className="auv-auth" aria-labelledby="auv-verify-title">
      <p className="auv-auth__eyebrow">One Auvora account</p>
      <h1 id="auv-verify-title">Verify email</h1>
      <p className="auv-auth__lede">Confirm your email to activate sign-in for this account.</p>
      {busy ? <p className="auv-auth__info">Verifying…</p> : null}
      {error ? (
        <p className="auv-auth__error" role="alert">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="auv-auth__info" role="status">
          {info}
        </p>
      ) : null}
      <p className="auv-auth__switch">
        <Link href="/auth/login">Continue to sign in</Link>
      </p>
    </section>
  );
}

export function VerifyEmailExperience(): ReactElement {
  return (
    <Suspense fallback={<section className="auv-auth">Verifying…</section>}>
      <VerifyBody />
    </Suspense>
  );
}
