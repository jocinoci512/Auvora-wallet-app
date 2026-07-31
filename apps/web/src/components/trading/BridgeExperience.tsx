'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { formatApiError } from '../../lib/api-client';
import { DEMO_BRIDGE_HISTORY, pushTradingActivity } from '../../lib/trading/activity';
import { formatSeconds, tradingFetch } from '../../lib/trading/api';
import {
  ENGINE_STATUS_STAGES,
  arrivalLabel,
  quoteBridge,
  totalFeesUsd,
} from '../../lib/trading/quote-engine';
import {
  CxActions,
  CxProgressTrack,
  humanizeError,
  TransactionShell,
} from '../transaction/TransactionShell';
import { QuoteChecklist } from './QuotePanel';
import '../../app/core-experience.css';

type NetworkCap = { network: string; bridgeSupported: boolean; reason?: string };
type QuoteResult = {
  quoteId: string;
  best: {
    providerCode: string;
    amountOut: string;
    feeAmount: string;
    feeAsset: string;
    estimatedFeeNative: string;
    estimatedCompletionSeconds: number;
    routeSummary: string;
  };
  alternatives?: Array<{ providerCode: string; amountOut: string; feeAmount: string }>;
};

type Screen = 'form' | 'confirm' | 'progress' | 'success' | 'failure';

const BRIDGE_STEPS = [
  { id: 'form', label: 'Route' },
  { id: 'confirm', label: 'Review' },
  { id: 'progress', label: 'Bridge' },
  { id: 'success', label: 'Done' },
];

const DEMO_NETS: NetworkCap[] = [
  { network: 'ETHEREUM', bridgeSupported: true },
  { network: 'BNB_SMART_CHAIN', bridgeSupported: true },
  { network: 'SOLANA', bridgeSupported: true },
  { network: 'POLYGON', bridgeSupported: true },
  { network: 'BITCOIN', bridgeSupported: false, reason: 'Coming soon' },
];

function demoQuote(
  amount: string,
  asset: string,
  source: string,
  destination: string,
): QuoteResult {
  try {
    const shared = quoteBridge({
      asset,
      fromNetwork: source,
      toNetwork: destination,
      amount: Number(amount) || 0,
    });
    return {
      quoteId: shared.id,
      best: {
        providerCode: shared.provider,
        amountOut: String(shared.toAmount),
        feeAmount: String(totalFeesUsd(shared).toFixed(2)),
        feeAsset: 'USD',
        estimatedFeeNative: arrivalLabel(shared.estimatedSeconds),
        estimatedCompletionSeconds: shared.estimatedSeconds,
        routeSummary: shared.routeSummary ?? `${source} → ${destination}`,
      },
      alternatives: [
        { providerCode: 'layerzero-style', amountOut: amount, feeAmount: '1.40' },
        { providerCode: 'wormhole-style', amountOut: amount, feeAmount: '1.55' },
      ],
    };
  } catch {
    return {
      quoteId: `bq-${crypto.randomUUID().slice(0, 6)}`,
      best: {
        providerCode: 'simulator-bridge',
        amountOut: amount,
        feeAmount: '1.25',
        feeAsset: asset,
        estimatedFeeNative: '0.002 ETH',
        estimatedCompletionSeconds: 480,
        routeSummary: 'Lock → message → mint',
      },
      alternatives: [
        { providerCode: 'layerzero-style', amountOut: amount, feeAmount: '1.40' },
        { providerCode: 'wormhole-style', amountOut: amount, feeAmount: '1.55' },
      ],
    };
  }
}

export function BridgeExperience(): ReactElement {
  const [tab, setTab] = useState<'bridge' | 'history'>('bridge');
  const [networks, setNetworks] = useState(DEMO_NETS);
  const [source, setSource] = useState('ETHEREUM');
  const [destination, setDestination] = useState('SOLANA');
  const [asset, setAsset] = useState('USDC');
  const [amount, setAmount] = useState('100');
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>('form');
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [transferId, setTransferId] = useState<string | null>(null);
  const [feesOk, setFeesOk] = useState(false);
  const [detailsOk, setDetailsOk] = useState(false);
  const [irreversibleOk, setIrreversibleOk] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current != null) window.clearInterval(timer.current);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const n = await tradingFetch<NetworkCap[]>('/api/v1/bridge/networks');
        if (!cancelled && n?.length) {
          setNetworks(n);
          setLive(true);
        }
      } catch (err) {
        if (!cancelled) setError(formatApiError(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function requestQuote(): Promise<void> {
    try {
      const data = await tradingFetch<QuoteResult>('/api/v1/bridge/quote', {
        method: 'POST',
        body: JSON.stringify({
          sourceNetwork: source,
          destinationNetwork: destination,
          assetSymbol: asset,
          amount,
        }),
      });
      setQuote(data);
      setProvider(data.best.providerCode);
      setLive(true);
      setError(null);
    } catch (err) {
      const q = demoQuote(amount, asset, source, destination);
      setQuote(q);
      setProvider(q.best.providerCode);
      setLive(false);
      setError(formatApiError(err));
    }
  }

  function flipNetworks(): void {
    setSource(destination);
    setDestination(source);
  }

  async function execute(): Promise<void> {
    if (!feesOk || !detailsOk || !irreversibleOk) {
      setError('Confirm the checklist before continuing.');
      return;
    }
    const authorized = window.confirm(
      `Authorize ${live ? '' : 'preview '}bridge of ${amount} ${asset} from ${source} to ${destination}?\n\nBridges usually cannot be cancelled once started.`,
    );
    if (!authorized) return;
    setScreen('progress');
    setProgress(8);
    try {
      if (live && quote) {
        const prepared = await tradingFetch<{ transferId?: string }>('/api/v1/bridge/prepare', {
          method: 'POST',
          body: JSON.stringify({
            quoteId: quote.quoteId,
            sourceNetwork: source,
            destinationNetwork: destination,
            assetSymbol: asset,
            amount,
          }),
        });
        setTransferId(prepared.transferId ?? `br-${crypto.randomUUID().slice(0, 8)}`);
        await tradingFetch('/api/v1/bridge/confirm', {
          method: 'POST',
          body: JSON.stringify({ transferId: prepared.transferId, quoteId: quote.quoteId }),
        });
      } else {
        setTransferId(`preview-${crypto.randomUUID().slice(0, 8)}`);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not complete transfer. Your funds stay on the source chain until confirmed.',
      );
      setScreen('failure');
      return;
    }

    if (timer.current != null) window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          if (timer.current != null) window.clearInterval(timer.current);
          timer.current = null;
          pushTradingActivity({
            kind: 'bridge',
            title: live ? `${source} → ${destination}` : `${source} → ${destination} (preview)`,
            detail: live ? `${amount} ${asset}` : `${amount} ${asset} — simulator`,
            status: live ? 'confirmed' : 'pending',
            amount,
            asset,
            href: '/bridge',
          });
          setScreen('success');
          return 100;
        }
        return p + 12;
      });
    }, 320);
  }

  const supported = networks.filter((n) => n.bridgeSupported !== false);
  const multiStep = tab === 'bridge' && screen !== 'form';
  const stepId = screen === 'failure' ? 'form' : screen;

  return (
    <TransactionShell
      title="Bridge"
      subtitle="Cross-chain transfers with provider choice, fees, and arrival estimates."
      reassure="We compare routes and fees first. Preview mode never leaves the source chain."
      steps={multiStep ? BRIDGE_STEPS : undefined}
      currentStepId={multiStep ? stepId : undefined}
      backHref="/"
      backLabel="Dashboard"
    >
      {!live ? (
        <div className="cx-alert cx-alert--info" role="status">
          Bridge preview — confirming does not lock or mint assets until the bridge service is
          connected.
        </div>
      ) : null}
      <div className="cx-tabs" role="tablist" aria-label="Bridge views">
        <button
          type="button"
          role="tab"
          className={tab === 'bridge' ? 'is-active' : undefined}
          aria-selected={tab === 'bridge'}
          onClick={() => {
            setTab('bridge');
            setScreen('form');
          }}
        >
          Bridge
        </button>
        <button
          type="button"
          role="tab"
          className={tab === 'history' ? 'is-active' : undefined}
          aria-selected={tab === 'history'}
          onClick={() => setTab('history')}
        >
          History
        </button>
      </div>

      {tab === 'history' ? (
        <section className="cx-panel">
          <h2>Bridge history</h2>
          <p>Recent cross-chain transfers.</p>
          <ul className="cx-list">
            {DEMO_BRIDGE_HISTORY.map((row) => (
              <li key={row.id}>
                <div>
                  <strong>{row.route}</strong>
                  <p className="cx-meta" style={{ margin: '0.25rem 0 0' }}>
                    {row.amount} {row.asset} · {row.provider}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="cx-chip" style={{ pointerEvents: 'none' }}>
                    {row.status}
                  </span>
                  <p className="cx-meta" style={{ margin: '0.25rem 0 0' }}>
                    {row.eta} · {row.when}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === 'bridge' && screen === 'form' ? (
        <>
          <section className="cx-panel">
            <h2>Networks</h2>
            <p>Pick source and destination chains.</p>
            <div style={{ display: 'grid', gap: '1.25rem' }}>
              <div>
                <h3
                  style={{ fontSize: '0.8125rem', color: 'var(--cx-muted)', margin: '0 0 0.5rem' }}
                >
                  Source
                </h3>
                <div className="cx-choice-grid" role="radiogroup" aria-label="Source network">
                  {supported.map((n) => (
                    <button
                      key={`s-${n.network}`}
                      type="button"
                      className={`cx-choice ${source === n.network ? 'cx-choice--on' : ''}`}
                      aria-pressed={source === n.network}
                      onClick={() => setSource(n.network)}
                    >
                      <strong>{n.network.replace(/_/g, ' ')}</strong>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h3
                  style={{ fontSize: '0.8125rem', color: 'var(--cx-muted)', margin: '0 0 0.5rem' }}
                >
                  Destination
                </h3>
                <div className="cx-choice-grid" role="radiogroup" aria-label="Destination network">
                  {supported.map((n) => (
                    <button
                      key={`d-${n.network}`}
                      type="button"
                      className={`cx-choice ${destination === n.network ? 'cx-choice--on' : ''}`}
                      aria-pressed={destination === n.network}
                      disabled={n.network === source}
                      onClick={() => setDestination(n.network)}
                    >
                      <strong>{n.network.replace(/_/g, ' ')}</strong>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="cx-btn cx-btn--ghost"
              style={{ minHeight: 40, marginTop: '0.5rem' }}
              onClick={flipNetworks}
            >
              Swap networks
            </button>
          </section>

          <section className="cx-panel">
            <h2>Amount</h2>
            <p>Asset and size for the transfer.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <label className="cx-field">
                <span>Asset</span>
                <select value={asset} onChange={(e) => setAsset(e.target.value)}>
                  {['USDC', 'USDT', 'ETH', 'WBTC'].map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
              <label className="cx-field">
                <span>Amount</span>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                />
              </label>
            </div>
            <CxActions onNext={() => void requestQuote()} nextLabel="Get routes" />

            {quote ? (
              <>
                <h2 style={{ marginTop: '1.5rem' }}>Providers</h2>
                <p>Compare out amount and fees.</p>
                <div className="cx-choice-grid" role="radiogroup" aria-label="Bridge provider">
                  <button
                    type="button"
                    className={`cx-choice ${provider === quote.best.providerCode ? 'cx-choice--on' : ''}`}
                    aria-pressed={provider === quote.best.providerCode}
                    onClick={() => setProvider(quote.best.providerCode)}
                  >
                    <strong>{quote.best.providerCode}</strong>
                    <span>
                      Out {quote.best.amountOut} · fee {quote.best.feeAmount} {quote.best.feeAsset}
                    </span>
                  </button>
                  {(quote.alternatives ?? []).map((alt) => (
                    <button
                      key={alt.providerCode}
                      type="button"
                      className={`cx-choice ${provider === alt.providerCode ? 'cx-choice--on' : ''}`}
                      aria-pressed={provider === alt.providerCode}
                      onClick={() => setProvider(alt.providerCode)}
                    >
                      <strong>{alt.providerCode}</strong>
                      <span>
                        Out {alt.amountOut} · fee {alt.feeAmount}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="cx-confirm">
                  <dl>
                    <div>
                      <dt>Estimated arrival</dt>
                      <dd>{formatSeconds(quote.best.estimatedCompletionSeconds)}</dd>
                    </div>
                    <div>
                      <dt>Bridge fee</dt>
                      <dd>
                        {quote.best.feeAmount} {quote.best.feeAsset}
                      </dd>
                    </div>
                    <div>
                      <dt>Gas (est.)</dt>
                      <dd>{quote.best.estimatedFeeNative}</dd>
                    </div>
                    <div>
                      <dt>Route</dt>
                      <dd>{quote.best.routeSummary}</dd>
                    </div>
                  </dl>
                </div>
                {!live ? (
                  <div className="cx-warn">
                    <strong>Preview quote</strong>
                    <p>
                      Live bridge service unavailable — continuing with simulator numbers.{' '}
                      {humanizeError(error, 'Preview mode is active.')}
                    </p>
                  </div>
                ) : null}
                {error && live ? (
                  <div className="cx-alert cx-alert--error">
                    {humanizeError(error, 'Something went wrong fetching routes.')}
                  </div>
                ) : null}
                <CxActions
                  onNext={() => {
                    setFeesOk(false);
                    setDetailsOk(false);
                    setIrreversibleOk(false);
                    setError(null);
                    setScreen('confirm');
                  }}
                  nextLabel="Review bridge"
                />
              </>
            ) : null}

            {error && !quote ? (
              <div className="cx-alert cx-alert--error" style={{ marginTop: '1rem' }}>
                {humanizeError(error, 'Could not load bridge networks or routes.')}
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      {tab === 'bridge' && screen === 'confirm' && quote ? (
        <section className="cx-panel">
          <h2>Confirm bridge</h2>
          <p>Confirm every detail. Source lock cannot be undone.</p>
          <div className="cx-confirm">
            <dl>
              <div>
                <dt>From</dt>
                <dd>{source}</dd>
              </div>
              <div>
                <dt>To</dt>
                <dd>{destination}</dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd>
                  {amount} {asset}
                </dd>
              </div>
              <div>
                <dt>Provider</dt>
                <dd>{provider}</dd>
              </div>
            </dl>
          </div>
          <QuoteChecklist
            feesChecked={feesOk}
            detailsChecked={detailsOk}
            onFees={setFeesOk}
            onDetails={setDetailsOk}
            actionLabel="bridge"
          />
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 10 }}>
            <input
              type="checkbox"
              checked={irreversibleOk}
              onChange={(e) => setIrreversibleOk(e.target.checked)}
              style={{ width: 20, height: 20, marginTop: 2 }}
            />
            <span>I understand bridging usually can’t be cancelled once started</span>
          </label>
          {error ? (
            <div className="cx-alert cx-alert--error" role="alert">
              {humanizeError(error, 'Confirm the checklist before continuing.')}
            </div>
          ) : null}
          <CxActions
            onBack={() => setScreen('form')}
            onNext={() => void execute()}
            nextLabel="Authorize bridge"
          />
        </section>
      ) : null}

      {tab === 'bridge' && screen === 'progress' ? (
        <CxProgressTrack
          progress={progress}
          label={live ? 'Bridging…' : 'Running bridge preview…'}
          stages={[...ENGINE_STATUS_STAGES]}
        />
      ) : null}

      {tab === 'bridge' && screen === 'success' ? (
        <div className="cx-success">
          <div className="cx-success-burst" aria-hidden>
            ✓
          </div>
          <h2>{live ? 'Bridge in flight' : 'Preview complete'}</h2>
          <p>
            {live
              ? `Transfer ${transferId ?? ''} submitted. Track status in history and activity.`
              : `Nothing left the source chain. Reference ${transferId ?? 'preview'} is for UI testing only.`}
          </p>
          <div className="cx-success__cta">
            <Link href="/activity" className="cx-btn cx-btn--primary">
              Activity
            </Link>
            <button
              type="button"
              className="cx-btn cx-btn--ghost"
              onClick={() => setScreen('form')}
            >
              {live ? 'Bridge again' : 'Start again'}
            </button>
          </div>
        </div>
      ) : null}

      {tab === 'bridge' && screen === 'failure' ? (
        <section className="cx-panel">
          <h2>Bridge failed</h2>
          <div className="cx-alert cx-alert--error">
            {humanizeError(error, 'Could not complete transfer.')}
          </div>
          <CxActions onNext={() => setScreen('form')} nextLabel="Try again" />
        </section>
      ) : null}
    </TransactionShell>
  );
}
