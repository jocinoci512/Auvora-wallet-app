'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
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
import { buildPortfolioInsights, computePortfolioHealthScore } from '../../lib/insights/demo';
import { OFFLINE_CACHE_NS, writeOfflineCache } from '../../lib/offline/cache';
import { PlatformShell } from '../platform/PlatformShell';
import '../../app/dashboard.css';

const COLORS = [
  'var(--cx-lagoon, var(--auvora-color-primary))',
  '#3d4f5f',
  '#84caff',
  '#f5b942',
  '#9db0c0',
];

type SortKey = 'value' | 'change' | 'symbol' | 'allocation';

export function PortfolioExperience(): ReactElement {
  const [query, setQuery] = useState('');
  const [network, setNetwork] = useState('all');
  const [sort, setSort] = useState<SortKey>('value');
  const [openId, setOpenId] = useState<string | null>(DEMO_HOLDINGS[0]?.id ?? null);
  const holdings = DEMO_HOLDINGS;
  const [score, setScore] = useState(0);
  const [factors, setFactors] = useState(() => computePortfolioHealthScore(DEMO_HOLDINGS).factors);
  const [insights, setInsights] = useState(() => buildPortfolioInsights(DEMO_HOLDINGS).slice(0, 3));

  useEffect(() => {
    const health = computePortfolioHealthScore(DEMO_HOLDINGS);
    setScore(health.score);
    setFactors(health.factors);
    setInsights(buildPortfolioInsights(DEMO_HOLDINGS).slice(0, 3));
    writeOfflineCache(
      OFFLINE_CACHE_NS.portfolio,
      'holdings',
      { holdings: DEMO_HOLDINGS, performance: DEMO_PERFORMANCE },
      1000 * 60 * 60 * 12,
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

  const source = filtered.length ? filtered : holdings;
  const totals = portfolioTotals(source);
  const slices = source.map((h, i) => ({
    label: h.symbol,
    value: h.valueUsd,
    color: COLORS[i % COLORS.length]!,
  }));
  const best = [...holdings].sort((a, b) => b.change24hPct - a.change24hPct)[0];
  const worst = [...holdings].sort((a, b) => a.change24hPct - b.change24hPct)[0];
  const networkAlloc = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of holdings) map.set(h.network, (map.get(h.network) ?? 0) + h.valueUsd);
    return [...map.entries()].map(([label, value]) => ({ label, value }));
  }, [holdings]);

  return (
    <PlatformShell
      title="Smart Portfolio"
      subtitle="Allocation, performance, and health — calm numbers you can act on."
      reassure="Illustrative data until live balances connect. Insights educate; they never trade for you."
      backHref="/dashboard"
      backLabel="Wallet"
      actions={
        <>
          <Link href="/insights" className="cx-btn cx-btn--ghost">
            Insights
          </Link>
          <Link href="/assistant" className="cx-btn cx-btn--primary">
            Ask Assistant
          </Link>
        </>
      }
    >
      <div className="cx-alert cx-alert--info" role="status">
        Sample holdings until live balances connect. Unrealized P/L uses demo cost basis where
        present — estimates, not advice. Insights never trade for you.
      </div>

      <section className="cx-panel" aria-label="Portfolio totals">
        <h2>Total value</h2>
        <p className="cx-amount-display" style={{ textAlign: 'left', fontSize: '2rem' }}>
          <CountUp value={totals.total} format={(n) => formatUsd(n)} />
        </p>
        <p className="cx-meta">
          Unrealized P/L (estimate){' '}
          <strong>
            {formatUsd(totals.unrealized)} ({formatPct(totals.unrealizedPct)})
          </strong>
          {' · '}
          Realized gains appear in Activity after sells/swaps (not booked in this demo).
        </p>
        <div className="cx-kpi">
          <div className="cx-kpi__card">
            <span>Wallets</span>
            <strong>{totals.wallets}</strong>
          </div>
          <div className="cx-kpi__card">
            <span>Networks</span>
            <strong>{totals.networks}</strong>
          </div>
          <div className="cx-kpi__card">
            <span>24h</span>
            <strong>{formatPct(totals.dayPct)}</strong>
          </div>
          <div className="cx-kpi__card">
            <span>Best 24h</span>
            <strong>
              {best?.symbol} {best ? formatPct(best.change24hPct) : '—'}
            </strong>
          </div>
          <div className="cx-kpi__card">
            <span>Worst 24h</span>
            <strong>
              {worst?.symbol} {worst ? formatPct(worst.change24hPct) : '—'}
            </strong>
          </div>
        </div>
      </section>

      <section className="cx-panel">
        <h2>Portfolio health</h2>
        <div className="cx-score-row">
          <div
            className="cx-score-ring"
            style={{ ['--cx-score' as string]: score }}
            aria-label={`Portfolio health ${score} percent`}
          >
            <strong>{score}</strong>
          </div>
          <div className="cx-score-copy">
            <p className="cx-meta">
              Diversification, security, recovery, and permissions — recommendations encourage,
              never shame.
            </p>
            <ul className="cx-list">
              {factors
                .filter((f) => !f.ok)
                .slice(0, 3)
                .map((f) => (
                  <li key={f.id}>
                    <div>
                      <strong>{f.label}</strong>
                      <p className="cx-meta">{f.why}</p>
                    </div>
                    <Link href={f.href} className="cx-btn cx-btn--ghost">
                      {f.action}
                    </Link>
                  </li>
                ))}
            </ul>
            {!factors.some((f) => !f.ok) ? (
              <p className="cx-meta">Looking healthy — keep reviewing permissions over time.</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="cx-panel">
        <h2>Insight highlights</h2>
        <ul className="cx-list">
          {insights.map((i) => (
            <li key={i.id}>
              <div>
                <strong>{i.title}</strong>
                <p className="cx-meta">{i.detail}</p>
              </div>
              {i.href ? (
                <Link href={i.href} className="cx-btn cx-btn--ghost">
                  Open
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
        <Link href="/insights" className="cx-link">
          All insights
        </Link>
      </section>

      <div className="dash-grid" style={{ marginBottom: '1rem' }}>
        <section className="dash-card dash-span-8" aria-labelledby="pf-perf">
          <div className="dash-card__head">
            <h2 className="dash-card__title" id="pf-perf">
              Historical performance
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
              Token allocation
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

      <section className="cx-panel">
        <h2>Network allocation</h2>
        <ul className="cx-list">
          {networkAlloc.map((n) => (
            <li key={n.label}>
              <strong style={{ textTransform: 'capitalize' }}>{n.label}</strong>
              <span>{formatUsd(n.value)}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="cx-toolbar" role="search">
        <label className="cx-field cx-field--grow">
          <span>Search</span>
          <input
            type="search"
            placeholder="Symbol, network, or wallet"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="cx-field">
          <span>Network</span>
          <select value={network} onChange={(e) => setNetwork(e.target.value)}>
            <option value="all">All networks</option>
            {networks.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="cx-field">
          <span>Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="value">Value</option>
            <option value="change">24h change</option>
            <option value="allocation">Allocation</option>
            <option value="symbol">Symbol</option>
          </select>
        </label>
      </div>

      <section className="cx-panel">
        <h2>Holdings</h2>
        <div className="pf-cards">
          {filtered.length === 0 ? (
            <div className="cx-empty">
              <h2>No assets</h2>
              <p>No assets match your filters.</p>
            </div>
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
      </section>

      <div className="cx-platform__actions">
        <Link href="/nfts" className="cx-btn cx-btn--ghost">
          Collectibles
        </Link>
        <Link href="/activity" className="cx-btn cx-btn--ghost">
          Activity
        </Link>
      </div>
    </PlatformShell>
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
  const hasBasis = holding.costBasisUsd != null && holding.costBasisUsd > 0;
  const pnl = hasBasis ? holding.valueUsd - holding.costBasisUsd! : null;
  const pnlPct = hasBasis && holding.costBasisUsd ? (pnl! / holding.costBasisUsd) * 100 : null;

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
            {holding.network} · {holding.walletLabel} · {holding.allocationPct.toFixed(1)}%
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
        <p className="cx-meta">24h path is illustrative for preview — not a live price chart.</p>
        <LineChart
          data={[
            { v: holding.valueUsd * (1 - holding.change24hPct / 200) },
            { v: holding.valueUsd * (1 - holding.change24hPct / 400) },
            { v: holding.valueUsd },
            { v: holding.valueUsd * (1 + holding.change24hPct / 400) },
            { v: holding.valueUsd },
          ]}
          height={88}
          ariaLabel={`${holding.symbol} illustrative recent path`}
        />
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
            <span className="dash-stat__k">Unrealized P/L</span>
            <span
              className={`dash-stat__v ${pnl != null && pnl >= 0 ? 'dash-pos' : pnl != null ? 'dash-neg' : ''}`}
            >
              {pnl != null && pnlPct != null
                ? `${formatUsd(pnl)} (${formatPct(pnlPct)}) · estimate`
                : 'Unavailable — no cost basis'}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
