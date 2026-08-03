'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactElement } from 'react';
import { formatApiError } from '../../lib/api-client';
import { resendVerification, signIn, signUp } from '../../lib/auth/session';

export function AuthExperience({ mode }: { mode: 'login' | 'register' }): ReactElement {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === 'register') {
        const res = await signUp(email.trim(), password, displayName.trim() || undefined);
        setInfo(
          res.message ||
            'Account created. Check your email to verify, then sign in. (Local console mail prints the link when MAIL_DRIVER=console.)',
        );
        router.push('/auth/login');
        return;
      }
      await signIn(email.trim(), password);
      router.push('/dashboard');
    } catch (err) {
      const message = formatApiError(err);
      setError(message);
      if (/verify/i.test(message)) {
        setInfo('Need a new verification email? Use Resend verification below.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function onResend(): Promise<void> {
    if (!email.trim()) {
      setError('Enter your email first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const message = await resendVerification(email.trim());
      setInfo(message);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auv-auth" aria-labelledby="auv-auth-title">
      <p className="auv-auth__eyebrow">One Auvora account</p>
      <h1 id="auv-auth-title">{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
      <p className="auv-auth__lede">
        Syncs identity, preferences, public addresses, labels, watch-only lists, activity metadata,
        and sessions across devices. Private keys, seeds, and recovery phrases never leave your
        devices — and are never stored on Auvora servers.
      </p>
      <form className="auv-auth__form" onSubmit={(e) => void onSubmit(e)}>
        {mode === 'register' ? (
          <label className="auv-auth__field">
            <span>Display name</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="nickname"
              maxLength={64}
            />
          </label>
        ) : null}
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
        <label className="auv-auth__field">
          <span>Password</span>
          <input
            type="password"
            required
            minLength={12}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          {mode === 'register' ? (
            <span className="auv-auth__hint">
              At least 12 characters with upper, lower, digit, and special character.
            </span>
          ) : null}
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
          {busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>
      <p className="auv-auth__switch">
        {mode === 'login' ? (
          <>
            New here? <Link href="/auth/register">Create an account</Link>
            {' · '}
            <Link href="/auth/forgot-password">Forgot password</Link>
            {' · '}
            <button
              type="button"
              className="auv-auth__linkbtn"
              disabled={busy}
              onClick={() => void onResend()}
            >
              Resend verification
            </button>
          </>
        ) : (
          <>
            Already have an account? <Link href="/auth/login">Sign in</Link>
          </>
        )}
      </p>
      <p className="auv-auth__note">
        Encrypted cross-device restoration of wallet secrets is a separate security milestone. This
        account layer does not sync seed phrases.
      </p>
    </section>
  );
}
