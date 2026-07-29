'use client';

import { Alert, Button, EmptyState, StatusBadge } from '@auvora/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactElement } from 'react';
import { formatApiError } from '../../lib/api-client';
import { web3Fetch } from '../../lib/web3/api';
import { DEMO_SIGN, riskLabel, type SignPreview } from '../../lib/web3/demo';
import { Web3SectionNav } from './Web3SectionNav';
import '../../app/web3-experience.css';

type SignKind = SignPreview['kind'];

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
      } else {
        setOffline(true);
      }
      setStatus(action === 'approve' ? 'approved' : 'rejected');
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w3">
      <header className="w3__header">
        <div>
          <p className="w3__eyebrow">
            <Link href="/web3">Web3 Hub</Link>
          </p>
          <h1>Signing</h1>
          <p className="w3__sub">
            Premium approval for messages, typed data, and transactions with risk cues.
          </p>
        </div>
      </header>

      <Web3SectionNav current="/web3/sign" />

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
          {error}
        </Alert>
      ) : null}

      <div className="w3-sign">
        <section className="w3-panel">
          <h2>Request</h2>
          <div className="w3-toolbar">
            <label className="w3-field">
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
            <label className="w3-field">
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
            <label className="w3-field">
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

          <p className="w3-meta">Origin · {origin}</p>
          <p>
            <strong>{preview.summary}</strong>
          </p>
          <span className={`w3-risk w3-risk--${preview.risk}`}>{riskLabel(preview.risk)}</span>

          {kind === 'transaction' ? (
            <>
              <p className="w3-meta">Gas estimate · {preview.gasEstimate}</p>
              <p className="w3-meta">Fee breakdown · {preview.feeBreakdown}</p>
              <Alert tone="info" title="Simulation placeholder">
                {preview.simulation}
              </Alert>
            </>
          ) : null}

          <Alert tone="warn" title="Unknown contract warning">
            Contract labels are placeholders. Elevated permissions and phishing domain checks
            surface before approve.
          </Alert>

          <pre className="w3-pre">{preview.payloadPreview}</pre>

          <div className="w3-actions">
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

        <section className="w3-panel">
          <h2>Permission summary</h2>
          <ul className="w3-list">
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
          <Link href="/web3/permissions">
            <Button type="button" variant="secondary">
              Open permission center
            </Button>
          </Link>
        </section>
      </div>
    </div>
  );
}
