'use client';

import Link from 'next/link';
import { useState, type FormEvent, type ReactElement } from 'react';
import { humanizeAuthError } from '../../lib/auth/error-copy';
import { forgotPassword } from '../../lib/auth/session';
import { AuthShell } from './AuthShell';

export function ForgotPasswordExperience(): ReactElement {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await forgotPassword(email.trim());
      setInfo(
        'If an account exists for this email, a reset link is on its way. This never asks for a recovery phrase.',
      );
    } catch (err) {
      setError(humanizeAuthError(err, 'Could not send a reset link.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Forgot password"
      lede="We email a time-limited reset link for your Auvora account. Wallet keys are not involved."
    >
      <form onSubmit={(e) => void onSubmit(e)}>
        <label className="as-field">
          <span>Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
          />
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
        <button type="submit" className="as-btn as-btn--primary" disabled={busy}>
          {busy ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <p className="as-switch">
        <Link href="/auth/login">Back to sign in</Link>
      </p>
    </AuthShell>
  );
}
