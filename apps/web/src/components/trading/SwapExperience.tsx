'use client';

import { Alert, Button, EmptyState, StatusBadge, SuccessState } from '@auvora/ui';
import { ArrowDownUp } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { LineChart } from '../charts/Charts';
import { formatApiError } from '../../lib/api-client';
import { DEMO_SWAP_HISTORY, pushTradingActivity } from '../../lib/trading/activity';
import { formatSeconds, impactPct, tradingFetch } from '../../lib/trading/api';
import '../../app/trading-experience.css';

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
    setScreen('confirm');
  }

  async function execute(): Promise<void> {
    setScreen('progress');
    setProgress(10);
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
    } catch {
      setExecutionId(`preview-${crypto.randomUUID().slice(0, 8)}`);
    }

    if (timer.current != null) window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          if (timer.current != null) window.clearInterval(timer.current);
          timer.current = null;
          pushTradingActivity({
            kind: 'swap',
            title: `${sellToken} → ${buyToken}`,
            detail: `Sold ${sellAmount} ${sellToken}`,
            status: 'confirmed',
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

  return (
    <div className="tx" role="main">
      <header className="tx__header">
        <div>
          <p className="tx__eyebrow">
            <Link href="/">Dashboard</Link>
          </p>
          <h1>Swap</h1>
          <p className="tx__sub">
            Instant quotes, route clarity, and calm confirmation — built for confident trading.
          </p>
        </div>
        <div className="tx__tabs" role="tablist" aria-label="Swap views">
          <button
            type="button"
            className={`tx__tab ${tab === 'swap' ? 'tx__tab--on' : ''}`}
            role="tab"
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
            className={`tx__tab ${tab === 'history' ? 'tx__tab--on' : ''}`}
            role="tab"
            aria-selected={tab === 'history'}
            onClick={() => setTab('history')}
          >
            History
          </button>
        </div>
      </header>

      {tab === 'history' ? (
        <section className="tx-panel" aria-label="Swap history">
          <h2>Recent swaps</h2>
          {!DEMO_SWAP_HISTORY.length ? (
            <EmptyState title="No swaps yet" description="Your completed swaps will appear here." />
          ) : (
            <ul className="tx-list">
              {DEMO_SWAP_HISTORY.map((row) => (
                <li key={row.id}>
                  <div>
                    <strong>{row.pair}</strong>
                    <p className="tx-meta">
                      {row.amountIn} → {row.amountOut} · impact {row.impact}
                    </p>
                  </div>
                  <div>
                    <StatusBadge
                      status={row.status === 'confirmed' ? 'active' : 'suspended'}
                      label={row.status}
                    />
                    <p className="tx-meta">{row.when}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link href="/activity">View full activity</Link>
        </section>
      ) : null}

      {tab === 'swap' && screen === 'form' ? (
        <>
          <section className="tx-panel">
            <h2>Network</h2>
            <div className="tx-choice-grid" role="radiogroup" aria-label="Network">
              {networks.map((n) => (
                <button
                  key={n.network}
                  type="button"
                  className={`tx-choice ${network === n.network ? 'tx-choice--on' : ''}`}
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

          <section className="tx-panel">
            <div className="tx-pair">
              <div className="tx-token-box">
                <div className="tx-token-box__row">
                  <span className="tx-meta">You pay</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setPicking('sell')}
                  >
                    {sellToken}
                  </Button>
                </div>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                  aria-label="Sell amount"
                />
              </div>
              <div className="tx-pair__swap">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={flip}
                  aria-label="Flip tokens"
                >
                  <ArrowDownUp size={16} />
                </Button>
              </div>
              <div className="tx-token-box">
                <div className="tx-token-box__row">
                  <span className="tx-meta">You receive</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setPicking('buy')}
                  >
                    {buyToken}
                  </Button>
                </div>
                <strong style={{ fontSize: '1.45rem' }}>{quote?.amountOut ?? '—'}</strong>
              </div>
            </div>

            {picking ? (
              <div className="tx-adv" role="dialog" aria-modal="true" aria-label="Token selector">
                <input
                  className="tx-token-search"
                  placeholder="Search token"
                  aria-label="Search token"
                  value={tokenSearch}
                  onChange={(e) => setTokenSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setPicking(null);
                  }}
                  autoFocus
                />
                <div className="tx-choice-grid">
                  {filtered.map((a) => (
                    <button
                      key={a.symbol}
                      type="button"
                      className="tx-choice"
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
                <Button type="button" variant="ghost" onClick={() => setPicking(null)}>
                  Close
                </Button>
              </div>
            ) : null}

            {quote ? (
              <dl className="tx-quote">
                <div className="tx-quote__row">
                  <dt>Min received</dt>
                  <dd>
                    {quote.minAmountOut} {buyToken}
                  </dd>
                </div>
                <div className="tx-quote__row">
                  <dt>Price impact</dt>
                  <dd>{impactPct(quote.priceImpactBps)}</dd>
                </div>
                <div className="tx-quote__row">
                  <dt>Network fee</dt>
                  <dd>{quote.estimatedFeeNative}</dd>
                </div>
                <div className="tx-quote__row">
                  <dt>ETA</dt>
                  <dd>{formatSeconds(quote.estimatedCompletionSeconds)}</dd>
                </div>
                <div className="tx-quote__row">
                  <dt>Provider</dt>
                  <dd>{quote.providerCode}</dd>
                </div>
              </dl>
            ) : null}

            <div className="tx-route" aria-label="Route visualization">
              {(quote?.routeSummary ?? `${sellToken} → ${buyToken}`)
                .split('→')
                .map((hop, i, arr) => (
                  <span key={`${hop}-${i}`} style={{ display: 'contents' }}>
                    <span className="tx-route__hop">{hop.trim()}</span>
                    {i < arr.length - 1 ? <span className="tx-route__arrow">→</span> : null}
                  </span>
                ))}
            </div>

            <div className="tx-adv">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {showAdvanced ? 'Hide' : 'Advanced'} settings
              </Button>
              {showAdvanced ? (
                <div className="tx-grid-2" style={{ marginTop: '0.75rem' }}>
                  <label className="tx-field">
                    <span>Slippage (bps)</span>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={slippageBps}
                      onChange={(e) => setSlippageBps(Number(e.target.value) || 50)}
                    />
                  </label>
                  <label className="tx-field">
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
            </div>

            {!live && error ? (
              <Alert tone="warn" title="Using preview quote">
                Live aggregator unavailable — showing simulator quote so you can continue.
              </Alert>
            ) : null}

            <div className="tx-actions">
              <Button type="button" variant="secondary" onClick={() => void refreshQuote()}>
                Refresh quote
              </Button>
              <Button type="button" disabled={!quote} onClick={() => void confirmSwap()}>
                Review swap
              </Button>
            </div>
          </section>

          <section className="tx-panel" aria-label="Price context">
            <h2>Market context</h2>
            <LineChart data={spark} height={96} ariaLabel={`${sellToken} recent price`} />
          </section>
        </>
      ) : null}

      {tab === 'swap' && screen === 'confirm' && quote ? (
        <section className="tx-panel">
          <h2>Confirm swap</h2>
          <dl className="tx-quote">
            <div className="tx-quote__row">
              <dt>You pay</dt>
              <dd>
                {sellAmount} {sellToken}
              </dd>
            </div>
            <div className="tx-quote__row">
              <dt>You receive</dt>
              <dd>
                {quote.amountOut} {buyToken}
              </dd>
            </div>
            <div className="tx-quote__row">
              <dt>Slippage</dt>
              <dd>{impactPct(slippageBps)}</dd>
            </div>
            <div className="tx-quote__row">
              <dt>Deadline</dt>
              <dd>{deadlineMin} min</dd>
            </div>
          </dl>
          <div className="tx-actions">
            <Button type="button" variant="ghost" onClick={() => setScreen('form')}>
              Back
            </Button>
            <Button type="button" onClick={() => void execute()}>
              Confirm & swap
            </Button>
          </div>
        </section>
      ) : null}

      {tab === 'swap' && screen === 'progress' ? (
        <section className="tx-panel" aria-busy="true" aria-live="polite">
          <h2>Swapping…</h2>
          <div
            className="tx-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Swap progress"
          >
            <div className="tx-progress__bar" style={{ width: `${progress}%` }} />
          </div>
          <p className="tx-meta">Broadcasting and waiting for confirmation.</p>
        </section>
      ) : null}

      {tab === 'swap' && screen === 'success' ? (
        <SuccessState
          title="Swap submitted"
          description={`Execution ${executionId ?? 'complete'}. Portfolio and activity will refresh shortly.`}
          action={
            <div className="tx-actions">
              <Link href="/activity">
                <Button>Activity</Button>
              </Link>
              <Link href="/portfolio">
                <Button variant="secondary">Portfolio</Button>
              </Link>
              <Button type="button" variant="ghost" onClick={() => setScreen('form')}>
                Swap again
              </Button>
            </div>
          }
        />
      ) : null}

      {tab === 'swap' && screen === 'failure' ? (
        <EmptyState
          title="Swap failed"
          description={error ?? 'The trade could not complete. Try again with a fresh quote.'}
          action={
            <Button type="button" onClick={() => setScreen('form')}>
              Back to form
            </Button>
          }
        />
      ) : null}
    </div>
  );
}
