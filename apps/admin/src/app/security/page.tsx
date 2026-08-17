'use client';

import type { OpsAlert, SecurityAuditLog } from '@auvora/sdk';
import { Alert, AsyncStates, Button, PageHeader, StatusBadge } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Subnav } from '../../components/Subnav';
import { RealtimeActivityFeed } from '../../components/RealtimeActivityFeed';
import { formatWhen, shortId } from '../../lib/admin-format';
import { useAdminRealtimeContext, useRealtimeRefetch } from '../../lib/admin-realtime-context';
import { createApiClient, formatAdminError } from '../../lib/api-client';
import { IDENTITY_LINKS } from '../../lib/section-nav';

export default function SecurityCenterPage(): ReactElement {
  const [alerts, setAlerts] = useState<OpsAlert[]>([]);
  const [events, setEvents] = useState<SecurityAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { status: realtimeStatus, events: liveEvents, reconnect } = useAdminRealtimeContext();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      const [alertResult, auditResult] = await Promise.all([
        client.adminListObservabilityAlerts().catch(() => ({ items: [] as OpsAlert[] })),
        client.adminListAudit({ take: 50 }).catch(() => ({ logs: [] as SecurityAuditLog[] })),
      ]);
      setAlerts(
        alertResult.items.filter(
          (item) =>
            /security|auth|fraud|breach|mfa|session/i.test(
              `${item.code} ${item.title} ${item.message}`,
            ) ||
            item.severity === 'critical' ||
            item.severity === 'CRITICAL',
        ),
      );
      setEvents(
        auditResult.logs.filter((log) =>
          /LOGIN|SESSION|DEVICE|STATUS|ROLE|MFA|STEP.?UP|SUSPEND|REVOKE|SECURITY/i.test(log.action),
        ),
      );
    } catch (err) {
      setError(formatAdminError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useRealtimeRefetch(
    (event) => event.type === 'SECURITY_EVENT' || event.type === 'SESSION_REVOKED',
    () => void load(),
  );

  return (
    <div className="page">
      <PageHeader
        title="Security operations"
        subtitle="Failed logins, revocations, suspensions, MFA, and step-up events from the audit trail. No synthetic risk scores."
      >
        <Subnav label="Identity" links={IDENTITY_LINKS} />
      </PageHeader>

      <Alert tone="info" title="Authoritative source">
        Backend audit and alerts are the source of truth. This board filters known security actions
        for operators.
      </Alert>

      <p className="action-row" style={{ margin: '1rem 0' }}>
        <Link href="/security/audit">
          <Button>Full audit log</Button>
        </Link>
        <Link href="/users">
          <Button variant="secondary">Users</Button>
        </Link>
        <Link href="/operators">
          <Button variant="ghost">Administrators</Button>
        </Link>
      </p>

      <AsyncStates
        loading={loading}
        loadingMessage="Loading security feed…"
        error={error}
        errorTitle="Could not load security events"
        onRetry={() => void load()}
        empty={!loading && !error && events.length === 0 && alerts.length === 0}
        emptyTitle="Empty security feed"
        emptyDescription="Security-relevant audit events and alerts will appear here when they occur."
      >
        {alerts.length > 0 ? (
          <section className="panel admin-section">
            <h2>Active security alerts</h2>
            <ul className="stack">
              {alerts.map((alert) => (
                <li key={alert.id}>
                  <StatusBadge status={alert.severity} /> <StatusBadge status={alert.status} />{' '}
                  {alert.title}
                  <p className="page-subtitle">{alert.message}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="admin-section">
          <h2>Security event log</h2>
          <div className="table-scroll">
            <p className="table-scroll__hint">Scroll sideways to see every column.</p>
            <table className="data-table">
              <caption className="auvora-sr-only">Security events</caption>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Action</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Target</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>{formatWhen(event.createdAt)}</td>
                    <td>
                      <StatusBadge status={event.action} />
                    </td>
                    <td className="mono">{shortId(event.actorUserId, 10)}</td>
                    <td className="mono">{shortId(event.targetUserId, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </AsyncStates>

      <section className="admin-section">
        <RealtimeActivityFeed
          status={realtimeStatus}
          events={liveEvents}
          onReconnect={reconnect}
          limit={12}
        />
      </section>
    </div>
  );
}
