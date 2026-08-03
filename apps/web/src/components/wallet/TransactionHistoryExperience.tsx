'use client';

import { Download, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useDeferredValue, useEffect, useMemo, useState, type ReactElement } from 'react';
import { getStoredAccessToken } from '../../lib/api-client';
import { loadLiveActivity, type ActivityDataState } from '../../lib/activity/live-activity';
import { tradingAsActivityTx } from '../../lib/trading/activity';
import {
  DEMO_ACTIVITY,
  exportActivityCsv,
  groupActivityByDay,
} from '../../lib/wallet-experience/demo-activity';
import type {
  ActivityTx,
  TxDirection,
  TxStatus,
  WalletAsset,
  WalletNetwork,
} from '../../lib/wallet-experience/types';
import { TransactionShell } from '../transaction/TransactionShell';
import '../../app/core-experience.css';

function slugId(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'item'
  );
}

function badgeClass(status: TxStatus): string {
  return `cx-badge cx-badge--${status}`;
}

function mapLiveStatus(raw: string): TxStatus {
  const s = raw.toLowerCase();
  if (s.includes('fail') || s.includes('error') || s.includes('revert')) return 'failed';
  if (s.includes('drop') || s.includes('cancel')) return 'dropped';
  if (s.includes('pend') || s.includes('queued')) return 'pending';
  return 'confirmed';
}

function mapLiveNetwork(raw?: string): WalletNetwork {
  const n = (raw ?? '').toLowerCase();
  if (n.includes('bitcoin') || n === 'btc') return 'bitcoin';
  if (n.includes('solana') || n === 'sol') return 'solana';
  if (n.includes('polygon') || n === 'matic' || n === 'pol') return 'polygon';
  if (n.includes('bnb') || n.includes('bsc')) return 'bnb';
  if (n.includes('tron') || n === 'trx') return 'tron';
  return 'ethereum';
}

export function TransactionHistoryExperience({
  initial,
}: {
  initial?: ActivityTx[];
}): ReactElement {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [status, setStatus] = useState<'all' | TxStatus>('all');
  const [direction, setDirection] = useState<'all' | TxDirection>('all');
  const [network, setNetwork] = useState<'all' | ActivityTx['network']>('all');
  const [selected, setSelected] = useState<ActivityTx | null>(null);
  const [trading, setTrading] = useState<ActivityTx[]>([]);
  const [liveRows, setLiveRows] = useState<ActivityTx[]>([]);
  const [dataState, setDataState] = useState<ActivityDataState>('demo');
  const [dataMessage, setDataMessage] = useState('Loading activity…');
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setSignedIn(Boolean(getStoredAccessToken()));
  }, []);

  useEffect(() => {
    const refresh = (): void => {
      setTrading(tradingAsActivityTx());
    };
    refresh();
    const onVis = (): void => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const live = await loadLiveActivity();
      if (cancelled) return;
      setDataState(live.state);
      setDataMessage(live.message);
      if (live.state === 'live' || live.state === 'empty') {
        setLiveRows(
          live.items.map((item) => ({
            id: item.id,
            hash: item.subtitle,
            direction: 'contract' as TxDirection,
            status: mapLiveStatus(item.status),
            network: mapLiveNetwork(item.network),
            asset: 'ETH' as WalletAsset,
            amount: '—',
            amountUsd: 0,
            from: '—',
            to: '—',
            timestamp: item.createdAt,
            note: item.title,
            explorerUrl: `/activity/${encodeURIComponent(item.id)}`,
          })),
        );
      } else {
        setLiveRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const source = useMemo(() => {
    // Signed-in: never silently inject DEMO_ACTIVITY. Unsigned / demo: sample ok.
    const base = initial?.length
      ? initial
      : signedIn || dataState === 'live' || dataState === 'empty' || dataState === 'unavailable'
        ? liveRows
        : DEMO_ACTIVITY;
    return [...trading, ...base].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [initial, trading, liveRows, signedIn, dataState]);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return source.filter((tx) => {
      if (status !== 'all' && tx.status !== status) return false;
      if (direction !== 'all' && tx.direction !== direction) return false;
      if (network !== 'all' && tx.network !== network) return false;
      if (!q) return true;
      return (
        tx.hash.toLowerCase().includes(q) ||
        tx.asset.toLowerCase().includes(q) ||
        tx.from.toLowerCase().includes(q) ||
        tx.to.toLowerCase().includes(q) ||
        (tx.note ?? '').toLowerCase().includes(q) ||
        tx.network.includes(q) ||
        tx.direction.includes(q)
      );
    });
  }, [source, deferredQuery, status, direction, network]);

  const groups = useMemo(() => groupActivityByDay(filtered), [filtered]);

  function downloadCsv(): void {
    const csv = exportActivityCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auvora-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <TransactionShell
      title="Activity"
      subtitle="Grouped history with status, fees, hashes, and explorer links."
      reassure={
        dataState === 'live'
          ? 'Live activity from registered addresses / account-linked chain records. Broadcast remains off.'
          : dataState === 'empty'
            ? 'No on-chain activity recorded for this account yet.'
            : dataState === 'unavailable'
              ? 'Activity API unavailable — no manufactured history is shown.'
              : 'Sample and local preview activity until you sign in. Pending transfers stay visible when live.'
      }
      backHref="/dashboard"
      backLabel="Wallet"
    >
      <div className="cx-alert cx-alert--info" role="status">
        {dataMessage}
        {dataState === 'demo' && !signedIn
          ? ' Sample / local preview history — not a complete live ledger.'
          : ''}
      </div>
      <div className="cx-wide">
        <div className="cx-toolbar" role="search">
          <label className="cx-field cx-field--grow">
            <span>Search</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Hash, asset, address, note…"
            />
          </label>
          <label className="cx-field">
            <span>Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="failed">Failed</option>
              <option value="dropped">Dropped</option>
            </select>
          </label>
          <label className="cx-field">
            <span>Type</span>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as typeof direction)}
            >
              <option value="all">All types</option>
              <option value="send">Send</option>
              <option value="receive">Receive</option>
              <option value="swap">Swap</option>
              <option value="stake">Stake</option>
              <option value="bridge">Bridge</option>
              <option value="contract">Contract</option>
            </select>
          </label>
          <label className="cx-field">
            <span>Network</span>
            <select value={network} onChange={(e) => setNetwork(e.target.value as typeof network)}>
              <option value="all">All networks</option>
              <option value="ethereum">Ethereum</option>
              <option value="polygon">Polygon</option>
              <option value="bnb">BNB</option>
              <option value="solana">Solana</option>
              <option value="bitcoin">Bitcoin</option>
              <option value="tron">Tron</option>
            </select>
          </label>
          <button type="button" className="cx-btn cx-btn--ghost" onClick={downloadCsv}>
            <Download size={16} aria-hidden /> Export CSV
          </button>
        </div>

        {!filtered.length ? (
          <div className="cx-empty">
            <h2>No transactions</h2>
            <p>Try clearing filters, or make your first send.</p>
            <Link className="cx-btn cx-btn--primary" href="/send">
              Send
            </Link>
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.label} className="cx-panel" aria-labelledby={`day-${slugId(g.label)}`}>
              <h2 id={`day-${slugId(g.label)}`}>{g.label}</h2>
              <ul className="cx-tx-list">
                {g.items.map((tx) => (
                  <li key={tx.id}>
                    <button type="button" className="cx-tx-row" onClick={() => setSelected(tx)}>
                      <div>
                        <strong>
                          {tx.direction} · {tx.asset}
                        </strong>
                        <p className="cx-meta">
                          {tx.network}
                          {tx.note ? ` · ${tx.note}` : ''} ·{' '}
                          {new Date(tx.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="cx-tx-right">
                        <span>
                          {tx.direction === 'receive' ? '+' : '-'}
                          {tx.amount} {tx.asset}
                        </span>
                        <span className={badgeClass(tx.status)}>{tx.status}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}

        {selected ? (
          <section className="cx-panel cx-tx-detail" aria-label="Transaction detail">
            <header className="cx-tx-detail__head">
              <h2>Transaction detail</h2>
              <button
                type="button"
                className="cx-btn cx-btn--ghost"
                onClick={() => setSelected(null)}
              >
                Close
              </button>
            </header>
            <dl className="cx-confirm">
              <div>
                <dt>Status</dt>
                <dd>
                  <span className={badgeClass(selected.status)}>{selected.status}</span>
                </dd>
              </div>
              <div>
                <dt>Hash</dt>
                <dd>
                  <code>{selected.hash}</code>
                </dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd>
                  {selected.amount} {selected.asset} ($
                  {selected.amountUsd.toLocaleString()})
                </dd>
              </div>
              <div>
                <dt>Fee</dt>
                <dd>
                  {selected.fee ?? '—'}
                  {selected.feeUsd != null ? ` ($${selected.feeUsd})` : ''}
                </dd>
              </div>
              <div>
                <dt>Network</dt>
                <dd>{selected.network}</dd>
              </div>
              <div>
                <dt>From</dt>
                <dd>
                  <code>{selected.from}</code>
                </dd>
              </div>
              <div>
                <dt>To</dt>
                <dd>
                  <code>{selected.to}</code>
                </dd>
              </div>
            </dl>
            {selected.explorerUrl.startsWith('http') ? (
              <a className="cx-link" href={selected.explorerUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={14} aria-hidden /> Open in explorer
              </a>
            ) : (
              <Link className="cx-link" href={selected.explorerUrl}>
                View in app
              </Link>
            )}
          </section>
        ) : null}
      </div>
    </TransactionShell>
  );
}
