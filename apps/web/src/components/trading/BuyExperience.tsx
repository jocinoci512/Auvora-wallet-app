'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { DEMO_BUY_PROVIDERS, pushTradingActivity } from '../../lib/trading/activity';
import { CxActions, CxProgressTrack, TransactionShell } from '../transaction/TransactionShell';
import '../../app/core-experience.css';

type Screen = 'form' | 'confirm' | 'progress' | 'success' | 'history';

const ASSETS = ['BTC', 'ETH', 'SOL', 'USDC'] as const;

const STEPS = [
  { id: 'form', label: 'Details' },
  { id: 'confirm', label: 'Review' },
  { id: 'progress', label: 'Pay' },
  { id: 'success', label: 'Done' },
] as const;

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

  const stepId = tab === 'history' ? undefined : screen === 'history' ? undefined : screen;

  return (
    <TransactionShell
      title="Buy"
      subtitle="Card, bank, or third-party providers — with fee transparency and compliance messaging."
      reassure="Purchases may require identity verification depending on amount and jurisdiction."
      steps={tab === 'buy' ? [...STEPS] : undefined}
      currentStepId={stepId}
      backHref="/dashboard"
    >
      <div className="cx-tabs" role="tablist" aria-label="Buy sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'buy'}
          className={tab === 'buy' ? 'is-active' : undefined}
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
          className={tab === 'history' ? 'is-active' : undefined}
          onClick={() => setTab('history')}
        >
          History
        </button>
      </div>

      {tab === 'history' ? (
        <section className="cx-panel">
          <h2>Purchase history</h2>
          <ul className="cx-list">
            <li>
              <div>
                <strong>ETH purchase</strong>
                <p className="cx-meta">$250 card · MoonPay</p>
              </div>
              <span className="cx-meta">Yesterday</span>
            </li>
            <li>
              <div>
                <strong>BTC purchase</strong>
                <p className="cx-meta">$500 ACH · Bank</p>
              </div>
              <span className="cx-meta">Last week</span>
            </li>
          </ul>
          <Link href="/payments" className="cx-link">
            Open payments ledger
          </Link>
        </section>
      ) : null}

      {tab === 'buy' && screen === 'form' ? (
        <>
          <section className="cx-panel">
            <h2>Asset</h2>
            <div className="cx-choice-grid" role="radiogroup" aria-label="Asset">
              {ASSETS.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`cx-choice ${asset === a ? 'cx-choice--on' : ''}`}
                  aria-pressed={asset === a}
                  onClick={() => setAsset(a)}
                >
                  <strong>{a}</strong>
                </button>
              ))}
            </div>
            <label className="cx-field">
              <span>Amount (USD)</span>
              <input
                value={fiatAmount}
                onChange={(e) => setFiatAmount(e.target.value)}
                inputMode="decimal"
              />
            </label>
            <p className="cx-meta">
              Est. receive ≈ {cryptoEst} {asset}
            </p>
          </section>

          <section className="cx-panel">
            <h2>Payment method</h2>
            <div className="cx-choice-grid" role="radiogroup" aria-label="Method">
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
                  className={`cx-choice ${method === id ? 'cx-choice--on' : ''}`}
                  aria-pressed={method === id}
                  onClick={() => setMethod(id)}
                >
                  <strong>{label}</strong>
                </button>
              ))}
            </div>
            {method === 'provider' ? (
              <div className="cx-choice-grid" role="radiogroup" aria-label="Provider">
                {DEMO_BUY_PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`cx-choice ${providerId === p.id ? 'cx-choice--on' : ''}`}
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
            <div className="cx-confirm">
              <dl>
                <div>
                  <dt>Provider fee</dt>
                  <dd>{feeLabel}</dd>
                </div>
                <div>
                  <dt>Network fee</dt>
                  <dd>Included in quote</dd>
                </div>
              </dl>
            </div>
            <div className="cx-alert cx-alert--info">
              <strong>Compliance</strong>
              <p>
                Purchases may require identity verification (KYC) depending on amount and
                jurisdiction. Auvora partners only with licensed on-ramps. You are buying digital
                assets which can lose value.
              </p>
            </div>
            <CxActions onNext={() => setScreen('confirm')} />
          </section>
        </>
      ) : null}

      {tab === 'buy' && screen === 'confirm' ? (
        <section className="cx-panel">
          <h2>Confirm purchase</h2>
          <div className="cx-confirm">
            <dl>
              <div>
                <dt>You pay</dt>
                <dd>${fiatAmount} USD</dd>
              </div>
              <div>
                <dt>You receive</dt>
                <dd>
                  ≈ {cryptoEst} {asset}
                </dd>
              </div>
              <div>
                <dt>Method</dt>
                <dd>
                  {method}
                  {method === 'provider' ? ` · ${provider.label}` : ''}
                </dd>
              </div>
              <div>
                <dt>Fees</dt>
                <dd>{feeLabel}</dd>
              </div>
            </dl>
          </div>
          <CxActions
            onBack={() => setScreen('form')}
            onNext={execute}
            nextLabel="Confirm payment"
          />
        </section>
      ) : null}

      {tab === 'buy' && screen === 'progress' ? (
        <CxProgressTrack
          progress={progress}
          label="Processing payment…"
          stages={['Submitted', 'Provider', 'Settling', 'Complete']}
        />
      ) : null}

      {tab === 'buy' && screen === 'success' ? (
        <div className="cx-success">
          <div className="cx-success-burst" aria-hidden>
            ✓
          </div>
          <h2>Purchase submitted</h2>
          <p>Funds typically arrive after provider settlement. Track in activity and portfolio.</p>
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
