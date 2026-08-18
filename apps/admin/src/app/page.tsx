'use client';

import type { AnalyticsInsightsSummary, OpsDashboardOverview } from '@auvora/sdk';
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
import { Suspense, useCallback, useEffect, useState, type ReactElement } from 'react';
import { RealtimeActivityFeed } from '../components/RealtimeActivityFeed';
import { MfaEnabledNotice } from '../components/MfaEnabledNotice';
import { createApiClient, formatAdminError } from '../lib/api-client';
import { useAdminRealtimeContext, useRealtimeRefetch } from '../lib/admin-realtime-context';
import { healthLabel, healthTone } from '../lib/admin-format';
import { env } from '../env';
import type { AdminEvent } from '../lib/realtime/admin-event';

type OverviewState = {
  users: number | null;
  activeUsers: number | null;
  suspended: number | null;
  wallets: number | null;
  auditEvents: number | null;
  connectionSessions: number | null;
  ops: OpsDashboardOverview | null;
  analytics: AnalyticsInsightsSummary | null;
  errors: string[];
};

function shouldRefreshDashboard(event: AdminEvent): boolean {
  return (
    event.type === 'USER_CREATED' ||
    event.type === 'ACCOUNT_STATUS_CHANGED' ||
    event.type === 'SESSION_CREATED' ||
    event.type === 'SESSION_REVOKED' ||
    event.type === 'CONNECTION_CREATED' ||
    event.type === 'CONNECTION_DISCONNECTED' ||
    event.type === 'SECURITY_EVENT' ||
    event.type === 'SERVICE_HEALTH_CHANGED'
  );
}

export default function HomePage(): ReactElement {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<OverviewState>({
    users: null,
    activeUsers: null,
    suspended: null,
    wallets: null,
    auditEvents: null,
    connectionSessions: null,
    ops: null,
    analytics: null,
    errors: [],
  });
  const { status: realtimeStatus, events: realtimeEvents, reconnect } = useAdminRealtimeContext();

  const load = useCallback(async () => {
    setLoading(true);
    const client = createApiClient();
    const next: OverviewState = {
      users: null,
      activeUsers: null,
      suspended: null,
      wallets: null,
      auditEvents: null,
      connectionSessions: null,
      ops: null,
      analytics: null,
      errors: [],
    };
    const tasks: Array<Promise<void>> = [
      client
        .adminSearchUsers({ take: 1 })
        .then((result) => {
          next.users = result.total;
        })
        .catch((err) => {
          next.errors.push(formatAdminError(err));
        }),
      client
        .adminSearchUsers({ status: 'ACTIVE', take: 1 })
        .then((result) => {
          next.activeUsers = result.total;
        })
        .catch(() => undefined),
      client
        .adminSearchUsers({ status: 'SUSPENDED', take: 1 })
        .then((result) => {
          next.suspended = result.total;
        })
        .catch(() => undefined),
      client
        .adminListWallets({ take: 1 })
        .then((result) => {
          next.wallets = result.total;
        })
        .catch(() => undefined),
      client
        .adminListAudit({ take: 1 })
        .then((result) => {
          next.auditEvents = result.total;
        })
        .catch(() => undefined),
      client
        .adminObservabilityDashboard()
        .then((ops) => {
          next.ops = ops;
        })
        .catch((err) => {
          next.errors.push(formatAdminError(err));
        }),
      client
        .adminAnalyticsInsights()
        .then((analytics) => {
          next.analytics = analytics;
        })
        .catch(() => undefined),
      fetch(`${env.NEXT_PUBLIC_API_URL}/api/v1/admin/connections/sessions`, {
        credentials: 'include',
      })
        .then(async (res) => {
          if (!res.ok) return;
          const payload = (await res.json()) as { data?: { active?: number } };
          next.connectionSessions = payload.data?.active ?? null;
        })
        .catch(() => undefined),
    ];
    await Promise.all(tasks);
    setState(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useRealtimeRefetch(shouldRefreshDashboard, () => void load(), 2000);

  const activeMaintenance = state.ops?.maintenanceNotices ?? [];

  return (
    <div className="page">
      <PageHeader
        title="Operations dashboard"
        subtitle="Live control-plane posture. Counts come from Admin APIs; missing services show as unavailable."
        actions={
          <div className="action-row">
            <Button type="button" variant="secondary" onClick={() => void load()}>
              Refresh
            </Button>
            <Link href="/observability/health">
              <Button variant="ghost">System health</Button>
            </Link>
          </div>
        }
      />

      <Suspense fallback={null}>
        <MfaEnabledNotice />
      </Suspense>

      {activeMaintenance.length > 0 ? (
        <Alert tone="warn" title="Maintenance notices">
          {activeMaintenance.map((notice) => (
            <div key={notice.id}>
              <strong>{notice.title}</strong> — {notice.message}
            </div>
          ))}
        </Alert>
      ) : null}

      {state.errors.length > 0 ? (
        <Alert tone="error" title="Some metrics could not be loaded">
          {state.errors[0]}
        </Alert>
      ) : null}

      {loading ? (
        <>
          <LoadingBlock message="Loading operational metrics…" />
          <Skeleton rows={3} label="Loading dashboard" />
        </>
      ) : (
        <section className="admin-kpi-grid" aria-label="Operational metrics">
          <Metric label="Total users" value={state.users} href="/users" />
          <Metric label="Active users" value={state.activeUsers} href="/users" />
          <Metric label="Suspended accounts" value={state.suspended} href="/users" />
          <Metric label="Connected wallets" value={state.wallets} href="/wallets" />
          <Metric
            label="Active connections"
            value={state.connectionSessions}
            href="/connections"
            hint="WalletConnect sessions currently active"
          />
          <Metric label="Security events" value={state.auditEvents} href="/security/audit" />
          <Metric
            label="Open alerts"
            value={state.ops?.openAlertCount ?? null}
            href="/observability/alerts"
          />
          <Metric
            label="Unhealthy services"
            value={state.ops?.unhealthyServiceCount ?? null}
            href="/observability/health"
          />
        </section>
      )}

      <section className="admin-section panel" aria-label="Service health">
        <h2>Service health</h2>
        {!state.ops || state.ops.services.length === 0 ? (
          <EmptyState
            title="Health unavailable"
            description="Observability has not reported service status yet."
          />
        ) : (
          <ul className="stack">
            {state.ops.services.map((service) => (
              <li key={service.serviceName}>
                <span className={`health-pill health-pill--${healthTone(service.status)}`}>
                  {healthLabel(service.status)}
                </span>{' '}
                {service.serviceName}
                {state.ops?.generatedAt ? (
                  <span className="page-subtitle"> · last checked {state.ops.generatedAt}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="admin-section">
        <RealtimeActivityFeed
          status={realtimeStatus}
          events={realtimeEvents}
          onReconnect={reconnect}
          limit={12}
        />
      </section>

      {state.analytics ? (
        <section className="admin-section panel" aria-label="Product signals">
          <h2>Product signals</h2>
          <p className="page-subtitle">Event volume {state.analytics.eventVolume}</p>
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
        </section>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  href,
  hint,
}: {
  label: string;
  value: number | null;
  href: string;
  hint?: string;
}): ReactElement {
  return (
    <Link href={href} className="admin-kpi" style={{ textDecoration: 'none', color: 'inherit' }}>
      <span className="admin-kpi__label">{label}</span>
      <span className="admin-kpi__value">{value == null ? '—' : value.toLocaleString()}</span>
      {hint ? <p className="admin-kpi__hint">{hint}</p> : null}
      {value == null ? <p className="admin-kpi__hint">Not reported</p> : null}
    </Link>
  );
}
