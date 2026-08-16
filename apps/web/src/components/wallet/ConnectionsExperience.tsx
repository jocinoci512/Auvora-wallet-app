'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { isSignedIn } from '../../lib/auth/session';
import { formatApiError } from '../../lib/api-client';
import { humanizeError } from '../transaction/TransactionShell';
import {
  toSafeConnectionView,
  type SafeConnectionView,
} from '../../lib/connections/sanitize-session';
import { issueCopy, classifyHttpStatus } from '../../lib/dashboard/status-copy';
import { networkLabel } from '../../lib/product/networks';
import { disconnectPairingSession, listPairingSessions } from '../../lib/reown/web-pairing';
import { permissionTitle } from '../../lib/web3/permissions';
import { mapPermissionGrants, web3Fetch } from '../../lib/web3/api';
import { demoConnectedSessions } from '../../lib/web3/sessions';
import { truncateMiddle } from '../../lib/wallet-experience/validation';
import { AuvoraClientError } from '@auvora/sdk';
import '../../app/core-experience.css';
import '../../app/wallet-flow.css';

function formatWhen(iso: string | null): string {
  if (!iso) return 'Unknown';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  return new Date(iso).toLocaleString();
}

function statusLabel(status: SafeConnectionView['status']): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'expired':
      return 'Expired';
    case 'disconnected':
      return 'Disconnected';
    default:
      return 'Connected';
  }
}

export function ConnectionsExperience(): ReactElement {
  const signedIn = isSignedIn();
  const [rows, setRows] = useState<SafeConnectionView[]>([]);
  const [sample, setSample] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issue, setIssue] = useState<ReturnType<typeof issueCopy> | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIssue(null);
    try {
      const live: SafeConnectionView[] = [];
      if (signedIn) {
        try {
          const grants = await web3Fetch<unknown>('/api/v1/connections/dapps/permissions');
          const mapped = mapPermissionGrants(grants);
          const grouped = new Map<string, SafeConnectionView>();
          for (const g of mapped) {
            const cur = grouped.get(g.origin);
            const next = toSafeConnectionView(
              {
                id: `dapp-${g.origin}`,
                name: g.origin,
                origin: g.origin,
                status: 'connected',
                networks: [g.network],
                accounts: [g.account],
                permissions: [g.permission],
                lastActivity: g.lastActivity,
                connectedAt: g.lastActivity,
              },
              { source: 'dapp' },
            );
            if (!next) continue;
            if (!cur) {
              grouped.set(g.origin, next);
            } else {
              grouped.set(g.origin, {
                ...cur,
                permissions: [...new Set([...cur.permissions, ...next.permissions])],
                networks: [...new Set([...cur.networks, ...next.networks])],
                accounts: [...new Set([...cur.accounts, ...next.accounts])],
                lastActivity: next.lastActivity ?? cur.lastActivity,
              });
            }
          }
          live.push(...grouped.values());
        } catch (err) {
          const status = err instanceof AuvoraClientError ? err.status : undefined;
          const kind = classifyHttpStatus(status);
          if (kind) setIssue(issueCopy(kind));
          else if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            setIssue(issueCopy('offline'));
          } else {
            setError(humanizeError(formatApiError(err), 'Could not load connections.'));
          }
        }
        try {
          const wc = await web3Fetch<unknown>('/api/v1/connections/walletconnect/sessions');
          const list = Array.isArray(wc) ? wc : [];
          for (const row of list) {
            const view = toSafeConnectionView(row, { source: 'walletconnect' });
            if (view) live.push(view);
          }
        } catch {
          /* dApp grants already attempted; WC optional */
        }
      }
      const pairing = listPairingSessions().map((s) =>
        toSafeConnectionView(
          {
            id: s.topic,
            name: s.name,
            origin: s.url ?? s.name,
            status: 'connected',
            networks: s.chains,
            accounts: s.accounts,
            connectedAt: s.pairedAt,
            lastActivity: s.lastActiveAt,
          },
          { source: 'pairing' },
        ),
      );
      live.push(...pairing.filter((row): row is SafeConnectionView => row != null));

      if (live.length) {
        setRows(live);
        setSample(false);
      } else if (!signedIn) {
        const demo = demoConnectedSessions().map((s) =>
          toSafeConnectionView(
            {
              id: s.id,
              name: s.name,
              origin: s.origin,
              status: 'connected',
              networks: s.networks,
              accounts: s.accounts,
              permissions: s.permissions,
              connectedAt: s.lastActivity,
              lastActivity: s.lastActivity,
            },
            { source: 'sample' },
          ),
        );
        setRows(demo.filter((row): row is SafeConnectionView => row != null));
        setSample(true);
      } else {
        setRows([]);
        setSample(false);
      }
    } finally {
      setLoading(false);
    }
  }, [signedIn]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  async function disconnect(row: SafeConnectionView): Promise<void> {
    setBusyId(row.id);
    setError(null);
    try {
      if (row.source === 'walletconnect' && signedIn && !sample) {
        await web3Fetch(`/api/v1/connections/walletconnect/sessions/${row.id}/terminate`, {
          method: 'POST',
        });
      } else if (row.source === 'dapp' && signedIn && !sample) {
        await Promise.all(
          row.permissions.map((permission) =>
            web3Fetch('/api/v1/connections/dapps/permissions', {
              method: 'POST',
              body: JSON.stringify({
                origin: `https://${row.domain}`,
                permission,
                allowed: false,
              }),
            }),
          ),
        );
      } else if (row.source === 'pairing') {
        disconnectPairingSession(row.id);
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setSelectedId(null);
      setConfirmId(null);
      setToast(`Disconnected ${row.name}`);
      window.setTimeout(() => setToast(null), 1800);
    } catch (err) {
      setError(humanizeError(formatApiError(err), 'Could not disconnect this app.'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="cx wf">
      <header className="cx__header">
        <p className="cx__eyebrow">
          <Link href="/dashboard">Wallet</Link>
        </p>
        <h1 className="cx__title">Connections</h1>
        <p className="cx__sub">
          Apps connected through WalletConnect or your local wallet. Disconnect anything you no
          longer trust.
        </p>
        <p className="cx__reassure">
          Auvora never holds your keys. Session secrets and pairing URIs are not shown here.
        </p>
      </header>

      {sample && rows.length ? (
        <div className="cx-alert cx-alert--info" role="status">
          Sample connections — sign in to load sessions from this account. This list is labeled
          preview data, not a live WalletConnect session.
        </div>
      ) : null}
      {issue ? (
        <div className="cx-alert cx-alert--warn" role="status">
          <strong>{issue.title}</strong>
          <p>{issue.body}</p>
        </div>
      ) : null}
      {error ? (
        <div className="cx-alert cx-alert--error" role="alert">
          {error}
        </div>
      ) : null}
      {toast ? (
        <div className="cx-alert cx-alert--info" role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}

      {loading ? (
        <section className="cx-panel" aria-busy="true" aria-live="polite">
          <p className="cx-meta">Looking up connections…</p>
        </section>
      ) : selected ? (
        <section className="cx-panel" aria-labelledby="wf-conn-detail">
          <p className="wf-kicker">Connection detail</p>
          <h2 id="wf-conn-detail">{selected.name}</h2>
          <p className="cx-meta">{selected.domain}</p>
          <dl className="wf-review">
            <div>
              <dt>Status</dt>
              <dd className={`wf-status wf-status--${selected.status}`}>
                {statusLabel(selected.status)}
              </dd>
            </div>
            <div>
              <dt>Wallet</dt>
              <dd>
                {selected.accounts.length
                  ? selected.accounts.map((a) => truncateMiddle(a)).join(', ')
                  : 'This device'}
              </dd>
            </div>
            <div>
              <dt>Networks</dt>
              <dd>
                {selected.networks.length
                  ? selected.networks.map((n) => networkLabel(n)).join(', ')
                  : 'Not specified'}
              </dd>
            </div>
            <div>
              <dt>Permissions</dt>
              <dd>
                {selected.permissions.length
                  ? selected.permissions.map((p) => permissionTitle(p)).join(', ')
                  : 'Session only — no extra grants listed'}
              </dd>
            </div>
            <div>
              <dt>Connected</dt>
              <dd>{formatWhen(selected.connectedAt)}</dd>
            </div>
            <div>
              <dt>Last activity</dt>
              <dd>{formatWhen(selected.lastActivity)}</dd>
            </div>
          </dl>
          {confirmId === selected.id ? (
            <div className="wf-confirm" role="alertdialog" aria-labelledby="wf-disc-title">
              <strong id="wf-disc-title">Disconnect {selected.name}?</strong>
              <p>
                This app will no longer be able to request signatures from this wallet until you
                connect again.
              </p>
              <div className="wf-actions">
                <button
                  type="button"
                  className="cx-btn cx-btn--primary"
                  disabled={busyId === selected.id}
                  onClick={() => void disconnect(selected)}
                >
                  {busyId === selected.id ? 'Disconnecting…' : 'Disconnect app'}
                </button>
                <button
                  type="button"
                  className="cx-btn cx-btn--ghost"
                  onClick={() => setConfirmId(null)}
                >
                  Keep connected
                </button>
              </div>
            </div>
          ) : (
            <div className="wf-actions">
              <button
                type="button"
                className="cx-btn cx-btn--primary"
                onClick={() => setConfirmId(selected.id)}
              >
                Disconnect app
              </button>
              <button
                type="button"
                className="cx-btn cx-btn--ghost"
                onClick={() => setSelectedId(null)}
              >
                Back to list
              </button>
            </div>
          )}
        </section>
      ) : rows.length === 0 ? (
        <section className="wf-empty">
          <p className="wf-kicker">Connections</p>
          <h2>No connected apps</h2>
          <p>
            WalletConnect and dApp sessions you approve will appear here. Only connect to sites you
            trust. Auvora never holds your keys — you approve each signature in your local wallet.
          </p>
          <p>
            To connect safely, open the app in its own site, choose WalletConnect, then approve the
            request on this device or Auvora mobile. Disconnect anything you no longer use.
          </p>
        </section>
      ) : (
        <section className="cx-panel">
          <h2>Connected apps</h2>
          <ul className="wf-list">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="wf-row"
                  onClick={() => setSelectedId(row.id)}
                  aria-label={`View details for ${row.name}`}
                >
                  <span className="wf-row__meta">
                    <strong>{row.name}</strong>
                    <small>
                      {row.domain} ·{' '}
                      {row.networks.map((n) => networkLabel(n)).join(', ') || 'Network'}
                    </small>
                  </span>
                  <span className={`wf-status wf-status--${row.status}`}>
                    {statusLabel(row.status)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
