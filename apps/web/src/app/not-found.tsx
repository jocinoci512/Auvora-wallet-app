import Link from 'next/link';
import type { ReactElement } from 'react';
import './core-experience.css';

export default function NotFound(): ReactElement {
  return (
    <div className="cx cx--wide">
      <div className="cx-atmosphere" aria-hidden />
      <header className="cx__header">
        <p className="cx__eyebrow">
          <Link href="/dashboard">Wallet</Link>
        </p>
        <h1 className="cx__title">Page not found</h1>
        <p className="cx__sub">That address is not part of Auvora Wallet.</p>
        <p className="cx__reassure">Your funds are not moved by this screen.</p>
      </header>
      <div className="cx__body">
        <section className="cx-panel" aria-label="Where to go next">
          <div className="cx-platform__actions">
            <Link href="/dashboard" className="cx-btn cx-btn--primary">
              Back to wallet
            </Link>
            <Link href="/settings/help" className="cx-btn cx-btn--ghost">
              Help
            </Link>
            <Link href="/status" className="cx-btn cx-btn--ghost">
              Status
            </Link>
            <Link href="/trust" className="cx-btn cx-btn--ghost">
              Trust
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
