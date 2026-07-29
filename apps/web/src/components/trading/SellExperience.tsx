'use client';

import { Alert, Button, SuccessState } from '@auvora/ui';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { pushTradingActivity } from '../../lib/trading/activity';
import '../../app/trading-experience.css';

type Screen = 'form' | 'confirm' | 'progress' | 'success' | 'history';

const ASSETS = [
  { id: 'BTC', balance: '0.42', price: 68420 },
  { id: 'ETH', balance: '8.15', price: 3420 },
  { id: 'SOL', balance: '126', price: 148 },
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

  return (
    <div className="tx" role="main">
      <header className="tx__header">
        <div>
          <p className="tx__eyebrow">
            <Link href="/">Dashboard</Link>
          </p>
          <h1>Sell crypto</h1>
          <p className="tx__sub">
            Choose an asset, destination, and review settlement before confirming.
          </p>
        </div>
        <div className="tx__tabs" role="tablist" aria-label="Sell sections">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'sell'}
            className={`tx__tab ${tab === 'sell' ? 'tx__tab--on' : ''}`}
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
            className={`tx__tab ${tab === 'history' ? 'tx__tab--on' : ''}`}
            onClick={() => setTab('history')}
          >
            History
          </button>
        </div>
      </header>

      {tab === 'history' ? (
        <section className="tx-panel">
          <h2>Sell history</h2>
          <ul className="tx-list">
            <li>
              <div>
                <strong>Sold 0.25 ETH</strong>
                <p className="tx-meta">$848 → Bank · settled</p>
              </div>
              <span className="tx-meta">5d ago</span>
            </li>
          </ul>
        </section>
      ) : null}

      {tab === 'sell' && screen === 'form' ? (
        <>
          <section className="tx-panel">
            <h2>Asset</h2>
            <div className="tx-choice-grid" role="radiogroup" aria-label="Asset">
              {ASSETS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`tx-choice ${assetId === a.id ? 'tx-choice--on' : ''}`}
                  aria-pressed={assetId === a.id}
                  onClick={() => setAssetId(a.id)}
                >
                  <strong>{a.id}</strong>
                  <span>Bal {a.balance}</span>
                </button>
              ))}
            </div>
            <label className="tx-field">
              <span>Amount ({asset.id})</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
              />
            </label>
          </section>

          <section className="tx-panel">
            <h2>Destination account</h2>
            <div className="tx-choice-grid" role="radiogroup" aria-label="Destination">
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
                  className={`tx-choice ${destination === id ? 'tx-choice--on' : ''}`}
                  aria-pressed={destination === id}
                  onClick={() => setDestination(id)}
                >
                  <strong>{label}</strong>
                </button>
              ))}
            </div>
            <dl className="tx-quote">
              <div className="tx-quote__row">
                <dt>You receive</dt>
                <dd>≈ ${fiat}</dd>
              </div>
              <div className="tx-quote__row">
                <dt>Fee breakdown</dt>
                <dd>≈ ${fee} (0.9%)</dd>
              </div>
              <div className="tx-quote__row">
                <dt>Settlement estimate</dt>
                <dd>{settleEta}</dd>
              </div>
            </dl>
            <Alert tone="warn" title="Irreversible once settled">
              Double-check destination details. Off-ramp partners may require KYC for larger
              amounts.
            </Alert>
            <div className="tx-actions">
              <Button type="button" onClick={() => setScreen('confirm')}>
                Continue
              </Button>
            </div>
          </section>
        </>
      ) : null}

      {tab === 'sell' && screen === 'confirm' ? (
        <section className="tx-panel">
          <h2>Confirm sale</h2>
          <dl className="tx-quote">
            <div className="tx-quote__row">
              <dt>Sell</dt>
              <dd>
                {amount} {asset.id}
              </dd>
            </div>
            <div className="tx-quote__row">
              <dt>Receive</dt>
              <dd>≈ ${fiat}</dd>
            </div>
            <div className="tx-quote__row">
              <dt>Destination</dt>
              <dd>{destination}</dd>
            </div>
            <div className="tx-quote__row">
              <dt>Settlement</dt>
              <dd>{settleEta}</dd>
            </div>
          </dl>
          <div className="tx-actions">
            <Button type="button" variant="ghost" onClick={() => setScreen('form')}>
              Back
            </Button>
            <Button type="button" onClick={execute}>
              Confirm sell
            </Button>
          </div>
        </section>
      ) : null}

      {tab === 'sell' && screen === 'progress' ? (
        <section className="tx-panel" aria-busy="true">
          <h2>Submitting sale…</h2>
          <div
            className="tx-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Sell progress"
          >
            <div className="tx-progress__bar" style={{ width: `${progress}%` }} />
          </div>
        </section>
      ) : null}

      {tab === 'sell' && screen === 'success' ? (
        <SuccessState
          title="Sale submitted"
          description={`Settlement estimate: ${settleEta}. Track progress in activity.`}
          action={
            <div className="tx-actions">
              <Link href="/activity">
                <Button>Activity</Button>
              </Link>
              <Link href="/portfolio">
                <Button variant="secondary">Portfolio</Button>
              </Link>
            </div>
          }
        />
      ) : null}
    </div>
  );
}
