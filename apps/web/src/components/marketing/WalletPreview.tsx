'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { usePrefersReducedMotion } from './motion';

const ASSETS = [
  { name: 'Ethereum', ticker: 'ETH', amount: '8.2104', fiat: '$24,180', delta: '+1.2%' },
  { name: 'Bitcoin', ticker: 'BTC', amount: '0.184', fiat: '$12,640', delta: '+0.4%' },
  { name: 'Solana', ticker: 'SOL', amount: '92.5', fiat: '$14,210', delta: '−0.3%' },
  { name: 'USDC', ticker: 'USDC', amount: '4,820', fiat: '$4,820', delta: '0.0%' },
];

const TABS = ['Portfolio', 'Activity', 'Security'] as const;

type WalletPreviewProps = {
  interactive?: boolean;
  className?: string;
};

export function WalletPreview({
  interactive = true,
  className = '',
}: WalletPreviewProps): ReactElement {
  const reduced = usePrefersReducedMotion();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Portfolio');
  const [balance, setBalance] = useState(reduced ? 55850 : 54210);

  useEffect(() => {
    if (reduced || !interactive) {
      setBalance(55850);
      return;
    }
    const id = window.setInterval(() => {
      setBalance((b) => {
        const next = b + (Math.random() > 0.45 ? 12 : -7);
        return Math.min(56240, Math.max(54880, next));
      });
    }, 2200);
    return () => window.clearInterval(id);
  }, [interactive, reduced]);

  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(balance);

  return (
    <div className={`mh-device ${className}`.trim()} aria-hidden={interactive ? undefined : true}>
      <div className="mh-device__glow" />
      <div className="mh-device__frame">
        <div className="mh-device__chrome">
          <span className="mh-device__notch" />
          <span className="mh-device__status">Auvora</span>
        </div>
        <div className="mh-device__screen">
          <p className="mh-device__wallet">Personal · Multi-chain</p>
          <p className="mh-device__balance-label">Total balance</p>
          <p className="mh-device__balance" data-live>
            {formatted}
          </p>
          <div className="mh-device__verbs" role="presentation">
            <span>Send</span>
            <span>Receive</span>
            <span>Swap</span>
          </div>
          {interactive ? (
            <div className="mh-device__tabs" role="tablist" aria-label="Wallet preview">
              {TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  className={tab === t ? 'is-active' : undefined}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          ) : (
            <div className="mh-device__tabs mh-device__tabs--static">
              {TABS.map((t) => (
                <span key={t} className={t === 'Portfolio' ? 'is-active' : undefined}>
                  {t}
                </span>
              ))}
            </div>
          )}
          <div className="mh-device__panel">
            {tab === 'Portfolio' || !interactive ? (
              <ul className="mh-device__assets">
                {ASSETS.map((a) => (
                  <li key={a.ticker}>
                    <span className="mh-device__pip" data-t={a.ticker} />
                    <span className="mh-device__asset-meta">
                      <strong>{a.name}</strong>
                      <small>
                        {a.amount} {a.ticker}
                      </small>
                    </span>
                    <span className="mh-device__asset-val">
                      <strong>{a.fiat}</strong>
                      <small data-delta={a.delta.startsWith('−') ? 'down' : 'up'}>{a.delta}</small>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {interactive && tab === 'Activity' ? (
              <ul className="mh-device__activity">
                <li>
                  <strong>Sent ETH</strong>
                  <span>−0.42 · 2h ago</span>
                </li>
                <li>
                  <strong>Received USDC</strong>
                  <span>+1,200 · Yesterday</span>
                </li>
                <li>
                  <strong>Swapped SOL</strong>
                  <span>→ USDC · 3d ago</span>
                </li>
              </ul>
            ) : null}
            {interactive && tab === 'Security' ? (
              <ul className="mh-device__activity">
                <li>
                  <strong>Passcode</strong>
                  <span>On</span>
                </li>
                <li>
                  <strong>Biometrics</strong>
                  <span>Ready</span>
                </li>
                <li>
                  <strong>Recovery</strong>
                  <span>Backed up</span>
                </li>
              </ul>
            ) : null}
          </div>
          <svg className="mh-device__chart" viewBox="0 0 280 64" aria-hidden="true">
            <path
              className="mh-device__chart-line"
              d="M0 48 C40 46 55 20 90 28 C120 36 140 12 170 18 C200 24 230 8 280 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
