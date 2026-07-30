'use client';

import { ArrowDownUp } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { LineChart } from '../charts/Charts';
import { formatApiError } from '../../lib/api-client';
import { DEMO_SWAP_HISTORY, pushTradingActivity } from '../../lib/trading/activity';
import { formatSeconds, impactPct, tradingFetch } from '../../lib/trading/api';
import { ENGINE_STATUS_STAGES } from '../../lib/trading/quote-engine';
import {
  CxActions,
  CxProgressTrack,
  humanizeError,
  TransactionShell,
} from '../transaction/TransactionShell';
import { QuoteChecklist } from './QuotePanel';
import '../../app/core-experience.css';

type NetworkCap = { network: string; swapSupported: boolean; reason?: string };
type Asset = { symbol: string; name: string; standard: string; verified: boolean };
type Quote = {
  quoteId: string;
  providerCode: string;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  amountOut: string;
  minAmountOut: string;
  priceImpactBps: number;
  estimatedFeeNative: string;
  estimatedCompletionSeconds: number;
  routeSummary: string;
};

type Screen = 'form' | 'confirm' | 'progress' | 'success' | 'failure' | 'history';

const SWAP_STEPS = [
  { id: 'form', label: 'Quote' },
  { id: 'confirm', label: 'Review' },
  { id: 'progress', label: 'Swap' },
  { id: 'success', label: 'Done' },
];

const DEMO_NETWORKS: NetworkCap[] = [
  { network: 'ETHEREUM', swapSupported: true },
  { network: 'SOLANA', swapSupported: true },
  { network: 'BNB_SMART_CHAIN', swapSupported: true },
  { network: 'POLYGON', swapSupported: true },
];

const DEMO_ASSETS: Asset[] = [
  { symbol: 'ETH', name: 'Ether', standard: 'native', verified: true },
  { symbol: 'USDC', name: 'USD Coin', standard: 'ERC20', verified: true },
  { symbol: 'USDT', name: 'Tether', standard: 'ERC20', verified: true },
  { symbol: 'WBTC', name: 'Wrapped BTC', standard: 'ERC20', verified: true },
  { symbol: 'SOL', name: 'Solana', standard: 'native', verified: true },
];

function demoQuote(
  sellToken: string,
  buyToken: string,
  sellAmount: string,
  slippageBps: number,
): Quote {
  const amt = Number(sellAmount) || 0.1;
  const out = sellToken === 'USDC' ? (amt / 3420).toFixed(6) : (amt * 3410).toFixed(2);
  return {
    quoteId: `demo-${crypto.randomUUID().slice(0, 6)}`,
    providerCode: 'simulator',
    sellToken,
    buyToken,
    sellAmount,
    amountOut: out,
    minAmountOut: (Number(out) * (1 - slippageBps / 10_000)).toFixed(6),
    priceImpactBps: 12,
    estimatedFeeNative: '0.0014 ETH',
    estimatedCompletionSeconds: 45,
    routeSummary: `${sellToken} → ${buyToken} (univ3)`,
  };
}

export function SwapExperience(): ReactElement {
  const [tab, setTab] = useState<'swap' | 'history'>('swap');
  const [networks, setNetworks] = useState<NetworkCap[]>(DEMO_NETWORKS);
  const [assets, setAssets] = useState<Asset[]>(DEMO_ASSETS);
  const [network, setNetwork] = useState('ETHEREUM');
  const [sellToken, setSellToken] = useState('ETH');
  const [buyToken, setBuyToken] = useState('USDC');
  const [sellAmount, setSellAmount] = useState('0.1');
  const [slippageBps, setSlippageBps] = useState(50);
  const [deadlineMin, setDeadlineMin] = useState(20);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [tokenSearch, setTokenSearch] = useState('');
  const [picking, setPicking] = useState<'sell' | 'buy' | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [live, setLive] = useState(false);
  const [screen, setScreen] = useState<Screen>('form');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [feesOk, setFeesOk] = useState(false);
  const [detailsOk, setDetailsOk] = useState(false);
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
        const data = await tradingFetch<NetworkCap[]>('/api/v1/swaps/networks');
        if (!cancelled && data?.length) {
          setNetworks(data);
          setLive(true);
        }
      } catch {
        /* demo networks */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await tradingFetch<Asset[]>(`/api/v1/swaps/assets?network=${network}`);
        if (!cancelled && data?.length) setAssets(data);
      } catch {
        if (!cancelled) setAssets(DEMO_ASSETS);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [network]);

  const refreshQuote = useCallback(async () => {
    try {
      const data = await tradingFetch<Quote>('/api/v1/swaps/quote', {
        method: 'POST',
        body: JSON.stringify({ network, sellToken, buyToken, sellAmount, slippageBps }),
      });
      setQuote(data);
      setLive(true);
      setError(null);
    } catch (err) {
      setQuote(demoQuote(sellToken, buyToken, sellAmount, slippageBps));
      setLive(false);
      setError(formatApiError(err));
    }
  }, [network, sellToken, buyToken, sellAmount, slippageBps]);

  useEffect(() => {
    if (tab !== 'swap' || screen !== 'form' || picking != null) return;
    void refreshQuote();
    const id = window.setInterval(() => void refreshQuote(), 15_000);
    return () => window.clearInterval(id);
  }, [refreshQuote, tab, screen, picking]);

  const filtered = useMemo(() => {
    const q = tokenSearch.trim().toLowerCase();
    return assets.filter(
      (a) => !q || a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q),
    );
  }, [assets, tokenSearch]);

  function flip(): void {
    setSellToken(buyToken);
    setBuyToken(sellToken);
  }

  async function confirmSwap(): Promise<void> {
    if (!quote) return;
    setFeesOk(false);
    setDetailsOk(false);
    setScreen('confirm');
  }

  async function execute(): Promise<void> {
    if (!feesOk || !detailsOk) {
      setError('Confirm the checklist before continuing.');
      return;
    }
    const authorized = window.confirm(
      `Authorize ${live ? '' : 'preview '}swap of ${sellAmount} ${sellToken} → ${buyToken}?\n\n${live ? 'This may broadcast a transaction.' : 'Nothing is swapped on-chain in preview mode.'}`,
    );
    if (!authorized) return;
    setScreen('progress');
    setProgress(10);
    let failedMessage: string | null = null;
    try {
      if (live && quote) {
        await tradingFetch('/api/v1/swaps/prepare', {
          method: 'POST',
          body: JSON.stringify({
            network,
            sellToken,
            buyToken,
            sellAmount,
            slippageBps,
            quoteId: quote.quoteId,
            userAddress: '0x1111111111111111111111111111111111111111',
          }),
        });
        const exec = await tradingFetch<{ executionId: string }>('/api/v1/swaps/execute', {
          method: 'POST',
          body: JSON.stringify({ quoteId: quote.quoteId }),
        });
        setExecutionId(exec.executionId);
      } else {
        setExecutionId(`preview-${crypto.randomUUID().slice(0, 8)}`);
      }
    } catch (err) {
      failedMessage =
        err instanceof Error ? err.message : 'The trade could not complete. Try a fresh quote.';
      setError(failedMessage);
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
            kind: 'swap',
            title: live ? `${sellToken} → ${buyToken}` : `${sellToken} → ${buyToken} (preview)`,
            detail: live
              ? `Sold ${sellAmount} ${sellToken}`
              : `Preview sold ${sellAmount} ${sellToken}`,
            status: live ? 'confirmed' : 'pending',
            amount: sellAmount,
            asset: sellToken,
            href: '/swap',
          });
          setScreen('success');
          return 100;
        }
        return p + 18;
      });
    }, 260);
  }

  const spark = useMemo(
    () =>
      [0, 1, 2, 3, 4, 5, 6].map((i) => ({
        t: String(i),
        v: 3400 + i * 8 + (i % 2 === 0 ? 12 : -6),
      })),
    [],
  );

  const multiStep = tab === 'swap' && screen !== 'form' && screen !== 'history';
  const stepId = screen === 'failure' ? 'form' : screen === 'history' ? 'form' : (screen as string);

  return (
    <TransactionShell
      title="Swap"
      subtitle="Instant quotes, route clarity, and calm confirmation — built for confident trading."
      reassure="Quotes refresh automatically. Preview mode never broadcasts; live mode waits for your confirm."
      steps={multiStep ? SWAP_STEPS : undefined}
      currentStepId={multiStep ? stepId : undefined}
      backHref="/"
      backLabel="Dashboard"
    >
      {!live ? (
        <div className="cx-alert cx-alert--info" role="status">
          Swap preview — confirming does not execute an on-chain trade until the swap service is
          connected.
        </div>
      ) : null}
      <div className="cx-tabs" role="tablist" aria-label="Swap views">
        <button
          type="button"
          role="tab"
          className={tab === 'swap' ? 'is-active' : undefined}
          aria-selected={tab === 'swap'}
          onClick={() => {
            setTab('swap');
            setScreen('form');
          }}
        >
          Swap
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
        <section className="cx-panel" aria-label="Swap history">
          <h2>Recent swaps</h2>
          <p>Your completed swaps appear here.</p>
          {!DEMO_SWAP_HISTORY.length ? (
            <p className="cx-meta">No swaps yet.</p>
          ) : (
            <ul className="cx-list">
              {DEMO_SWAP_HISTORY.map((row) => (
                <li key={row.id}>
                  <div>
                    <strong>{row.pair}</strong>
                    <p className="cx-meta" style={{ margin: '0.25rem 0 0' }}>
                      {row.amountIn} → {row.amountOut} · impact {row.impact}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="cx-chip" style={{ pointerEvents: 'none' }}>
                      {row.status}
                    </span>
                    <p className="cx-meta" style={{ margin: '0.25rem 0 0' }}>
                      {row.when}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link href="/activity" className="cx-link">
            View full activity
          </Link>
        </section>
      ) : null}

      {tab === 'swap' && screen === 'form' ? (
        <>
          <section className="cx-panel">
            <h2>Network</h2>
            <p>Choose where the swap will execute.</p>
            <div className="cx-choice-grid" role="radiogroup" aria-label="Network">
              {networks.map((n) => (
                <button
                  key={n.network}
                  type="button"
                  className={`cx-choice ${network === n.network ? 'cx-choice--on' : ''}`}
                  aria-pressed={network === n.network}
                  disabled={n.swapSupported === false}
                  onClick={() => setNetwork(n.network)}
                >
                  <strong>{n.network.replace(/_/g, ' ')}</strong>
                  <span>{n.swapSupported ? 'Supported' : (n.reason ?? 'Unavailable')}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="cx-panel">
            <h2>Tokens</h2>
            <p>Set what you pay and what you receive.</p>

            <div className="cx-field-row">
              <label className="cx-field cx-field--grow">
                <span>You pay</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                  aria-label="Sell amount"
                />
              </label>
              <button
                type="button"
                className="cx-btn cx-btn--ghost"
                onClick={() => setPicking('sell')}
              >
                {sellToken}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', margin: '0.25rem 0 0.75rem' }}>
              <button
                type="button"
                className="cx-btn cx-btn--ghost"
                onClick={flip}
                aria-label="Flip tokens"
                style={{ minHeight: 40, padding: '0 0.85rem' }}
              >
                <ArrowDownUp size={16} />
              </button>
            </div>

            <div className="cx-field-row">
              <div className="cx-field cx-field--grow">
                <span>You receive</span>
                <strong
                  style={{
                    fontSize: '1.45rem',
                    minHeight: 48,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {quote?.amountOut ?? '—'}
                </strong>
              </div>
              <button
                type="button"
                className="cx-btn cx-btn--ghost"
                onClick={() => setPicking('buy')}
              >
                {buyToken}
              </button>
            </div>

            {picking ? (
              <div role="dialog" aria-modal="true" aria-label="Token selector">
                <label className="cx-field">
                  <span>Search token</span>
                  <input
                    placeholder="Search token"
                    aria-label="Search token"
                    value={tokenSearch}
                    onChange={(e) => setTokenSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setPicking(null);
                    }}
                    autoFocus
                  />
                </label>
                <div className="cx-choice-grid">
                  {filtered.map((a) => (
                    <button
                      key={a.symbol}
                      type="button"
                      className="cx-choice"
                      onClick={() => {
                        if (picking === 'sell') setSellToken(a.symbol);
                        else setBuyToken(a.symbol);
                        setPicking(null);
                        setTokenSearch('');
                      }}
                    >
                      <strong>{a.symbol}</strong>
                      <span>
                        {a.name}
                        {a.verified ? ' · verified' : ''}
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="cx-btn cx-btn--ghost"
                  onClick={() => setPicking(null)}
                >
                  Close
                </button>
              </div>
            ) : null}

            {quote ? (
              <div className="cx-confirm">
                <dl>
                  <div>
                    <dt>Min received</dt>
                    <dd>
                      {quote.minAmountOut} {buyToken}
                    </dd>
                  </div>
                  <div>
                    <dt>Price impact</dt>
                    <dd>{impactPct(quote.priceImpactBps)}</dd>
                  </div>
                  <div>
                    <dt>Network fee</dt>
                    <dd>{quote.estimatedFeeNative}</dd>
                  </div>
                  <div>
                    <dt>ETA</dt>
                    <dd>{formatSeconds(quote.estimatedCompletionSeconds)}</dd>
                  </div>
                  <div>
                    <dt>Provider</dt>
                    <dd>{quote.providerCode}</dd>
                  </div>
                </dl>
              </div>
            ) : null}

            <div className="cx-chips" aria-label="Route visualization">
              {(quote?.routeSummary ?? `${sellToken} → ${buyToken}`)
                .split('→')
                .map((hop, i, arr) => (
                  <span key={`${hop}-${i}`} style={{ display: 'contents' }}>
                    <span className="cx-chip" style={{ pointerEvents: 'none' }}>
                      {hop.trim()}
                    </span>
                    {i < arr.length - 1 ? (
                      <span className="cx-meta" style={{ margin: 0, alignSelf: 'center' }}>
                        →
                      </span>
                    ) : null}
                  </span>
                ))}
            </div>

            <button
              type="button"
              className="cx-btn cx-btn--ghost"
              style={{ minHeight: 40, marginBottom: '0.75rem' }}
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? 'Hide' : 'Advanced'} settings
            </button>
            {showAdvanced ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <label className="cx-field">
                  <span>Slippage (bps)</span>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={slippageBps}
                    onChange={(e) => setSlippageBps(Number(e.target.value) || 50)}
                  />
                </label>
                <label className="cx-field">
                  <span>Deadline (minutes)</span>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={deadlineMin}
                    onChange={(e) => setDeadlineMin(Number(e.target.value) || 20)}
                  />
                </label>
              </div>
            ) : null}

            {!live && error ? (
              <div className="cx-warn">
                <strong>Using preview quote</strong>
                <p>
                  Live aggregator unavailable — showing simulator quote so you can continue.{' '}
                  {humanizeError(error, 'Preview mode is active.')}
                </p>
              </div>
            ) : null}

            <CxActions
              onBack={() => void refreshQuote()}
              backLabel="Refresh quote"
              onNext={() => void confirmSwap()}
              nextLabel="Review swap"
              nextDisabled={!quote}
            />
          </section>

          <section className="cx-panel" aria-label="Price context">
            <h2>Market context</h2>
            <p>Recent price movement for orientation.</p>
            <LineChart data={spark} height={96} ariaLabel={`${sellToken} recent price`} />
          </section>
        </>
      ) : null}

      {tab === 'swap' && screen === 'confirm' && quote ? (
        <section className="cx-panel">
          <h2>Confirm swap</h2>
          <p>Review every detail before broadcasting.</p>
          <div className="cx-confirm">
            <dl>
              <div>
                <dt>You pay</dt>
                <dd>
                  {sellAmount} {sellToken}
                </dd>
              </div>
              <div>
                <dt>You receive</dt>
                <dd>
                  {quote.amountOut} {buyToken}
                </dd>
              </div>
              <div>
                <dt>Minimum received</dt>
                <dd>
                  {quote.minAmountOut} {buyToken}
                </dd>
              </div>
              <div>
                <dt>Network fee</dt>
                <dd>{quote.estimatedFeeNative}</dd>
              </div>
              <div>
                <dt>Slippage</dt>
                <dd>{impactPct(slippageBps)}</dd>
              </div>
              <div>
                <dt>Deadline</dt>
                <dd>{deadlineMin} min</dd>
              </div>
            </dl>
          </div>
          <QuoteChecklist
            feesChecked={feesOk}
            detailsChecked={detailsOk}
            onFees={setFeesOk}
            onDetails={setDetailsOk}
            actionLabel="swap"
          />
          {error ? (
            <div className="cx-alert cx-alert--error" role="alert">
              {humanizeError(error, 'Confirm the checklist before continuing.')}
            </div>
          ) : null}
          <CxActions
            onBack={() => setScreen('form')}
            onNext={() => void execute()}
            nextLabel="Confirm preview swap"
          />
        </section>
      ) : null}

      {tab === 'swap' && screen === 'progress' ? (
        <CxProgressTrack
          progress={progress}
          label={live ? 'Swapping…' : 'Running swap preview…'}
          stages={[...ENGINE_STATUS_STAGES]}
        />
      ) : null}

      {tab === 'swap' && screen === 'success' ? (
        <div className="cx-success">
          <div className="cx-success-burst" aria-hidden>
            ✓
          </div>
          <h2>{live ? 'Quote path complete (preview broadcast)' : 'Preview complete'}</h2>
          <p>
            {live
              ? `Execution ${executionId ?? 'complete'}. Portfolio and activity will refresh shortly.`
              : `Nothing was swapped on-chain. Reference ${executionId ?? 'preview'} is for UI testing only.`}
          </p>
          <div className="cx-success__cta">
            <Link href="/activity" className="cx-btn cx-btn--primary">
              Activity
            </Link>
            <Link href="/portfolio" className="cx-btn cx-btn--ghost">
              Portfolio
            </Link>
            <button
              type="button"
              className="cx-btn cx-btn--ghost"
              onClick={() => setScreen('form')}
            >
              {live ? 'Swap again' : 'Start again'}
            </button>
          </div>
        </div>
      ) : null}

      {tab === 'swap' && screen === 'failure' ? (
        <section className="cx-panel">
          <h2>Swap failed</h2>
          <div className="cx-alert cx-alert--error">
            {humanizeError(error, 'The trade could not complete. Try again with a fresh quote.')}
          </div>
          <CxActions onNext={() => setScreen('form')} nextLabel="Back to form" />
        </section>
      ) : null}
    </TransactionShell>
  );
}
