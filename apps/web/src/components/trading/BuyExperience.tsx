'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { DEMO_BUY_PROVIDERS, pushTradingActivity } from '../../lib/trading/activity';
import {
  ENGINE_STATUS_STAGES,
  quoteBuy,
  quoteExpired,
  type AssetQuote,
} from '../../lib/trading/quote-engine';
import { CxActions, CxProgressTrack, TransactionShell } from '../transaction/TransactionShell';
import { QuoteChecklist, QuotePanel } from './QuotePanel';
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
  const [quote, setQuote] = useState<AssetQuote | null>(null);
  const [feesOk, setFeesOk] = useState(false);
  const [detailsOk, setDetailsOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const timer = useRef<number | null>(null);

  const provider = DEMO_BUY_PROVIDERS.find((p) => p.id === providerId) ?? DEMO_BUY_PROVIDERS[0]!;

  const refreshQuote = useCallback(() => {
    const q = quoteBuy({
      asset,
      fiatUsd: Number(fiatAmount) || 0,
      method,
      providerCode: method === 'provider' ? provider.id : 'auvora-sim',
    });
    setQuote(q);
    setFeesOk(false);
    setDetailsOk(false);
    setError(null);
  }, [asset, fiatAmount, method, provider.id]);

  useEffect(() => {
    refreshQuote();
  }, [refreshQuote]);

  useEffect(
    () => () => {
      if (timer.current != null) window.clearInterval(timer.current);
    },
    [],
  );

  function execute(): void {
    if (!quote) return;
    if (quoteExpired(quote)) {
      setError('This quote expired. Refresh for an updated price.');
      refreshQuote();
      return;
    }
    if (!feesOk || !detailsOk) {
      setError('Confirm the checklist before continuing.');
      return;
    }
    if (submitting) return;
    const authorized = window.confirm(
      `Authorize preview buy of ~${quote.toAmount.toFixed(6)} ${asset} for $${fiatAmount}?\n\nNo payment is charged in preview mode.`,
    );
    if (!authorized) return;
    setSubmitting(true);
    setScreen('progress');
    setProgress(10);
    setError(null);
    if (timer.current != null) window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          if (timer.current != null) window.clearInterval(timer.current);
          timer.current = null;
          pushTradingActivity({
            kind: 'buy',
            title: `Buy ${asset} (preview)`,
            detail: `$${fiatAmount} via ${method} — simulator`,
            status: 'pending',
            amount: String(quote.toAmount),
            asset,
            href: '/buy',
          });
          setScreen('success');
          setSubmitting(false);
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
      subtitle="Fiat to crypto with every fee explained before you pay."
      reassure="Simulator until a buy provider is connected. No payment is charged in this mode."
      steps={tab === 'buy' ? [...STEPS] : undefined}
      currentStepId={stepId}
      backHref="/dashboard"
    >
      <div className="cx-alert cx-alert--info" role="status">
        Buy preview — confirming does not charge a card or create a real order until a provider is
        connected.
      </div>
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
            <div className="cx-alert cx-alert--info">
              <strong>Compliance</strong>
              <p>
                Purchases may require identity verification (KYC) depending on amount and
                jurisdiction. Auvora partners only with licensed on-ramps. You are buying digital
                assets which can lose value.
              </p>
            </div>
          </section>

          {quote ? <QuotePanel quote={quote} onRefresh={refreshQuote} /> : null}
          <CxActions
            onNext={() => setScreen('confirm')}
            nextDisabled={!quote || quoteExpired(quote)}
          />
        </>
      ) : null}

      {tab === 'buy' && screen === 'confirm' && quote ? (
        <section className="cx-panel">
          <h2>Confirm purchase</h2>
          <QuotePanel quote={quote} onRefresh={refreshQuote} />
          <QuoteChecklist
            feesChecked={feesOk}
            detailsChecked={detailsOk}
            onFees={setFeesOk}
            onDetails={setDetailsOk}
            actionLabel="buy"
          />
          {error ? (
            <div className="cx-alert cx-alert--error" role="alert">
              {error}
            </div>
          ) : null}
          <CxActions
            onBack={() => setScreen('form')}
            onNext={execute}
            nextLabel="Authenticate & pay"
            nextDisabled={quoteExpired(quote) || submitting}
          />
        </section>
      ) : null}

      {tab === 'buy' && screen === 'progress' ? (
        <CxProgressTrack
          progress={progress}
          label="Processing purchase…"
          stages={[...ENGINE_STATUS_STAGES]}
        />
      ) : null}

      {tab === 'buy' && screen === 'success' && quote ? (
        <div className="cx-success">
          <div className="cx-success-burst" aria-hidden>
            ✓
          </div>
          <h2>Preview complete</h2>
          <p>
            No payment was charged. Estimated receive {quote.toAmount.toFixed(6)} {asset} for $
            {fiatAmount}. Reference {quote.id}.
          </p>
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
