'use client';

import { Alert, Button, EmptyState, StatusBadge } from '@auvora/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import { formatApiError } from '../../lib/api-client';
import { web3Fetch } from '../../lib/web3/api';
import { DEMO_SIGN, riskLabel, type SignPreview } from '../../lib/web3/demo';
import { PlatformShell } from '../platform/PlatformShell';
import { humanizeError } from '../transaction/TransactionShell';
import { Web3SectionNav } from './Web3SectionNav';

type SignKind = SignPreview['kind'];

const preStyle: CSSProperties = {
  margin: 0,
  padding: '0.75rem',
  borderRadius: 8,
  border: '1px solid var(--cx-line, var(--auvora-color-border))',
  background: 'color-mix(in srgb, var(--cx-line, var(--auvora-color-border)) 22%, transparent)',
  fontSize: '0.78rem',
  overflow: 'auto',
  maxHeight: 240,
};

const signGridStyle: CSSProperties = {
  display: 'grid',
  gap: '0.85rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  alignItems: 'start',
};

export function SigningExperience(): ReactElement {
  const params = useSearchParams();
  const origin = params.get('origin') ?? 'https://app.uniswap.org';
  const [kind, setKind] = useState<SignKind>('transaction');
  const [wallet, setWallet] = useState('Primary · 0x1111…1111');
  const [network, setNetwork] = useState('ETHEREUM');
  const [preview, setPreview] = useState<SignPreview>(DEMO_SIGN);
  const [status, setStatus] = useState<'idle' | 'approved' | 'rejected'>('idle');
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPreview({
      ...DEMO_SIGN,
      kind,
      network,
      summary:
        kind === 'message'
          ? `Sign message for ${origin}`
          : kind === 'typed'
            ? `Typed data (EIP-712) for ${origin}`
            : DEMO_SIGN.summary,
      payloadPreview:
        kind === 'message'
          ? JSON.stringify({ message: 'Auvora session bind', origin }, null, 2)
          : kind === 'typed'
            ? JSON.stringify(
                { types: { Permit: [] }, domain: { name: 'Uniswap' }, message: {} },
                null,
                2,
              )
            : DEMO_SIGN.payloadPreview,
    });
  }, [kind, network, origin]);

  async function decide(action: 'approve' | 'reject'): Promise<void> {
    setBusy(true);
    setError(null);
    setOffline(false);
    try {
      const payloadType =
        kind === 'transaction' ? 'TRANSACTION' : kind === 'typed' ? 'TYPED_DATA' : 'MESSAGE';
      const prepared = await web3Fetch<{ requestId: string }>(
        '/api/v1/connections/dapps/sign/prepare',
        {
          method: 'POST',
          body: JSON.stringify({
            origin,
            kind: 'BROWSER',
            connectionRef: wallet,
            network,
            payloadType,
            payload: preview.payloadPreview,
          }),
        },
      ).catch(() => null);

      if (prepared?.requestId) {
        await web3Fetch('/api/v1/connections/sign/confirm', {
          method: 'POST',
          body: JSON.stringify({
            requestId: prepared.requestId,
            confirmed: action === 'approve',
          }),
        });
        setStatus(action === 'approve' ? 'approved' : 'rejected');
      } else {
        setOffline(true);
        if (action === 'reject') {
          setStatus('rejected');
        } else {
          setError(
            'Preview only — we could not reach the signing service. Nothing was approved on-chain.',
          );
        }
      }
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PlatformShell
      title="Signing"
      subtitle="Review messages, typed data, and transactions before you approve."
      reassure="Nothing leaves without your confirmation. Check the network, amount, and origin carefully."
      backHref="/web3"
      backLabel="Web3 Hub"
      nav={<Web3SectionNav current="/web3/sign" />}
    >
      {status === 'approved' ? (
        <Alert tone="success" title="Approved">
          Request recorded. Session persistence applies for trusted origins.
        </Alert>
      ) : null}
      {status === 'rejected' ? (
        <Alert tone="warn" title="Rejected">
          No signature was produced. The dApp was notified when live.
        </Alert>
      ) : null}
      {offline ? (
        <Alert tone="info" title="Offline preview">
          Live sign endpoints unavailable — local approval flow still works.
        </Alert>
      ) : null}
      {error ? (
        <Alert tone="error" title="Signing failed">
          {humanizeError(error, 'Something went wrong while signing. Try again.')}
        </Alert>
      ) : null}

      <div style={signGridStyle}>
        <section className="cx-panel">
          <h2>Request</h2>
          <div className="cx-toolbar">
            <label className="cx-field">
              <span>Type</span>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as SignKind)}
                aria-label="Signing type"
              >
                <option value="message">Message</option>
                <option value="typed">Typed data</option>
                <option value="transaction">Transaction</option>
              </select>
            </label>
            <label className="cx-field">
              <span>Wallet</span>
              <select
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
                aria-label="Wallet selection"
              >
                <option>Primary · 0x1111…1111</option>
                <option>Hardware · Ledger</option>
              </select>
            </label>
            <label className="cx-field">
              <span>Network</span>
              <select
                value={network}
                onChange={(e) => setNetwork(e.target.value)}
                aria-label="Network selection"
              >
                <option value="ETHEREUM">Ethereum</option>
                <option value="POLYGON">Polygon</option>
                <option value="SOLANA">Solana</option>
              </select>
            </label>
          </div>

          <p className="cx-meta">Origin · {origin}</p>
          <p>
            <strong>{preview.summary}</strong>
          </p>
          <span className="cx-badge">{riskLabel(preview.risk)}</span>

          {kind === 'transaction' ? (
            <>
              <p className="cx-meta">Gas estimate · {preview.gasEstimate}</p>
              <p className="cx-meta">Fee breakdown · {preview.feeBreakdown}</p>
              <Alert tone="info" title="Simulation placeholder">
                {preview.simulation}
              </Alert>
            </>
          ) : null}

          <Alert tone="warn" title="Unknown contract warning">
            Contract labels are placeholders. Elevated permissions and phishing domain checks
            surface before approve.
          </Alert>

          <pre style={preStyle}>{preview.payloadPreview}</pre>

          <div className="cx-platform__actions">
            <Button
              type="button"
              disabled={busy || status !== 'idle'}
              onClick={() => void decide('approve')}
            >
              Approve
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy || status !== 'idle'}
              onClick={() => void decide('reject')}
            >
              Reject
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={status === 'idle'}
              onClick={() => setStatus('idle')}
            >
              Reset
            </Button>
          </div>
        </section>

        <section className="cx-panel">
          <h2>Permission summary</h2>
          <ul className="cx-list">
            <li>
              <span>View addresses</span>
              <StatusBadge status="active" label="Granted" />
            </li>
            <li>
              <span>Request signatures</span>
              <StatusBadge
                status={kind === 'message' || kind === 'typed' ? 'pending' : 'archived'}
                label={kind !== 'transaction' ? 'This request' : 'Idle'}
              />
            </li>
            <li>
              <span>Request transactions</span>
              <StatusBadge
                status={kind === 'transaction' ? 'pending' : 'archived'}
                label={kind === 'transaction' ? 'This request' : 'Idle'}
              />
            </li>
            <li>
              <span>Network switch</span>
              <StatusBadge status="active" label={network} />
            </li>
          </ul>
          <EmptyState
            title="Trusted dApps"
            description="Mark origins as trusted from the advanced connections lab after first approval."
          />
          <Link href="/web3/permissions" className="cx-btn cx-btn--ghost">
            Open permission center
          </Link>
        </section>
      </div>
    </PlatformShell>
  );
}
