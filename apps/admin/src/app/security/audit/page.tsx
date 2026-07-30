'use client';

import { AuvoraClientError, type SecurityAuditLog } from '@auvora/sdk';
import { AsyncStates, Button, PageHeader, StatusBadge } from '@auvora/ui';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Subnav } from '../../../components/Subnav';
import { createApiClient, formatApiError } from '../../../lib/api-client';
import { IDENTITY_LINKS } from '../../../lib/section-nav';

export default function SecurityAuditPage(): ReactElement {
  const [logs, setLogs] = useState<SecurityAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState('');
  const [actorUserId, setActorUserId] = useState('');
  const [applied, setApplied] = useState({ action: '', actorUserId: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      const result = await client.adminListAudit({
        action: applied.action.trim() || undefined,
        actorUserId: applied.actorUserId.trim() || undefined,
        take: 100,
      });
      setLogs(result.logs);
      setTotal(result.total);
    } catch (err) {
      setError(
        err instanceof AuvoraClientError && err.status === 401
          ? 'Unauthorized — save an admin JWT access token above.'
          : formatApiError(err),
      );
    } finally {
      setLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    void load();
  }, [load]);

  function runSearch(): void {
    setApplied({ action, actorUserId });
  }

  return (
    <main className="page">
      <PageHeader
        title="Audit logs"
        subtitle={loading ? 'Loading…' : `${total} security audit event${total === 1 ? '' : 's'}`}
      >
        <Subnav label="Identity" links={IDENTITY_LINKS} />
      </PageHeader>

      <section className="panel filters" aria-label="Audit filters">
        <div className="filters__row">
          <label className="field">
            <span className="field-label">Action</span>
            <input
              className="field-input"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="e.g. ROLES_UPDATED"
            />
          </label>
          <label className="field">
            <span className="field-label">Actor user ID</span>
            <input
              className="field-input"
              value={actorUserId}
              onChange={(e) => setActorUserId(e.target.value)}
              placeholder="UUID"
            />
          </label>
          <Button type="button" onClick={runSearch}>
            Search
          </Button>
        </div>
      </section>

      <AsyncStates
        loading={loading}
        loadingMessage="Loading audit trail…"
        error={error}
        errorTitle="Could not load audit logs"
        onRetry={() => void load()}
        empty={!loading && !error && logs.length === 0}
        emptyTitle="No audit events"
        emptyDescription="Admin account and session actions will appear here."
      >
        <div className="table-scroll">
          <table className="data-table">
            <caption className="auvora-sr-only">Security audit log</caption>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Action</th>
                <th scope="col">Actor</th>
                <th scope="col">Target</th>
                <th scope="col">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="mono">{new Date(log.createdAt).toLocaleString()}</td>
                  <td>
                    <StatusBadge status={log.action} />
                  </td>
                  <td className="mono">{log.actorUserId ?? '—'}</td>
                  <td className="mono">{log.targetUserId ?? '—'}</td>
                  <td className="mono">{log.ipAddress ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AsyncStates>
    </main>
  );
}
