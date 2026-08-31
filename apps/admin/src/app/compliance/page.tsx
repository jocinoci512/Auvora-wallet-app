'use client';

import {
  AuvoraClientError,
  type ComplianceDashboardMetrics,
  type ComplianceProvider,
  type VerificationRequest,
} from '@auvora/sdk';
import { Button, StatusBadge } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { ConfirmReasonDialog } from '../../components/ConfirmReasonDialog';
import { createApiClient, formatApiError } from '../../lib/api-client';
import { useRealtimeRefetch } from '../../lib/admin-realtime-context';
import type { AdminEvent } from '../../lib/realtime/admin-event';

type PendingKyc = { id: string; kind: 'reject' | 'resubmit' };

export default function AdminCompliancePage(): ReactElement {
  const [metrics, setMetrics] = useState<ComplianceDashboardMetrics | null>(null);
  const [queue, setQueue] = useState<VerificationRequest[]>([]);
  const [providers, setProviders] = useState<ComplianceProvider[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingKyc | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const client = createApiClient();
      const [m, q, p] = await Promise.all([
        client.adminComplianceDashboard(),
        client.adminComplianceKycQueue(),
        client.adminListComplianceProviders(),
      ]);
      setMetrics(m);
      setQueue(q);
      setProviders(p);
    } catch (err) {
      if (err instanceof AuvoraClientError && err.status === 401) {
        setError('Your Admin session expired. Sign in again.');
      } else {
        setError(formatApiError(err));
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeRefetch(
    (event: AdminEvent) => event.type === 'COMPLIANCE_STATUS_CHANGED',
    () => void load(),
    800,
  );

  async function approve(id: string): Promise<void> {
    setMessage(null);
    try {
      const client = createApiClient();
      await client.adminApproveKyc(id);
      setMessage('KYC approved');
      await load();
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  async function confirmReason(reason: string, internalNote?: string): Promise<void> {
    if (!pending) return;
    setBusy(true);
    setMessage(null);
    try {
      const client = createApiClient();
      if (pending.kind === 'reject') {
        await client.adminRejectKyc(pending.id, reason, internalNote);
        setMessage('KYC rejected');
      } else {
        await client.adminRequestKycResubmission(pending.id, reason);
        setMessage('Resubmission requested');
      }
      setPending(null);
      await load();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <h1>KYC queue</h1>
      <p>
        Review identity verification submissions. Reasons shown to customers must be safe and
        specific. Document binaries are never returned by this UI.
      </p>
      <p>
        <Link href="/compliance/alerts">AML alerts</Link> ·{' '}
        <Link href="/compliance/cases">Cases</Link> · <Link href="/compliance/rules">Rules</Link>
      </p>
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p>{message}</p> : null}
      {metrics ? (
        <section>
          <p>Pending KYC: {metrics.pendingKyc}</p>
          <p>Open alerts: {metrics.openAlerts}</p>
        </section>
      ) : null}
      <table className="data-table">
        <thead>
          <tr>
            <th>Request</th>
            <th>User</th>
            <th>Status</th>
            <th>Level</th>
            <th>Submitted</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {queue.map((row) => (
            <tr key={row.id}>
              <td className="mono">{row.id.slice(0, 8)}…</td>
              <td className="mono">
                <Link href={`/users/${row.ownerUserId}`}>{row.ownerUserId.slice(0, 8)}…</Link>
              </td>
              <td>
                <StatusBadge status={row.status} />
              </td>
              <td>{row.requestedLevel}</td>
              <td>{row.submittedAt ? new Date(row.submittedAt).toLocaleString() : '—'}</td>
              <td>
                <Button type="button" onClick={() => void approve(row.id)}>
                  Approve
                </Button>{' '}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPending({ id: row.id, kind: 'reject' })}
                >
                  Reject
                </Button>{' '}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPending({ id: row.id, kind: 'resubmit' })}
                >
                  Request resubmission
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {providers.length > 0 ? (
        <section>
          <h2>Providers</h2>
          <ul>
            {providers.map((p) => (
              <li key={p.code}>
                {p.code} — {p.isEnabled ? 'enabled' : 'disabled'} (priority {p.priority})
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <ConfirmReasonDialog
        open={pending !== null}
        title={pending?.kind === 'resubmit' ? 'Request resubmission' : 'Reject KYC'}
        description={
          pending?.kind === 'resubmit'
            ? 'Customer-visible instructions are required. Internal notes stay in Admin only.'
            : 'A customer-visible rejection reason is required. Internal notes stay in Admin only.'
        }
        confirmLabel={pending?.kind === 'resubmit' ? 'Request resubmission' : 'Reject'}
        pending={busy}
        showInternalNote={pending?.kind === 'reject'}
        customerReasonLabel="Customer-visible reason"
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        onConfirm={(reason, internalNote) => void confirmReason(reason, internalNote)}
      />
    </main>
  );
}
