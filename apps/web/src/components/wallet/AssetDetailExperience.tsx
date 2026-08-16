'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  applyQuotes,
  DEMO_HOLDINGS,
  DEMO_TXS,
  formatPct,
  formatUsd,
  type Holding,
} from '../../lib/dashboard-demo';
import { DEMO_RECEIVE_ADDRESSES } from '../../lib/wallet-experience/demo-addresses';
import { networkLabel, resolveNetwork } from '../../lib/product/networks';
import { fetchPricesWithFailover } from '../../lib/portfolio/price-failover';
import '../../app/core-experience.css';
import '../../app/wallet-dashboard.css';
import '../../app/wallet-flow.css';
import { PublicAddress } from './PublicAddress';
import type { WalletNetwork } from '../../lib/wallet-experience/types';

function NetworkMark({ network }: { network: string }): ReactElement {
  const resolved = resolveNetwork(network);
  return (
    <span className="wd-netmark" aria-hidden>
      {resolved?.mark ?? network.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function AssetDetailExperience(): ReactElement {
  const params = useParams<{ assetId: string }>();
  const seed = useMemo(
    () => DEMO_HOLDINGS.find((h) => h.id === params.assetId) ?? null,
    [params.assetId],
  );
  const [holding, setHolding] = useState<Holding | null>(seed);
  const [priceState, setPriceState] = useState<'loading' | 'live' | 'unavailable'>('loading');

  useEffect(() => {
    setHolding(seed);
    if (!seed) return;
    let cancelled = false;
    setPriceState('loading');
    void (async () => {
      try {
        const prices = await fetchPricesWithFailover([seed.symbol]);
        if (cancelled) return;
        if (!prices.quotes.length) {
          setPriceState('unavailable');
          return;
        }
        setHolding(applyQuotes([seed], prices.quotes)[0] ?? seed);
        setPriceState('live');
      } catch {
        if (!cancelled) setPriceState('unavailable');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seed]);

  if (!seed) {
    return (
      <div className="cx wf">
        <div className="wf-empty">
          <h2>Asset not found</h2>
          <p>That holding is not in this wallet view.</p>
          <Link className="cx-btn cx-btn--primary" href="/dashboard">
            Back to wallet
          </Link>
        </div>
      </div>
    );
  }

  const asset = holding ?? seed;
  const net = resolveNetwork(asset.network);
  const networkKey = (net?.id ?? 'ethereum') as WalletNetwork;
  const address = DEMO_RECEIVE_ADDRESSES[networkKey];
  const activity = DEMO_TXS.filter(
    (tx) =>
      tx.asset === asset.symbol ||
      tx.asset.startsWith(`${asset.symbol}→`) ||
      tx.asset.endsWith(`→${asset.symbol}`),
  );
  const up = asset.change24hPct >= 0;

  return (
    <div className="cx wf">
      <p className="cx__eyebrow">
        <Link href="/dashboard">Wallet</Link>
      </p>
      <section className="wf-hero" aria-labelledby="wf-asset-name">
        <p className="wf-kicker">Asset</p>
        <div className="wf-idrow">
          <NetworkMark network={asset.network} />
          <span>
            <strong id="wf-asset-name">{asset.name}</strong>
            <small>
              {asset.symbol} · {networkLabel(asset.network)}
            </small>
          </span>
        </div>
        <p className="wf-hero__value">
          {asset.balance} {asset.symbol}
        </p>
        <p className="wf-hero__fiat">
          {priceState === 'loading' ? 'Updating value…' : formatUsd(asset.valueUsd)}
        </p>
        <dl className="wf-stats">
          <div className="wf-stat">
            <dt>Price</dt>
            <dd>
              {priceState === 'loading' ? 'Loading…' : formatUsd(asset.priceUsd)}
              {priceState === 'unavailable' ? (
                <small className="wf-quiet"> Market data unavailable</small>
              ) : null}
            </dd>
          </div>
          <div className="wf-stat">
            <dt>24h</dt>
            <dd className={up ? 'wd-pos' : 'wd-neg'}>{formatPct(asset.change24hPct)}</dd>
          </div>
        </dl>
        <div className="wf-actions">
          <Link className="cx-btn cx-btn--primary" href={`/send?asset=${asset.symbol}`}>
            Send {asset.symbol}
          </Link>
          <Link className="cx-btn cx-btn--ghost" href={`/receive?asset=${asset.symbol}`}>
            Receive {asset.symbol}
          </Link>
        </div>
        <p className="wf-quiet">
          {asset.walletLabel} · {networkLabel(asset.network)}. Historical market data is not
          available — no estimated chart is shown.
        </p>
      </section>

      <section className="cx-panel" style={{ marginTop: '1rem' }}>
        <h2>Network</h2>
        <p>
          {networkLabel(asset.network)} addresses use this network’s format. Sending the wrong asset
          here can be unrecoverable.
        </p>
        {address ? <PublicAddress value={address} copyEnabled={false} /> : null}
        <p className="wf-quiet">
          Address preview only — copy stays off until funding is unlocked on this companion.
        </p>
      </section>

      <section className="cx-panel" style={{ marginTop: '1rem' }} aria-labelledby="wf-activity">
        <div className="wd-card__head" style={{ marginBottom: '0.75rem' }}>
          <h2 id="wf-activity" style={{ margin: 0 }}>
            Recent activity
          </h2>
          <Link className="wd-card__link" href="/activity">
            View activity
          </Link>
        </div>
        {activity.length ? (
          <ul className="wf-list">
            {activity.map((tx) => (
              <li key={tx.id}>
                <Link
                  href={`/activity/${tx.id}`}
                  className="wf-row"
                  style={{ textDecoration: 'none' }}
                >
                  <span className="wf-row__meta">
                    <strong>
                      {tx.type} · {tx.asset}
                    </strong>
                    <small>
                      {networkLabel(tx.network)} · {tx.at} · {tx.status}
                    </small>
                  </span>
                  <span>{tx.amount}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="wf-quiet">No activity for this asset yet.</p>
        )}
      </section>
    </div>
  );
}
