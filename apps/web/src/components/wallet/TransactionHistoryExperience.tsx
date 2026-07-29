'use client';

import { Button, EmptyState, StatusBadge } from '@auvora/ui';
import { Download, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useDeferredValue, useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  DEMO_ACTIVITY,
  exportActivityCsv,
  groupActivityByDay,
} from '../../lib/wallet-experience/demo-activity';
import { tradingAsActivityTx } from '../../lib/trading/activity';
import { DEMO_ACTIVITY as DEMO_NFT_ACTIVITY } from '../../lib/nft/demo';
import type { ActivityTx, TxDirection, TxStatus } from '../../lib/wallet-experience/types';
import '../../app/wallet-experience.css';

const STATUS_BADGE: Record<TxStatus, string> = {
  confirmed: 'active',
  pending: 'pending',
  failed: 'suspended',
  dropped: 'archived',
};

function slugId(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'item'
  );
}

function nftActivityAsTx(): ActivityTx[] {
  return DEMO_NFT_ACTIVITY.map((n) => ({
    id: n.id,
    hash: n.id,
    direction: n.kind === 'received' || n.kind === 'minted' ? 'receive' : 'send',
    status: n.status === 'pending' ? 'pending' : 'confirmed',
    network: n.network.toLowerCase().includes('solana')
      ? 'solana'
      : n.network.toLowerCase().includes('polygon')
        ? 'polygon'
        : 'ethereum',
    asset: 'ETH',
    amount: '1',
    amountUsd: 0,
    from: n.kind,
    to: n.detail,
    timestamp: n.timestamp,
    note: n.title,
    explorerUrl: n.assetId ? `/nfts/assets/${n.assetId}` : '/nfts/activity',
    walletLabel: 'NFTs',
  }));
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
  const [selected, setSelected] = useState<ActivityTx | null>(null);
  const [trading, setTrading] = useState<ActivityTx[]>([]);
  const [nftRows, setNftRows] = useState<ActivityTx[]>([]);

  useEffect(() => {
    const refresh = (): void => {
      setTrading(tradingAsActivityTx());
      setNftRows(nftActivityAsTx());
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

  const source = useMemo(() => {
    const base = initial?.length ? initial : DEMO_ACTIVITY;
    return [...trading, ...nftRows, ...base].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [initial, trading, nftRows]);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return source.filter((tx) => {
      if (status !== 'all' && tx.status !== status) return false;
      if (direction !== 'all' && tx.direction !== direction) return false;
      if (!q) return true;
      return (
        tx.hash.toLowerCase().includes(q) ||
        tx.asset.toLowerCase().includes(q) ||
        tx.from.toLowerCase().includes(q) ||
        tx.to.toLowerCase().includes(q) ||
        (tx.note ?? '').toLowerCase().includes(q) ||
        tx.network.includes(q)
      );
    });
  }, [source, deferredQuery, status, direction]);

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
    <div className="wx" role="main">
      <header className="wx__header">
        <div>
          <p className="wx__eyebrow">
            <Link href="/wallets">Wallets</Link>
          </p>
          <h1>Activity</h1>
          <p className="wx__sub">
            Search, filter, and inspect transfers with fees, hashes, and explorer links.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={downloadCsv}>
          <Download size={16} aria-hidden /> Export CSV
        </Button>
      </header>

      <div className="wx-toolbar" role="search">
        <label className="wx-field wx-field--grow">
          <span className="wx-sr-only">Search transactions</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search hash, asset, address…"
          />
        </label>
        <label className="wx-field">
          <span className="wx-sr-only">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="all">All statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="dropped">Dropped</option>
          </select>
        </label>
        <label className="wx-field">
          <span className="wx-sr-only">Type</span>
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
      </div>

      {!filtered.length ? (
        <EmptyState
          title="No transactions"
          description="Try clearing filters or make your first send."
          action={
            <Link href="/send">
              <Button>Send</Button>
            </Link>
          }
        />
      ) : (
        groups.map((g) => (
          <section key={g.label} className="wx-panel" aria-labelledby={`day-${slugId(g.label)}`}>
            <h2 id={`day-${slugId(g.label)}`}>{g.label}</h2>
            <ul className="wx-tx-list">
              {g.items.map((tx) => (
                <li key={tx.id}>
                  <button type="button" className="wx-tx-row" onClick={() => setSelected(tx)}>
                    <div>
                      <strong>
                        {tx.direction} · {tx.asset}
                      </strong>
                      <p className="wx-meta">
                        {tx.network}
                        {tx.note ? ` · ${tx.note}` : ''} ·{' '}
                        {new Date(tx.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="wx-tx-right">
                      <span>
                        {tx.direction === 'receive' ? '+' : '-'}
                        {tx.amount} {tx.asset}
                      </span>
                      <StatusBadge status={STATUS_BADGE[tx.status]} label={tx.status} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {selected ? (
        <section className="wx-panel wx-tx-detail" aria-label="Transaction detail">
          <header className="wx-tx-detail__head">
            <h2>Transaction detail</h2>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(null)}>
              Close
            </Button>
          </header>
          <dl className="wx-kv">
            <div>
              <dt>Status</dt>
              <dd>
                <StatusBadge status={STATUS_BADGE[selected.status]} label={selected.status} />
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
                {selected.amount} {selected.asset} (${selected.amountUsd.toLocaleString()})
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
            <a
              className="wx-text-link"
              href={selected.explorerUrl}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={14} aria-hidden /> Open in explorer
            </a>
          ) : (
            <Link className="wx-text-link" href={selected.explorerUrl}>
              View in app
            </Link>
          )}
        </section>
      ) : null}
    </div>
  );
}
