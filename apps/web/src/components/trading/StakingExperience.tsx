'use client';

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
import { ENGINE_STATUS_STAGES } from '../../lib/trading/quote-engine';
import {
  CxActions,
  CxProgressTrack,
  humanizeError,
  TransactionShell,
} from '../transaction/TransactionShell';
import { QuoteChecklist } from './QuotePanel';
import '../../app/core-experience.css';

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

const STEPS = [
  { id: 'form', label: 'Details' },
  { id: 'confirm', label: 'Review' },
  { id: 'progress', label: 'Submit' },
  { id: 'success', label: 'Done' },
] as const;

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
  const [feesOk, setFeesOk] = useState(false);
  const [detailsOk, setDetailsOk] = useState(false);
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
    setFeesOk(false);
    setDetailsOk(false);
    setError(null);
    setScreen('confirm');
  }

  function execute(): void {
    if (!feesOk || !detailsOk) {
      setError('Confirm the checklist before continuing.');
      return;
    }
    const authorized = window.confirm(
      `Authorize ${live ? '' : 'preview '}${action} of ${amount} with ${validator.name}?\n\n${live ? 'This may broadcast a transaction.' : 'Nothing moves on-chain in preview mode.'}`,
    );
    if (!authorized) return;
    setScreen('progress');
    setProgress(10);
    if (timer.current != null) window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          if (timer.current != null) window.clearInterval(timer.current);
          pushTradingActivity({
            kind: action === 'claim' ? 'claim' : action,
            title: live
              ? `${action} · ${validator.name}`
              : `${action} · ${validator.name} (preview)`,
            detail: live
              ? `${amount} on ${validator.network}`
              : `${amount} on ${validator.network} — simulator`,
            status: live ? 'confirmed' : 'pending',
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

  const inFlow =
    screen === 'stake' ||
    screen === 'unstake' ||
    screen === 'claim' ||
    screen === 'confirm' ||
    screen === 'progress' ||
    screen === 'success';

  const currentStepId = (() => {
    if (screen === 'stake' || screen === 'unstake' || screen === 'claim') return 'form';
    if (screen === 'confirm') return 'confirm';
    if (screen === 'progress') return 'progress';
    if (screen === 'success') return 'success';
    return undefined;
  })();

  return (
    <TransactionShell
      title="Staking"
      subtitle="Browse validators, track rewards, and stake or unstake with clear confirmation."
      reassure="Staking locks assets with a validator; unstaking may take a network-specific cooldown."
      steps={inFlow ? [...STEPS] : undefined}
      currentStepId={currentStepId}
      backHref="/dashboard"
    >
      <div className="cx-wide">
        <div className="cx-tabs" role="tablist" aria-label="Staking sections">
          <button
            type="button"
            role="tab"
            aria-selected={screen === 'dashboard' || screen === 'success'}
            className={screen === 'dashboard' || screen === 'success' ? 'is-active' : undefined}
            onClick={() => setScreen('dashboard')}
          >
            Overview
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={screen === 'stake' || (screen === 'confirm' && action === 'stake')}
            className={
              screen === 'stake' || (screen === 'confirm' && action === 'stake')
                ? 'is-active'
                : undefined
            }
            onClick={() => begin('stake')}
          >
            Stake
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={screen === 'unstake' || (screen === 'confirm' && action === 'unstake')}
            className={
              screen === 'unstake' || (screen === 'confirm' && action === 'unstake')
                ? 'is-active'
                : undefined
            }
            onClick={() => begin('unstake')}
          >
            Unstake
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={screen === 'claim' || (screen === 'confirm' && action === 'claim')}
            className={
              screen === 'claim' || (screen === 'confirm' && action === 'claim')
                ? 'is-active'
                : undefined
            }
            onClick={() => begin('claim')}
          >
            Claim
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={screen === 'history'}
            className={screen === 'history' ? 'is-active' : undefined}
            onClick={() => setScreen('history')}
          >
            History
          </button>
        </div>

        {!live ? (
          <div className="cx-warn">
            <strong>Preview staking data</strong>
            <p>
              {error
                ? humanizeError(
                    error,
                    'Live staking service unavailable — showing curated dashboard data.',
                  )
                : 'Showing curated dashboard data until staking positions connect.'}
            </p>
          </div>
        ) : null}

        {screen === 'dashboard' ? (
          <>
            <section className="cx-panel">
              <h2>Totals</h2>
              <div className="cx-confirm">
                <dl>
                  <div>
                    <dt>Total staked</dt>
                    <dd>{totals.staked.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt>Pending rewards</dt>
                    <dd>{totals.rewards.toFixed(4)}</dd>
                  </div>
                  <div>
                    <dt>Avg APY</dt>
                    <dd>{totals.apy.toFixed(2)}%</dd>
                  </div>
                </dl>
              </div>
            </section>

            <section className="cx-panel" aria-label="Rewards chart">
              <h2>Rewards (7d)</h2>
              <LineChart data={DEMO_REWARD_SERIES} height={110} ariaLabel="Staking rewards" />
            </section>

            <section className="cx-panel">
              <h2>Positions</h2>
              <ul className="cx-list">
                {positions.map((p) => (
                  <li key={p.id}>
                    <div>
                      <strong>{p.validatorName}</strong>
                      <p className="cx-meta">
                        {p.network} · {p.amount} staked · APY {p.apy}%
                      </p>
                    </div>
                    <div>
                      <p className="cx-meta">Rewards {p.rewards}</p>
                      <button
                        type="button"
                        className="cx-btn cx-btn--ghost"
                        onClick={() => {
                          setSelectedPosition(p.id);
                          begin('claim');
                        }}
                      >
                        Details
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="cx-panel">
              <h2>Validator browser</h2>
              <ul className="cx-list">
                {validators.map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      className={`cx-choice ${selectedValidator === v.id ? 'cx-choice--on' : ''}`}
                      style={{ textAlign: 'left', width: '100%' }}
                      onClick={() => setSelectedValidator(v.id)}
                    >
                      <strong>{v.name}</strong>
                      <span>
                        {v.network} · APY {v.apy}% · commission {v.commission}% · {v.staked}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="cx-btn cx-btn--primary"
                      onClick={() => {
                        setSelectedValidator(v.id);
                        begin('stake');
                      }}
                    >
                      Stake
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </>
        ) : null}

        {(screen === 'stake' || screen === 'unstake' || screen === 'claim') && (
          <section className="cx-panel">
            <h2>
              {screen === 'stake' ? 'Stake' : screen === 'unstake' ? 'Unstake' : 'Claim rewards'}
            </h2>
            {screen !== 'claim' ? (
              <>
                <label className="cx-field">
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
                <label className="cx-field">
                  <span>Amount</span>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                  />
                </label>
              </>
            ) : (
              <label className="cx-field">
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
            <div className="cx-confirm">
              <dl>
                <div>
                  <dt>Network</dt>
                  <dd>{validator.network}</dd>
                </div>
                <div>
                  <dt>Est. APY</dt>
                  <dd>{validator.apy}%</dd>
                </div>
              </dl>
            </div>
            <CxActions
              onBack={() => setScreen('dashboard')}
              backLabel="Cancel"
              onNext={goConfirm}
            />
          </section>
        )}

        {screen === 'confirm' ? (
          <section className="cx-panel">
            <h2>Confirm {action}</h2>
            <div className="cx-confirm">
              <dl>
                <div>
                  <dt>Action</dt>
                  <dd>{action}</dd>
                </div>
                <div>
                  <dt>Validator</dt>
                  <dd>{validator.name}</dd>
                </div>
                <div>
                  <dt>Amount</dt>
                  <dd>{amount}</dd>
                </div>
              </dl>
            </div>
            <QuoteChecklist
              feesChecked={feesOk}
              detailsChecked={detailsOk}
              onFees={setFeesOk}
              onDetails={setDetailsOk}
              actionLabel={action}
            />
            {error ? (
              <div className="cx-alert cx-alert--error" role="alert">
                {humanizeError(error, 'Confirm the checklist before continuing.')}
              </div>
            ) : null}
            <CxActions
              onBack={() => setScreen(action)}
              onNext={execute}
              nextLabel={`Authorize ${action}`}
            />
          </section>
        ) : null}

        {screen === 'progress' ? (
          <CxProgressTrack
            progress={progress}
            label={live ? 'Submitting…' : 'Running staking preview…'}
            stages={[...ENGINE_STATUS_STAGES]}
          />
        ) : null}

        {screen === 'success' ? (
          <div className="cx-success">
            <div className="cx-success-burst" aria-hidden>
              ✓
            </div>
            <h2>{live ? 'Staking action submitted' : 'Preview complete'}</h2>
            <p>
              {live
                ? 'Position and rewards will update after confirmation. Check activity for the receipt.'
                : 'Nothing was staked, unstaked, or claimed on-chain. This walkthrough was UI-only.'}
            </p>
            <div className="cx-success__cta">
              <button
                type="button"
                className="cx-btn cx-btn--primary"
                onClick={() => setScreen('dashboard')}
              >
                Overview
              </button>
              <Link href="/activity" className="cx-btn cx-btn--ghost">
                Activity
              </Link>
              <Link href="/portfolio" className="cx-btn cx-btn--ghost">
                Portfolio
              </Link>
            </div>
          </div>
        ) : null}

        {screen === 'history' ? (
          <section className="cx-panel">
            <h2>Staking history</h2>
            <ul className="cx-list">
              <li>
                <div>
                  <strong>Stake 1.0 ETH</strong>
                  <p className="cx-meta">Auvora Cloud · confirmed</p>
                </div>
                <span className="cx-meta">2d ago</span>
              </li>
              <li>
                <div>
                  <strong>Claim 0.012 ETH</strong>
                  <p className="cx-meta">Rewards · confirmed</p>
                </div>
                <span className="cx-meta">5d ago</span>
              </li>
            </ul>
          </section>
        ) : null}
      </div>
    </TransactionShell>
  );
}
