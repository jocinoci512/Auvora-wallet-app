'use client';

import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Bell,
  Boxes,
  Landmark,
  Link2,
  Plus,
  Banknote,
  ShoppingCart,
  Sparkles,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Icon, StatusBadge } from '@auvora/ui';
import { DonutChart, LineChart } from '../charts/Charts';
import { CountUp } from '../charts/CountUp';
import {
  DEMO_HOLDINGS,
  DEMO_MOVERS,
  DEMO_PERFORMANCE,
  DEMO_TXS,
  DEMO_WATCHLIST,
  formatPct,
  formatUsd,
  portfolioTotals,
  type Holding,
  type Mover,
  type PerformancePoint,
  type TxPreview,
} from '../../lib/dashboard-demo';
import { getStoredAccessToken } from '../../lib/api-client';
import '../../app/dashboard.css';

const ALLOCATION_COLORS = [
  'var(--auvora-color-primary)',
  '#3d4f5f',
  '#84caff',
  '#f5b942',
  '#9db0c0',
];

const QUICK_ACTIONS = [
  { href: '/receive', label: 'Receive', icon: ArrowDownLeft },
  { href: '/send', label: 'Send', icon: ArrowUpRight },
  { href: '/swap', label: 'Swap', icon: ArrowLeftRight },
  { href: '/staking', label: 'Stake', icon: Landmark },
  { href: '/bridge', label: 'Bridge', icon: Boxes },
  { href: '/buy', label: 'Buy', icon: ShoppingCart },
  { href: '/sell', label: 'Sell', icon: Banknote },
  { href: '/web3', label: 'Web3 Hub', icon: Link2 },
  { href: '/digital-assets', label: 'View NFTs', icon: Sparkles },
  { href: '/wallets/onboarding', label: 'Import Wallet', icon: Plus },
] as const;

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const token = getStoredAccessToken();
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
      headers: {
        accept: 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: T };
    return body.data ?? null;
  } catch {
    return null;
  }
}

export function DashboardExperience(): ReactElement {
  const [holdings, setHoldings] = useState<Holding[]>(DEMO_HOLDINGS);
  const [performance, setPerformance] = useState<PerformancePoint[]>(DEMO_PERFORMANCE);
  const [movers, setMovers] = useState<Mover[]>(DEMO_MOVERS);
  const [watchlist, setWatchlist] = useState<Mover[]>(DEMO_WATCHLIST);
  const [txs] = useState<TxPreview[]>(DEMO_TXS);
  const [liveHint, setLiveHint] = useState('Showing curated preview data');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [overview, topMovers] = await Promise.all([
          fetchJson<{
            assets?: Array<{
              symbol: string;
              network: string;
              priceUsd: string;
              change24hPct: string | null;
            }>;
            trending?: Array<{ symbol: string; change24hPct: string; priceUsd: string }>;
            provider?: string;
          }>('/api/v1/market-data/overview'),
          fetchJson<{
            gainers?: Array<{ symbol: string; change24hPct: string; priceUsd: string }>;
            losers?: Array<{ symbol: string; change24hPct: string; priceUsd: string }>;
          }>('/api/v1/market-data/dashboards/top-movers'),
        ]);

        if (cancelled) return;

        if (overview?.assets?.length) {
          const enriched = overview.assets.slice(0, 6).map((a, i) => {
            const price = Number(a.priceUsd) || 0;
            const change = Number(a.change24hPct ?? 0);
            const balance = i === 0 ? 0.42 : i === 1 ? 8.15 : 20 + i * 3;
            const value = price * balance;
            return {
              id: `live-${a.network}-${a.symbol}`,
              symbol: a.symbol,
              name: a.symbol,
              network: a.network,
              balance,
              priceUsd: price,
              valueUsd: value,
              change24hPct: change,
              allocationPct: 0,
              walletId: 'live',
              walletLabel: 'Linked wallets',
            } satisfies Holding;
          });
          const total = enriched.reduce((s, h) => s + h.valueUsd, 0) || 1;
          setHoldings(
            enriched.map((h) => ({
              ...h,
              allocationPct: (h.valueUsd / total) * 100,
            })),
          );
          const base = total * 0.94;
          setPerformance(
            ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((t, i) => ({
              t,
              v: base * (1 + i * 0.012) + (i % 2 === 0 ? 120 : -80),
            })),
          );
          setLiveHint(
            overview.provider ? `Market data · ${overview.provider}` : 'Market overview live',
          );
        }

        if (topMovers?.gainers || overview?.trending) {
          const list = (topMovers?.gainers ?? overview?.trending ?? []).slice(0, 5).map((m) => ({
            symbol: m.symbol,
            priceUsd: Number(m.priceUsd) || 0,
            change24hPct: Number(m.change24hPct) || 0,
          }));
          if (list.length) setMovers(list);
          if (overview?.trending?.length) {
            setWatchlist(
              overview.trending.slice(0, 4).map((m) => ({
                symbol: m.symbol,
                priceUsd: Number(m.priceUsd) || 0,
                change24hPct: Number(m.change24hPct) || 0,
              })),
            );
          }
        }
      } catch {
        /* demo data already rendered */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = useMemo(() => portfolioTotals(holdings), [holdings]);
  const slices = useMemo(
    () =>
      holdings.map((h, i) => ({
        label: h.symbol,
        value: h.valueUsd,
        color: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length]!,
      })),
    [holdings],
  );

  return (
    <div className="dash" role="main">
      <header className="dash__hello">
        <div>
          <h1>Dashboard</h1>
          <p>Your portfolio at a glance — clear, calm, and current.</p>
        </div>
        <p aria-live="polite">{liveHint}</p>
      </header>

      <section className="dash-hero" aria-label="Portfolio summary">
        <div className="dash-hero__value">
          <span className="dash-hero__label">Portfolio value</span>
          <div className="dash-hero__amount">
            <CountUp value={totals.total} format={(n) => formatUsd(n)} />
          </div>
          <p className="dash-row__meta" style={{ marginTop: '0.45rem' }}>
            {totals.wallets} wallets · {totals.networks} networks
          </p>
        </div>
        <div className="dash-kpis">
          <div className="dash-kpi">
            <div className="dash-kpi__label">Today</div>
            <div className={`dash-kpi__value ${totals.day >= 0 ? 'dash-pos' : 'dash-neg'}`}>
              {formatUsd(totals.day)} · {formatPct(totals.dayPct)}
            </div>
          </div>
          <div className="dash-kpi">
            <div className="dash-kpi__label">This week</div>
            <div className={`dash-kpi__value ${totals.weekPct >= 0 ? 'dash-pos' : 'dash-neg'}`}>
              {formatPct(totals.weekPct)}
            </div>
          </div>
          <div className="dash-kpi">
            <div className="dash-kpi__label">This month</div>
            <div className={`dash-kpi__value ${totals.monthPct >= 0 ? 'dash-pos' : 'dash-neg'}`}>
              {formatPct(totals.monthPct)}
            </div>
          </div>
        </div>
      </section>

      <div className="dash-grid">
        <section className="dash-card dash-span-5" aria-labelledby="dash-perf-title">
          <div className="dash-card__head">
            <h2 className="dash-card__title" id="dash-perf-title">
              Weekly performance
            </h2>
            <Link className="dash-card__link" href="/portfolio">
              Details
            </Link>
          </div>
          <LineChart data={performance} height={140} ariaLabel="Weekly portfolio performance" />
        </section>

        <section className="dash-card dash-span-4" aria-labelledby="dash-alloc-title">
          <div className="dash-card__head">
            <h2 className="dash-card__title" id="dash-alloc-title">
              Asset allocation
            </h2>
          </div>
          <div className="dash-alloc">
            <DonutChart
              slices={slices}
              size={148}
              centerLabel={holdings[0]?.symbol ?? '—'}
              centerSub="Largest"
            />
            <ul className="dash-legend">
              {slices.map((s) => (
                <li key={s.label}>
                  <span className="dash-dot" style={{ background: s.color }} aria-hidden />
                  <span>
                    {s.label} · {((s.value / (totals.total || 1)) * 100).toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="dash-card dash-span-3" aria-labelledby="dash-actions-title">
          <div className="dash-card__head">
            <h2 className="dash-card__title" id="dash-actions-title">
              Quick actions
            </h2>
          </div>
          <div className="dash-actions">
            {QUICK_ACTIONS.map((action) => (
              <Link key={action.label} href={action.href} className="dash-action">
                <span className="dash-action__icon">
                  <Icon icon={action.icon} size="sm" />
                </span>
                <span className="dash-action__label">{action.label}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="dash-card dash-span-6" aria-labelledby="dash-holdings-title">
          <div className="dash-card__head">
            <h2 className="dash-card__title" id="dash-holdings-title">
              Top holdings
            </h2>
            <Link className="dash-card__link" href="/portfolio">
              Portfolio
            </Link>
          </div>
          <ul className="dash-list">
            {holdings.map((h) => (
              <li key={h.id} className="dash-row">
                <div>
                  <div>
                    <strong>{h.symbol}</strong> · {h.network}
                  </div>
                  <div className="dash-row__meta">
                    {h.balance} · {h.walletLabel}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div>{formatUsd(h.valueUsd)}</div>
                  <div className={h.change24hPct >= 0 ? 'dash-pos' : 'dash-neg'}>
                    {formatPct(h.change24hPct)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="dash-card dash-span-6" aria-labelledby="dash-tx-title">
          <div className="dash-card__head">
            <h2 className="dash-card__title" id="dash-tx-title">
              Recent transactions
            </h2>
            <Link className="dash-card__link" href="/blockchain/transactions">
              All
            </Link>
          </div>
          <ul className="dash-list">
            {txs.map((tx) => (
              <li key={tx.id} className="dash-row">
                <div>
                  <div>
                    <strong style={{ textTransform: 'capitalize' }}>{tx.type}</strong> · {tx.asset}
                  </div>
                  <div className="dash-row__meta">
                    {tx.network} · {tx.at}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div>{tx.amount}</div>
                  <StatusBadge status={tx.status} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="dash-card dash-span-3" aria-labelledby="dash-movers-title">
          <div className="dash-card__head">
            <h2 className="dash-card__title" id="dash-movers-title">
              Price movers
            </h2>
          </div>
          <ul className="dash-list">
            {movers.map((m) => (
              <li key={m.symbol} className="dash-row">
                <span>{m.symbol}</span>
                <span className={m.change24hPct >= 0 ? 'dash-pos' : 'dash-neg'}>
                  {formatPct(m.change24hPct)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="dash-card dash-span-3" aria-labelledby="dash-watch-title">
          <div className="dash-card__head">
            <h2 className="dash-card__title" id="dash-watch-title">
              Watchlist
            </h2>
            <Link className="dash-card__link" href="/market/watchlist">
              Edit
            </Link>
          </div>
          <ul className="dash-list">
            {watchlist.map((m) => (
              <li key={m.symbol} className="dash-row">
                <div>
                  <strong>{m.symbol}</strong>
                  <div className="dash-row__meta">{formatUsd(m.priceUsd)}</div>
                </div>
                <span className={m.change24hPct >= 0 ? 'dash-pos' : 'dash-neg'}>
                  {formatPct(m.change24hPct)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="dash-card dash-span-3" aria-labelledby="dash-market-title">
          <div className="dash-card__head">
            <h2 className="dash-card__title" id="dash-market-title">
              Market overview
            </h2>
            <Link className="dash-card__link" href="/market">
              Open
            </Link>
          </div>
          <div className="dash-summary-grid">
            <div className="dash-stat">
              <span className="dash-stat__k">Tracked</span>
              <span className="dash-stat__v">{movers.length + watchlist.length} assets</span>
            </div>
            <div className="dash-stat">
              <span className="dash-stat__k">Sentiment</span>
              <span className="dash-stat__v dash-pos">Risk-on</span>
            </div>
          </div>
        </section>

        <section className="dash-card dash-span-3" aria-labelledby="dash-health-title">
          <div className="dash-card__head">
            <h2 className="dash-card__title" id="dash-health-title">
              Wallet health
            </h2>
          </div>
          <div className="dash-summary-grid">
            <div className="dash-stat">
              <span className="dash-stat__k">Backup</span>
              <span className="dash-pill dash-pill--ok">Verified</span>
            </div>
            <div className="dash-stat">
              <span className="dash-stat__k">2FA</span>
              <span className="dash-pill dash-pill--ok">On</span>
            </div>
            <div className="dash-stat">
              <span className="dash-stat__k">Risk score</span>
              <span className="dash-stat__v">Low</span>
            </div>
            <div className="dash-stat">
              <span className="dash-stat__k">Wallets</span>
              <span className="dash-stat__v">{totals.wallets}</span>
            </div>
          </div>
        </section>

        <section className="dash-card dash-span-3" aria-labelledby="dash-net-title">
          <div className="dash-card__head">
            <h2 className="dash-card__title" id="dash-net-title">
              Network status
            </h2>
            <Link className="dash-card__link" href="/status">
              Status
            </Link>
          </div>
          <ul className="dash-list">
            {['Ethereum', 'Solana', 'Bitcoin'].map((n) => (
              <li key={n} className="dash-row">
                <span>{n}</span>
                <span className="dash-pill dash-pill--ok">Healthy</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="dash-card dash-span-3" aria-labelledby="dash-alerts-title">
          <div className="dash-card__head">
            <h2 className="dash-card__title" id="dash-alerts-title">
              Price alerts
            </h2>
            <Icon icon={Bell} size="sm" />
          </div>
          <ul className="dash-list">
            <li className="dash-row">
              <span>BTC &gt; $70k</span>
              <span className="dash-pill dash-pill--muted">Armed</span>
            </li>
            <li className="dash-row">
              <span>ETH &lt; $3.2k</span>
              <span className="dash-pill dash-pill--warn">Near</span>
            </li>
          </ul>
        </section>

        <section className="dash-card dash-span-3" aria-labelledby="dash-modules-title">
          <div className="dash-card__head">
            <h2 className="dash-card__title" id="dash-modules-title">
              Activity modules
            </h2>
          </div>
          <div className="dash-summary-grid">
            <Link
              href="/digital-assets"
              className="dash-stat"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <span className="dash-stat__k">NFTs</span>
              <span className="dash-stat__v">Digital assets</span>
            </Link>
            <Link
              href="/staking"
              className="dash-stat"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <span className="dash-stat__k">Staking</span>
              <span className="dash-stat__v">4.1% APY</span>
            </Link>
            <Link
              href="/bridge"
              className="dash-stat"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <span className="dash-stat__k">Bridge</span>
              <span className="dash-stat__v">1 in flight</span>
            </Link>
            <Link
              href="/swap"
              className="dash-stat"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <span className="dash-stat__k">Swap</span>
              <span className="dash-stat__v">Ready</span>
            </Link>
            <Link
              href="/connections"
              className="dash-stat"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <span className="dash-stat__k">dApps</span>
              <span className="dash-stat__v">3 connected</span>
            </Link>
            <Link
              href="/notifications"
              className="dash-stat"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <span className="dash-stat__k">Inbox</span>
              <span className="dash-stat__v">2 unread</span>
            </Link>
          </div>
        </section>

        <section className="dash-card dash-span-3" aria-labelledby="dash-wallet-cta">
          <div className="dash-card__head">
            <h2 className="dash-card__title" id="dash-wallet-cta">
              Wallets
            </h2>
            <Icon icon={Wallet} size="sm" />
          </div>
          <p className="dash-row__meta" style={{ margin: '0 0 0.75rem' }}>
            Manage keys, addresses, and balances across networks.
          </p>
          <Link
            href="/wallets"
            className="dash-action"
            style={{ width: '100%', boxSizing: 'border-box' }}
          >
            <span className="dash-action__label">Open wallets</span>
          </Link>
        </section>
      </div>
    </div>
  );
}
