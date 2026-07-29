'use client';

import { AuvoraClientError, type BlockchainEventLog } from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminBlockchainEventsPage(): ReactElement {
  const [events, setEvents] = useState<BlockchainEventLog[]>([]);
  const [total, setTotal] = useState(0);
  const [eventType, setEventType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      const result = await client.adminListBlockchainEvents({
        eventType: eventType.trim() || undefined,
      });
      setEvents(result.items);
      setTotal(result.total);
    } catch (err) {
      if (err instanceof AuvoraClientError && err.status === 401) {
        setError('Unauthorized — save an admin JWT access token above.');
      } else {
        setError(formatApiError(err));
      }
    } finally {
      setLoading(false);
    }
  }, [eventType]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main>
      <header className="page-header">
        <div>
          <h1>Event log</h1>
          <p className="page-subtitle">
            {total} event{total === 1 ? '' : 's'}
          </p>
        </div>
        <Link href="/blockchain">
          <Button variant="ghost">Back</Button>
        </Link>
      </header>

      <section className="panel filters">
        <div className="filters__row">
          <label className="field">
            <span className="field-label">Event type</span>
            <input
              className="field-input"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              placeholder="e.g. address.activated"
            />
          </label>
          <Button type="button" onClick={() => void load()}>
            Search
          </Button>
        </div>
      </section>

      {loading ? <p className="state-message">Loading events…</p> : null}
      {error ? <div className="alert alert--error">{error}</div> : null}

      {!loading && !error && events.length === 0 ? (
        <p className="state-message">No events match your filters.</p>
      ) : null}

      {!loading && events.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Event type</th>
              <th>Chain</th>
              <th>Aggregate ID</th>
              <th>Correlation ID</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{event.eventType}</td>
                <td>{event.chain ? event.chain.replace(/_/g, ' ') : '—'}</td>
                <td className="mono">
                  {event.aggregateId ? `${event.aggregateId.slice(0, 8)}…` : '—'}
                </td>
                <td className="mono">
                  {event.correlationId ? `${event.correlationId.slice(0, 8)}…` : '—'}
                </td>
                <td>{new Date(event.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </main>
  );
}
