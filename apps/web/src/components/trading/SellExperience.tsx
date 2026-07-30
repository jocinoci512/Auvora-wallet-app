'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { pushTradingActivity } from '../../lib/trading/activity';
import {
  ENGINE_STATUS_STAGES,
  quoteExpired,
  quoteSell,
  type AssetQuote,
} from '../../lib/trading/quote-engine';
import { CxActions, CxProgressTrack, TransactionShell } from '../transaction/TransactionShell';
import { QuoteChecklist, QuotePanel } from './QuotePanel';
import '../../app/core-experience.css';

type Screen = 'form' | 'confirm' | 'progress' | 'success' | 'history';

const ASSETS = [
  { id: 'BTC', balance: '0.42' },
  { id: 'ETH', balance: '8.15' },
  { id: 'SOL', balance: '126' },
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
  const [quote, setQuote] = useState<AssetQuote | null>(null);
  const [feesOk, setFeesOk] = useState(false);
  const [detailsOk, setDetailsOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const timer = useRef<number | null>(null);

  const asset = ASSETS.find((a) => a.id === assetId) ?? ASSETS[1]!;

  const refreshQuote = useCallback(() => {
    const q = quoteSell({
      asset: assetId,
      cryptoAmount: Number(amount) || 0,
      destination,
    });
    setQuote(q);
    setFeesOk(false);
    setDetailsOk(false);
    setError(null);
  }, [assetId, amount, destination]);

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
      `Authorize preview sell of ${amount} ${asset.id} for ≈ $${quote.toAmount.toFixed(2)}?\n\nNo funds move in preview mode.`,
    );
    if (!authorized) return;
    setSubmitting(true);
    setScreen('progress');
    setProgress(12);
    setError(null);
    if (timer.current != null) window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          if (timer.current != null) window.clearInterval(timer.current);
          timer.current = null;
          pushTradingActivity({
            kind: 'sell',
            title: `Sell ${asset.id} (preview)`,
            detail: `$${quote.toAmount.toFixed(2)} → ${destination} — simulator`,
            status: 'pending',
            amount,
            asset: asset.id,
            href: '/sell',
          });
          setScreen('success');
          setSubmitting(false);
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
      subtitle="Crypto to cash with payout, fees, and settlement time before you confirm."
      reassure="Simulator until an off-ramp is connected. No sale settles in this mode."
      steps={tab === 'sell' ? [...STEPS] : undefined}
      currentStepId={stepId}
      backHref="/dashboard"
    >
      <div className="cx-alert cx-alert--info" role="status">
        Sell preview — confirming does not move funds or settle fiat until an off-ramp is connected.
      </div>
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
            <div className="cx-warn">
              <strong>Irreversible once settled</strong>
              <p>
                Double-check destination details. Off-ramp partners may require KYC for larger
                amounts.
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

      {tab === 'sell' && screen === 'confirm' && quote ? (
        <section className="cx-panel">
          <h2>Confirm sale</h2>
          <QuotePanel quote={quote} onRefresh={refreshQuote} />
          <QuoteChecklist
            feesChecked={feesOk}
            detailsChecked={detailsOk}
            onFees={setFeesOk}
            onDetails={setDetailsOk}
            actionLabel="sell"
          />
          {error ? (
            <div className="cx-alert cx-alert--error" role="alert">
              {error}
            </div>
          ) : null}
          <CxActions
            onBack={() => setScreen('form')}
            onNext={execute}
            nextLabel="Authenticate & sell"
            nextDisabled={quoteExpired(quote) || submitting}
          />
        </section>
      ) : null}

      {tab === 'sell' && screen === 'progress' ? (
        <CxProgressTrack
          progress={progress}
          label="Processing sale…"
          stages={[...ENGINE_STATUS_STAGES]}
        />
      ) : null}

      {tab === 'sell' && screen === 'success' && quote ? (
        <div className="cx-success">
          <div className="cx-success-burst" aria-hidden>
            ✓
          </div>
          <h2>Preview complete</h2>
          <p>
            No sale was submitted. Estimated receive ≈ ${quote.toAmount.toFixed(2)}. Reference{' '}
            {quote.id}.
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
