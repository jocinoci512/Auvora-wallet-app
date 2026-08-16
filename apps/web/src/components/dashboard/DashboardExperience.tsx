'use client';

import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Bell,
  Boxes,
  Eye,
  EyeOff,
  Landmark,
  Settings,
  Banknote,
  ShoppingCart,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Icon } from '@auvora/ui';
import { DonutChart, LineChart } from '../charts/Charts';
import { CountUp } from '../charts/CountUp';
import {
  DEMO_HOLDINGS,
  DEMO_MARKET_SNAPSHOT,
  DEMO_MOVERS,
  DEMO_PERFORMANCE,
  DEMO_TXS,
  DEMO_WATCHLIST,
  formatPct,
  formatUsd,
  groupTxsByDay,
  performanceForRange,
  portfolioTotals,
  sparklineFor,
  type ChartRange,
  type Holding,
  type Mover,
  type PerformancePoint,
  type TxPreview,
} from '../../lib/dashboard-demo';
import { getStoredAccessToken } from '../../lib/api-client';
import { fetchPricesWithFailover } from '../../lib/portfolio/price-failover';
import { getSecurityPrefs } from '../../lib/wallet-experience/security-prefs';
import { getUserPrefs } from '../../lib/wallet-experience/user-prefs';
import '../../app/wallet-dashboard.css';

const ALLOCATION_COLORS = ['#0E4F5C', '#5C6570', '#185FA5', '#9A7B4F', '#3D9AAA'];

const PRIMARY_ACTIONS = [
  { href: '/send', label: 'Send', icon: ArrowUpRight, primary: true },
  { href: '/receive', label: 'Receive', icon: ArrowDownLeft, primary: true },
  { href: '/web3/pair', label: 'Pair mobile', icon: ArrowLeftRight, primary: true },
  { href: '/activity', label: 'Activity', icon: Bell, primary: true },
] as const;

const MORE_ACTIONS = [
  { href: '/swap', label: 'Swap (soon)', icon: ArrowLeftRight },
  { href: '/buy', label: 'Buy (soon)', icon: ShoppingCart },
  { href: '/sell', label: 'Sell (soon)', icon: Banknote },
  { href: '/staking', label: 'Stake (soon)', icon: Landmark },
  { href: '/bridge', label: 'Bridge (soon)', icon: Boxes },
] as const;

const RANGES: ChartRange[] = ['1D', '1W', '1M', '3M', '1Y', 'ALL'];

type SortKey = 'value' | 'change' | 'symbol';

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

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardExperience(): ReactElement {
  const [holdings, setHoldings] = useState<Holding[]>(DEMO_HOLDINGS);
  const [performance, setPerformance] = useState<PerformancePoint[]>(DEMO_PERFORMANCE);
  const [movers, setMovers] = useState<Mover[]>(DEMO_MOVERS);
  const [watchlist, setWatchlist] = useState<Mover[]>(DEMO_WATCHLIST);
  const [txs] = useState<TxPreview[]>(DEMO_TXS);
  const [liveHint, setLiveHint] = useState('Demonstration portfolio - not live balances');
  const [range, setRange] = useState<ChartRange>('1W');
  const [query, setQuery] = useState('');
  const [network, setNetwork] = useState('all');
  const [sort, setSort] = useState<SortKey>('value');
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await fetchPricesWithFailover(['btc', 'eth', 'sol', 'bnb', 'matic', 'trx']);
      if (cancelled) return;
      if (result.live) {
        setLiveHint('Demonstration holdings - live prices via ' + result.sourceLabel);
      } else {
        setLiveHint('Demonstration portfolio - ' + result.sourceLabel);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [favorites, setFavorites] = useState<Set<string>>(() => new Set(['h-btc', 'h-eth']));
  const [hideBalances, setHideBalances] = useState(false);
  const [hideZero, setHideZero] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [walletLabel, setWalletLabel] = useState('Personal');
  const [activityFilter, setActivityFilter] = useState<'all' | TxPreview['type']>('all');
  const [currencyHint, setCurrencyHint] = useState('');
  const [securityScore, setSecurityScore] = useState(70);
  const [securitySnap, setSecuritySnap] = useState({
    backup: true,
    bio: false,
    pin: false,
    autoLock: '5 min',
  });

  useEffect(() => {
    const p = getUserPrefs();
    setCurrencyHint(p.currency);
    const s = getSecurityPrefs();
    let score = 40;
    if (s.pinEnabled) score += 20;
    if (s.biometricEnabled) score += 20;
    if (s.backupReminderEnabled) score += 10;
    if (s.autoLockMinutes > 0) score += 10;
    setSecurityScore(Math.min(100, score));
    setSecuritySnap({
      backup: s.backupReminderEnabled,
      bio: s.biometricEnabled,
      pin: s.pinEnabled,
      autoLock: s.autoLockMinutes ? `${s.autoLockMinutes} min` : 'Off',
    });
    try {
      setHideBalances(localStorage.getItem('auvora_hide_balances_v1') === '1');
      setHideZero(localStorage.getItem('auvora_hide_zero_v1') === '1');
    } catch {
      /* ignore */
    }
  }, []);

  function toggleHideBalances(): void {
    setHideBalances((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('auvora_hide_balances_v1', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function money(n: number): string {
    return hideBalances ? '••••••' : formatUsd(n);
  }

  function units(balance: number, symbol: string): string {
    return hideBalances ? `•••• ${symbol}` : `${balance} ${symbol}`;
  }

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
  const chartData = useMemo(
    () => performanceForRange(performance, range, totals.total),
    [performance, range, totals.total],
  );
  const slices = useMemo(
    () =>
      holdings.map((h, i) => ({
        label: h.symbol,
        value: h.valueUsd,
        color: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length]!,
      })),
    [holdings],
  );

  const networks = useMemo(
    () => Array.from(new Set(holdings.map((h) => h.network))).sort(),
    [holdings],
  );

  const filteredHoldings = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = holdings.filter((h) => {
      if (hideZero && h.balance <= 0) return false;
      if (network !== 'all' && h.network !== network) return false;
      if (!q) return true;
      return (
        h.symbol.toLowerCase().includes(q) ||
        h.name.toLowerCase().includes(q) ||
        h.network.toLowerCase().includes(q)
      );
    });
    rows = [...rows].sort((a, b) => {
      const af = favorites.has(a.id) ? 1 : 0;
      const bf = favorites.has(b.id) ? 1 : 0;
      if (bf !== af) return bf - af;
      if (sort === 'symbol') return a.symbol.localeCompare(b.symbol);
      if (sort === 'change') return b.change24hPct - a.change24hPct;
      return b.valueUsd - a.valueUsd;
    });
    return rows;
  }, [favorites, hideZero, holdings, network, query, sort]);

  const dayGroups = useMemo(() => {
    const filtered = activityFilter === 'all' ? txs : txs.filter((t) => t.type === activityFilter);
    return groupTxsByDay(filtered);
  }, [activityFilter, txs]);

  const losers = useMemo(
    () => [...movers].sort((a, b) => a.change24hPct - b.change24hPct).slice(0, 3),
    [movers],
  );
  const gainers = useMemo(
    () => [...movers].sort((a, b) => b.change24hPct - a.change24hPct).slice(0, 3),
    [movers],
  );

  function toggleFav(id: string): void {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="wd" role="main">
      <div className="wd-atmosphere" aria-hidden />

      <header className="wd-header">
        <div className="wd-header__identity">
          <div className="wd-avatar" aria-hidden>
            AU
          </div>
          <div>
            <p className="wd-header__greet">{greeting()}</p>
            <p className="wd-header__name">Auvora</p>
          </div>
        </div>
        <div className="wd-header__tools">
          <label className="visually-hidden" htmlFor="wd-wallet">
            Wallet
          </label>
          <select
            id="wd-wallet"
            className="wd-select"
            value={walletLabel}
            onChange={(e) => setWalletLabel(e.target.value)}
            aria-label="Wallet selector"
          >
            <option value="Personal">Personal</option>
            <option value="Daily spend">Daily spend</option>
            <option value="Cold vault">Cold vault</option>
          </select>
          <span className="wd-net" title="Active network">
            <span className="wd-net__pip" aria-hidden />
            Multi-chain
          </span>
          <input
            className="wd-search"
            type="search"
            placeholder="Search assets"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search assets"
          />
          <button
            type="button"
            className="wd-icon-btn"
            aria-label={hideBalances ? 'Show balances' : 'Hide balances'}
            aria-pressed={hideBalances}
            onClick={toggleHideBalances}
          >
            <Icon icon={hideBalances ? EyeOff : Eye} size="sm" />
          </button>
          <Link href="/notifications" className="wd-icon-btn" aria-label="Notifications">
            <Icon icon={Bell} size="sm" />
          </Link>
          <Link href="/settings" className="wd-icon-btn" aria-label="Settings">
            <Icon icon={Settings} size="sm" />
          </Link>
        </div>
      </header>

      <p className="wd-hint" aria-live="polite">
        {liveHint}
        {currencyHint ? ` · ${currencyHint}` : ''}
      </p>

      <section className="wd-hero" aria-labelledby="wd-portfolio-label">
        <p className="wd-hero__label" id="wd-portfolio-label">
          Total portfolio
        </p>
        <p className="wd-hero__balance" aria-live="polite">
          {hideBalances ? '••••••' : <CountUp value={totals.total} format={(n) => formatUsd(n)} />}
        </p>
        <div className="wd-hero__delta">
          <span className={totals.dayPct >= 0 ? 'wd-pos' : 'wd-neg'}>
            {hideBalances ? '••••' : money(totals.day)} ·{' '}
            {hideBalances ? '••••' : formatPct(totals.dayPct)} <span>24h</span>
          </span>
          <span className={totals.weekPct >= 0 ? 'wd-pos' : 'wd-neg'}>
            {hideBalances ? '••••' : formatPct(totals.weekPct)} <span>1W</span>
          </span>
          <span className={totals.monthPct >= 0 ? 'wd-pos' : 'wd-neg'}>
            {hideBalances ? '••••' : formatPct(totals.monthPct)} <span>1M</span>
          </span>
          <span className={totals.unrealized >= 0 ? 'wd-pos' : 'wd-neg'}>
            {hideBalances ? '••••' : money(totals.unrealized)} <span>P&amp;L</span>
          </span>
        </div>
        <div className="wd-ranges" role="tablist" aria-label="Chart range">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={range === r}
              className={`wd-chip${range === r ? ' is-active' : ''}`}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="wd-chart">
          <LineChart
            data={chartData}
            height={168}
            stroke="var(--wd-lagoon, #0E4F5C)"
            ariaLabel={`Portfolio performance ${range}`}
          />
        </div>
        <div className="wd-hero__alloc">
          <DonutChart
            slices={slices}
            size={120}
            thickness={14}
            centerLabel={`${totals.networks}`}
            centerSub="nets"
            ariaLabel="Portfolio allocation"
          />
          <ul className="wd-legend">
            {slices.slice(0, 4).map((s) => (
              <li key={s.label}>
                <span className="wd-dot" style={{ background: s.color }} aria-hidden />
                {s.label} · {((s.value / (totals.total || 1)) * 100).toFixed(0)}%
              </li>
            ))}
          </ul>
        </div>
      </section>

      <nav className="wd-actions" aria-label="Primary actions">
        {PRIMARY_ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className={`wd-action${a.primary ? ' wd-action--primary' : ''}`}
          >
            <span className="wd-action__icon">
              <Icon icon={a.icon} size="sm" />
            </span>
            {a.label}
          </Link>
        ))}
      </nav>
      <nav className="wd-actions wd-actions--more" aria-label="More actions">
        {MORE_ACTIONS.map((a) => (
          <Link key={a.href} href={a.href} className="wd-action">
            <span className="wd-action__icon">
              <Icon icon={a.icon} size="sm" />
            </span>
            {a.label}
          </Link>
        ))}
      </nav>

      <section className="wd-section" aria-labelledby="wd-assets-title">
        <div className="wd-section__head">
          <h2 className="wd-section__title" id="wd-assets-title">
            Assets
          </h2>
          <Link className="wd-section__link" href="/portfolio">
            Full portfolio
          </Link>
        </div>
        <div className="wd-toolbar">
          <select
            className="wd-select"
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
          <select
            className="wd-select"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort assets"
          >
            <option value="value">Value</option>
            <option value="change">24h change</option>
            <option value="symbol">Name</option>
          </select>
          <label className="wd-check">
            <input
              type="checkbox"
              checked={hideZero}
              onChange={(e) => {
                const next = e.target.checked;
                setHideZero(next);
                try {
                  localStorage.setItem('auvora_hide_zero_v1', next ? '1' : '0');
                } catch {
                  /* ignore */
                }
              }}
            />
            Hide zero
          </label>
        </div>
        <ul className="wd-assets">
          {filteredHoldings.map((h) => {
            const open = openId === h.id;
            const spark = sparklineFor(h.priceUsd + h.balance);
            return (
              <li key={h.id} className="wd-asset">
                <div
                  className="wd-asset__row"
                  style={{ gridTemplateColumns: 'auto auto 1fr auto auto' }}
                >
                  <button
                    type="button"
                    className={`wd-fav${favorites.has(h.id) ? ' is-on' : ''}`}
                    aria-label={favorites.has(h.id) ? 'Unpin favorite' : 'Pin favorite'}
                    aria-pressed={favorites.has(h.id)}
                    onClick={() => toggleFav(h.id)}
                  >
                    ★
                  </button>
                  <button
                    type="button"
                    className="wd-asset__logo"
                    aria-expanded={open}
                    aria-label={`${h.name} details`}
                    onClick={() => setOpenId(open ? null : h.id)}
                    style={{ border: 'none', cursor: 'pointer' }}
                  >
                    {h.symbol.slice(0, 2)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : h.id)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      font: 'inherit',
                      color: 'inherit',
                      padding: 0,
                    }}
                  >
                    <span className="wd-asset__meta">
                      <strong>
                        {h.name}{' '}
                        <span style={{ color: 'var(--wd-faint)', fontWeight: 500 }}>
                          {h.symbol}
                        </span>
                      </strong>
                      <small>
                        {units(h.balance, h.symbol)} · {h.network}
                      </small>
                    </span>
                  </button>
                  <span className="wd-spark" aria-hidden>
                    <LineChart
                      data={spark}
                      height={32}
                      fill={false}
                      stroke={h.change24hPct >= 0 ? 'var(--wd-success)' : 'var(--wd-danger)'}
                      ariaLabel={`${h.symbol} sparkline`}
                    />
                  </span>
                  <button
                    type="button"
                    className="wd-asset__vals"
                    onClick={() => setOpenId(open ? null : h.id)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      font: 'inherit',
                      color: 'inherit',
                      padding: 0,
                    }}
                  >
                    <strong>{money(h.valueUsd)}</strong>
                    <small className={h.change24hPct >= 0 ? 'wd-pos' : 'wd-neg'}>
                      {hideBalances ? '••••' : formatPct(h.change24hPct)}
                    </small>
                  </button>
                </div>
                {open ? (
                  <div className="wd-asset__detail">
                    <LineChart
                      data={sparklineFor(h.valueUsd, 24)}
                      height={100}
                      stroke="var(--wd-lagoon)"
                      ariaLabel={`${h.symbol} recent performance`}
                    />
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--wd-muted)' }}>
                      Allocation {h.allocationPct.toFixed(1)}% · {h.walletLabel} · Price{' '}
                      {money(h.priceUsd)}
                    </p>
                    <div className="wd-asset__detail-actions">
                      <Link href={`/send?asset=${h.symbol}`}>Send</Link>
                      <Link href={`/receive?asset=${h.symbol}`}>Receive</Link>
                      <Link href={`/swap?from=${h.symbol}`}>Swap</Link>
                      <Link href={`/assets/${h.id}`}>Details</Link>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="wd-section" aria-labelledby="wd-activity-title">
        <div className="wd-section__head">
          <h2 className="wd-section__title" id="wd-activity-title">
            Recent activity
          </h2>
          <Link className="wd-section__link" href="/activity">
            View all
          </Link>
        </div>
        <div className="wd-toolbar">
          {(['all', 'send', 'receive', 'swap', 'stake', 'bridge'] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`wd-chip${activityFilter === f ? ' is-active' : ''}`}
              onClick={() => setActivityFilter(f)}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}
          <Link className="wd-section__link" href="/activity" style={{ marginLeft: 'auto' }}>
            Export
          </Link>
        </div>
        <div className="wd-timeline">
          {dayGroups.map((g) => (
            <div key={g.day} className="wd-day">
              <p className="wd-day__label">{g.day}</p>
              {g.items.map((tx) => (
                <Link key={tx.id} href={`/activity/${tx.id}`} className="wd-tx">
                  <span className="wd-tx__icon" aria-hidden>
                    {tx.type === 'receive' ? '↓' : tx.type === 'send' ? '↑' : '⇄'}
                  </span>
                  <span className="wd-tx__body">
                    <strong>
                      {tx.type} {tx.asset}
                    </strong>
                    <small>
                      {tx.network} · {tx.at}
                    </small>
                  </span>
                  <span className="wd-tx__amt">
                    {tx.amount} {tx.asset}
                    <span className={`wd-status wd-status--${tx.status}`}>{tx.status}</span>
                  </span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="wd-section" aria-labelledby="wd-market-title">
        <div className="wd-section__head">
          <h2 className="wd-section__title" id="wd-market-title">
            Market snapshot
          </h2>
          <Link className="wd-section__link" href="/market">
            Market
          </Link>
        </div>
        <div className="wd-grid wd-grid--3">
          <div className="wd-panel">
            <h3>Top gainers</h3>
            {gainers.map((m) => (
              <div key={m.symbol} className="wd-mover">
                <span>{m.symbol}</span>
                <strong className="wd-pos">{formatPct(m.change24hPct)}</strong>
              </div>
            ))}
          </div>
          <div className="wd-panel">
            <h3>Top losers</h3>
            {losers.map((m) => (
              <div key={m.symbol} className="wd-mover">
                <span>{m.symbol}</span>
                <strong className="wd-neg">{formatPct(m.change24hPct)}</strong>
              </div>
            ))}
          </div>
          <div className="wd-panel">
            <h3>Context</h3>
            <div className="wd-stat-row">
              <span>Fear &amp; Greed</span>
              <strong>
                {DEMO_MARKET_SNAPSHOT.fearGreed} · {DEMO_MARKET_SNAPSHOT.fearGreedLabel}
              </strong>
            </div>
            <div className="wd-stat-row">
              <span>Market cap</span>
              <strong>${DEMO_MARKET_SNAPSHOT.marketCapT}T</strong>
            </div>
            <div className="wd-stat-row">
              <span>BTC dominance</span>
              <strong>{DEMO_MARKET_SNAPSHOT.btcDominance}%</strong>
            </div>
            <div className="wd-stat-row">
              <span>ETH gas</span>
              <strong>{DEMO_MARKET_SNAPSHOT.ethGasGwei} gwei</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="wd-section" aria-labelledby="wd-watch-title">
        <div className="wd-section__head">
          <h2 className="wd-section__title" id="wd-watch-title">
            Watchlist
          </h2>
          <Link className="wd-section__link" href="/market/watchlist">
            Manage
          </Link>
        </div>
        <div className="wd-panel">
          {watchlist.map((m) => (
            <div key={m.symbol} className="wd-mover">
              <span>
                <strong>{m.symbol}</strong> · {formatUsd(m.priceUsd)}
              </span>
              <strong className={m.change24hPct >= 0 ? 'wd-pos' : 'wd-neg'}>
                {formatPct(m.change24hPct)}
              </strong>
            </div>
          ))}
        </div>
      </section>

      <section className="wd-section" aria-labelledby="wd-sec-title">
        <div className="wd-section__head">
          <h2 className="wd-section__title" id="wd-sec-title">
            Security status
          </h2>
          <Link className="wd-section__link" href="/settings/security">
            Security center
          </Link>
        </div>
        <div className="wd-grid wd-grid--2">
          <div className="wd-panel">
            <div className="wd-score" style={{ ['--wd-score' as string]: `${securityScore}%` }}>
              <div className="wd-score__ring" aria-label={`Security score ${securityScore}`}>
                <span>{securityScore}</span>
              </div>
              <div>
                <strong>Wallet health</strong>
                <p>
                  {securityScore >= 80
                    ? 'Looking solid. Keep recovery offline and biometrics on.'
                    : 'A few quiet upgrades will raise your score.'}
                </p>
              </div>
            </div>
            <div className="wd-stat-row">
              <span>Backup reminder</span>
              <strong>{securitySnap.backup ? 'On' : 'Off'}</strong>
            </div>
            <div className="wd-stat-row">
              <span>Biometrics</span>
              <strong>{securitySnap.bio ? 'Enabled' : 'Off'}</strong>
            </div>
            <div className="wd-stat-row">
              <span>PIN lock</span>
              <strong>{securitySnap.pin ? 'Enabled' : 'Off'}</strong>
            </div>
            <div className="wd-stat-row">
              <span>Auto-lock</span>
              <strong>{securitySnap.autoLock}</strong>
            </div>
          </div>
          <div className="wd-panel">
            <h3>Recommendations</h3>
            <ul className="wd-rec">
              <li>Keep your recovery phrase offline</li>
              <li>Review connected dApps monthly</li>
              <li>Enable biometrics on this device</li>
              <li>
                Pair hardware when ready — <Link href="/wallets/hardware">Hardware</Link>
              </li>
            </ul>
            <p style={{ margin: '1rem 0 0', fontSize: '0.8125rem' }}>
              <Link className="wd-section__link" href="/web3/permissions">
                Connected dApps
              </Link>
              {' · '}
              <Link className="wd-section__link" href="/settings/devices">
                Devices
              </Link>
              {' · '}
              <Link className="wd-section__link" href="/address-book">
                Address book
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
