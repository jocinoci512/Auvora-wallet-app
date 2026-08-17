'use client';

import { AsyncStates, Button, PageHeader, StatusBadge } from '@auvora/ui';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { env } from '../../env';
import { formatWhen, shortId } from '../../lib/admin-format';
import { toSafeConnection, type SafeConnectionRow } from '../../lib/admin-control-plane';
import { formatAdminError } from '../../lib/api-client';

type Providers = {
  providers: Array<{ code: string; name: string; healthy: boolean; latencyMs: number }>;
};

type Sessions = {
  active: number;
  pending: number;
  terminated: number;
};

export default function AdminConnectionsPage(): ReactElement {
  const [providers, setProviders] = useState<Providers | null>(null);
  const [connections, setConnections] = useState<SafeConnectionRow[]>([]);
  const [sessions, setSessions] = useState<Sessions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const base = env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
      const headers = { accept: 'application/json' };
      const [providerRes, connectionRes, sessionRes] = await Promise.all([
        fetch(`${base}/api/v1/admin/connections/providers`, { headers, credentials: 'include' }),
        fetch(`${base}/api/v1/admin/connections/connections`, { headers, credentials: 'include' }),
        fetch(`${base}/api/v1/admin/connections/sessions`, { headers, credentials: 'include' }),
      ]);
      for (const res of [providerRes, connectionRes, sessionRes]) {
        if (!res.ok) {
          const err = new Error(`Request failed (${res.status})`) as Error & { status?: number };
          err.status = res.status;
          throw err;
        }
      }
      const providerPayload = (await providerRes.json()) as { data: Providers };
      const connectionPayload = (await connectionRes.json()) as {
        data: Array<Record<string, unknown>>;
      };
      const sessionPayload = (await sessionRes.json()) as { data: Sessions };
      setProviders(providerPayload.data);
      setConnections((connectionPayload.data ?? []).map(toSafeConnection));
      setSessions(sessionPayload.data);
    } catch (err) {
      setError(formatAdminError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="page">
      <PageHeader
        title="Connections"
        subtitle="Safe connection metadata only. WalletConnect secrets are never displayed."
        actions={
          <Button type="button" variant="secondary" onClick={() => void load()}>
            Refresh
          </Button>
        }
      />

      <section className="admin-kpi-grid" aria-label="Connection sessions">
        <div className="admin-kpi">
          <span className="admin-kpi__label">Active</span>
          <span className="admin-kpi__value">{sessions?.active ?? '—'}</span>
        </div>
        <div className="admin-kpi">
          <span className="admin-kpi__label">Pending</span>
          <span className="admin-kpi__value">{sessions?.pending ?? '—'}</span>
        </div>
        <div className="admin-kpi">
          <span className="admin-kpi__label">Terminated</span>
          <span className="admin-kpi__value">{sessions?.terminated ?? '—'}</span>
        </div>
      </section>

      <section className="admin-section panel">
        <h2>Providers</h2>
        <ul className="stack">
          {(providers?.providers ?? []).map((provider) => (
            <li key={provider.code}>
              <StatusBadge status={provider.healthy ? 'HEALTHY' : 'UNAVAILABLE'} /> {provider.name}{' '}
              · {provider.latencyMs}ms
            </li>
          ))}
        </ul>
      </section>

      <AsyncStates
        loading={loading}
        loadingMessage="Loading connections…"
        error={error}
        errorTitle="Could not load connections"
        onRetry={() => void load()}
        empty={!loading && !error && connections.length === 0}
        emptyTitle="No connections"
        emptyDescription="No external wallet connections have been recorded."
      >
        <div className="table-scroll">
          <table className="data-table">
            <caption className="auvora-sr-only">External connections</caption>
            <thead>
              <tr>
                <th scope="col">Provider / app</th>
                <th scope="col">Status</th>
                <th scope="col">Platform</th>
                <th scope="col">Created</th>
                <th scope="col">Last activity</th>
                <th scope="col">ID</th>
              </tr>
            </thead>
            <tbody>
              {connections.map((row) => (
                <tr key={row.id}>
                  <td>{row.label || row.providerCode}</td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                  <td>{row.kind}</td>
                  <td>{formatWhen(row.createdAt)}</td>
                  <td>{formatWhen(row.updatedAt || row.connectedAt)}</td>
                  <td className="mono">{shortId(row.id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AsyncStates>
    </div>
  );
}
