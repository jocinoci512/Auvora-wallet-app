'use client';

import { Alert, Button, SuccessState } from '@auvora/ui';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { LineChart } from '../charts/Charts';
import { formatApiError } from '../../lib/api-client';
import {
  DEMO_REWARD_SERIES,
  DEMO_VALIDATORS,
  pushTradingActivity,
} from '../../lib/trading/activity';
import { tradingFetch } from '../../lib/trading/api';
import '../../app/trading-experience.css';

type Screen =
  'dashboard' | 'stake' | 'unstake' | 'claim' | 'confirm' | 'progress' | 'success' | 'history';

type Position = {
  id: string;
  validatorName: string;
  network: string;
  amount: string;
  apy: number;
  rewards: string;
};

const DEMO_POSITIONS: Position[] = [
  {
    id: 'p1',
    validatorName: 'Auvora Cloud',
    network: 'ethereum',
    amount: '2.40',
    apy: 4.12,
    rewards: '0.018',
  },
  {
    id: 'p2',
    validatorName: 'Sol Beacon',
    network: 'solana',
    amount: '85',
    apy: 6.4,
    rewards: '1.12',
  },
];

export function StakingExperience(): ReactElement {
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [positions, setPositions] = useState<Position[]>(DEMO_POSITIONS);
  const [validators] = useState(DEMO_VALIDATORS);
  const [selectedValidator, setSelectedValidator] = useState(DEMO_VALIDATORS[0]!.id);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(
    DEMO_POSITIONS[0]?.id ?? null,
  );
  const [amount, setAmount] = useState('1.0');
  const [action, setAction] = useState<'stake' | 'unstake' | 'claim'>('stake');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [live, setLive] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await tradingFetch<Position[]>('/api/v1/staking/positions');
        if (cancelled) return;
        if (Array.isArray(data) && data.length) {
          setPositions(
            data.map((p, i) => ({
              id: String((p as { id?: string }).id ?? `live-${i}`),
              validatorName: String((p as { validatorName?: string }).validatorName ?? 'Validator'),
              network: String((p as { network?: string }).network ?? 'ethereum'),
              amount: String((p as { amount?: string }).amount ?? '0'),
              apy: Number((p as { apy?: number }).apy ?? 4),
              rewards: String((p as { rewards?: string }).rewards ?? '0'),
            })),
          );
          setLive(true);
        }
      } catch (err) {
        if (!cancelled) setError(formatApiError(err));
      }
    })();
    return () => {
      cancelled = true;
      if (timer.current != null) window.clearInterval(timer.current);
    };
  }, []);

  const totals = useMemo(() => {
    const staked = positions.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const rewards = positions.reduce((s, p) => s + (Number(p.rewards) || 0), 0);
    const apy =
      positions.length === 0 ? 0 : positions.reduce((s, p) => s + p.apy, 0) / positions.length;
    return { staked, rewards, apy };
  }, [positions]);

  const validator = validators.find((v) => v.id === selectedValidator) ?? validators[0]!;

  function begin(next: 'stake' | 'unstake' | 'claim'): void {
    setAction(next);
    setScreen(next);
  }

  function goConfirm(): void {
    setScreen('confirm');
  }

  function execute(): void {
    setScreen('progress');
    setProgress(10);
    if (timer.current != null) window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          if (timer.current != null) window.clearInterval(timer.current);
          pushTradingActivity({
            kind: action === 'claim' ? 'claim' : action,
            title: `${action} · ${validator.name}`,
            detail: `${amount} on ${validator.network}`,
            status: 'confirmed',
            amount,
            asset: validator.network === 'solana' ? 'SOL' : 'ETH',
            href: '/staking',
          });
          setScreen('success');
          return 100;
        }
        return p + 16;
      });
    }, 250);
  }

  return (
    <div className="tx" role="main">
      <header className="tx__header">
        <div>
          <p className="tx__eyebrow">
            <Link href="/">Dashboard</Link>
          </p>
          <h1>Staking</h1>
          <p className="tx__sub">
            Browse validators, track rewards, and stake or unstake with clear confirmation.
          </p>
        </div>
        <div className="tx__tabs" role="tablist" aria-label="Staking sections">
          <button
            type="button"
            role="tab"
            aria-selected={screen === 'dashboard' || screen === 'success'}
            className={`tx__tab ${screen === 'dashboard' || screen === 'success' ? 'tx__tab--on' : ''}`}
            onClick={() => setScreen('dashboard')}
          >
            Overview
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={screen === 'stake' || (screen === 'confirm' && action === 'stake')}
            className={`tx__tab ${screen === 'stake' || (screen === 'confirm' && action === 'stake') ? 'tx__tab--on' : ''}`}
            onClick={() => begin('stake')}
          >
            Stake
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={screen === 'unstake' || (screen === 'confirm' && action === 'unstake')}
            className={`tx__tab ${screen === 'unstake' || (screen === 'confirm' && action === 'unstake') ? 'tx__tab--on' : ''}`}
            onClick={() => begin('unstake')}
          >
            Unstake
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={screen === 'claim' || (screen === 'confirm' && action === 'claim')}
            className={`tx__tab ${screen === 'claim' || (screen === 'confirm' && action === 'claim') ? 'tx__tab--on' : ''}`}
            onClick={() => begin('claim')}
          >
            Claim
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={screen === 'history'}
            className={`tx__tab ${screen === 'history' ? 'tx__tab--on' : ''}`}
            onClick={() => setScreen('history')}
          >
            History
          </button>
        </div>
      </header>

      {!live && error ? (
        <Alert tone="warn" title="Preview staking data">
          Live staking service unavailable — showing curated dashboard data.
        </Alert>
      ) : null}

      {screen === 'dashboard' ? (
        <>
          <div className="tx-kpi">
            <div className="tx-kpi__card">
              <span>Total staked</span>
              <strong>{totals.staked.toFixed(2)}</strong>
            </div>
            <div className="tx-kpi__card">
              <span>Pending rewards</span>
              <strong>{totals.rewards.toFixed(4)}</strong>
            </div>
            <div className="tx-kpi__card">
              <span>Avg APY</span>
              <strong>{totals.apy.toFixed(2)}%</strong>
            </div>
          </div>

          <section className="tx-panel" aria-label="Rewards chart">
            <h2>Rewards (7d)</h2>
            <LineChart data={DEMO_REWARD_SERIES} height={110} ariaLabel="Staking rewards" />
          </section>

          <section className="tx-panel">
            <h2>Positions</h2>
            <ul className="tx-list">
              {positions.map((p) => (
                <li key={p.id}>
                  <div>
                    <strong>{p.validatorName}</strong>
                    <p className="tx-meta">
                      {p.network} · {p.amount} staked · APY {p.apy}%
                    </p>
                  </div>
                  <div>
                    <p className="tx-meta">Rewards {p.rewards}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setSelectedPosition(p.id);
                        begin('claim');
                      }}
                    >
                      Details
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="tx-panel">
            <h2>Validator browser</h2>
            <ul className="tx-list">
              {validators.map((v) => (
                <li
                  key={v.id}
                  className={`tx-validator ${selectedValidator === v.id ? 'tx-validator--on' : ''}`}
                >
                  <button
                    type="button"
                    className="tx-validator__select"
                    onClick={() => setSelectedValidator(v.id)}
                  >
                    <strong>{v.name}</strong>
                    <p className="tx-meta">
                      {v.network} · APY {v.apy}% · commission {v.commission}% · {v.staked}
                    </p>
                  </button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setSelectedValidator(v.id);
                      begin('stake');
                    }}
                  >
                    Stake
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      {(screen === 'stake' || screen === 'unstake' || screen === 'claim') && (
        <section className="tx-panel">
          <h2>
            {screen === 'stake' ? 'Stake' : screen === 'unstake' ? 'Unstake' : 'Claim rewards'}
          </h2>
          {screen !== 'claim' ? (
            <>
              <label className="tx-field">
                <span>Validator</span>
                <select
                  value={selectedValidator}
                  onChange={(e) => setSelectedValidator(e.target.value)}
                >
                  {validators.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.apy}% APY)
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
            </>
          ) : (
            <label className="tx-field">
              <span>Position</span>
              <select
                value={selectedPosition ?? ''}
                onChange={(e) => setSelectedPosition(e.target.value)}
              >
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.validatorName} · rewards {p.rewards}
                  </option>
                ))}
              </select>
            </label>
          )}
          <dl className="tx-quote">
            <div className="tx-quote__row">
              <dt>Network</dt>
              <dd>{validator.network}</dd>
            </div>
            <div className="tx-quote__row">
              <dt>Est. APY</dt>
              <dd>{validator.apy}%</dd>
            </div>
          </dl>
          <div className="tx-actions">
            <Button type="button" variant="ghost" onClick={() => setScreen('dashboard')}>
              Cancel
            </Button>
            <Button type="button" onClick={goConfirm}>
              Continue
            </Button>
          </div>
        </section>
      )}

      {screen === 'confirm' ? (
        <section className="tx-panel">
          <h2>Confirm {action}</h2>
          <dl className="tx-quote">
            <div className="tx-quote__row">
              <dt>Action</dt>
              <dd>{action}</dd>
            </div>
            <div className="tx-quote__row">
              <dt>Validator</dt>
              <dd>{validator.name}</dd>
            </div>
            <div className="tx-quote__row">
              <dt>Amount</dt>
              <dd>{amount}</dd>
            </div>
          </dl>
          <div className="tx-actions">
            <Button type="button" variant="ghost" onClick={() => setScreen(action)}>
              Back
            </Button>
            <Button type="button" onClick={execute}>
              Confirm
            </Button>
          </div>
        </section>
      ) : null}

      {screen === 'progress' ? (
        <section className="tx-panel" aria-busy="true">
          <h2>Submitting…</h2>
          <div
            className="tx-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Staking progress"
          >
            <div className="tx-progress__bar" style={{ width: `${progress}%` }} />
          </div>
        </section>
      ) : null}

      {screen === 'success' ? (
        <SuccessState
          title="Staking action submitted"
          description="Position and rewards will update after confirmation. Check activity for the receipt."
          action={
            <div className="tx-actions">
              <Button type="button" onClick={() => setScreen('dashboard')}>
                Overview
              </Button>
              <Link href="/activity">
                <Button variant="secondary">Activity</Button>
              </Link>
              <Link href="/portfolio">
                <Button variant="ghost">Portfolio</Button>
              </Link>
            </div>
          }
        />
      ) : null}

      {screen === 'history' ? (
        <section className="tx-panel">
          <h2>Staking history</h2>
          <ul className="tx-list">
            <li>
              <div>
                <strong>Stake 1.0 ETH</strong>
                <p className="tx-meta">Auvora Cloud · confirmed</p>
              </div>
              <span className="tx-meta">2d ago</span>
            </li>
            <li>
              <div>
                <strong>Claim 0.012 ETH</strong>
                <p className="tx-meta">Rewards · confirmed</p>
              </div>
              <span className="tx-meta">5d ago</span>
            </li>
          </ul>
        </section>
      ) : null}
    </div>
  );
}
