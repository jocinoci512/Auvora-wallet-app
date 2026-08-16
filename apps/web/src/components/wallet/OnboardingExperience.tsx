'use client';

import Link from 'next/link';
import { useState, type ReactElement } from 'react';
import '../../app/onboarding.css';

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
  const [phase, setPhase] = useState<'welcome' | 'account' | 'choose'>('welcome');

  if (phase === 'welcome') {
    return (
      <div className="ob ob--wide" role="main">
        <div className="ob-atmosphere" aria-hidden />
        <section className="ob-welcome" aria-labelledby="ob-welcome-title">
          <OrbitIllustration />
          <p className="ob-brand">Auvora</p>
          <h1 id="ob-welcome-title">A calm start for self-custody.</h1>
          <p className="ob-welcome__lede">
            First an optional Auvora Account for identity. Then a wallet whose keys stay on your
            devices.
          </p>
          <div className="ob-welcome__cta">
            <button
              type="button"
              className="ob-btn ob-btn--primary ob-btn--lg"
              onClick={() => setPhase('account')}
            >
              Continue
            </button>
            <Link href="/dashboard" className="ob-btn ob-btn--ghost ob-btn--lg">
              I already have a wallet
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (phase === 'account') {
    return (
      <div className="ob ob--wide" role="main">
        <div className="ob-atmosphere" aria-hidden />
        <header className="ob__header">
          <p className="ob__eyebrow">
            <button type="button" className="ob-back" onClick={() => setPhase('welcome')}>
              Back
            </button>
          </p>
          <h1 className="ob__title">Account and wallet are different</h1>
          <p className="ob__sub">
            Sign in if you want preferences across devices. You can still create a wallet on this
            device without an account.
          </p>
        </header>
        <div className="ob-paths">
          <div className="ob-path">
            <strong>Auvora Account</strong>
            <span>
              Identity, sessions, and preferences. Never receives private keys or a recovery phrase.
            </span>
          </div>
          <div className="ob-path">
            <strong>Non-custodial wallet</strong>
            <span>
              You control the cryptographic keys on this device. Backup is your recovery phrase.
            </span>
          </div>
        </div>
        <div className="ob-welcome__cta" style={{ marginTop: '1.5rem' }}>
          <Link href="/auth/register" className="ob-btn ob-btn--primary ob-btn--lg">
            Create account
          </Link>
          <Link href="/auth/login" className="ob-btn ob-btn--ghost ob-btn--lg">
            Sign in
          </Link>
          <button
            type="button"
            className="ob-btn ob-btn--ghost ob-btn--lg"
            onClick={() => setPhase('choose')}
          >
            Continue to wallet setup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ob ob--wide" role="main">
      <div className="ob-atmosphere" aria-hidden />
      <header className="ob__header">
        <p className="ob__eyebrow">
          <button type="button" className="ob-back" onClick={() => setPhase('account')}>
            Back
          </button>
        </p>
        <h1 className="ob__title">Set up a wallet</h1>
        <p className="ob__sub">Create a new wallet or import one you already control.</p>
        <p className="ob__reassure">
          Auvora does not receive your private keys through account login.
        </p>
      </header>

      <div className="ob-paths">
        <Link href="/wallets/create" className="ob-path ob-path--primary">
          <strong>Create a new wallet</strong>
          <span>Generate keys on this device, then write down the recovery phrase.</span>
        </Link>
        <Link href="/wallets/import" className="ob-path">
          <strong>Import or restore</strong>
          <span>Use a recovery phrase or private key you already have.</span>
        </Link>
      </div>

      <details className="ob-advanced">
        <summary>More options</summary>
        <div className="ob-advanced__links">
          <Link href="/wallets/restore">Restore from backup</Link>
          <Link href="/wallets/hardware">Hardware wallet</Link>
          <Link href="/wallets/watch">Watch-only</Link>
          <Link href="/wallets/recovery">Recovery rehearsal</Link>
        </div>
      </details>
    </div>
  );
}
