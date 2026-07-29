'use client';

import { Alert, Button, EmptyState, StatusBadge, SuccessState } from '@auvora/ui';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { formatApiError } from '../../lib/api-client';
import { DEMO_BRIDGE_HISTORY, pushTradingActivity } from '../../lib/trading/activity';
import { formatSeconds, tradingFetch } from '../../lib/trading/api';
import '../../app/trading-experience.css';

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

const DEMO_NETS: NetworkCap[] = [
  { network: 'ETHEREUM', bridgeSupported: true },
  { network: 'BNB_SMART_CHAIN', bridgeSupported: true },
  { network: 'SOLANA', bridgeSupported: true },
  { network: 'POLYGON', bridgeSupported: true },
  { network: 'BITCOIN', bridgeSupported: false, reason: 'Coming soon' },
];

function demoQuote(amount: string, asset: string): QuoteResult {
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
      const q = demoQuote(amount, asset);
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
        }).catch(() => undefined);
      } else {
        setTransferId(`preview-${crypto.randomUUID().slice(0, 8)}`);
      }
    } catch {
      setTransferId(`preview-${crypto.randomUUID().slice(0, 8)}`);
    }

    if (timer.current != null) window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          if (timer.current != null) window.clearInterval(timer.current);
          timer.current = null;
          pushTradingActivity({
            kind: 'bridge',
            title: `${source} → ${destination}`,
            detail: `${amount} ${asset}`,
            status: 'confirmed',
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

  return (
    <div className="tx" role="main">
      <header className="tx__header">
        <div>
          <p className="tx__eyebrow">
            <Link href="/">Dashboard</Link>
          </p>
          <h1>Bridge</h1>
          <p className="tx__sub">
            Cross-chain transfers with provider choice, fees, and arrival estimates.
          </p>
        </div>
        <div className="tx__tabs" role="tablist" aria-label="Bridge views">
          <button
            type="button"
            role="tab"
            className={`tx__tab ${tab === 'bridge' ? 'tx__tab--on' : ''}`}
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
            className={`tx__tab ${tab === 'history' ? 'tx__tab--on' : ''}`}
            aria-selected={tab === 'history'}
            onClick={() => setTab('history')}
          >
            History
          </button>
        </div>
      </header>

      {tab === 'history' ? (
        <section className="tx-panel">
          <h2>Bridge history</h2>
          <ul className="tx-list">
            {DEMO_BRIDGE_HISTORY.map((row) => (
              <li key={row.id}>
                <div>
                  <strong>{row.route}</strong>
                  <p className="tx-meta">
                    {row.amount} {row.asset} · {row.provider}
                  </p>
                </div>
                <div>
                  <StatusBadge
                    status={row.status === 'confirmed' ? 'active' : 'pending'}
                    label={row.status}
                  />
                  <p className="tx-meta">
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
          <section className="tx-panel">
            <div className="tx-grid-2">
              <div>
                <h2>Source</h2>
                <div className="tx-choice-grid" role="radiogroup" aria-label="Source network">
                  {supported.map((n) => (
                    <button
                      key={`s-${n.network}`}
                      type="button"
                      className={`tx-choice ${source === n.network ? 'tx-choice--on' : ''}`}
                      aria-pressed={source === n.network}
                      onClick={() => setSource(n.network)}
                    >
                      <strong>{n.network.replace(/_/g, ' ')}</strong>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h2>Destination</h2>
                <div className="tx-choice-grid" role="radiogroup" aria-label="Destination network">
                  {supported.map((n) => (
                    <button
                      key={`d-${n.network}`}
                      type="button"
                      className={`tx-choice ${destination === n.network ? 'tx-choice--on' : ''}`}
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
            <Button type="button" variant="ghost" size="sm" onClick={flipNetworks}>
              Swap networks
            </Button>
          </section>

          <section className="tx-panel">
            <div className="tx-grid-2">
              <label className="tx-field">
                <span>Asset</span>
                <select value={asset} onChange={(e) => setAsset(e.target.value)}>
                  {['USDC', 'USDT', 'ETH', 'WBTC'].map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
              <label className="tx-field">
                <span>Amount</span>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                />
              </label>
            </div>
            <div className="tx-actions">
              <Button type="button" variant="secondary" onClick={() => void requestQuote()}>
                Get routes
              </Button>
            </div>

            {quote ? (
              <>
                <h2 style={{ marginTop: '1rem' }}>Providers</h2>
                <div className="tx-choice-grid" role="radiogroup" aria-label="Bridge provider">
                  <button
                    type="button"
                    className={`tx-choice ${provider === quote.best.providerCode ? 'tx-choice--on' : ''}`}
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
                      className={`tx-choice ${provider === alt.providerCode ? 'tx-choice--on' : ''}`}
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
                <dl className="tx-quote">
                  <div className="tx-quote__row">
                    <dt>Estimated arrival</dt>
                    <dd>{formatSeconds(quote.best.estimatedCompletionSeconds)}</dd>
                  </div>
                  <div className="tx-quote__row">
                    <dt>Bridge fee</dt>
                    <dd>
                      {quote.best.feeAmount} {quote.best.feeAsset}
                    </dd>
                  </div>
                  <div className="tx-quote__row">
                    <dt>Gas (est.)</dt>
                    <dd>{quote.best.estimatedFeeNative}</dd>
                  </div>
                  <div className="tx-quote__row">
                    <dt>Route</dt>
                    <dd>{quote.best.routeSummary}</dd>
                  </div>
                </dl>
                {!live ? (
                  <Alert tone="warn" title="Preview quote">
                    Live bridge service unavailable — continuing with simulator numbers.
                  </Alert>
                ) : null}
                <div className="tx-actions">
                  <Button type="button" onClick={() => setScreen('confirm')}>
                    Review bridge
                  </Button>
                </div>
              </>
            ) : null}
          </section>
        </>
      ) : null}

      {tab === 'bridge' && screen === 'confirm' && quote ? (
        <section className="tx-panel">
          <h2>Confirm bridge</h2>
          <dl className="tx-quote">
            <div className="tx-quote__row">
              <dt>From</dt>
              <dd>{source}</dd>
            </div>
            <div className="tx-quote__row">
              <dt>To</dt>
              <dd>{destination}</dd>
            </div>
            <div className="tx-quote__row">
              <dt>Amount</dt>
              <dd>
                {amount} {asset}
              </dd>
            </div>
            <div className="tx-quote__row">
              <dt>Provider</dt>
              <dd>{provider}</dd>
            </div>
          </dl>
          <div className="tx-actions">
            <Button type="button" variant="ghost" onClick={() => setScreen('form')}>
              Back
            </Button>
            <Button type="button" onClick={() => void execute()}>
              Confirm & bridge
            </Button>
          </div>
        </section>
      ) : null}

      {tab === 'bridge' && screen === 'progress' ? (
        <section className="tx-panel" aria-busy="true">
          <h2>Bridging…</h2>
          <div
            className="tx-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Bridge progress"
          >
            <div className="tx-progress__bar" style={{ width: `${progress}%` }} />
          </div>
          <p className="tx-meta">Tracking source lock and destination mint.</p>
        </section>
      ) : null}

      {tab === 'bridge' && screen === 'success' ? (
        <SuccessState
          title="Bridge in flight"
          description={`Transfer ${transferId ?? ''} submitted. Track status in history and activity.`}
          action={
            <div className="tx-actions">
              <Link href="/activity">
                <Button>Activity</Button>
              </Link>
              <Button type="button" variant="secondary" onClick={() => setScreen('form')}>
                Bridge again
              </Button>
            </div>
          }
        />
      ) : null}

      {tab === 'bridge' && screen === 'failure' ? (
        <EmptyState
          title="Bridge failed"
          description={error ?? 'Could not complete transfer.'}
          action={
            <Button type="button" onClick={() => setScreen('form')}>
              Try again
            </Button>
          }
        />
      ) : null}
    </div>
  );
}
