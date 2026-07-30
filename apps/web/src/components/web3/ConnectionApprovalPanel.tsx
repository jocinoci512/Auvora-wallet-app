'use client';

import { Alert, Button, EmptyState } from '@auvora/ui';
import Link from 'next/link';
import { useState, type CSSProperties, type ReactElement } from 'react';
import {
  connectionMethodLabel,
  riskLabel,
  type ConnectionRequest,
  type PairingPreview,
} from '../../lib/web3/demo';
import { permissionsCanMoveFunds } from '../../lib/web3/permissions';
import { assessTrust } from '../../lib/web3/trust';
import { PermissionExplainList } from './PermissionExplainList';
import { TrustIndicators } from './TrustIndicators';

const qrBox: CSSProperties = {
  width: 160,
  height: 160,
  borderRadius: 12,
  border: '1px dashed var(--cx-line, var(--auvora-color-border))',
  background:
    'repeating-conic-gradient(from 0deg, color-mix(in srgb, var(--cx-line, var(--auvora-color-border)) 55%, transparent) 0% 25%, transparent 0% 50%) 0 0 / 16px 16px',
  display: 'grid',
  placeItems: 'center',
  textAlign: 'center',
  padding: '0.75rem',
  fontSize: '0.75rem',
  flexShrink: 0,
};

const pairingRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '1rem',
  alignItems: 'flex-start',
  marginTop: '0.75rem',
};

const uriStyle: CSSProperties = {
  margin: 0,
  padding: '0.65rem',
  borderRadius: 8,
  border: '1px solid var(--cx-line, var(--auvora-color-border))',
  fontSize: '0.72rem',
  wordBreak: 'break-all',
  maxWidth: 420,
};

type Props = {
  requests: ConnectionRequest[];
  pairing: PairingPreview;
  live: boolean;
  preview: boolean;
  busyId: string | null;
  previouslyConnectedOrigins: Set<string>;
  onDecide: (id: string, action: 'approve' | 'reject') => void;
};

export function ConnectionApprovalPanel({
  requests,
  pairing,
  live,
  preview,
  busyId,
  previouslyConnectedOrigins,
  onDecide,
}: Props): ReactElement {
  const pending = requests.filter((r) => r.status === 'pending');
  const [copied, setCopied] = useState<'uri' | 'code' | null>(null);

  async function copy(kind: 'uri' | 'code', value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      /* clipboard may be blocked */
    }
  }

  return (
    <section className="cx-panel" aria-labelledby="connection-approval-heading">
      <h2 id="connection-approval-heading">Connection approval</h2>
      <p className="cx-meta">
        Review pending dApp requests and WalletConnect-shaped desktop pairing. Sessions are
        {live
          ? ' synced when the connections service is reachable.'
          : ' local preview until the service is online.'}
      </p>

      {preview ? (
        <Alert tone="warn" title="Preview pairing">
          This QR and pair code are simulated WalletConnect-shaped material — not a live relay
          session. Nothing is verified-safe unless a catalog verification flag is present.
        </Alert>
      ) : null}

      <div style={pairingRow}>
        <div style={qrBox} role="img" aria-label="WalletConnect QR preview placeholder">
          QR preview
          <br />
          (not live WC)
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <p>
            <strong>Desktop pairing</strong>
          </p>
          <p className="cx-meta">
            Method · {connectionMethodLabel(pairing.method)} · Account · {pairing.account} ·{' '}
            {pairing.networks.join(', ')}
          </p>
          <p className="cx-meta">
            Pair code · <strong>{pairing.pairCode}</strong>
            {pairing.preview ? ' · Preview expires locally' : ''}
          </p>
          <pre style={uriStyle}>{pairing.uri}</pre>
          <div className="cx-platform__actions" style={{ marginTop: '0.65rem' }}>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void copy('code', pairing.pairCode)}
              aria-label="Copy pair code"
            >
              {copied === 'code' ? 'Copied code' : 'Copy pair code'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void copy('uri', pairing.uri)}
              aria-label="Copy WalletConnect URI"
            >
              {copied === 'uri' ? 'Copied URI' : 'Copy wc: URI'}
            </Button>
          </div>
        </div>
      </div>

      <h3 style={{ marginTop: '1.25rem' }}>Pending requests</h3>
      {pending.length === 0 ? (
        <EmptyState
          title="No pending requests"
          description="New connection proposals from QR, URI, or desktop pairing appear here."
        />
      ) : (
        <ul className="cx-list">
          {pending.map((r) => {
            const previously = previouslyConnectedOrigins.has(r.origin);
            const trust = assessTrust({
              origin: r.origin,
              permissions: r.permissions,
              previouslyConnected: previously,
              pendingRequestCount: pending.length,
            });
            return (
              <li key={r.id}>
                <div>
                  <strong>{r.name}</strong>
                  <p className="cx-meta">
                    {r.origin} · {connectionMethodLabel(r.method)} ·{' '}
                    {new Date(r.createdAt).toLocaleString()}
                  </p>
                  <p className="cx-meta">
                    Networks · {r.networks.join(', ')}
                    {r.account ? ` · Account · ${r.account}` : ''}
                  </p>
                  <span className="cx-badge">{riskLabel(trust.overallRisk)}</span>
                  {permissionsCanMoveFunds(r.permissions) ? (
                    <p className="cx-meta">Includes transaction requests that can move funds.</p>
                  ) : null}
                  <TrustIndicators
                    origin={r.origin}
                    permissions={r.permissions}
                    previouslyConnected={previously}
                    pendingRequestCount={pending.length}
                    assessment={trust}
                  />
                  <PermissionExplainList codes={r.permissions} compact={false} />
                </div>
                <div className="cx-platform__actions">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busyId === r.id}
                    onClick={() => onDecide(r.id, 'approve')}
                    aria-label={`Approve connection to ${r.name}`}
                  >
                    Approve
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busyId === r.id}
                    onClick={() => onDecide(r.id, 'reject')}
                    aria-label={`Reject connection to ${r.name}`}
                  >
                    Reject
                  </Button>
                  <Link href={`/web3/sign?origin=${encodeURIComponent(r.origin)}`}>
                    <Button type="button" size="sm" variant="ghost">
                      Review signing
                    </Button>
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
