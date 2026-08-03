'use client';

import Link from 'next/link';
import { useState, type FormEvent, type ReactElement } from 'react';
import { formatApiError } from '../../lib/api-client';
import { forgotPassword } from '../../lib/auth/session';

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
      const message = await forgotPassword(email.trim());
      setInfo(message || 'If an account exists, a reset link was sent.');
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auv-auth" aria-labelledby="auv-forgot-title">
      <p className="auv-auth__eyebrow">One Auvora account</p>
      <h1 id="auv-forgot-title">Forgot password</h1>
      <p className="auv-auth__lede">
        We email a time-limited reset link. This never asks for your seed phrase or private keys.
      </p>
      <form className="auv-auth__form" onSubmit={(e) => void onSubmit(e)}>
        <label className="auv-auth__field">
          <span>Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
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
        <button type="submit" className="mh-btn mh-btn--primary" disabled={busy}>
          {busy ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <p className="auv-auth__switch">
        <Link href="/auth/login">Back to sign in</Link>
      </p>
    </section>
  );
}
