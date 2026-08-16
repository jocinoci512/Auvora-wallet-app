'use client';

import {
  AuvoraClientError,
  type AdminMaintenanceNotice,
  type AnalyticsInsightsSummary,
  type OpsDashboardOverview,
} from '@auvora/sdk';
import {
  Alert,
  Button,
  EmptyState,
  LoadingBlock,
  PageHeader,
  Skeleton,
  StatusBadge,
} from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../lib/api-client';
import { RealtimeActivityFeed } from '../components/RealtimeActivityFeed';
import { useAdminRealtime } from '../lib/realtime/useAdminRealtime';

type OverviewState = {
  ops: OpsDashboardOverview | null;
  analytics: AnalyticsInsightsSummary | null;
  maintenance: AdminMaintenanceNotice[];
  opsError: string | null;
  analyticsError: string | null;
};

export default function HomePage(): ReactElement {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<OverviewState>({
    ops: null,
    analytics: null,
    maintenance: [],
    opsError: null,
    analyticsError: null,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const client = createApiClient();
    const next: OverviewState = {
      ops: null,
      analytics: null,
      maintenance: [],
      opsError: null,
      analyticsError: null,
    };

    try {
      next.ops = await client.adminObservabilityDashboard();
      next.maintenance = next.ops.maintenanceNotices ?? [];
    } catch (err) {
      next.opsError =
        err instanceof AuvoraClientError && err.status === 401
          ? 'Unauthorized — save an admin JWT access token above.'
          : formatApiError(err);
      try {
        next.maintenance = await client.adminListMaintenance();
      } catch {
        /* optional */
      }
    }

    try {
      next.analytics = await client.adminAnalyticsInsights();
    } catch (err) {
      next.analyticsError =
        err instanceof AuvoraClientError && err.status === 401
          ? 'Unauthorized — save an admin JWT access token above.'
          : formatApiError(err);
    }

    setState(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime overview: debounced reconciling refresh + a live activity panel.
  const loadRef = useRef(load);
  loadRef.current = load;
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    status: realtimeStatus,
    events: realtimeEvents,
    reconnect,
  } = useAdminRealtime({
    onEvent: () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(() => void loadRef.current(), 2000);
    },
  });
  useEffect(
    () => () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
    },
    [],
  );

  const activeMaintenance = state.maintenance.filter((m) => m.isActive !== false);
  const unhealthy = state.ops?.unhealthyServiceCount ?? 0;
  const openIncidents = state.ops?.openIncidentCount ?? 0;

  return (
    <main className="page">
      <PageHeader
        title="Operations overview"
        subtitle="Live platform posture — health, incidents, maintenance, and product signals."
      >
        <div className="action-row">
          <Button type="button" variant="secondary" onClick={() => void load()}>
            Refresh
          </Button>
          <Link href="/observability">
            <Button variant="ghost">Ops</Button>
          </Link>
          <Link href="/infrastructure">
            <Button variant="ghost">Infra</Button>
          </Link>
        </div>
      </PageHeader>

      <section style={{ margin: '16px 0' }}>
        <RealtimeActivityFeed
          status={realtimeStatus}
          events={realtimeEvents}
          onReconnect={reconnect}
          limit={10}
        />
      </section>

      {activeMaintenance.length > 0 ? (
        <Alert tone="warn" title="Maintenance notices">
          {activeMaintenance.map((notice) => (
            <div key={notice.id}>
              <strong>{notice.title}</strong> — {notice.message}
            </div>
          ))}
        </Alert>
      ) : null}

      {loading ? (
        <>
          <LoadingBlock message="Loading overview…" />
          <Skeleton rows={3} label="Loading overview metrics" />
        </>
      ) : null}

      {state.opsError ? (
        <Alert tone="error" title="Could not load operations dashboard">
          {state.opsError}
        </Alert>
      ) : null}

      {!loading && state.ops ? (
        <div className="metric-grid" aria-label="Live operations metrics">
          <div className="metric-card">
            <span className="metric-card__label">Open alerts</span>
            <span className="metric-card__value">{state.ops.openAlertCount}</span>
          </div>
          <div className="metric-card">
            <span className="metric-card__label">Open incidents</span>
            <span className="metric-card__value">{openIncidents}</span>
          </div>
          <div className="metric-card">
            <span className="metric-card__label">Unhealthy services</span>
            <span className="metric-card__value">{unhealthy}</span>
          </div>
          <div className="metric-card">
            <span className="metric-card__label">Event volume</span>
            <span className="metric-card__value">
              {state.analytics ? state.analytics.eventVolume : '—'}
            </span>
          </div>
        </div>
      ) : null}

      {!loading && state.ops ? (
        <section
          className="panel"
          aria-label="Service health strip"
          style={{ marginTop: '1.5rem' }}
        >
          <h2>System health</h2>
          {state.ops.services.length === 0 ? (
            <EmptyState
              title="No health samples"
              description="Telemetry has not reported service status yet."
            />
          ) : (
            <ul className="stack">
              {state.ops.services.map((service) => (
                <li key={service.serviceName}>
                  <span
                    className={`dot ${service.status === 'OK' || service.status === 'HEALTHY' ? 'dot--healthy' : 'dot--unhealthy'}`}
                    aria-hidden
                  />
                  {service.serviceName}: <StatusBadge status={service.status} />
                </li>
              ))}
            </ul>
          )}
          <p className="page-subtitle" style={{ marginTop: '0.75rem' }}>
            Generated {state.ops.generatedAt}
          </p>
        </section>
      ) : null}

      {!loading && state.ops?.openIncidents?.length ? (
        <section className="panel" style={{ marginTop: '1.5rem' }} aria-label="Open incidents">
          <h2>Open incidents</h2>
          <ul className="stack">
            {state.ops.openIncidents.slice(0, 5).map((incident) => (
              <li key={incident.id}>
                <StatusBadge status={incident.severity} /> <StatusBadge status={incident.status} />{' '}
                {incident.code} — {incident.title}
              </li>
            ))}
          </ul>
          <p className="action-row" style={{ marginTop: '0.75rem' }}>
            <Link href="/observability/incidents">
              <Button variant="secondary">Triage incidents</Button>
            </Link>
          </p>
        </section>
      ) : null}

      {!loading && state.analytics ? (
        <section style={{ marginTop: '1.5rem' }} aria-label="Product analytics">
          <h2>Live product signals</h2>
          <p className="page-subtitle">
            Analytics insights · lag{' '}
            {state.analytics.aggregationLagMs != null
              ? `${state.analytics.aggregationLagMs}ms`
              : 'n/a'}
          </p>
          {state.analytics.insights.length === 0 ? (
            <EmptyState
              title="No insights"
              description="Aggregation has not produced insights yet."
            />
          ) : (
            <ul className="stack">
              {state.analytics.insights.slice(0, 5).map((item, index) => (
                <li key={`${item.title}-${index}`}>
                  <StatusBadge status={item.severity} /> {item.title} — {item.description}
                </li>
              ))}
            </ul>
          )}
          <p className="action-row" style={{ marginTop: '1rem' }}>
            <Link href="/analytics">
              <Button variant="secondary">Open analytics</Button>
            </Link>
            <Link href="/wallets">
              <Button variant="ghost">Wallet metrics</Button>
            </Link>
            <Link href="/support">
              <Button variant="ghost">Support queue (demo)</Button>
            </Link>
          </p>
        </section>
      ) : null}

      {!loading && state.analyticsError && !state.analytics ? (
        <Alert tone="info" title="Analytics unavailable">
          {state.analyticsError}
        </Alert>
      ) : null}

      <section style={{ marginTop: '2rem' }} aria-label="Admin shortcuts">
        <h2>Operate</h2>
        <p className="action-row">
          <Link href="/users">
            <Button>Users & RBAC</Button>
          </Link>
          <Link href="/security/audit">
            <Button variant="secondary">Audit logs</Button>
          </Link>
          <Link href="/observability/maintenance">
            <Button variant="secondary">Maintenance</Button>
          </Link>
          <Link href="/infrastructure/config">
            <Button variant="ghost">Feature flags</Button>
          </Link>
          <Link href="/settings">
            <Button variant="ghost">System settings</Button>
          </Link>
        </p>
      </section>
    </main>
  );
}
