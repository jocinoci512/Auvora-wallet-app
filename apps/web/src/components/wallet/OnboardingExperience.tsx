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
  const [phase, setPhase] = useState<'welcome' | 'choose'>('welcome');

  if (phase === 'welcome') {
    return (
      <div className="ob ob--wide" role="main">
        <div className="ob-atmosphere" aria-hidden />
        <section className="ob-welcome" aria-labelledby="ob-welcome-title">
          <OrbitIllustration />
          <p className="ob-brand">Auvora</p>
          <h1 id="ob-welcome-title">Your wallet, without the worry.</h1>
          <p className="ob-welcome__lede">
            We will guide you step by step. Keys stay yours. Nothing irreversible happens without a
            clear confirmation.
          </p>
          <div className="ob-welcome__cta">
            <button
              type="button"
              className="ob-btn ob-btn--primary ob-btn--lg"
              onClick={() => setPhase('choose')}
            >
              Get started
            </button>
            <Link href="/dashboard" className="ob-btn ob-btn--ghost ob-btn--lg">
              I already have a wallet
            </Link>
          </div>
          <ul className="ob-welcome__trust">
            <li>Self-custody</li>
            <li>Readable confirms</li>
            <li>Takes a few minutes</li>
          </ul>
        </section>
      </div>
    );
  }

  return (
    <div className="ob ob--wide" role="main">
      <div className="ob-atmosphere" aria-hidden />
      <header className="ob__header">
        <p className="ob__eyebrow">
          <button
            type="button"
            onClick={() => setPhase('welcome')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--ob-lagoon)',
              font: 'inherit',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
              minHeight: 44,
            }}
          >
            Back
          </button>
        </p>
        <h1 className="ob__title">How would you like to begin?</h1>
        <p className="ob__sub">
          New here? Create a wallet. Already have one? Import it. Advanced options stay tucked away.
        </p>
        <p className="ob__reassure">
          You can change your mind later — this choice just sets the path.
        </p>
      </header>

      <div className="ob-paths">
        <Link href="/wallets/create" className="ob-path ob-path--primary">
          <span className="ob-path__icon" aria-hidden>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <strong>Create a new wallet</strong>
          <span>Generate a fresh account with guided backup and security setup.</span>
        </Link>
        <Link href="/wallets/import" className="ob-path">
          <span className="ob-path__icon" aria-hidden>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
            </svg>
          </span>
          <strong>Import an existing wallet</strong>
          <span>Recovery phrase, private key, hardware, or WalletConnect.</span>
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
