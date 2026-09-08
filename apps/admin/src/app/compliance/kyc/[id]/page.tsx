'use client';

import { AuvoraClientError } from '@auvora/sdk';
import { Button, StatusBadge } from '@auvora/ui';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { ConfirmReasonDialog } from '../../../../components/ConfirmReasonDialog';
import { createApiClient, formatApiError } from '../../../../lib/api-client';

type KycDetailData = {
  id: string;
  ownerUserId: string;
  status: string;
  requestedLevel: string;
  provider: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  internalAdminNote: string | null;
  metadata: {
    legalName?: string;
    country?: string;
    dateOfBirth?: string;
    idType?: string;
    idNumber?: string;
    idExpiration?: string;
    frontDocumentId?: string;
    backDocumentId?: string;
    customerVisibleReason?: string;
    internalAdminNote?: string;
    [key: string]: unknown;
  };
  customer: {
    id: string;
    email: string | null;
    username: string | null;
  } | null;
  documents: Array<{
    id: string;
    documentType: string;
    fileName: string | null;
    status: string;
    createdAt: string;
    side?: string;
  }>;
  auditTrail: Array<{
    id: string;
    action: string;
    actorUserId: string | null;
    actorRole: string | null;
    details: Record<string, unknown> | null;
    createdAt: string;
  }>;
  priorVerifications: Array<{
    id: string;
    status: string;
    submittedAt: string | null;
    reviewedAt: string | null;
    rejectionReason: string | null;
  }>;
};

export default function AdminKycDetailPage(): ReactElement {
  const params = useParams();
  const _router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string);

  const [data, setData] = useState<KycDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Document tokens for secure streaming
  const [docTokens, setDocTokens] = useState<Record<string, string>>({});
  const [loadingTokens, setLoadingTokens] = useState(false);

  // Rejection / Resubmission dialog
  const [pendingKind, setPendingKind] = useState<'reject' | 'resubmit' | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      const res = (await client.adminGetKycDetail(id)) as unknown as KycDetailData;
      setData(res);

      // Pre-fetch view tokens for associated documents
      if (res.documents && res.documents.length > 0) {
        setLoadingTokens(true);
        const tokens: Record<string, string> = {};
        for (const doc of res.documents) {
          try {
            const tokenRes = await client.adminGetDocumentViewToken(doc.id);
            tokens[doc.id] = tokenRes.token;
          } catch {
            // Ignore individual token errors
          }
        }
        setDocTokens(tokens);
        setLoadingTokens(false);
      }
    } catch (err) {
      if (err instanceof AuvoraClientError && err.status === 401) {
        setError('Your Admin session expired. Sign in again.');
      } else {
        setError(formatApiError(err));
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleStartReview(): Promise<void> {
    if (!id) return;
    setMessage(null);
    try {
      const client = createApiClient();
      await client.adminStartKycReview(id);
      setMessage('Status updated to IN_REVIEW');
      await load();
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  async function handleApprove(): Promise<void> {
    if (!id) return;
    setMessage(null);
    try {
      const client = createApiClient();
      await client.adminApproveKyc(id);
      setMessage('KYC submission approved successfully');
      await load();
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  async function handleConfirmReason(reason: string, internalNote?: string): Promise<void> {
    if (!id || !pendingKind) return;
    setBusy(true);
    setMessage(null);
    try {
      const client = createApiClient();
      if (pendingKind === 'reject') {
        await client.adminRejectKyc(id, reason, internalNote);
        setMessage('KYC submission rejected');
      } else {
        await client.adminRequestKycResubmission(id, reason);
        setMessage('Resubmission requested with instructions for customer');
      }
      setPendingKind(null);
      await load();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  const client = createApiClient();

  if (loading) {
    return (
      <main className="page">
        <p>Loading KYC verification detail…</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="page">
        <p>
          <Link href="/compliance">← Back to KYC queue</Link>
        </p>
        <p role="alert" style={{ color: 'red' }}>
          {error || 'Verification request not found'}
        </p>
      </main>
    );
  }

  const meta = data.metadata || {};

  return (
    <main className="page">
      <p>
        <Link href="/compliance">← Back to KYC queue</Link>
      </p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>KYC Review: {data.id.slice(0, 8)}…</h1>
        <div>
          <StatusBadge status={data.status} />
        </div>
      </div>

      {error ? (
        <p role="alert" style={{ color: 'red' }}>
          {error}
        </p>
      ) : null}
      {message ? <p style={{ color: 'green' }}>{message}</p> : null}

      {/* Review Actions */}
      <section
        style={{
          display: 'flex',
          gap: '0.75rem',
          padding: '1rem',
          background: '#f9f9f9',
          border: '1px solid #ddd',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          alignItems: 'center',
        }}
      >
        <span style={{ fontWeight: 'bold' }}>Review actions:</span>
        {data.status === 'SUBMITTED' ? (
          <Button type="button" variant="secondary" onClick={() => void handleStartReview()}>
            Start review (Set to In Review)
          </Button>
        ) : null}

        {data.status !== 'APPROVED' ? (
          <Button type="button" onClick={() => void handleApprove()}>
            Approve verification
          </Button>
        ) : null}

        <Button type="button" variant="secondary" onClick={() => setPendingKind('reject')}>
          Reject
        </Button>

        <Button type="button" variant="secondary" onClick={() => setPendingKind('resubmit')}>
          Request resubmission
        </Button>
      </section>

      {/* Grid: Customer profile & Submitted fields */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ border: '1px solid #eee', padding: '1rem', borderRadius: '8px' }}>
          <h2>Customer profile</h2>
          <p>
            <strong>User ID:</strong> <span className="mono">{data.ownerUserId}</span>
          </p>
          <p>
            <strong>Email:</strong> {data.customer?.email || '—'}
          </p>
          <p>
            <strong>Username:</strong> {data.customer?.username || '—'}
          </p>
          <p>
            <strong>Provider:</strong> {data.provider}
          </p>
          <p>
            <strong>Requested Level:</strong> {data.requestedLevel}
          </p>
          <p>
            <strong>Submitted At:</strong>{' '}
            {data.submittedAt ? new Date(data.submittedAt).toLocaleString() : '—'}
          </p>
          {data.reviewedAt ? (
            <p>
              <strong>Reviewed At:</strong> {new Date(data.reviewedAt).toLocaleString()} by{' '}
              {data.reviewedBy || 'Admin'}
            </p>
          ) : null}
          {data.rejectionReason ? (
            <p style={{ color: '#b00' }}>
              <strong>Customer Notice:</strong> {data.rejectionReason}
            </p>
          ) : null}
          {data.internalAdminNote ? (
            <p style={{ color: '#666', fontStyle: 'italic' }}>
              <strong>Internal Note:</strong> {data.internalAdminNote}
            </p>
          ) : null}
        </div>

        <div style={{ border: '1px solid #eee', padding: '1rem', borderRadius: '8px' }}>
          <h2>Submitted identification</h2>
          <p>
            <strong>Legal Name:</strong> {meta.legalName || '—'}
          </p>
          <p>
            <strong>Date of Birth:</strong> {meta.dateOfBirth || '—'}
          </p>
          <p>
            <strong>Country:</strong> {meta.country || '—'}
          </p>
          <p>
            <strong>ID Type:</strong> {meta.idType || '—'}
          </p>
          <p>
            <strong>ID Number:</strong> {meta.idNumber || '—'}
          </p>
          <p>
            <strong>ID Expiration:</strong> {meta.idExpiration || '—'}
          </p>
        </div>
      </div>

      {/* Government ID Documents */}
      <section
        style={{
          border: '1px solid #eee',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
        }}
      >
        <h2>Government ID documents</h2>
        <p style={{ fontSize: '0.85rem', color: '#666' }}>
          Documents are streamed via authenticated, short-lived signed tokens. No permanent URLs are
          exposed.
        </p>

        {loadingTokens ? <p>Generating secure view tokens…</p> : null}

        {data.documents.length === 0 ? (
          <p>No document files attached to this verification.</p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1rem',
            }}
          >
            {data.documents.map((doc) => {
              const token = docTokens[doc.id];
              const streamUrl = token ? client.adminDocumentContentUrl(doc.id, token) : null;

              return (
                <div
                  key={doc.id}
                  style={{
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    padding: '0.75rem',
                    background: '#fafafa',
                  }}
                >
                  <h3>
                    {doc.documentType} {doc.side ? `(${doc.side})` : ''}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: '#666' }}>
                    File: {doc.fileName || doc.id} · Status: {doc.status}
                  </p>

                  {streamUrl ? (
                    <div style={{ marginTop: '0.5rem' }}>
                      <img
                        src={streamUrl}
                        alt={`Document ${doc.documentType}`}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '260px',
                          display: 'block',
                          objectFit: 'contain',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          background: '#fff',
                        }}
                        onError={(e) => {
                          // Handle PDF or unsupported format fallback
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <a
                        href={streamUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-block',
                          marginTop: '0.5rem',
                          fontSize: '0.85rem',
                        }}
                      >
                        Open full document view ↗
                      </a>
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.85rem', color: '#888' }}>
                      Token expired or unavailable.{' '}
                      <button
                        type="button"
                        onClick={async () => {
                          const t = await client.adminGetDocumentViewToken(doc.id);
                          setDocTokens((prev) => ({ ...prev, [doc.id]: t.token }));
                        }}
                      >
                        Refresh token
                      </button>
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Audit Log */}
      <section
        style={{
          border: '1px solid #eee',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
        }}
      >
        <h2>KYC audit log</h2>
        {data.auditTrail.length === 0 ? (
          <p>No audit events recorded.</p>
        ) : (
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Action</th>
                <th>Actor</th>
                <th>Role</th>
                <th>Timestamp</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {data.auditTrail.map((ev) => (
                <tr key={ev.id}>
                  <td>
                    <strong>{ev.action}</strong>
                  </td>
                  <td className="mono">
                    {ev.actorUserId ? ev.actorUserId.slice(0, 8) + '…' : 'System'}
                  </td>
                  <td>{ev.actorRole || 'SYSTEM'}</td>
                  <td>{new Date(ev.createdAt).toLocaleString()}</td>
                  <td style={{ fontSize: '0.8rem', color: '#555' }}>
                    {ev.details ? JSON.stringify(ev.details) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Prior Verifications */}
      {data.priorVerifications && data.priorVerifications.length > 0 ? (
        <section style={{ border: '1px solid #eee', padding: '1rem', borderRadius: '8px' }}>
          <h2>Prior verification history</h2>
          <ul>
            {data.priorVerifications.map((p) => (
              <li key={p.id}>
                <strong>{p.status}</strong> — Submitted:{' '}
                {p.submittedAt ? new Date(p.submittedAt).toLocaleDateString() : '—'}
                {p.rejectionReason ? ` (Reason: ${p.rejectionReason})` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ConfirmReasonDialog
        open={pendingKind !== null}
        title={pendingKind === 'resubmit' ? 'Request resubmission' : 'Reject KYC'}
        description={
          pendingKind === 'resubmit'
            ? 'Customer-visible instructions are required. Internal notes stay in Admin only.'
            : 'A customer-visible rejection reason is required. Internal notes stay in Admin only.'
        }
        confirmLabel={pendingKind === 'resubmit' ? 'Request resubmission' : 'Reject'}
        pending={busy}
        showInternalNote={pendingKind === 'reject'}
        customerReasonLabel="Customer-visible reason"
        onOpenChange={(open) => {
          if (!open) setPendingKind(null);
        }}
        onConfirm={(reason, internalNote) => void handleConfirmReason(reason, internalNote)}
      />
    </main>
  );
}
