'use client';

import { AuvoraClientError, type AdminMaintenanceNotice } from '@auvora/sdk';
import { Alert, AsyncStates, Button, PageHeader, StatusBadge } from '@auvora/ui';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Subnav } from '../../../components/Subnav';
import { createApiClient, formatApiError } from '../../../lib/api-client';
import { OPS_LINKS } from '../../../lib/section-nav';

export default function MaintenancePage(): ReactElement {
  const [items, setItems] = useState<AdminMaintenanceNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formOk, setFormOk] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState('info');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      setItems(await client.adminListMaintenance());
    } catch (err) {
      setError(
        err instanceof AuvoraClientError && err.status === 401
          ? 'Unauthorized — save an admin JWT access token above.'
          : formatApiError(err),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createNotice() {
    if (
      !window.confirm('Publish this maintenance notice to the public status page and ops overview?')
    ) {
      return;
    }
    setBusy(true);
    setFormError(null);
    setFormOk(null);
    try {
      if (!title.trim() || !message.trim() || !startsAt) {
        throw new Error('Title, message, and start time are required.');
      }
      const client = createApiClient();
      await client.adminCreateMaintenance({
        title: title.trim(),
        message: message.trim(),
        severity,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
      });
      setFormOk('Maintenance notice published.');
      setTitle('');
      setMessage('');
      setEndsAt('');
      await load();
    } catch (err) {
      setFormError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function endNotice(id: string, noticeTitle: string): Promise<void> {
    if (
      !window.confirm(
        `End maintenance notice “${noticeTitle}”? It will leave the public status page.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setFormError(null);
    setFormOk(null);
    try {
      const client = createApiClient();
      await client.adminSetMaintenanceActive(id, false);
      setFormOk('Maintenance notice ended.');
      await load();
    } catch (err) {
      setFormError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <PageHeader
        title="Maintenance notices"
        subtitle="Publish and end notices that surface on the public status page and ops overview."
      >
        <Subnav label="Observability sections" links={OPS_LINKS} />
      </PageHeader>

      {formError ? (
        <Alert tone="error" title="Could not publish notice">
          {formError}
        </Alert>
      ) : null}
      {formOk ? (
        <Alert tone="success" title="Published">
          {formOk}
        </Alert>
      ) : null}

      <section className="panel" aria-label="Create maintenance notice">
        <h2>Schedule notice</h2>
        <div className="filters__row">
          <label className="field">
            <span className="field-label">Title</span>
            <input
              className="field-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Scheduled maintenance"
            />
          </label>
          <label className="field">
            <span className="field-label">Severity</span>
            <select
              className="field-input"
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            >
              <option value="info">info</option>
              <option value="warning">warning</option>
              <option value="critical">critical</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Starts</span>
            <input
              className="field-input"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Ends (optional)</span>
            <input
              className="field-input"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </label>
        </div>
        <label className="field" style={{ display: 'block', marginTop: '0.75rem' }}>
          <span className="field-label">Message</span>
          <textarea
            className="field-input"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What customers should expect"
          />
        </label>
        <div className="action-row" style={{ marginTop: '0.75rem' }}>
          <Button type="button" disabled={busy} onClick={() => void createNotice()}>
            Publish notice
          </Button>
        </div>
      </section>

      <h2 style={{ marginTop: '1.5rem' }}>Notices</h2>
      <AsyncStates
        loading={loading}
        loadingMessage="Loading maintenance notices…"
        error={error}
        errorTitle="Could not load notices"
        onRetry={() => void load()}
        empty={!loading && !error && items.length === 0}
        emptyTitle="No maintenance notices"
        emptyDescription="Publish a notice when planning downtime or degraded capacity."
      >
        <ul className="stack">
          {items.map((notice) => (
            <li key={notice.id}>
              <div className="action-row" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <StatusBadge status={notice.severity} />{' '}
                  {notice.isActive === false ? (
                    <StatusBadge status="inactive" />
                  ) : (
                    <StatusBadge status="active" />
                  )}{' '}
                  <strong>{notice.title}</strong>
                  <p className="page-subtitle" style={{ marginTop: '0.35rem' }}>
                    {notice.message}
                  </p>
                  <p className="page-subtitle">
                    {new Date(notice.startsAt).toLocaleString()}
                    {notice.endsAt ? ` → ${new Date(notice.endsAt).toLocaleString()}` : ''}
                  </p>
                </div>
                {notice.isActive !== false ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void endNotice(notice.id, notice.title)}
                  >
                    End notice
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </AsyncStates>
    </main>
  );
}
