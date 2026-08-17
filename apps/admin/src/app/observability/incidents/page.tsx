'use client';

import { AuvoraClientError, type OpsIncident } from '@auvora/sdk';
import { Alert, AsyncStates, Button, PageHeader, StatusBadge } from '@auvora/ui';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Subnav } from '../../../components/Subnav';
import { createApiClient, formatApiError } from '../../../lib/api-client';
import { OPS_LINKS } from '../../../lib/section-nav';

function canTriage(status: string): boolean {
  const s = status.toUpperCase();
  return s !== 'RESOLVED' && s !== 'CLOSED';
}

export default function AdminIncidentsPage(): ReactElement {
  const [items, setItems] = useState<OpsIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      setItems((await client.adminListObservabilityIncidents()).items);
    } catch (err) {
      setError(
        err instanceof AuvoraClientError && err.status === 401
          ? 'Your Admin session expired. Sign in again.'
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
    if (!window.confirm('Acknowledge this incident?')) return;
    setBusyId(id);
    setActionError(null);
    try {
      const client = createApiClient();
      await client.adminAcknowledgeIncident(id);
      await load();
    } catch (err) {
      setActionError(formatApiError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function resolve(id: string): Promise<void> {
    if (!window.confirm('Resolve this incident? Mark only when impact is contained.')) return;
    setBusyId(id);
    setActionError(null);
    try {
      const client = createApiClient();
      await client.adminResolveIncident(id, { rootCause: 'Resolved from admin console' });
      await load();
    } catch (err) {
      setActionError(formatApiError(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="page">
      <PageHeader
        title="Incident Center"
        subtitle="Acknowledge and resolve live incidents. Actions call the observability admin API."
      >
        <Subnav label="Observability sections" links={OPS_LINKS} />
      </PageHeader>

      {actionError ? (
        <Alert tone="error" title="Triage failed">
          {actionError}
        </Alert>
      ) : null}

      <AsyncStates
        loading={loading}
        loadingMessage="Loading incidents…"
        error={error}
        errorTitle="Could not load incidents"
        onRetry={() => void load()}
        empty={!loading && !error && items.length === 0}
        emptyTitle="No incidents"
        emptyDescription="No open or recent incidents."
      >
        <ul className="stack">
          {items.map((incident) => (
            <li key={incident.id}>
              <div className="action-row" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <StatusBadge status={incident.severity} />{' '}
                  <StatusBadge status={incident.status} />{' '}
                  <strong>
                    {incident.code} — {incident.title}
                  </strong>
                  <p className="page-subtitle" style={{ marginTop: '0.35rem' }}>
                    {incident.serviceName ?? 'platform'} ·{' '}
                    {new Date(incident.startedAt).toLocaleString()}
                  </p>
                </div>
                {canTriage(incident.status) ? (
                  <div className="action-row">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busyId === incident.id}
                      onClick={() => void acknowledge(incident.id)}
                    >
                      Acknowledge
                    </Button>
                    <Button
                      type="button"
                      disabled={busyId === incident.id}
                      onClick={() => void resolve(incident.id)}
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
