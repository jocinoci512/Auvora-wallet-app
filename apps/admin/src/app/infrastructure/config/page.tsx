'use client';

import { AuvoraClientError, type FeatureFlag } from '@auvora/sdk';
import { Alert, AsyncStates, Button, PageHeader, StatusBadge } from '@auvora/ui';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Subnav } from '../../../components/Subnav';
import { createApiClient, formatApiError } from '../../../lib/api-client';
import { useRealtimeRefetch } from '../../../lib/admin-realtime-context';
import type { AdminEvent } from '../../../lib/realtime/admin-event';
import { INFRA_LINKS } from '../../../lib/section-nav';

export default function InfrastructureConfigPage(): ReactElement {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyCode, setBusyCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      setFlags(await client.adminListFeatureFlags());
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

  useRealtimeRefetch(
    (event: AdminEvent) => event.type === 'FEATURE_FLAG_CHANGED',
    () => void load(),
    800,
  );

  async function toggleFlag(flag: FeatureFlag) {
    const next = flag.enabled ? 'disable' : 'enable';
    if (
      !window.confirm(
        `${next === 'disable' ? 'Disable' : 'Enable'} feature flag “${flag.code}”${flag.environmentCode ? ` (${flag.environmentCode})` : ''}? This is a runtime product control.`,
      )
    ) {
      return;
    }
    setBusyCode(flag.code);
    setActionError(null);
    try {
      const client = createApiClient();
      await client.adminUpdateFeatureFlag(flag.code, { enabled: !flag.enabled });
      await load();
    } catch (err) {
      setActionError(formatApiError(err));
    } finally {
      setBusyCode(null);
    }
  }

  return (
    <main className="page">
      <PageHeader
        title="Feature flags"
        subtitle="Runtime flags (environment-scoped). Secrets are never displayed."
      >
        <Subnav label="Infrastructure" links={INFRA_LINKS} />
      </PageHeader>

      {actionError ? (
        <Alert tone="error" title="Could not update flag">
          {actionError}
        </Alert>
      ) : null}

      <AsyncStates
        loading={loading}
        loadingMessage="Loading feature flags…"
        error={error}
        errorTitle="Could not load flags"
        onRetry={() => void load()}
        empty={!loading && !error && flags.length === 0}
        emptyTitle="No feature flags"
        emptyDescription="Seed or create flags via infrastructure APIs."
      >
        <div className="table-scroll">
          <table className="data-table">
            <caption className="auvora-sr-only">Feature flags</caption>
            <thead>
              <tr>
                <th scope="col">Code</th>
                <th scope="col">Environment</th>
                <th scope="col">State</th>
                <th scope="col">Description</th>
                <th scope="col">
                  <span className="auvora-sr-only">Toggle</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {flags.map((flag) => (
                <tr key={flag.id ?? flag.code}>
                  <td>
                    <code>{flag.code}</code>
                  </td>
                  <td>{flag.environmentCode ?? 'all'}</td>
                  <td>
                    <StatusBadge status={flag.enabled ? 'enabled' : 'disabled'} />
                  </td>
                  <td>{flag.description ?? '—'}</td>
                  <td>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busyCode === flag.code}
                      onClick={() => void toggleFlag(flag)}
                    >
                      {flag.enabled ? 'Disable' : 'Enable'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AsyncStates>
    </main>
  );
}
