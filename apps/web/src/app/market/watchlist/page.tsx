'use client';

import Link from 'next/link';
import { type ReactElement } from 'react';

export default function MarketWatchlistPage(): ReactElement {
  return (
    <main className="page">
      <header className="page__header">
        <h1>Watchlist</h1>
        <nav className="page__subnav">
          <Link href="/market">Overview</Link>
          <Link href="/market/portfolio">Portfolio</Link>
          <Link href="/market/watchlist">Watchlist</Link>
        </nav>
      </header>
      <p>
        Manage favorites and pinned assets via <code>/api/v1/market-data/watchlists</code>. Price
        alerts live under <code>/api/v1/market-data/alerts</code>.
      </p>
    </main>
  );
}
