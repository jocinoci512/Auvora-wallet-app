'use client';

import { Alert, Button, PageHeader, StatusBadge } from '@auvora/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type ReactElement } from 'react';
import { Subnav } from '../../../../components/Subnav';
import { getDemoNotes, getDemoTicket } from '../../../../lib/support-demo';
import { SUPPORT_LINKS } from '../../../../lib/section-nav';

export default function SupportTicketDetailPage(): ReactElement {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const ticket = getDemoTicket(id);
  const notes = getDemoNotes(id);
  const [internalNote, setInternalNote] = useState('');
  const [saved, setSaved] = useState(false);

  if (!ticket) {
    return (
      <main className="page">
        <PageHeader title="Case not found" subtitle={id}>
          <Subnav label="Support" links={SUPPORT_LINKS} />
        </PageHeader>
        <p>
          <Link href="/support">← Back to queue</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="page">
      <PageHeader title={ticket.subject} subtitle={`${ticket.id} · ${ticket.requesterEmail}`}>
        <Subnav label="Support" links={SUPPORT_LINKS} />
      </PageHeader>

      <Alert tone="warn" title="Demo case">
        Conversation history and notes are preview-only. Escalation and CSAT actions do not persist.
      </Alert>

      <p>
        <Link href="/support">← Back to queue</Link>
      </p>

      <div className="metric-grid" aria-label="Case summary">
        <div className="metric-card">
          <span className="metric-card__label">Status</span>
          <span className="metric-card__value">
            <StatusBadge status={ticket.status} />
          </span>
        </div>
        <div className="metric-card">
          <span className="metric-card__label">Priority</span>
          <span className="metric-card__value">
            <StatusBadge status={ticket.priority} />
          </span>
        </div>
        <div className="metric-card">
          <span className="metric-card__label">User verified</span>
          <span className="metric-card__value">{ticket.verifiedUser ? 'Yes' : 'No'}</span>
        </div>
        <div className="metric-card">
          <span className="metric-card__label">CSAT</span>
          <span className="metric-card__value">{ticket.csat ?? '—'}</span>
        </div>
      </div>

      <section style={{ marginTop: '1.5rem' }}>
        <h2>Conversation & notes</h2>
        <ul className="stack">
          {notes.map((note) => (
            <li key={note.id}>
              <strong>{note.author}</strong>{' '}
              {note.internal ? (
                <StatusBadge status="internal" />
              ) : (
                <StatusBadge status="customer" />
              )}
              <p style={{ margin: '0.35rem 0 0' }}>{note.body}</p>
              <p className="page-subtitle">{new Date(note.createdAt).toLocaleString()}</p>
            </li>
          ))}
          {notes.length === 0 ? <li>No notes yet.</li> : null}
        </ul>
      </section>

      <section className="panel" style={{ marginTop: '1.5rem' }} aria-label="Internal note">
        <h2>Add internal note</h2>
        <label className="field" style={{ display: 'block' }}>
          <span className="field-label">Note</span>
          <textarea
            className="field-input"
            rows={3}
            value={internalNote}
            onChange={(e) => setInternalNote(e.target.value)}
            placeholder="Visible to agents only"
          />
        </label>
        <div className="action-row" style={{ marginTop: '0.75rem' }}>
          <Button
            type="button"
            onClick={() => {
              setSaved(true);
              setInternalNote('');
            }}
          >
            Save note (preview)
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              window.alert('Escalation is preview-only until a ticket API ships.');
            }}
          >
            Escalate (preview)
          </Button>
          {ticket.userId && !ticket.userId.startsWith('usr_demo_') ? (
            <Link href={`/users/${ticket.userId}`}>
              <Button variant="ghost">Open user account</Button>
            </Link>
          ) : (
            <Button type="button" variant="ghost" disabled>
              Demo user (no live account)
            </Button>
          )}
        </div>
        {saved ? (
          <p className="page-subtitle" style={{ marginTop: '0.5rem' }}>
            Preview only — note was not persisted.
          </p>
        ) : null}
      </section>
    </main>
  );
}
