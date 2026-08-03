'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent, type ReactElement } from 'react';
import { formatApiError } from '../../lib/api-client';
import { resetPassword } from '../../lib/auth/session';

function ResetForm(): ReactElement {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!token) {
      setError('Missing reset token. Open the link from your email.');
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const message = await resetPassword(token, password);
      setInfo(message || 'Password updated. You can sign in.');
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auv-auth" aria-labelledby="auv-reset-title">
      <p className="auv-auth__eyebrow">One Auvora account</p>
      <h1 id="auv-reset-title">Reset password</h1>
      <p className="auv-auth__lede">Choose a new password for your Auvora identity account.</p>
      <form className="auv-auth__form" onSubmit={(e) => void onSubmit(e)}>
        <label className="auv-auth__field">
          <span>New password</span>
          <input
            type="password"
            required
            minLength={12}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <span className="auv-auth__hint">
            At least 12 characters with upper, lower, digit, and special character.
          </span>
        </label>
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
        <button type="submit" className="mh-btn mh-btn--primary" disabled={busy || !token}>
          {busy ? 'Updating…' : 'Update password'}
        </button>
      </form>
      <p className="auv-auth__switch">
        <Link href="/auth/login">Sign in</Link>
      </p>
    </section>
  );
}

export function ResetPasswordExperience(): ReactElement {
  return (
    <Suspense fallback={<section className="auv-auth">Loading…</section>}>
      <ResetForm />
    </Suspense>
  );
}
