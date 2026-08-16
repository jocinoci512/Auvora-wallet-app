'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent, type ReactElement } from 'react';
import { humanizeAuthError, isStrongPassword } from '../../lib/auth/error-copy';
import { resendVerification, signIn, signUp } from '../../lib/auth/session';
import { issueCopy, type AppIssue } from '../../lib/dashboard/status-copy';
import { AuthShell } from './AuthShell';

const REASON_ISSUES: Record<string, AppIssue> = {
  expired: 'session',
  session: 'session',
  revoked: 'revoked',
  locked: 'locked',
  suspended: 'suspended',
  offline: 'offline',
  rate_limited: 'rate_limited',
  unavailable: 'backend',
};

function PasswordField({
  value,
  onChange,
  autoComplete,
  label,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  label: string;
  hint?: string;
}): ReactElement {
  const [show, setShow] = useState(false);
  return (
    <label className="as-field">
      <span>{label}</span>
      <div className="as-field__row">
        <input
          type={show ? 'text' : 'password'}
          required
          minLength={12}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
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
      {hint ? <span className="as-hint">{hint}</span> : null}
    </label>
  );
}

function AuthForm({ mode }: { mode: 'login' | 'register' }): ReactElement {
  const router = useRouter();
  const params = useSearchParams();
  const reason = params.get('reason') ?? '';
  const registered = params.get('registered') === '1';
  const banner = REASON_ISSUES[reason] ? issueCopy(REASON_ISSUES[reason]!) : null;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(
    registered ? 'Account created. Check your email to verify, then sign in.' : null,
  );

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    if (!/\S+@\S+\.\S+/.test(email.trim())) {
      setError('Enter a valid email address.');
      setBusy(false);
      return;
    }
    if (mode === 'register' && !isStrongPassword(password)) {
      setError(
        'Use at least 12 characters, including upper and lower case, a number, and a symbol.',
      );
      setBusy(false);
      return;
    }
    try {
      if (mode === 'register') {
        await signUp(email.trim(), password, displayName.trim() || undefined);
        router.push('/auth/login?registered=1');
        return;
      }
      await signIn(email.trim(), password);
      router.push('/dashboard');
    } catch (err) {
      const message = humanizeAuthError(
        err,
        mode === 'register' ? 'Account could not be created.' : 'Sign-in could not be completed.',
      );
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
      await resendVerification(email.trim());
      setInfo('If that email is registered and unverified, a new message is on its way.');
    } catch (err) {
      setError(humanizeAuthError(err, 'Could not resend verification.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={mode === 'login' ? 'Sign in' : 'Create account'}
      lede={
        mode === 'login'
          ? 'Sign in to your Auvora account for identity, sessions, and preferences. This does not unlock wallet keys.'
          : 'Create an Auvora account for identity and cross-device preferences. A wallet is separate, and keys stay on your devices.'
      }
    >
      {banner ? (
        <div className="as-issue as-issue--warn" role="status">
          <strong>{banner.title}</strong>
          <p className="as-hint">{banner.body}</p>
        </div>
      ) : null}
      <form onSubmit={(e) => void onSubmit(e)}>
        {mode === 'register' ? (
          <label className="as-field">
            <span>Display name (optional)</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="nickname"
              maxLength={64}
            />
          </label>
        ) : null}
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
        <PasswordField
          value={password}
          onChange={setPassword}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          label="Password"
          hint={
            mode === 'register'
              ? 'At least 12 characters with upper, lower, a number, and a symbol.'
              : undefined
          }
        />
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
          {busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>
      <p className="as-switch">
        {mode === 'login' ? (
          <>
            New here? <Link href="/auth/register">Create an account</Link>
            {' · '}
            <Link href="/auth/forgot-password">Forgot password</Link>
            {' · '}
            <button
              type="button"
              className="as-btn as-btn--ghost"
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
    </AuthShell>
  );
}

export function AuthExperience({ mode }: { mode: 'login' | 'register' }): ReactElement {
  return (
    <Suspense
      fallback={
        <AuthShell title={mode === 'login' ? 'Sign in' : 'Create account'} lede="Loading…">
          <p className="as-hint">Preparing the form…</p>
        </AuthShell>
      }
    >
      <AuthForm mode={mode} />
    </Suspense>
  );
}
