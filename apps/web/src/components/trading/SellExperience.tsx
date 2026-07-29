'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { pushTradingActivity } from '../../lib/trading/activity';
import { CxActions, CxProgressTrack, TransactionShell } from '../transaction/TransactionShell';
import '../../app/core-experience.css';

type Screen = 'form' | 'confirm' | 'progress' | 'success' | 'history';

const ASSETS = [
  { id: 'BTC', balance: '0.42', price: 68420 },
  { id: 'ETH', balance: '8.15', price: 3420 },
  { id: 'SOL', balance: '126', price: 148 },
] as const;

const STEPS = [
  { id: 'form', label: 'Details' },
  { id: 'confirm', label: 'Review' },
  { id: 'progress', label: 'Sell' },
  { id: 'success', label: 'Done' },
] as const;

export function SellExperience(): ReactElement {
  const [tab, setTab] = useState<'sell' | 'history'>('sell');
  const [assetId, setAssetId] = useState<(typeof ASSETS)[number]['id']>('ETH');
  const [amount, setAmount] = useState('0.5');
  const [destination, setDestination] = useState<'bank' | 'card' | 'balance'>('bank');
  const [screen, setScreen] = useState<Screen>('form');
  const [progress, setProgress] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current != null) window.clearInterval(timer.current);
    },
    [],
  );

  const asset = ASSETS.find((a) => a.id === assetId) ?? ASSETS[1];
  const fiat = useMemo(() => {
    const n = Number(amount) || 0;
    return (n * asset.price * 0.991).toFixed(2);
  }, [amount, asset]);
  const fee = useMemo(() => {
    const n = Number(amount) || 0;
    return (n * asset.price * 0.009).toFixed(2);
  }, [amount, asset]);
  const settleEta =
    destination === 'bank'
      ? '1–3 business days'
      : destination === 'card'
        ? 'Instant–2h'
        : 'Immediate';

  function execute(): void {
    setScreen('progress');
    setProgress(12);
    if (timer.current != null) window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          if (timer.current != null) window.clearInterval(timer.current);
          timer.current = null;
          pushTradingActivity({
            kind: 'sell',
            title: `Sell ${asset.id}`,
            detail: `$${fiat} → ${destination}`,
            status: 'confirmed',
            amount,
            asset: asset.id,
            href: '/sell',
          });
          setScreen('success');
          return 100;
        }
        return p + 18;
      });
    }, 260);
  }

  const stepId = tab === 'sell' && screen !== 'history' ? screen : undefined;

  return (
    <TransactionShell
      title="Sell"
      subtitle="Choose an asset, destination, and review settlement before confirming."
      reassure="Double-check destination details before you confirm."
      steps={tab === 'sell' ? [...STEPS] : undefined}
      currentStepId={stepId}
      backHref="/dashboard"
    >
      <div className="cx-tabs" role="tablist" aria-label="Sell sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'sell'}
          className={tab === 'sell' ? 'is-active' : undefined}
          onClick={() => {
            setTab('sell');
            setScreen('form');
          }}
        >
          Sell
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'history'}
          className={tab === 'history' ? 'is-active' : undefined}
          onClick={() => setTab('history')}
        >
          History
        </button>
      </div>

      {tab === 'history' ? (
        <section className="cx-panel">
          <h2>Sell history</h2>
          <ul className="cx-list">
            <li>
              <div>
                <strong>Sold 0.25 ETH</strong>
                <p className="cx-meta">$848 → Bank · settled</p>
              </div>
              <span className="cx-meta">5d ago</span>
            </li>
          </ul>
        </section>
      ) : null}

      {tab === 'sell' && screen === 'form' ? (
        <>
          <section className="cx-panel">
            <h2>Asset</h2>
            <div className="cx-choice-grid" role="radiogroup" aria-label="Asset">
              {ASSETS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`cx-choice ${assetId === a.id ? 'cx-choice--on' : ''}`}
                  aria-pressed={assetId === a.id}
                  onClick={() => setAssetId(a.id)}
                >
                  <strong>{a.id}</strong>
                  <span>Bal {a.balance}</span>
                </button>
              ))}
            </div>
            <label className="cx-field">
              <span>Amount ({asset.id})</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
              />
            </label>
          </section>

          <section className="cx-panel">
            <h2>Destination account</h2>
            <div className="cx-choice-grid" role="radiogroup" aria-label="Destination">
              {(
                [
                  ['bank', 'Bank account'],
                  ['card', 'Debit card'],
                  ['balance', 'USD balance'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`cx-choice ${destination === id ? 'cx-choice--on' : ''}`}
                  aria-pressed={destination === id}
                  onClick={() => setDestination(id)}
                >
                  <strong>{label}</strong>
                </button>
              ))}
            </div>
            <div className="cx-confirm">
              <dl>
                <div>
                  <dt>You receive</dt>
                  <dd>≈ ${fiat}</dd>
                </div>
                <div>
                  <dt>Fee breakdown</dt>
                  <dd>≈ ${fee} (0.9%)</dd>
                </div>
                <div>
                  <dt>Settlement estimate</dt>
                  <dd>{settleEta}</dd>
                </div>
              </dl>
            </div>
            <div className="cx-warn">
              <strong>Irreversible once settled</strong>
              <p>
                Double-check destination details. Off-ramp partners may require KYC for larger
                amounts.
              </p>
            </div>
            <CxActions onNext={() => setScreen('confirm')} />
          </section>
        </>
      ) : null}

      {tab === 'sell' && screen === 'confirm' ? (
        <section className="cx-panel">
          <h2>Confirm sale</h2>
          <div className="cx-confirm">
            <dl>
              <div>
                <dt>Sell</dt>
                <dd>
                  {amount} {asset.id}
                </dd>
              </div>
              <div>
                <dt>Receive</dt>
                <dd>≈ ${fiat}</dd>
              </div>
              <div>
                <dt>Destination</dt>
                <dd>{destination}</dd>
              </div>
              <div>
                <dt>Settlement</dt>
                <dd>{settleEta}</dd>
              </div>
            </dl>
          </div>
          <CxActions onBack={() => setScreen('form')} onNext={execute} nextLabel="Confirm sell" />
        </section>
      ) : null}

      {tab === 'sell' && screen === 'progress' ? (
        <CxProgressTrack
          progress={progress}
          label="Submitting sale…"
          stages={['Submitted', 'Off-ramp', 'Settling', 'Complete']}
        />
      ) : null}

      {tab === 'sell' && screen === 'success' ? (
        <div className="cx-success">
          <div className="cx-success-burst" aria-hidden>
            ✓
          </div>
          <h2>Sale submitted</h2>
          <p>Settlement estimate: {settleEta}. Track progress in activity.</p>
          <div className="cx-success__cta">
            <Link href="/activity" className="cx-btn cx-btn--primary">
              Activity
            </Link>
            <Link href="/portfolio" className="cx-btn cx-btn--ghost">
              Portfolio
            </Link>
          </div>
        </div>
      ) : null}
    </TransactionShell>
  );
}
