'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { AsyncStates, Button, PageHeader, StatusBadge } from '@auvora/ui';
import { ConfirmReasonDialog } from '../../components/ConfirmReasonDialog';
import {
  adminApproveLargeTransferReview,
  adminListLargeTransferReviews,
  adminRejectLargeTransferReview,
  type LargeTransferReviewRow,
} from '../../lib/admin-control-plane';
import { formatUsdCents, formatWhen, reviewOrigin, shortId } from '../../lib/admin-format';
import { formatAdminError, isStepUpRequired } from '../../lib/api-client';
import { useRealtimeRefetch } from '../../lib/admin-realtime-context';
import type { AdminEvent } from '../../lib/realtime/admin-event';

const FILTERS = ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'ALL'] as const;

export default function TransactionReviewsPage(): ReactElement {
  const router = useRouter();
  const [status, setStatus] = useState<(typeof FILTERS)[number]>('PENDING');
  const [rows, setRows] = useState<LargeTransferReviewRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    id: string;
    kind: 'approve' | 'reject';
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminListLargeTransferReviews({
        status: status === 'ALL' ? undefined : status,
        take: 100,
      });
      setRows(data.items);
      setCounts(data.counts);
    } catch (err) {
      setError(formatAdminError(err));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeRefetch(
    (event: AdminEvent) =>
      event.type === 'TRANSACTION_REVIEW_CREATED' ||
      event.type === 'TRANSACTION_REVIEW_APPROVED' ||
      event.type === 'TRANSACTION_REVIEW_REJECTED' ||
      event.type === 'TRANSACTION_REVIEW_REQUESTED' ||
      event.type === 'TRANSACTION_REVIEW_DECIDED',
    () => void load(),
    800,
  );

  async function confirm(reason: string): Promise<void> {
    if (!pendingAction) return;
    setBusy(true);
    try {
      if (pendingAction.kind === 'approve') {
        await adminApproveLargeTransferReview(pendingAction.id, reason);
      } else {
        await adminRejectLargeTransferReview(pendingAction.id, reason);
      }
      setPendingAction(null);
      await load();
    } catch (err) {
      if (isStepUpRequired(err)) {
        router.push(`/step-up?next=${encodeURIComponent('/transaction-reviews')}`);
        return;
      }
      setError(formatAdminError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Transaction Reviews"
        subtitle="High-value Auvora transfers and TEST simulations share this queue. Approval never signs or broadcasts for the user."
        actions={
          <Button type="button" variant="secondary" onClick={() => void load()}>
            Refresh
          </Button>
        }
      />

      <section className="admin-kpi-grid" aria-label="Review counts">
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            className={`admin-kpi${status === item ? ' admin-kpi--active' : ''}`}
            onClick={() => setStatus(item)}
          >
            <span className="admin-kpi__label">
              {item === 'ALL' ? 'all queues' : item.toLowerCase()}
            </span>
            <span className="admin-kpi__value">
              {item === 'ALL'
                ? Object.values(counts).reduce((sum, value) => sum + value, 0)
                : (counts[item] ?? 0)}
            </span>
          </button>
        ))}
      </section>

      <AsyncStates
        loading={loading}
        loadingMessage="Loading transaction reviews…"
        error={error}
        errorTitle="Could not load transaction reviews"
        onRetry={() => void load()}
        empty={!loading && !error && rows.length === 0}
        emptyTitle="No transaction reviews"
        emptyDescription="High-value or test-queue transactions will appear here."
      >
        <div className="table-scroll">
          <table className="data-table">
            <caption className="auvora-sr-only">Transaction review queue</caption>
            <thead>
              <tr>
                <th scope="col">Origin</th>
                <th scope="col">Review</th>
                <th scope="col">User</th>
                <th scope="col">Asset</th>
                <th scope="col">Amount</th>
                <th scope="col">USD</th>
                <th scope="col">Destination</th>
                <th scope="col">Status</th>
                <th scope="col">Requested</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const origin = reviewOrigin(row.sourceType, row.metadata);
                return (
                  <tr key={row.id}>
                    <td>
                      <span
                        className={`admin-source-badge admin-source-badge--${origin.simulated ? 'simulated' : 'live'}`}
                      >
                        {origin.label}
                      </span>
                    </td>
                    <td className="mono" title={row.id}>
                      {shortId(row.id, 12)}
                    </td>
                    <td className="mono">
                      <Link href={`/users/${row.ownerUserId}`} title={row.ownerUserId}>
                        {shortId(row.ownerUserId, 12)}
                      </Link>
                    </td>
                    <td>
                      <strong>{row.assetCode}</strong>
                      <div className="page-subtitle">{row.network}</div>
                    </td>
                    <td>{row.amount}</td>
                    <td>{formatUsdCents(row.amountUsdCents)}</td>
                    <td className="mono" title={row.destinationAddress}>
                      {shortId(row.destinationAddress, 14)}
                    </td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td>{formatWhen(row.requestedAt)}</td>
                    <td>
                      {row.status === 'PENDING' ? (
                        <div className="action-row">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setPendingAction({ id: row.id, kind: 'approve' })}
                          >
                            Approve
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setPendingAction({ id: row.id, kind: 'reject' })}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="page-subtitle">
                          {row.decisionReason ?? row.rejectionReason ?? 'Finalized'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </AsyncStates>

      <ConfirmReasonDialog
        open={pendingAction !== null}
        title={pendingAction?.kind === 'approve' ? 'Approve review' : 'Reject review'}
        description="This decision is audited. Simulated reviews only move TEST balances. Real reviews never sign or broadcast — the user still signs on their device after approval."
        confirmLabel={pendingAction?.kind === 'approve' ? 'Approve' : 'Reject'}
        pending={busy}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
        onConfirm={confirm}
      />
    </div>
  );
}
