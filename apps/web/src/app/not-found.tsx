import Link from 'next/link';
import type { ReactElement } from 'react';
import './consumer.css';

export default function NotFound(): ReactElement {
  return (
    <div className="as">
      <p className="as-kicker">
        <Link href="/">Auvora</Link>
      </p>
      <div className="as-issue">
        <h1 className="as__title">Page not found</h1>
        <p className="as__lede">
          That address is not part of Auvora Wallet. Your funds are not moved by this screen.
        </p>
        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
          <Link className="as-btn as-btn--primary" href="/dashboard">
            Back to wallet
          </Link>
          <Link className="as-btn as-btn--ghost" href="/settings/help">
            Help
          </Link>
        </div>
      </div>
    </div>
  );
}
