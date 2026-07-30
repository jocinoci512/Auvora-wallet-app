'use client';

import Link from 'next/link';
import { useEffect, type ReactElement } from 'react';
import './core-experience.css';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): ReactElement {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="cx cx--wide">
      <div className="cx-atmosphere" aria-hidden />
      <header className="cx__header">
        <p className="cx__eyebrow">
          <Link href="/dashboard">Wallet</Link>
        </p>
        <h1 className="cx__title">Something went wrong</h1>
        <p className="cx__sub">
          The page hit an unexpected error. Your funds are not moved by this screen.
        </p>
        <p className="cx__reassure">
          Try again, or return to your wallet. Check Status if the issue persists.
        </p>
      </header>
      <div className="cx__body">
        <section className="cx-panel">
          <div className="cx-platform__actions">
            <button type="button" className="cx-btn cx-btn--primary" onClick={reset}>
              Try again
            </button>
            <Link href="/dashboard" className="cx-btn cx-btn--ghost">
              Back to wallet
            </Link>
            <Link href="/status" className="cx-btn cx-btn--ghost">
              Status
            </Link>
            <Link href="/settings/help" className="cx-btn cx-btn--ghost">
              Help
            </Link>
          </div>
          {error.digest ? (
            <p className="cx-meta" style={{ marginTop: '1rem' }}>
              Reference: {error.digest}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
