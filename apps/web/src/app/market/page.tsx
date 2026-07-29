'use client';

import { AuvoraClientError } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { formatApiError, getStoredAccessToken } from '../../lib/api-client';

type Overview = {
  generatedAt: string;
  provider: string;
  assets: Array<{
    symbol: string;
    network: string;
    priceUsd: string;
    change24hPct: string | null;
    marketCapUsd: string | null;
  }>;
  trending: Array<{ symbol: string; change24hPct: string; priceUsd: string }>;
};

export default function MarketDataPage(): ReactElement {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = getStoredAccessToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/market-data/overview`,
        {
          headers: {
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            accept: 'application/json',
          },
          credentials: 'include',
        },
      );
      if (!response.ok) {
        throw new AuvoraClientError('Failed to load market overview', response.status);
      }
      const body = (await response.json()) as { data: Overview };
      setOverview(body.data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof AuvoraClientError && err.status === 401
          ? 'Unauthorized — save a JWT access token above.'
          : formatApiError(err),
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="page">
      <header className="page__header">
        <h1>Market overview</h1>
        <nav className="page__subnav">
          <Link href="/market">Overview</Link>
          <Link href="/market/portfolio">Portfolio</Link>
          <Link href="/market/watchlist">Watchlist</Link>
        </nav>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      {overview ? (
        <>
          <p>
            Provider {overview.provider} · Generated {overview.generatedAt}
          </p>
          <h2>Assets</h2>
          <ul className="stack">
            {overview.assets.map((asset) => (
              <li key={`${asset.network}-${asset.symbol}`}>
                {asset.symbol} ({asset.network}) — ${asset.priceUsd}
                {asset.change24hPct != null ? ` · 24h ${asset.change24hPct}%` : ''}
              </li>
            ))}
          </ul>
          <h2>Trending</h2>
          <ul className="stack">
            {overview.trending.map((item) => (
              <li key={item.symbol}>
                {item.symbol} — ${item.priceUsd} · {item.change24hPct}%
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </main>
  );
}
