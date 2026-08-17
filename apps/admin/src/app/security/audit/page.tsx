'use client';

import type { SecurityAuditLog } from '@auvora/sdk';
import { AsyncStates, Button, PageHeader, Pagination, StatusBadge } from '@auvora/ui';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Subnav } from '../../../components/Subnav';
import { formatWhen, shortId } from '../../../lib/admin-format';
import { isUnsafeField } from '../../../lib/admin-control-plane';
import { createApiClient, formatAdminError } from '../../../lib/api-client';
import { IDENTITY_LINKS } from '../../../lib/section-nav';

const PAGE_SIZE = 50;

function metadataPreview(metadata: Record<string, unknown> | null): string {
  if (!metadata) return '—';
  const safe = Object.entries(metadata)
    .filter(([key]) => !isUnsafeField(key))
    .map(([key, value]) => `${key}=${String(value)}`)
    .slice(0, 4);
  return safe.join(' · ') || '—';
}

export default function SecurityAuditPage(): ReactElement {
  const [logs, setLogs] = useState<SecurityAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState('');
  const [actorUserId, setActorUserId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [requestId, setRequestId] = useState('');
  const [applied, setApplied] = useState({
    action: '',
    actorUserId: '',
    targetUserId: '',
    page: 1,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      const result = await client.adminListAudit({
        action: applied.action.trim() || undefined,
        actorUserId: applied.actorUserId.trim() || undefined,
        targetUserId: applied.targetUserId.trim() || undefined,
        skip: (applied.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      });
      setLogs(result.logs);
      setTotal(result.total);
    } catch (err) {
      setError(formatAdminError(err));
    } finally {
      setLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    return logs.filter((log) => {
      const created = new Date(log.createdAt).getTime();
      if (from && created < new Date(from).getTime()) return false;
      if (to && created > new Date(to).getTime() + 86_400_000) return false;
      if (requestId.trim()) {
        const hay = JSON.stringify(log.metadata ?? {});
        if (!hay.includes(requestId.trim())) return false;
      }
      return true;
    });
  }, [logs, from, to, requestId]);

  return (
    <div className="page">
      <PageHeader
        title="Audit log"
        subtitle={
          loading
            ? 'Loading…'
            : `${total.toLocaleString()} immutable event${total === 1 ? '' : 's'}`
        }
      >
        <Subnav label="Identity" links={IDENTITY_LINKS} />
      </PageHeader>

      <section className="panel filters" aria-label="Audit filters">
        <form
          className="filters__row"
          onSubmit={(event) => {
            event.preventDefault();
            setApplied({
              action,
              actorUserId,
              targetUserId,
              page: 1,
            });
          }}
        >
          <label className="field">
            <span className="field-label">Action</span>
            <input
              className="field-input"
              value={action}
              onChange={(event) => setAction(event.target.value)}
              placeholder="e.g. ADMIN_ROLE_CHANGED"
            />
          </label>
          <label className="field">
            <span className="field-label">Actor</span>
            <input
              className="field-input"
              value={actorUserId}
              onChange={(event) => setActorUserId(event.target.value)}
              placeholder="User ID"
            />
          </label>
          <label className="field">
            <span className="field-label">Target</span>
            <input
              className="field-input"
              value={targetUserId}
              onChange={(event) => setTargetUserId(event.target.value)}
              placeholder="User ID"
            />
          </label>
          <label className="field">
            <span className="field-label">From</span>
            <input
              className="field-input"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">To</span>
            <input
              className="field-input"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Request ID</span>
            <input
              className="field-input"
              value={requestId}
              onChange={(event) => setRequestId(event.target.value)}
              placeholder="Filter current page"
            />
          </label>
          <Button type="submit">Search</Button>
        </form>
        <p className="page-subtitle">
          Actor, target, and action are server-side. Date range and request ID filter the current
          page.
        </p>
      </section>

      <AsyncStates
        loading={loading}
        loadingMessage="Loading audit trail…"
        error={error}
        errorTitle="Could not load audit logs"
        onRetry={() => void load()}
        empty={!loading && !error && visible.length === 0}
        emptyTitle="No audit results"
        emptyDescription="Widen filters or clear the date range."
      >
        <div className="table-scroll">
          <table className="data-table">
            <caption className="auvora-sr-only">Immutable audit log</caption>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Action</th>
                <th scope="col">Actor</th>
                <th scope="col">Target</th>
                <th scope="col">Result</th>
                <th scope="col">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((log) => (
                <tr key={log.id}>
                  <td>{formatWhen(log.createdAt)}</td>
                  <td>
                    <StatusBadge status={log.action} />
                  </td>
                  <td className="mono">{shortId(log.actorUserId, 10)}</td>
                  <td className="mono">{shortId(log.targetUserId, 10)}</td>
                  <td>Recorded</td>
                  <td>{metadataPreview(log.metadata)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={applied.page}
          pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
          onPageChange={(page) => setApplied((current) => ({ ...current, page }))}
        />
      </AsyncStates>
    </div>
  );
}
