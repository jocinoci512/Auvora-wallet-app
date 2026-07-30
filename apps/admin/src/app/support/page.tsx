'use client';

import { Alert, Button, PageHeader, StatusBadge } from '@auvora/ui';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { Subnav } from '../../components/Subnav';
import { DEMO_TICKETS } from '../../lib/support-demo';
import { SUPPORT_LINKS } from '../../lib/section-nav';

export default function SupportQueuePage(): ReactElement {
  const openCount = DEMO_TICKETS.filter((t) => t.status !== 'resolved').length;
  const escalated = DEMO_TICKETS.filter((t) => t.status === 'escalated').length;
  const csatSamples = DEMO_TICKETS.filter((t) => t.csat != null);
  const avgCsat =
    csatSamples.length > 0
      ? (csatSamples.reduce((sum, t) => sum + (t.csat ?? 0), 0) / csatSamples.length).toFixed(1)
      : '—';

  return (
    <main className="page">
      <PageHeader
        title="Support queue"
        subtitle="Cases, verification, escalations, and CSAT — preview until a ticket domain ships."
      >
        <Subnav label="Support" links={SUPPORT_LINKS} />
      </PageHeader>

      <Alert tone="warn" title="Demo data">
        No support-ticket API exists yet. This queue uses labeled preview cases so ops can evaluate
        IA and workflows. Do not treat counts as live production metrics.
      </Alert>

      <div
        className="metric-grid"
        aria-label="Support preview metrics"
        style={{ marginTop: '1rem' }}
      >
        <div className="metric-card">
          <span className="metric-card__label">Open / pending (demo)</span>
          <span className="metric-card__value">{openCount}</span>
        </div>
        <div className="metric-card">
          <span className="metric-card__label">Escalated (demo)</span>
          <span className="metric-card__value">{escalated}</span>
        </div>
        <div className="metric-card">
          <span className="metric-card__label">Avg CSAT (demo)</span>
          <span className="metric-card__value">{avgCsat}</span>
        </div>
      </div>

      <div className="table-scroll" style={{ marginTop: '1.5rem' }}>
        <table className="data-table">
          <caption className="auvora-sr-only">Support ticket preview queue</caption>
          <thead>
            <tr>
              <th scope="col">Subject</th>
              <th scope="col">Status</th>
              <th scope="col">Priority</th>
              <th scope="col">Verified</th>
              <th scope="col">Assignee</th>
              <th scope="col">
                <span className="auvora-sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {DEMO_TICKETS.map((ticket) => (
              <tr key={ticket.id}>
                <td>
                  <div>{ticket.subject}</div>
                  <div className="page-subtitle">{ticket.requesterEmail}</div>
                </td>
                <td>
                  <StatusBadge status={ticket.status} />
                </td>
                <td>
                  <StatusBadge status={ticket.priority} />
                </td>
                <td>{ticket.verifiedUser ? 'Yes' : 'Unverified'}</td>
                <td>{ticket.assignee ?? 'Unassigned'}</td>
                <td>
                  <Link href={`/support/tickets/${ticket.id}`}>Open</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="action-row" style={{ marginTop: '1.25rem' }}>
        <Link href="/support/kb">
          <Button variant="secondary">Knowledge base</Button>
        </Link>
        <Link href="/support/templates">
          <Button variant="ghost">Response templates</Button>
        </Link>
        <Link href="/users">
          <Button variant="ghost">Verify user account</Button>
        </Link>
      </p>
    </main>
  );
}
