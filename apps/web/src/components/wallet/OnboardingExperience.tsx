'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import '../../app/onboarding.css';
import { isSignedIn } from '../../lib/auth/session';

function OrbitIllustration(): ReactElement {
  return (
    <div className="ob-orbit" aria-hidden>
      <svg viewBox="0 0 200 200" fill="none">
        <circle
          cx="100"
          cy="100"
          r="78"
          stroke="currentColor"
          strokeOpacity="0.15"
          strokeWidth="1.5"
        />
        <circle
          cx="100"
          cy="100"
          r="54"
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeWidth="1.5"
        />
        <circle cx="100" cy="100" r="28" fill="currentColor" fillOpacity="0.12" />
        <path
          d="M100 46c-8 18-8 36 0 54 8 18 8 36 0 54"
          stroke="currentColor"
          strokeOpacity="0.55"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M46 100c18-8 36-8 54 0s36 8 54 0"
          stroke="currentColor"
          strokeOpacity="0.55"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="100" cy="100" r="6" fill="currentColor" />
        <circle cx="154" cy="72" r="5" fill="currentColor" fillOpacity="0.7" />
        <circle cx="58" cy="140" r="4" fill="currentColor" fillOpacity="0.5" />
      </svg>
    </div>
  );
}

export function OnboardingExperience(): ReactElement {
  const [phase, setPhase] = useState<'welcome' | 'wallet'>('welcome');

  useEffect(() => {
    if (isSignedIn()) setPhase('wallet');
  }, []);

  if (phase === 'welcome') {
    return (
      <div className="ob ob--wide" role="main">
        <div className="ob-atmosphere" aria-hidden />
        <section className="ob-welcome" aria-labelledby="ob-welcome-title">
          <OrbitIllustration />
          <p className="ob-brand">Auvora</p>
          <h1 id="ob-welcome-title">Welcome to Auvora</h1>
          <p className="ob-welcome__lede">
            Create one account for Web and Android. After you sign in, set up a self-custody wallet
            on this device. Keys never leave your devices.
          </p>
          <div className="ob-welcome__cta">
            <Link href="/auth/register" className="ob-btn ob-btn--primary ob-btn--lg">
              Create Account
            </Link>
            <Link href="/auth/login" className="ob-btn ob-btn--ghost ob-btn--lg">
              Sign In
            </Link>
          </div>
          <p className="ob__reassure" style={{ marginTop: '1.25rem' }}>
            Already have a recovery phrase? Sign in first, then restore your wallet on this device.
            Password reset restores account access only — it cannot decrypt wallet material
            encrypted with another secret.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="ob ob--wide" role="main">
      <div className="ob-atmosphere" aria-hidden />
      <header className="ob__header">
        <p className="ob__eyebrow">
          <button type="button" className="ob-back" onClick={() => setPhase('welcome')}>
            Back
          </button>
        </p>
        <h1 className="ob__title">Set up a wallet</h1>
        <p className="ob__sub">
          Your Auvora account is shared across platforms. Wallet keys for signing stay on this
          device until a vetted cross-device vault architecture ships.
        </p>
        <p className="ob__reassure">
          Auvora does not receive your private keys through account login. No manual “link mobile
          wallet” step is required for account identity.
        </p>
      </header>

      <div className="ob-paths">
        <Link href="/wallets/create" className="ob-path ob-path--primary">
          <strong>Create a new wallet</strong>
          <span>Generate keys on this device, then write down the recovery phrase.</span>
        </Link>
        <Link href="/wallets/import" className="ob-path">
          <strong>Import or restore</strong>
          <span>Emergency restore with a recovery phrase you already control.</span>
        </Link>
      </div>

      <details className="ob-advanced">
        <summary>More options</summary>
        <div className="ob-advanced__links">
          <Link href="/wallets/restore">Restore from backup</Link>
          <Link href="/wallets/hardware">Hardware wallet</Link>
          <Link href="/wallets/watch">Watch-only</Link>
          <Link href="/compliance">Identity verification (KYC)</Link>
        </div>
      </details>
    </div>
  );
}
