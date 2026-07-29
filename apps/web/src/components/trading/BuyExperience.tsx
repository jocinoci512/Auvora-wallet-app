'use client';

import { Alert, Button, SuccessState } from '@auvora/ui';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { DEMO_BUY_PROVIDERS, pushTradingActivity } from '../../lib/trading/activity';
import '../../app/trading-experience.css';

type Screen = 'form' | 'confirm' | 'progress' | 'success' | 'history';

const ASSETS = ['BTC', 'ETH', 'SOL', 'USDC'] as const;

export function BuyExperience(): ReactElement {
  const [tab, setTab] = useState<'buy' | 'history'>('buy');
  const [asset, setAsset] = useState<(typeof ASSETS)[number]>('ETH');
  const [fiatAmount, setFiatAmount] = useState('250');
  const [method, setMethod] = useState<'card' | 'bank' | 'provider'>('card');
  const [providerId, setProviderId] = useState(DEMO_BUY_PROVIDERS[0]!.id);
  const [screen, setScreen] = useState<Screen>('form');
  const [progress, setProgress] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current != null) window.clearInterval(timer.current);
    },
    [],
  );

  const provider = DEMO_BUY_PROVIDERS.find((p) => p.id === providerId) ?? DEMO_BUY_PROVIDERS[0]!;
  const cryptoEst = useMemo(() => {
    const usd = Number(fiatAmount) || 0;
    const prices: Record<string, number> = { BTC: 68420, ETH: 3420, SOL: 148, USDC: 1 };
    return (usd / (prices[asset] ?? 1)).toFixed(asset === 'USDC' ? 2 : 6);
  }, [asset, fiatAmount]);

  const feeLabel =
    method === 'bank' ? '$0.50 ACH' : method === 'card' ? '2.9% + $0.30' : provider.fee;

  function execute(): void {
    setScreen('progress');
    setProgress(10);
    if (timer.current != null) window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          if (timer.current != null) window.clearInterval(timer.current);
          timer.current = null;
          pushTradingActivity({
            kind: 'buy',
            title: `Buy ${asset}`,
            detail: `$${fiatAmount} via ${method}`,
            status: 'confirmed',
            amount: cryptoEst,
            asset,
            href: '/buy',
          });
          setScreen('success');
          return 100;
        }
        return p + 20;
      });
    }, 240);
  }

  return (
    <div className="tx" role="main">
      <header className="tx__header">
        <div>
          <p className="tx__eyebrow">
            <Link href="/">Dashboard</Link>
          </p>
          <h1>Buy crypto</h1>
          <p className="tx__sub">
            Card, bank, or third-party providers — with fee transparency and compliance messaging.
          </p>
        </div>
        <div className="tx__tabs" role="tablist" aria-label="Buy sections">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'buy'}
            className={`tx__tab ${tab === 'buy' ? 'tx__tab--on' : ''}`}
            onClick={() => {
              setTab('buy');
              setScreen('form');
            }}
          >
            Buy
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
          <h2>Purchase history</h2>
          <ul className="tx-list">
            <li>
              <div>
                <strong>ETH purchase</strong>
                <p className="tx-meta">$250 card · MoonPay</p>
              </div>
              <span className="tx-meta">Yesterday</span>
            </li>
            <li>
              <div>
                <strong>BTC purchase</strong>
                <p className="tx-meta">$500 ACH · Bank</p>
              </div>
              <span className="tx-meta">Last week</span>
            </li>
          </ul>
          <Link href="/payments">Open payments ledger</Link>
        </section>
      ) : null}

      {tab === 'buy' && screen === 'form' ? (
        <>
          <section className="tx-panel">
            <h2>Asset</h2>
            <div className="tx-choice-grid" role="radiogroup" aria-label="Asset">
              {ASSETS.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`tx-choice ${asset === a ? 'tx-choice--on' : ''}`}
                  aria-pressed={asset === a}
                  onClick={() => setAsset(a)}
                >
                  <strong>{a}</strong>
                </button>
              ))}
            </div>
            <label className="tx-field">
              <span>Amount (USD)</span>
              <input
                value={fiatAmount}
                onChange={(e) => setFiatAmount(e.target.value)}
                inputMode="decimal"
              />
            </label>
            <p className="tx-meta">
              Est. receive ≈ {cryptoEst} {asset}
            </p>
          </section>

          <section className="tx-panel">
            <h2>Payment method</h2>
            <div className="tx-choice-grid" role="radiogroup" aria-label="Method">
              {(
                [
                  ['card', 'Card purchase'],
                  ['bank', 'Bank transfer'],
                  ['provider', 'Third-party provider'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`tx-choice ${method === id ? 'tx-choice--on' : ''}`}
                  aria-pressed={method === id}
                  onClick={() => setMethod(id)}
                >
                  <strong>{label}</strong>
                </button>
              ))}
            </div>
            {method === 'provider' ? (
              <div className="tx-choice-grid" role="radiogroup" aria-label="Provider">
                {DEMO_BUY_PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`tx-choice ${providerId === p.id ? 'tx-choice--on' : ''}`}
                    aria-pressed={providerId === p.id}
                    onClick={() => setProviderId(p.id)}
                  >
                    <strong>{p.label}</strong>
                    <span>
                      {p.methods.join(' · ')} · {p.fee}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            <dl className="tx-quote">
              <div className="tx-quote__row">
                <dt>Provider fee</dt>
                <dd>{feeLabel}</dd>
              </div>
              <div className="tx-quote__row">
                <dt>Network fee</dt>
                <dd>Included in quote</dd>
              </div>
            </dl>
            <Alert tone="info" title="Compliance">
              <p className="tx-compliance">
                Purchases may require identity verification (KYC) depending on amount and
                jurisdiction. Auvora partners only with licensed on-ramps. You are buying digital
                assets which can lose value.
              </p>
            </Alert>
            <div className="tx-actions">
              <Button type="button" onClick={() => setScreen('confirm')}>
                Continue
              </Button>
            </div>
          </section>
        </>
      ) : null}

      {tab === 'buy' && screen === 'confirm' ? (
        <section className="tx-panel">
          <h2>Confirm purchase</h2>
          <dl className="tx-quote">
            <div className="tx-quote__row">
              <dt>You pay</dt>
              <dd>${fiatAmount} USD</dd>
            </div>
            <div className="tx-quote__row">
              <dt>You receive</dt>
              <dd>
                ≈ {cryptoEst} {asset}
              </dd>
            </div>
            <div className="tx-quote__row">
              <dt>Method</dt>
              <dd>
                {method}
                {method === 'provider' ? ` · ${provider.label}` : ''}
              </dd>
            </div>
            <div className="tx-quote__row">
              <dt>Fees</dt>
              <dd>{feeLabel}</dd>
            </div>
          </dl>
          <div className="tx-actions">
            <Button type="button" variant="ghost" onClick={() => setScreen('form')}>
              Back
            </Button>
            <Button type="button" onClick={execute}>
              Confirm payment
            </Button>
          </div>
        </section>
      ) : null}

      {tab === 'buy' && screen === 'progress' ? (
        <section className="tx-panel" aria-busy="true">
          <h2>Processing payment…</h2>
          <div
            className="tx-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Buy progress"
          >
            <div className="tx-progress__bar" style={{ width: `${progress}%` }} />
          </div>
        </section>
      ) : null}

      {tab === 'buy' && screen === 'success' ? (
        <SuccessState
          title="Purchase submitted"
          description="Funds typically arrive after provider settlement. Track in activity and portfolio."
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
