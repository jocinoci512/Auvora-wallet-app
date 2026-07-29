'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Alert, PageHeader } from '@auvora/ui';
import { DonutChart, LineChart } from '../charts/Charts';
import { CountUp } from '../charts/CountUp';
import {
  DEMO_HOLDINGS,
  DEMO_PERFORMANCE,
  formatPct,
  formatUsd,
  portfolioTotals,
  type Holding,
} from '../../lib/dashboard-demo';
import { OFFLINE_CACHE_NS, writeOfflineCache } from '../../lib/offline/cache';
import '../../app/dashboard.css';

const COLORS = ['var(--auvora-color-primary)', '#3d4f5f', '#84caff', '#f5b942', '#9db0c0'];

type SortKey = 'value' | 'change' | 'symbol' | 'allocation';

export function PortfolioExperience(): ReactElement {
  const [query, setQuery] = useState('');
  const [network, setNetwork] = useState('all');
  const [sort, setSort] = useState<SortKey>('value');
  const [openId, setOpenId] = useState<string | null>(DEMO_HOLDINGS[0]?.id ?? null);
  const holdings = DEMO_HOLDINGS;

  useEffect(() => {
    writeOfflineCache(
      OFFLINE_CACHE_NS.portfolio,
      'holdings',
      { holdings: DEMO_HOLDINGS, performance: DEMO_PERFORMANCE },
      1000 * 60 * 60 * 12,
    );
    writeOfflineCache(
      OFFLINE_CACHE_NS.assetMeta,
      'symbols',
      DEMO_HOLDINGS.map((h) => ({
        symbol: h.symbol,
        name: h.name,
        network: h.network,
      })),
      1000 * 60 * 60 * 24,
    );
  }, []);

  const networks = useMemo(
    () => Array.from(new Set(holdings.map((h) => h.network))).sort(),
    [holdings],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = holdings.filter((h) => {
      if (network !== 'all' && h.network !== network) return false;
      if (!q) return true;
      return (
        h.symbol.toLowerCase().includes(q) ||
        h.name.toLowerCase().includes(q) ||
        h.network.toLowerCase().includes(q) ||
        h.walletLabel.toLowerCase().includes(q)
      );
    });
    rows = [...rows].sort((a, b) => {
      if (sort === 'symbol') return a.symbol.localeCompare(b.symbol);
      if (sort === 'change') return b.change24hPct - a.change24hPct;
      if (sort === 'allocation') return b.allocationPct - a.allocationPct;
      return b.valueUsd - a.valueUsd;
    });
    return rows;
  }, [holdings, query, network, sort]);

  const totals = portfolioTotals(filtered.length ? filtered : holdings);
  const slices = (filtered.length ? filtered : holdings).map((h, i) => ({
    label: h.symbol,
    value: h.valueUsd,
    color: COLORS[i % COLORS.length]!,
  }));

  return (
    <div className="pf" role="main">
      <PageHeader
        title="Portfolio"
        subtitle="Multi-wallet balances, allocation, and performance — search, filter, and expand any position."
        actions={
          <Link href="/" className="dash-card__link">
            ← Dashboard
          </Link>
        }
      />

      <Alert tone="info" title="Preview portfolio data" style={{ marginBottom: '1rem' }}>
        Holdings and charts on this page use illustrative sample data until live wallet balances are
        connected for your session. Market overview and API-backed surfaces remain the source of
        truth for production quotes.
      </Alert>

      <section className="dash-hero" aria-label="Portfolio totals">
        <div className="dash-hero__value">
          <span className="dash-hero__label">Total value</span>
          <div className="dash-hero__amount">
            <CountUp value={totals.total} format={(n) => formatUsd(n)} />
          </div>
          <p className="dash-row__meta" style={{ marginTop: '0.4rem' }}>
            Unrealized P/L{' '}
            <span className={totals.unrealized >= 0 ? 'dash-pos' : 'dash-neg'}>
              {formatUsd(totals.unrealized)} ({formatPct(totals.unrealizedPct)})
            </span>
          </p>
        </div>
        <div className="dash-kpis">
          <div className="dash-kpi">
            <div className="dash-kpi__label">Wallets</div>
            <div className="dash-kpi__value">{totals.wallets}</div>
          </div>
          <div className="dash-kpi">
            <div className="dash-kpi__label">Networks</div>
            <div className="dash-kpi__value">{totals.networks}</div>
          </div>
          <div className="dash-kpi">
            <div className="dash-kpi__label">24h</div>
            <div className={`dash-kpi__value ${totals.dayPct >= 0 ? 'dash-pos' : 'dash-neg'}`}>
              {formatPct(totals.dayPct)}
            </div>
          </div>
        </div>
      </section>

      <section className="dash-card" style={{ marginBottom: '0.85rem' }} aria-labelledby="pf-nfts">
        <div className="dash-card__head">
          <h2 className="dash-card__title" id="pf-nfts">
            Digital assets
          </h2>
          <Link href="/digital-assets" className="dash-card__link">
            Open hub →
          </Link>
        </div>
        <p className="dash-row__meta">
          NFTs and collectibles contribute to wallet totals via the Digital Assets hub. Browse the
          gallery, collections, and NFT activity without leaving portfolio context.
        </p>
        <div
          className="dash-actions"
          style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}
        >
          <Link href="/nfts">Gallery</Link>
          <Link href="/nfts?view=collection">Collections</Link>
          <Link href="/nfts/activity">NFT activity</Link>
        </div>
      </section>

      <div className="dash-grid" style={{ marginBottom: '0.85rem' }}>
        <section className="dash-card dash-span-8" aria-labelledby="pf-perf">
          <div className="dash-card__head">
            <h2 className="dash-card__title" id="pf-perf">
              Performance
            </h2>
          </div>
          <LineChart
            data={DEMO_PERFORMANCE}
            height={160}
            ariaLabel="Portfolio historical performance"
          />
        </section>
        <section className="dash-card dash-span-4" aria-labelledby="pf-alloc">
          <div className="dash-card__head">
            <h2 className="dash-card__title" id="pf-alloc">
              Allocation
            </h2>
          </div>
          <div className="dash-alloc">
            <DonutChart slices={slices} size={140} centerLabel="Mix" centerSub="By value" />
            <ul className="dash-legend">
              {slices.map((s) => (
                <li key={s.label}>
                  <span className="dash-dot" style={{ background: s.color }} aria-hidden />
                  {s.label}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <div className="pf__toolbar" role="search">
        <label className="auvora-sr-only" htmlFor="pf-search">
          Search assets
        </label>
        <input
          id="pf-search"
          type="search"
          placeholder="Search symbol, network, or wallet"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="auvora-sr-only" htmlFor="pf-network">
          Filter network
        </label>
        <select
          id="pf-network"
          value={network}
          onChange={(e) => setNetwork(e.target.value)}
          aria-label="Filter by network"
        >
          <option value="all">All networks</option>
          {networks.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <label className="auvora-sr-only" htmlFor="pf-sort">
          Sort holdings
        </label>
        <select
          id="pf-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort holdings"
        >
          <option value="value">Sort: Value</option>
          <option value="change">Sort: 24h change</option>
          <option value="allocation">Sort: Allocation</option>
          <option value="symbol">Sort: Symbol</option>
        </select>
      </div>

      <div className="pf-cards">
        {filtered.length === 0 ? (
          <p className="dash-row__meta">No assets match your filters.</p>
        ) : (
          filtered.map((h) => (
            <AssetCard
              key={h.id}
              holding={h}
              open={openId === h.id}
              onToggle={() => setOpenId((cur) => (cur === h.id ? null : h.id))}
            />
          ))
        )}
      </div>
    </div>
  );
}

function AssetCard({
  holding,
  open,
  onToggle,
}: {
  holding: Holding;
  open: boolean;
  onToggle: () => void;
}): ReactElement {
  const pnl =
    holding.costBasisUsd != null
      ? holding.valueUsd - holding.costBasisUsd
      : holding.valueUsd * 0.08;
  const pnlPct = holding.costBasisUsd
    ? (pnl / holding.costBasisUsd) * 100
    : holding.change24hPct * 4;

  return (
    <article className="pf-card">
      <button type="button" className="pf-card__toggle" aria-expanded={open} onClick={onToggle}>
        <span className="pf-card__avatar" aria-hidden>
          {holding.symbol.slice(0, 3)}
        </span>
        <span>
          <div className="pf-card__name">
            {holding.name} ({holding.symbol})
          </div>
          <div className="pf-card__sub">
            {holding.network} · {holding.walletLabel}
          </div>
        </span>
        <span className="pf-card__value">
          {formatUsd(holding.valueUsd)}
          <div className={`pf-card__sub ${holding.change24hPct >= 0 ? 'dash-pos' : 'dash-neg'}`}>
            {formatPct(holding.change24hPct)} 24h
          </div>
        </span>
        <span className="pf-card__sub" aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>
      <div className="pf-card__body" hidden={!open}>
        <div>
          <LineChart
            data={[
              { v: holding.valueUsd * 0.92 },
              { v: holding.valueUsd * 0.95 },
              { v: holding.valueUsd * 0.94 },
              { v: holding.valueUsd * 0.98 },
              { v: holding.valueUsd },
            ]}
            height={88}
            ariaLabel={`${holding.symbol} recent price path`}
          />
        </div>
        <div className="dash-summary-grid">
          <div className="dash-stat">
            <span className="dash-stat__k">Balance</span>
            <span className="dash-stat__v">
              {holding.balance} {holding.symbol}
            </span>
          </div>
          <div className="dash-stat">
            <span className="dash-stat__k">Price</span>
            <span className="dash-stat__v">{formatUsd(holding.priceUsd)}</span>
          </div>
          <div className="dash-stat">
            <span className="dash-stat__k">Allocation</span>
            <span className="dash-stat__v">{holding.allocationPct.toFixed(1)}%</span>
          </div>
          <div className="dash-stat">
            <span className="dash-stat__k">Unrealized P/L</span>
            <span className={`dash-stat__v ${pnl >= 0 ? 'dash-pos' : 'dash-neg'}`}>
              {formatUsd(pnl)} ({formatPct(pnlPct)})
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
