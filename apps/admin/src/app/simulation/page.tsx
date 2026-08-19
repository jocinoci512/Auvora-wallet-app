'use client';

import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { AsyncStates, Button, EmptyState, PageHeader, StatusBadge } from '@auvora/ui';
import {
  adminApplySimulationPreset,
  adminCreateSimulationTransaction,
  adminDisableTestAccount,
  adminEnableTestAccount,
  adminGetSimulationAccount,
  adminListSimulationAccounts,
  adminRemoveSimulationBalance,
  adminResetSimulationPortfolio,
  adminUpsertSimulationBalance,
  type SimulationAccountView,
} from '../../lib/admin-control-plane';
import { ConfirmReasonDialog } from '../../components/ConfirmReasonDialog';
import { formatWhen } from '../../lib/admin-format';
import { formatAdminError, isStepUpRequired } from '../../lib/api-client';
import { useRouter } from 'next/navigation';

const PRESETS = [
  ['starter', 'Starter portfolio'],
  ['high_net_worth', 'High-net-worth portfolio'],
  ['low_balance', 'Low-balance portfolio'],
  ['large_transfer_review', 'Large-transfer review'],
  ['insufficient_funds', 'Insufficient-funds scenario'],
  ['network_congestion', 'Network congestion scenario'],
] as const;

export default function SimulationPage(): ReactElement {
  const router = useRouter();
  const [lookupUserId, setLookupUserId] = useState('');
  const [account, setAccount] = useState<SimulationAccountView | null>(null);
  const [accounts, setAccounts] = useState<
    Array<{
      id: string;
      ownerUserId: string;
      status: string;
      assetCount: number;
      updatedAt: string;
      createdAt: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | {
    kind: 'enable' | 'disable' | 'reset' | 'preset' | 'remove' | 'scenario';
    presetCode?: string;
    assetCode?: string;
  }>(null);
  const [assetCode, setAssetCode] = useState('BTC');
  const [amount, setAmount] = useState('1');
  const [operation, setOperation] = useState<'set' | 'increase' | 'decrease'>('set');
  const [scenario, setScenario] = useState<
    | 'incoming_transfer'
    | 'outgoing_success'
    | 'insufficient_balance'
    | 'pending_transaction'
    | 'failed_transaction'
    | 'rejected_transaction'
    | 'large_transfer_review'
    | 'security_hold'
  >('incoming_transfer');

  const currentUserId = account?.ownerUserId ?? lookupUserId.trim();

  const loadList = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      setAccounts(await adminListSimulationAccounts());
    } catch (err) {
      setError(formatAdminError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAccount = useCallback(async (userId: string): Promise<void> => {
    const id = userId.trim();
    if (!id) {
      setAccount(null);
      return;
    }
    try {
      setAccount(await adminGetSimulationAccount(id));
    } catch (err) {
      setAccount(null);
      setError(formatAdminError(err));
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  async function refresh(): Promise<void> {
    await Promise.all([loadList(), fetchAccount(lookupUserId)]);
  }

  const portfolioUsd = useMemo(() => {
    if (!account) return null;
    return account.balances.reduce((sum, row) => sum + Number(row.valueUsd ?? 0), 0);
  }, [account]);

  async function withReason(reason: string): Promise<void> {
    try {
      if (!currentUserId || !dialog) return;
      if (dialog.kind === 'enable') {
        setAccount(await adminEnableTestAccount(currentUserId, reason));
      } else if (dialog.kind === 'disable') {
        setAccount(await adminDisableTestAccount(currentUserId, reason));
      } else if (dialog.kind === 'reset') {
        setAccount(await adminResetSimulationPortfolio(currentUserId, reason));
      } else if (dialog.kind === 'preset' && dialog.presetCode) {
        setAccount(await adminApplySimulationPreset(currentUserId, dialog.presetCode, reason));
      } else if (dialog.kind === 'remove' && dialog.assetCode) {
        setAccount(await adminRemoveSimulationBalance(currentUserId, dialog.assetCode, reason));
      } else if (dialog.kind === 'scenario') {
        await adminCreateSimulationTransaction({
          userId: currentUserId,
          assetCode,
          scenario,
          amount,
          reason,
        });
        setAccount(await adminGetSimulationAccount(currentUserId));
      }
      setDialog(null);
      await refresh();
    } catch (err) {
      if (isStepUpRequired(err)) {
        router.push(`/step-up?next=${encodeURIComponent('/simulation')}`);
        return;
      }
      setError(formatAdminError(err));
    }
  }

  async function saveBalance(reason: string): Promise<void> {
    if (!currentUserId) return;
    try {
      const next = await adminUpsertSimulationBalance({
        userId: currentUserId,
        assetCode,
        operation,
        amount,
        reason,
      });
      setAccount(next);
      await refresh();
    } catch (err) {
      if (isStepUpRequired(err)) {
        router.push(`/step-up?next=${encodeURIComponent('/simulation')}`);
        return;
      }
      setError(formatAdminError(err));
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Simulation"
        subtitle="TEST-account-only balances and transactions. Never mixed with real on-chain holdings."
        actions={
          <Button type="button" variant="secondary" onClick={() => void refresh()}>
            Refresh
          </Button>
        }
      />

      <section className="panel filters">
        <div className="filters__row">
          <label className="field">
            <span className="field-label">User ID</span>
            <input
              className="field-input"
              value={lookupUserId}
              onChange={(event) => setLookupUserId(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void fetchAccount(lookupUserId);
                }
              }}
              placeholder="Lookup a TEST account by user id"
            />
          </label>
          <Button type="button" onClick={() => void fetchAccount(lookupUserId)}>
            Open
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setDialog({ kind: 'enable' })}
            disabled={!lookupUserId.trim()}
          >
            Mark as Test Account
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setDialog({ kind: 'disable' })}
            disabled={!lookupUserId.trim()}
          >
            Disable TEST account
          </Button>
        </div>
      </section>

      <AsyncStates
        loading={loading}
        loadingMessage="Loading simulation control plane…"
        error={error}
        errorTitle="Could not load simulation data"
        onRetry={() => void refresh()}
        empty={!loading && !error && !account && accounts.length === 0}
        emptyTitle="No TEST accounts yet"
        emptyDescription="Enable simulation for a user to start a protected test portfolio."
      >
        <section className="admin-kpi-grid">
          <div className="admin-kpi">
            <span className="admin-kpi__label">Test accounts</span>
            <span className="admin-kpi__value">{accounts.length}</span>
          </div>
          <div className="admin-kpi">
            <span className="admin-kpi__label">Selected account</span>
            <span className="admin-kpi__value">{account ? 'TEST' : '—'}</span>
          </div>
          <div className="admin-kpi">
            <span className="admin-kpi__label">SIMULATED value</span>
            <span className="admin-kpi__value">
              {portfolioUsd == null
                ? '—'
                : `$${portfolioUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TEST`}
            </span>
          </div>
        </section>

        <section className="panel">
          <h2>Protected TEST accounts</h2>
          {accounts.length === 0 ? (
            <EmptyState
              title="No classified test accounts"
              description="Production customers do not receive simulation balances unless explicitly classified."
            />
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">User</th>
                    <th scope="col">Status</th>
                    <th scope="col">Assets</th>
                    <th scope="col">Updated</th>
                    <th scope="col">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((row) => (
                    <tr
                      key={row.id}
                      className={`admin-table-row--selectable${
                        row.ownerUserId === lookupUserId.trim() ? ' admin-table-row--selected' : ''
                      }`}
                      onClick={() => {
                        setLookupUserId(row.ownerUserId);
                        void fetchAccount(row.ownerUserId);
                      }}
                    >
                      <td className="mono">{row.ownerUserId}</td>
                      <td>
                        <StatusBadge status={row.status} />
                      </td>
                      <td>{row.assetCount}</td>
                      <td>{formatWhen(row.updatedAt)}</td>
                      <td>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            setLookupUserId(row.ownerUserId);
                            void fetchAccount(row.ownerUserId);
                          }}
                        >
                          Select
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {account ? (
          <>
            <section className="panel">
              <div
                className="action-row"
                style={{ justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div>
                  <h2>Selected TEST portfolio</h2>
                  <p className="page-subtitle mono">{account.ownerUserId}</p>
                </div>
                <div className="action-row">
                  {PRESETS.map(([code, label]) => (
                    <Button
                      key={code}
                      type="button"
                      variant="ghost"
                      onClick={() => setDialog({ kind: 'preset', presetCode: code })}
                    >
                      {label}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setDialog({ kind: 'reset' })}
                  >
                    Reset portfolio
                  </Button>
                </div>
              </div>

              {account.balances.length === 0 ? (
                <EmptyState
                  title="No simulated balances"
                  description="Add or preset TEST balances to begin QA scenarios."
                />
              ) : (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Asset</th>
                        <th scope="col">Balance</th>
                        <th scope="col">Value</th>
                        <th scope="col">Price</th>
                        <th scope="col">Label</th>
                        <th scope="col">Updated</th>
                        <th scope="col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {account.balances.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <strong>{row.assetCode}</strong>
                            <div className="page-subtitle">{row.chain}</div>
                          </td>
                          <td>{row.quantity}</td>
                          <td>
                            {row.valueUsd
                              ? `$${Number(row.valueUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : 'Price unavailable'}
                          </td>
                          <td>{row.priceUsd ? `$${row.priceUsd}` : '—'}</td>
                          <td>{row.label}</td>
                          <td>{formatWhen(row.updatedAt)}</td>
                          <td>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() =>
                                setDialog({ kind: 'remove', assetCode: row.assetCode })
                              }
                            >
                              Remove
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="panel">
              <h2>Balance controls</h2>
              <div className="filters__row">
                <label className="field">
                  <span className="field-label">Asset</span>
                  <input
                    className="field-input"
                    value={assetCode}
                    onChange={(event) => setAssetCode(event.target.value.toUpperCase())}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Operation</span>
                  <select
                    className="field-input"
                    value={operation}
                    onChange={(event) =>
                      setOperation(event.target.value as 'set' | 'increase' | 'decrease')
                    }
                  >
                    <option value="set">Set</option>
                    <option value="increase">Increase</option>
                    <option value="decrease">Decrease</option>
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Amount</span>
                  <input
                    className="field-input"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                </label>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const reason = window.prompt(
                    'Reason for this simulation balance change (min 8 chars):',
                  );
                  if (reason && reason.trim().length >= 8) {
                    void saveBalance(reason.trim());
                  }
                }}
              >
                Save simulated balance
              </Button>
            </section>

            <section className="panel">
              <h2>Create simulated transaction scenario</h2>
              <p className="page-subtitle">
                These records are TEST-only. They never sign, broadcast, or create real transaction
                hashes.
              </p>
              <div className="filters__row">
                <label className="field">
                  <span className="field-label">Scenario</span>
                  <select
                    className="field-input"
                    value={scenario}
                    onChange={(event) => setScenario(event.target.value as typeof scenario)}
                  >
                    <option value="incoming_transfer">Incoming transfer</option>
                    <option value="outgoing_success">Outgoing success</option>
                    <option value="insufficient_balance">Insufficient balance</option>
                    <option value="pending_transaction">Pending transaction</option>
                    <option value="failed_transaction">Failed transaction</option>
                    <option value="rejected_transaction">Rejected transaction</option>
                    <option value="large_transfer_review">Large-transfer review</option>
                    <option value="security_hold">Security hold</option>
                  </select>
                </label>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDialog({ kind: 'scenario' })}
              >
                Create SIMULATED scenario
              </Button>
            </section>

            <section className="panel">
              <h2>Simulation history</h2>
              {account.events.length === 0 ? (
                <EmptyState
                  title="No simulation history"
                  description="Changes will appear here with admin reason and timestamp."
                />
              ) : (
                <ul className="stack">
                  {account.events.slice(0, 10).map((event) => (
                    <li key={event.id}>
                      <strong>{event.eventType}</strong>{' '}
                      {event.assetCode ? `· ${event.assetCode}` : ''} · {event.reason}
                      <div className="page-subtitle">{formatWhen(event.createdAt)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel">
              <h2>Simulation transactions</h2>
              {account.transactions.length === 0 ? (
                <EmptyState
                  title="No simulation transactions"
                  description="Use presets and account-level actions to create QA transaction history."
                />
              ) : (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Reference</th>
                        <th scope="col">Asset</th>
                        <th scope="col">Direction</th>
                        <th scope="col">Amount</th>
                        <th scope="col">Status</th>
                        <th scope="col">Review</th>
                        <th scope="col">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {account.transactions.map((tx) => (
                        <tr key={tx.id}>
                          <td className="mono">{tx.reference}</td>
                          <td>{tx.assetCode}</td>
                          <td>{tx.direction}</td>
                          <td>{tx.amount}</td>
                          <td>
                            <StatusBadge status={tx.status} />
                          </td>
                          <td className="mono">{tx.reviewId ?? '—'}</td>
                          <td>{formatWhen(tx.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : null}
      </AsyncStates>

      <ConfirmReasonDialog
        open={dialog !== null}
        title={
          dialog?.kind === 'enable'
            ? 'Mark as Test Account'
            : dialog?.kind === 'disable'
              ? 'Disable TEST account'
              : dialog?.kind === 'reset'
                ? 'Reset simulation portfolio'
                : dialog?.kind === 'remove'
                  ? 'Remove simulated asset'
                  : dialog?.kind === 'scenario'
                    ? 'Create SIMULATED transaction'
                    : 'Apply simulation preset'
        }
        description="This action is restricted to authorized admins, requires a reason, and never changes real on-chain funds."
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        onConfirm={withReason}
      />
    </div>
  );
}
