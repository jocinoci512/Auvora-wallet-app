'use client';

import { Alert, EmptyState, LoadingBlock, Skeleton, StatusBadge } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { type PlatformStatus } from '@auvora/sdk';
import { LegalNav } from '../../components/legal/LegalShell';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { createApiClient, formatApiError } from '../../lib/api-client';

export default function PlatformStatusPage(): ReactElement {
  const [status, setStatus] = useState<PlatformStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient({ timeoutMs: 8_000 });
      setStatus(await client.getPlatformStatus());
    } catch (err) {
      setStatus(null);
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PlatformShell
      title="Status"
      subtitle="Public maintenance, incidents, and service health — calm and factual."
      reassure="If something is wrong, we say so here. Your recovery phrase is never required to check status."
      backHref="/dashboard"
      backLabel="Wallet"
      nav={<LegalNav current="/status" />}
      actions={
        <button type="button" className="cx-btn cx-btn--ghost" onClick={() => void load()}>
          Refresh
        </button>
      }
    >
      {loading ? (
        <>
          <LoadingBlock message="Loading platform status…" />
          <Skeleton rows={4} label="Loading status" />
        </>
      ) : null}

      {error ? (
        <Alert tone="error" title="Could not load status">
          {error}
          <p className="cx-meta" style={{ marginTop: '0.5rem' }}>
            If the API is offline locally, that does not mean your wallet keys are affected.
          </p>
        </Alert>
      ) : null}

      {!loading && status ? (
        <>
          <section className="cx-panel" aria-label="Overall status">
            <h2>Overall</h2>
            <p>
              <StatusBadge status={status.overall} /> Updated{' '}
              {new Date(status.generatedAt).toLocaleString()}
            </p>
            <p className="cx-meta">
              For security posture and honesty principles, see{' '}
              <Link href="/trust">Trust & transparency</Link>.
            </p>
          </section>

          <section className="cx-panel">
            <h2>Maintenance</h2>
            {status.maintenanceNotices.length === 0 ? (
              <EmptyState
                title="No active maintenance"
                description="There are no scheduled notices right now."
              />
            ) : (
              <ul className="cx-list">
                {status.maintenanceNotices.map((notice) => (
                  <li key={notice.id}>
                    <div>
                      <strong>{notice.title}</strong>
                      <p className="cx-meta">{notice.message}</p>
                    </div>
                    <StatusBadge status={notice.severity} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="cx-panel">
            <h2>Incidents</h2>
            {status.incidents.length === 0 ? (
              <EmptyState
                title="No public incidents"
                description="No open incidents are published."
              />
            ) : (
              <ul className="cx-list">
                {status.incidents.map((incident) => (
                  <li key={incident.code}>
                    <div>
                      <strong>
                        {incident.code} — {incident.title}
                      </strong>
                      <p className="cx-meta">
                        {incident.severity} · {incident.status}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="cx-panel">
            <h2>Services</h2>
            {status.services.length === 0 ? (
              <EmptyState
                title="No service samples"
                description="Health samples have not arrived yet."
              />
            ) : (
              <ul className="cx-list">
                {status.services.map((service) => (
                  <li key={service.serviceName}>
                    <strong>{service.serviceName}</strong>
                    <StatusBadge status={service.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </PlatformShell>
  );
}
