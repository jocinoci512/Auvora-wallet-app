'use client';

import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, Link2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { AuvoraClientError } from '@auvora/sdk';
import { isSignedIn } from '../../lib/auth/session';
import {
  applyQuotes,
  DEMO_TXS,
  formatPct,
  formatUsd,
  portfolioTotals,
  type Holding,
  type TxPreview,
} from '../../lib/dashboard-demo';
import {
  classifyHttpStatus,
  EMPTY_COPY,
  issueCopy,
  type DashboardIssue,
} from '../../lib/dashboard/status-copy';
import { fetchPricesWithFailover } from '../../lib/portfolio/price-failover';
import { loadLivePortfolio } from '../../lib/portfolio/live-portfolio';
import { networkLabel, resolveNetwork } from '../../lib/product/networks';
import { getUserPrefs } from '../../lib/wallet-experience/user-prefs';
import { web3Fetch } from '../../lib/web3/api';
import '../../app/wallet-dashboard.css';

function NetworkMark({ network }: { network: string }): ReactElement {
  const resolved = resolveNetwork(network);
  return (
    <span className="wd-netmark" aria-hidden>
      {resolved?.mark ?? network.slice(0, 1).toUpperCase()}
    </span>
  );
}

function formatUpdated(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'Updated just now';
  if (mins === 1) return 'Updated 1 minute ago';
  if (mins < 60) return `Updated ${mins} minutes ago`;
  return `Updated ${new Date(iso).toLocaleString()}`;
}

function DashboardSkeleton(): ReactElement {
  return (
    <div className="wd wd-sk" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Loading wallet overview</span>
      <div className="wd-sk__hero" />
      <div className="wd-sk__actions">
        <div className="wd-sk__row" />
        <div className="wd-sk__row" />
        <div className="wd-sk__row" />
      </div>
      <div className="wd-sk__grid">
        <div className="wd-sk__card" />
        <div className="wd-sk__card" />
      </div>
    </div>
  );
}

function EmptyBlock({
  copy,
}: {
  copy: { title: string; body: string; actionLabel: string; actionHref: string };
}): ReactElement {
  return (
    <div className="wd-empty">
      <strong>{copy.title}</strong>
      <p>{copy.body}</p>
      <Link href={copy.actionHref}>{copy.actionLabel}</Link>
    </div>
  );
}

export function DashboardExperience(): ReactElement {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [txs, setTxs] = useState<TxPreview[]>([]);
  const [mode, setMode] = useState<'demo' | 'live' | 'empty'>('empty');
  const [hint, setHint] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [issues, setIssues] = useState<DashboardIssue[]>([]);
  const [ready, setReady] = useState(false);
  const [hideBalances, setHideBalances] = useState(false);
  const [currency, setCurrency] = useState('USD');
  const [sessions, setSessions] = useState<{ active: number; pending: number; live: boolean }>({
    active: 0,
    pending: 0,
    live: false,
  });
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    try {
      setHideBalances(localStorage.getItem('auvora_hide_balances_v1') === '1');
    } catch {
      /* ignore */
    }
    setCurrency(getUserPrefs().currency);
    setSignedIn(isSignedIn());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const nextIssues: DashboardIssue[] = [];
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        nextIssues.push('offline');
      }

      const preview =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('preview')
          : null;
      if (preview === 'loading') {
        return;
      }
      if (preview === 'empty') {
        if (cancelled) return;
        setHoldings([]);
        setTxs([]);
        setMode('empty');
        setHint('');
        setReady(true);
        return;
      }

      const portfolio = await loadLivePortfolio();
      if (cancelled) return;

      let rows = portfolio.holdings;
      if (portfolio.state === 'unavailable' && isSignedIn()) {
        nextIssues.push('rpc');
      }

      setHoldings(rows);
      setMode(portfolio.state === 'demo' ? 'demo' : rows.length ? 'live' : 'empty');
      setTxs(portfolio.state === 'demo' ? DEMO_TXS : []);
      setUpdatedAt(portfolio.generatedAt ?? (rows.length ? new Date().toISOString() : null));
      setHint(portfolio.message);
      setIssues([...nextIssues]);
      setReady(true);

      try {
        const prices = await fetchPricesWithFailover(rows.map((h) => h.symbol.toLowerCase()));
        if (cancelled) return;
        if (prices.quotes.length) {
          rows = applyQuotes(rows, prices.quotes);
          setHoldings(rows);
        }
        if (!prices.live && rows.some((h) => h.balance > 0)) {
          nextIssues.push('market');
        }
        setHint(portfolio.message + (prices.sourceLabel ? ` · ${prices.sourceLabel}` : ''));
        setIssues([...nextIssues]);
      } catch {
        if (!cancelled) {
          nextIssues.push('market');
          setIssues([...nextIssues]);
        }
      }

      if (!isSignedIn()) return;
      try {
        const summary = await web3Fetch<{ activeSessions?: number; pendingRequests?: number }>(
          '/api/v1/connections/dapps/sessions/summary',
        );
        if (!cancelled) {
          setSessions({
            active: Number(summary.activeSessions ?? 0),
            pending: Number(summary.pendingRequests ?? 0),
            live: true,
          });
        }
      } catch (err) {
        const status = err instanceof AuvoraClientError ? err.status : undefined;
        const classified = classifyHttpStatus(status);
        if (classified && !nextIssues.includes(classified)) nextIssues.push(classified);
        else if (!nextIssues.includes('backend')) nextIssues.push('backend');
        if (!cancelled) setIssues([...nextIssues]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = useMemo(() => portfolioTotals(holdings), [holdings]);
  const allocation = useMemo(
    () => [...holdings].sort((a, b) => b.valueUsd - a.valueUsd).slice(0, 6),
    [holdings],
  );

  function toggleHide(): void {
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

  if (!ready) return <DashboardSkeleton />;

  const currencyNote = currency === 'USD' ? 'USD' : `${currency} unavailable — values shown in USD`;
  const updated = formatUpdated(updatedAt);

  return (
    <div className="wd">
      <div className="wd-stack">
        {mode === 'demo' ? (
          <div className="wd-banner wd-banner--demo" role="status">
            <strong>Sample portfolio</strong>
            <p>
              {hint ||
                'Preview holdings for this companion. Sign in and add a wallet to see live balances. Auvora never holds your keys.'}
            </p>
          </div>
        ) : null}
        {issues.map((kind) => {
          const copy = issueCopy(kind);
          return (
            <div key={kind} className="wd-banner wd-banner--error" role="status">
              <strong>{copy.title}</strong>
              <p>{copy.body}</p>
            </div>
          );
        })}

        <section className="wd-hero" aria-labelledby="wd-portfolio-label">
          <div>
            <p className="wd-hero__label" id="wd-portfolio-label">
              Portfolio
            </p>
            <p className="wd-hero__value" aria-live="polite">
              {holdings.length ? money(totals.total) : hideBalances ? '••••••' : formatUsd(0)}
            </p>
            <div className="wd-hero__delta">
              {holdings.length ? (
                <span className={totals.dayPct >= 0 ? 'wd-pos' : 'wd-neg'}>
                  {hideBalances
                    ? '••••'
                    : `${totals.day >= 0 ? '+' : '−'}${formatUsd(Math.abs(totals.day))} · ${formatPct(totals.dayPct)}`}{' '}
                  <span style={{ color: 'var(--wd-muted)', fontWeight: 500 }}>24h</span>
                </span>
              ) : (
                <span style={{ color: 'var(--wd-muted)', fontWeight: 500 }}>
                  No live balance yet
                </span>
              )}
              <button
                type="button"
                className="wd-card__link"
                onClick={toggleHide}
                aria-pressed={hideBalances}
                style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0 }}
              >
                {hideBalances ? <Eye size={16} aria-hidden /> : <EyeOff size={16} aria-hidden />}{' '}
                {hideBalances ? 'Show' : 'Hide'}
              </button>
            </div>
            <p className="wd-hero__meta">
              {currencyNote}
              {updated ? ` · ${updated}` : ''}
              {` · ${totals.networks || 0} network${totals.networks === 1 ? '' : 's'}`}
            </p>
          </div>
          <div className="wd-alloc" aria-label="Portfolio breakdown">
            {allocation.length ? (
              allocation.map((h) => (
                <div key={h.id} className="wd-alloc__row">
                  <span>{h.symbol}</span>
                  <span className="wd-alloc__track">
                    <span
                      className="wd-alloc__fill"
                      style={{ width: `${Math.max(2, h.allocationPct)}%` }}
                    />
                  </span>
                  <span>{hideBalances ? '••' : `${h.allocationPct.toFixed(0)}%`}</span>
                </div>
              ))
            ) : (
              <p className="wd-hero__meta">Allocation appears after assets load.</p>
            )}
          </div>
        </section>

        <nav className="wd-actions" aria-label="Primary wallet actions">
          <Link href="/send" className="wd-action wd-action--primary">
            <span className="wd-action__icon">
              <ArrowUpRight size={18} aria-hidden />
            </span>
            <span>
              <strong>Send</strong>
              <small>Transfer from this wallet</small>
            </span>
          </Link>
          <Link href="/receive" className="wd-action">
            <span className="wd-action__icon">
              <ArrowDownLeft size={18} aria-hidden />
            </span>
            <span>
              <strong>Receive</strong>
              <small>Show an address</small>
            </span>
          </Link>
          <Link href="/connections" className="wd-action">
            <span className="wd-action__icon">
              <Link2 size={18} aria-hidden />
            </span>
            <span>
              <strong>Connect</strong>
              <small>Apps and sessions</small>
            </span>
          </Link>
        </nav>

        <div className="wd-layout">
          <section className="wd-card" aria-labelledby="wd-assets-title">
            <div className="wd-card__head">
              <h2 className="wd-card__title" id="wd-assets-title">
                Assets
              </h2>
              <Link className="wd-card__link" href="/portfolio">
                Full list
              </Link>
            </div>
            {holdings.length ? (
              <>
                <div className="wd-table-wrap">
                  <table className="wd-table">
                    <caption className="visually-hidden">Asset balances by network</caption>
                    <thead>
                      <tr>
                        <th scope="col">Asset</th>
                        <th scope="col">Network</th>
                        <th className="num wd-col-price" scope="col">
                          Price
                        </th>
                        <th className="num wd-col-price" scope="col">
                          24h
                        </th>
                        <th className="num" scope="col">
                          Balance
                        </th>
                        <th className="num" scope="col">
                          Value
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {holdings.map((h) => (
                        <tr key={h.id}>
                          <td>
                            <Link href={`/assets/${h.id}`} className="wd-asset-link">
                              <div className="wd-asset-id">
                                <NetworkMark network={h.network} />
                                <span>
                                  <strong>{h.name}</strong>
                                  <small>{h.symbol}</small>
                                </span>
                              </div>
                            </Link>
                          </td>
                          <td>
                            <span className="wd-netchip">{networkLabel(h.network)}</span>
                          </td>
                          <td className="num wd-col-price">
                            {h.priceUsd ? money(h.priceUsd) : '—'}
                          </td>
                          <td
                            className={`num wd-col-price ${h.change24hPct >= 0 ? 'wd-pos' : 'wd-neg'}`}
                          >
                            {hideBalances ? '••••' : formatPct(h.change24hPct)}
                          </td>
                          <td className="num">{units(h.balance, h.symbol)}</td>
                          <td className="num">{h.valueUsd ? money(h.valueUsd) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="wd-list">
                  {holdings.map((h) => (
                    <li key={`m-${h.id}`}>
                      <Link href={`/assets/${h.id}`} className="wd-asset-link">
                        <div className="wd-asset-id">
                          <NetworkMark network={h.network} />
                          <span>
                            <strong>{h.name}</strong>
                            <small>
                              {networkLabel(h.network)} · {units(h.balance, h.symbol)}
                            </small>
                          </span>
                        </div>
                        <span className="wd-tx__amt">
                          {h.valueUsd ? money(h.valueUsd) : '—'}
                          <span className={h.change24hPct >= 0 ? 'wd-pos' : 'wd-neg'}>
                            {hideBalances ? '••••' : formatPct(h.change24hPct)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <EmptyBlock copy={signedIn ? EMPTY_COPY.wallet : EMPTY_COPY.assets} />
            )}
          </section>

          <div className="wd-stack">
            <section className="wd-card" aria-labelledby="wd-activity-title">
              <div className="wd-card__head">
                <h2 className="wd-card__title" id="wd-activity-title">
                  Recent activity
                </h2>
                <Link className="wd-card__link" href="/activity">
                  View all
                </Link>
              </div>
              {txs.length ? (
                txs.map((tx) => (
                  <div key={tx.id} className="wd-tx">
                    <span className="wd-tx__icon" aria-hidden>
                      {tx.type === 'receive' ? '↓' : tx.type === 'send' ? '↑' : '⇄'}
                    </span>
                    <span>
                      <strong>
                        {tx.type} {tx.asset}
                      </strong>
                      <small>
                        {networkLabel(tx.network)} · {tx.at}
                      </small>
                    </span>
                    <span className="wd-tx__amt">
                      {hideBalances ? '••••' : tx.amount}
                      <span className={`wd-status wd-status--${tx.status}`}>{tx.status}</span>
                    </span>
                  </div>
                ))
              ) : (
                <EmptyBlock copy={EMPTY_COPY.activity} />
              )}
              {mode === 'demo' ? (
                <p className="wd-cue">Sample activity for this preview — not a live history.</p>
              ) : null}
            </section>

            <section className="wd-card" aria-labelledby="wd-conn-title">
              <div className="wd-card__head">
                <h2 className="wd-card__title" id="wd-conn-title">
                  Connection status
                </h2>
                <Link className="wd-card__link" href="/connections">
                  Manage
                </Link>
              </div>
              {sessions.live && (sessions.active > 0 || sessions.pending > 0) ? (
                <>
                  <div className="wd-conn">
                    <span>Active sessions</span>
                    <strong>{sessions.active}</strong>
                  </div>
                  <div className="wd-conn">
                    <span>Pending requests</span>
                    <strong>{sessions.pending}</strong>
                  </div>
                </>
              ) : (
                <EmptyBlock copy={signedIn ? EMPTY_COPY.connections : EMPTY_COPY.account} />
              )}
              <p className="wd-cue">Keys stay on this device. Auvora does not custody assets.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
