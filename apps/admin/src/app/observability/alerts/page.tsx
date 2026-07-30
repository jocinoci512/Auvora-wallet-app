'use client';

import { AuvoraClientError, type OpsAlert } from '@auvora/sdk';
import { Alert, AsyncStates, Button, PageHeader, StatusBadge } from '@auvora/ui';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Subnav } from '../../../components/Subnav';
import { createApiClient, formatApiError } from '../../../lib/api-client';
import { OPS_LINKS } from '../../../lib/section-nav';

function canTriage(status: string): boolean {
  const s = status.toUpperCase();
  return s !== 'RESOLVED' && s !== 'CLOSED' && s !== 'ACKNOWLEDGED';
}

function canResolve(status: string): boolean {
  const s = status.toUpperCase();
  return s !== 'RESOLVED' && s !== 'CLOSED';
}

export default function AdminAlertsPage(): ReactElement {
  const [items, setItems] = useState<OpsAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      const result = await client.adminListObservabilityAlerts();
      setItems(result.items);
    } catch (err) {
      setError(
        err instanceof AuvoraClientError && err.status === 401
          ? 'Unauthorized — save a JWT access token above.'
          : formatApiError(err),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function acknowledge(id: string): Promise<void> {
    if (!window.confirm('Acknowledge this alert?')) return;
    setBusyId(id);
    setActionError(null);
    try {
      const client = createApiClient();
      await client.adminAcknowledgeAlert(id);
      await load();
    } catch (err) {
      setActionError(formatApiError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function resolve(id: string): Promise<void> {
    if (!window.confirm('Resolve this alert?')) return;
    setBusyId(id);
    setActionError(null);
    try {
      const client = createApiClient();
      await client.adminResolveAlert(id);
      await load();
    } catch (err) {
      setActionError(formatApiError(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="page">
      <PageHeader title="Alert Center" subtitle="Acknowledge and resolve platform alerts.">
        <Subnav label="Observability sections" links={OPS_LINKS} />
      </PageHeader>

      {actionError ? (
        <Alert tone="error" title="Action failed">
          {actionError}
        </Alert>
      ) : null}

      <AsyncStates
        loading={loading}
        loadingMessage="Loading alerts…"
        error={error}
        errorTitle="Could not load alerts"
        onRetry={() => void load()}
        empty={!loading && !error && items.length === 0}
        emptyTitle="No alerts"
        emptyDescription="The alert center is quiet — no open or recent alerts."
      >
        <ul className="stack">
          {items.map((alert) => (
            <li key={alert.id}>
              <div className="action-row" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <StatusBadge status={alert.severity} /> <StatusBadge status={alert.status} />{' '}
                  <strong>{alert.title}</strong>
                  <p className="page-subtitle" style={{ marginTop: '0.35rem' }}>
                    {alert.message}
                  </p>
                  <p className="page-subtitle">
                    {alert.serviceName ?? 'platform'} · {new Date(alert.firedAt).toLocaleString()}
                  </p>
                </div>
                {canResolve(alert.status) ? (
                  <div className="action-row">
                    {canTriage(alert.status) ? (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busyId === alert.id}
                        onClick={() => void acknowledge(alert.id)}
                      >
                        Acknowledge
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      disabled={busyId === alert.id}
                      onClick={() => void resolve(alert.id)}
                    >
                      Resolve
                    </Button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </AsyncStates>
    </main>
  );
}
