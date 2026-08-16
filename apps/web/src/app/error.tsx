'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';
import './consumer.css';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): ReactElement {
  return (
    <div className="as">
      <p className="as-kicker">
        <Link href="/">Auvora</Link>
      </p>
      <div className="as-issue as-issue--error">
        <h1 className="as__title">Something went wrong</h1>
        <p className="as__lede">
          Try again, or return to your wallet. Your funds are not moved by this screen.
        </p>
        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
          <button type="button" className="as-btn as-btn--primary" onClick={reset}>
            Try again
          </button>
          <Link className="as-btn as-btn--ghost" href="/dashboard">
            Back to wallet
          </Link>
          <Link className="as-btn as-btn--ghost" href="/settings/help">
            Help
          </Link>
        </div>
        {error.digest ? <p className="as-hint">Reference: {error.digest}</p> : null}
      </div>
    </div>
  );
}
