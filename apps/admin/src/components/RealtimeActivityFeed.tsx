'use client';

import { Badge, Card, CardHeader, EmptyState, type BadgeTone } from '@auvora/ui';
import { type ReactElement } from 'react';
import type { AdminEvent, RealtimeStatus } from '../lib/realtime/admin-event';

const STATUS_TONE: Record<RealtimeStatus, BadgeTone> = {
  connected: 'success',
  connecting: 'info',
  reconnecting: 'warning',
  offline: 'error',
};

const STATUS_LABEL: Record<RealtimeStatus, string> = {
  connected: 'Live',
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
  offline: 'Offline',
};

const SEVERITY_TONE: Record<string, BadgeTone> = {
  info: 'neutral',
  warning: 'warning',
  critical: 'error',
};

export function RealtimeStatusBadge({ status }: { status: RealtimeStatus }): ReactElement {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? ts : d.toLocaleTimeString();
}

function describe(event: AdminEvent): string {
  const who = event.userId ? `user ${event.userId.slice(0, 8)}` : 'system';
  const platform = event.platform ? ` (${event.platform})` : '';
  return `${who}${platform}`;
}

export interface RealtimeActivityFeedProps {
  status: RealtimeStatus;
  events: AdminEvent[];
  onReconnect?: () => void;
  limit?: number;
}

/**
 * Professional admin realtime activity panel. Shows a live connection status and
 * a chronological feed of safe account/system events. No demo/fake data — an
 * empty system shows a proper empty state.
 */
export function RealtimeActivityFeed({
  status,
  events,
  onReconnect,
  limit = 25,
}: RealtimeActivityFeedProps): ReactElement {
  const visible = events.slice(0, limit);
  return (
    <Card>
      <CardHeader
        title="Realtime activity"
        description="Live account and security events, streamed from the backend."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RealtimeStatusBadge status={status} />
            {status !== 'connected' && onReconnect ? (
              <button
                type="button"
                className="auvora-button auvora-button--ghost"
                onClick={onReconnect}
              >
                Retry
              </button>
            ) : null}
          </div>
        }
      />
      {visible.length === 0 ? (
        <EmptyState
          title="No activity yet"
          description={
            status === 'connected'
              ? 'Events will appear here in real time as they happen.'
              : 'Connect the realtime stream to see live events.'
          }
        />
      ) : (
        <ul className="auvora-list" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {visible.map((event) => (
            <li
              key={event.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '8px 0',
                borderBottom: '1px solid var(--auvora-border, #eee)',
              }}
            >
              <Badge tone={SEVERITY_TONE[event.severity] ?? 'neutral'}>{event.type}</Badge>
              <span style={{ flex: 1 }}>{describe(event)}</span>
              <span style={{ opacity: 0.6, fontVariantNumeric: 'tabular-nums' }}>
                {formatTime(event.timestamp)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
