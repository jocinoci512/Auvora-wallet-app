'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent, type ReactElement } from 'react';
import { humanizeAuthError, isStrongPassword } from '../../lib/auth/error-copy';
import { resetPassword } from '../../lib/auth/session';
import { AuthShell } from './AuthShell';

function ResetForm(): ReactElement {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!token) {
      setError('This reset link is missing or incomplete. Open the latest email we sent.');
      return;
    }
    if (!isStrongPassword(password)) {
      setError(
        'Use at least 12 characters, including upper and lower case, a number, and a symbol.',
      );
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await resetPassword(token, password);
      setInfo('Password updated. You can sign in.');
    } catch (err) {
      setError(humanizeAuthError(err, 'This reset link could not be used. Request a new one.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Reset password" lede="Choose a new password for your Auvora account.">
      <form onSubmit={(e) => void onSubmit(e)}>
        <label className="as-field">
          <span>New password</span>
          <div className="as-field__row">
            <input
              type={show ? 'text' : 'password'}
              required
              minLength={12}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="as-btn as-btn--ghost"
              aria-pressed={show}
              aria-label={show ? 'Hide password' : 'Show password'}
              onClick={() => setShow((v) => !v)}
            >
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
          <span className="as-hint">
            At least 12 characters with upper, lower, a number, and a symbol.
          </span>
        </label>
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
        <button type="submit" className="as-btn as-btn--primary" disabled={busy || !token}>
          {busy ? 'Updating…' : 'Update password'}
        </button>
      </form>
      <p className="as-switch">
        <Link href="/auth/login">Sign in</Link>
        {' · '}
        <Link href="/auth/forgot-password">Request a new link</Link>
      </p>
    </AuthShell>
  );
}

export function ResetPasswordExperience(): ReactElement {
  return (
    <Suspense
      fallback={
        <AuthShell title="Reset password" lede="Loading…">
          <p className="as-hint">Preparing the form…</p>
        </AuthShell>
      }
    >
      <ResetForm />
    </Suspense>
  );
}
