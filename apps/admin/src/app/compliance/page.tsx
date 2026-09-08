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
type KycFilter =
  'ALL' | 'SUBMITTED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'REQUIRES_RESUBMISSION';

export default function AdminCompliancePage(): ReactElement {
  const [metrics, setMetrics] = useState<ComplianceDashboardMetrics | null>(null);
  const [queue, setQueue] = useState<VerificationRequest[]>([]);
  const [providers, setProviders] = useState<ComplianceProvider[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<KycFilter>('ALL');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingKyc | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const client = createApiClient();
      const statusParam = selectedFilter === 'ALL' ? undefined : selectedFilter;
      const [m, q, p] = await Promise.all([
        client.adminComplianceDashboard(),
        client.adminComplianceKycQueue(statusParam),
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
  }, [selectedFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeRefetch(
    (event: AdminEvent) => event.type === 'COMPLIANCE_STATUS_CHANGED',
    () => void load(),
    800,
  );

  async function startReview(id: string): Promise<void> {
    setMessage(null);
    try {
      const client = createApiClient();
      await client.adminStartKycReview(id);
      setMessage('Review started (status set to IN_REVIEW)');
      await load();
    } catch (err) {
      setError(formatApiError(err));
    }
  }

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

  const filters: { label: string; value: KycFilter }[] = [
    { label: 'All', value: 'ALL' },
    { label: 'Submitted', value: 'SUBMITTED' },
    { label: 'In Review', value: 'IN_REVIEW' },
    { label: 'Approved', value: 'APPROVED' },
    { label: 'Rejected', value: 'REJECTED' },
    { label: 'Needs Resubmission', value: 'REQUIRES_RESUBMISSION' },
  ];

  return (
    <main className="page">
      <h1>KYC Reviews</h1>
      <p>
        Review customer identity verification submissions. Document binaries are stored encrypted
        and retrieved only through secure, short-lived tokens.
      </p>
      <p>
        <Link href="/compliance/alerts">AML alerts</Link> ·{' '}
        <Link href="/compliance/cases">Cases</Link> · <Link href="/compliance/rules">Rules</Link>
      </p>
      {error ? (
        <p role="alert" style={{ color: 'red' }}>
          {error}
        </p>
      ) : null}
      {message ? <p style={{ color: 'green' }}>{message}</p> : null}
      {metrics ? (
        <section style={{ display: 'flex', gap: '2rem', marginBottom: '1rem' }}>
          <p>
            <strong>Pending KYC:</strong> {metrics.pendingKyc}
          </p>
          <p>
            <strong>Open alerts:</strong> {metrics.openAlerts}
          </p>
        </section>
      ) : null}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setSelectedFilter(f.value)}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '4px',
              border: '1px solid #ccc',
              cursor: 'pointer',
              background: selectedFilter === f.value ? '#0066cc' : '#f5f5f5',
              color: selectedFilter === f.value ? '#fff' : '#333',
              fontWeight: selectedFilter === f.value ? 'bold' : 'normal',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Request</th>
            <th>Customer</th>
            <th>Country</th>
            <th>ID Type</th>
            <th>Status</th>
            <th>Submitted</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {queue.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ textAlign: 'center', padding: '1rem' }}>
                No verification submissions found for the selected filter.
              </td>
            </tr>
          ) : (
            queue.map((row) => {
              const rowObj = row as VerificationRequest & { metadata?: Record<string, unknown> };
              const meta = rowObj.metadata || {};
              const country = (meta.country as string) || '—';
              const idType = (meta.idType as string) || (meta.documentType as string) || '—';

              return (
                <tr key={row.id}>
                  <td className="mono">
                    <Link href={`/compliance/kyc/${row.id}`}>{row.id.slice(0, 8)}…</Link>
                  </td>
                  <td className="mono">
                    <Link href={`/users/${row.ownerUserId}`}>{row.ownerUserId.slice(0, 8)}…</Link>
                  </td>
                  <td>{country}</td>
                  <td>{idType}</td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                  <td>{row.submittedAt ? new Date(row.submittedAt).toLocaleString() : '—'}</td>
                  <td>
                    <Link
                      href={`/compliance/kyc/${row.id}`}
                      style={{
                        marginRight: '8px',
                        padding: '4px 8px',
                        border: '1px solid #0066cc',
                        borderRadius: '4px',
                        textDecoration: 'none',
                        fontSize: '0.85rem',
                      }}
                    >
                      Review
                    </Link>
                    {row.status === 'SUBMITTED' ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void startReview(row.id)}
                      >
                        Start review
                      </Button>
                    ) : null}{' '}
                    {row.status !== 'APPROVED' ? (
                      <Button type="button" onClick={() => void approve(row.id)}>
                        Approve
                      </Button>
                    ) : null}{' '}
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
                      Resubmit
                    </Button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {providers.length > 0 ? (
        <section style={{ marginTop: '2rem' }}>
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
