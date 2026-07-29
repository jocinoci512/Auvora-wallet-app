'use client';

import { AuvoraClientError } from '@auvora/sdk';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { formatApiError, getStoredAccessToken } from '../../lib/api-client';

type Screen =
  | 'connect'
  | 'devices'
  | 'sessions'
  | 'browser'
  | 'dapp'
  | 'permissions'
  | 'trusted'
  | 'history'
  | 'watch'
  | 'sign'
  | 'confirm'
  | 'success'
  | 'failure';

const DEFAULT_PERMISSIONS = [
  'VIEW_ADDRESSES',
  'VIEW_BALANCES',
  'REQUEST_SIGNATURES',
  'REQUEST_TRANSACTIONS',
  'NETWORK_SWITCH',
  'SESSION_MANAGE',
];

export default function ConnectionsPage(): ReactElement {
  const [screen, setScreen] = useState<Screen>('connect');
  const [capabilities, setCapabilities] = useState<unknown[]>([]);
  const [discovered, setDiscovered] = useState<unknown[]>([]);
  const [devices, setDevices] = useState<unknown[]>([]);
  const [sessions, setSessions] = useState<unknown[]>([]);
  const [browser, setBrowser] = useState<unknown[]>([]);
  const [watch, setWatch] = useState<unknown[]>([]);
  const [connections, setConnections] = useState<unknown[]>([]);
  const [dappRequests, setDappRequests] = useState<unknown[]>([]);
  const [trustedDapps, setTrustedDapps] = useState<unknown[]>([]);
  const [permissions, setPermissions] = useState<unknown[]>([]);
  const [bookmarks, setBookmarks] = useState<unknown[]>([]);
  const [activity, setActivity] = useState<unknown[]>([]);
  const [sessionSummary, setSessionSummary] = useState<Record<string, unknown> | null>(null);
  const [web3Status, setWeb3Status] = useState<Record<string, unknown> | null>(null);
  const [prepared, setPrepared] = useState<{ requestId: string; prepared: unknown } | null>(null);
  const [signResult, setSignResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [watchAddress, setWatchAddress] = useState('0x2222222222222222222222222222222222222222');
  const [connectionRef, setConnectionRef] = useState('');
  const [payload, setPayload] = useState('transfer 0.01 ETH');
  const [dappOrigin, setDappOrigin] = useState('https://app.uniswap.org');
  const [dappName, setDappName] = useState('Uniswap');
  const [dappUrl, setDappUrl] = useState('https://app.uniswap.org/swap');
  const [signOrigin, setSignOrigin] = useState('https://app.uniswap.org');
  const [payloadType, setPayloadType] = useState<'TRANSACTION' | 'MESSAGE' | 'TYPED_DATA'>(
    'TRANSACTION',
  );

  const api = useCallback(async (path: string, init?: RequestInit) => {
    const token = getStoredAccessToken();
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
      credentials: 'include',
    });
    if (!response.ok) {
      throw new AuvoraClientError(await response.text(), response.status);
    }
    return (await response.json()) as { data: unknown };
  }, []);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const [c, d, s, b, w, conn, status, summary, reqs, trusted, perms, marks, hist] =
        await Promise.all([
          api('/api/v1/connections/capabilities'),
          api('/api/v1/connections/devices'),
          api('/api/v1/connections/walletconnect/sessions'),
          api('/api/v1/connections/browser'),
          api('/api/v1/connections/watch'),
          api('/api/v1/connections'),
          api('/api/v1/connections/web3/status'),
          api('/api/v1/connections/dapps/sessions/summary'),
          api('/api/v1/connections/dapps/requests'),
          api('/api/v1/connections/dapps/trusted'),
          api('/api/v1/connections/dapps/permissions'),
          api('/api/v1/connections/dapps/browser/bookmarks'),
          api('/api/v1/connections/dapps/activity'),
        ]);
      setCapabilities(c.data as unknown[]);
      setDevices(d.data as unknown[]);
      setSessions(s.data as unknown[]);
      setBrowser(b.data as unknown[]);
      setWatch(w.data as unknown[]);
      setConnections(conn.data as unknown[]);
      setWeb3Status(status.data as Record<string, unknown>);
      setSessionSummary(summary.data as Record<string, unknown>);
      setDappRequests(reqs.data as unknown[]);
      setTrustedDapps(trusted.data as unknown[]);
      setPermissions(perms.data as unknown[]);
      setBookmarks(marks.data as unknown[]);
      setActivity(hist.data as unknown[]);
      setError(null);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const discover = async () => {
    try {
      setLoading(true);
      const res = await api('/api/v1/connections/devices/discover');
      setDiscovered(res.data as unknown[]);
      setScreen('devices');
      setError(null);
    } catch (err) {
      setError(formatApiError(err));
      setScreen('failure');
    } finally {
      setLoading(false);
    }
  };

  const pair = async (deviceId: string) => {
    try {
      setLoading(true);
      await api('/api/v1/connections/devices/pair', {
        method: 'POST',
        body: JSON.stringify({ deviceId }),
      });
      setConnectionRef(deviceId);
      await refresh();
      setScreen('devices');
    } catch (err) {
      setError(formatApiError(err));
      setScreen('failure');
    } finally {
      setLoading(false);
    }
  };

  const createWc = async () => {
    try {
      setLoading(true);
      await api('/api/v1/connections/walletconnect/sessions', {
        method: 'POST',
        body: JSON.stringify({ networks: ['ETHEREUM'], permissions: ['accounts', 'sign'] }),
      });
      await refresh();
      setScreen('sessions');
    } catch (err) {
      setError(formatApiError(err));
      setScreen('failure');
    } finally {
      setLoading(false);
    }
  };

  const approveSession = async (sessionId: string) => {
    try {
      setLoading(true);
      await api(`/api/v1/connections/walletconnect/sessions/${sessionId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ accounts: ['0x1111111111111111111111111111111111111111'] }),
      });
      await refresh();
    } catch (err) {
      setError(formatApiError(err));
      setScreen('failure');
    } finally {
      setLoading(false);
    }
  };

  const connectBrowser = async (providerId: string) => {
    try {
      setLoading(true);
      await api('/api/v1/connections/browser/connect', {
        method: 'POST',
        body: JSON.stringify({ providerId }),
      });
      setConnectionRef(providerId);
      await refresh();
      setScreen('browser');
    } catch (err) {
      setError(formatApiError(err));
      setScreen('failure');
    } finally {
      setLoading(false);
    }
  };

  const addWatch = async () => {
    try {
      setLoading(true);
      await api('/api/v1/connections/watch', {
        method: 'POST',
        body: JSON.stringify({
          network: 'ETHEREUM',
          address: watchAddress,
          label: 'Watch portfolio',
        }),
      });
      await refresh();
      setScreen('watch');
    } catch (err) {
      setError(formatApiError(err));
      setScreen('failure');
    } finally {
      setLoading(false);
    }
  };

  const createDappRequest = async () => {
    try {
      setLoading(true);
      await api('/api/v1/connections/dapps/requests', {
        method: 'POST',
        body: JSON.stringify({
          origin: dappOrigin,
          name: dappName,
          networks: ['ETHEREUM', 'BNB_SMART_CHAIN'],
          permissions: DEFAULT_PERMISSIONS,
        }),
      });
      await refresh();
      setScreen('dapp');
    } catch (err) {
      setError(formatApiError(err));
      setScreen('failure');
    } finally {
      setLoading(false);
    }
  };

  const approveDappRequest = async (requestId: string) => {
    try {
      setLoading(true);
      await api(`/api/v1/connections/dapps/requests/${requestId}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          accounts: ['0x1111111111111111111111111111111111111111'],
          trustDapp: true,
        }),
      });
      await refresh();
      setScreen('success');
    } catch (err) {
      setError(formatApiError(err));
      setScreen('failure');
    } finally {
      setLoading(false);
    }
  };

  const rejectDappRequest = async (requestId: string) => {
    try {
      setLoading(true);
      await api(`/api/v1/connections/dapps/requests/${requestId}/reject`, { method: 'POST' });
      await refresh();
      setScreen('dapp');
    } catch (err) {
      setError(formatApiError(err));
      setScreen('failure');
    } finally {
      setLoading(false);
    }
  };

  const visitDapp = async () => {
    try {
      setLoading(true);
      await api('/api/v1/connections/dapps/browser/visit', {
        method: 'POST',
        body: JSON.stringify({ url: dappUrl, title: dappName }),
      });
      setSignOrigin(new URL(dappUrl).origin);
      await refresh();
      setScreen('dapp');
    } catch (err) {
      setError(formatApiError(err));
      setScreen('failure');
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = async (origin: string, permission: string, allowed: boolean) => {
    try {
      setLoading(true);
      await api('/api/v1/connections/dapps/permissions', {
        method: 'POST',
        body: JSON.stringify({ origin, permission, allowed: !allowed }),
      });
      await refresh();
      setScreen('permissions');
    } catch (err) {
      setError(formatApiError(err));
      setScreen('failure');
    } finally {
      setLoading(false);
    }
  };

  const revokeTrusted = async (trustedDappId: string) => {
    try {
      setLoading(true);
      await api(`/api/v1/connections/dapps/trusted/${trustedDappId}/revoke`, { method: 'POST' });
      await refresh();
      setScreen('trusted');
    } catch (err) {
      setError(formatApiError(err));
      setScreen('failure');
    } finally {
      setLoading(false);
    }
  };

  const prepareSign = async () => {
    try {
      setLoading(true);
      const path = signOrigin
        ? '/api/v1/connections/dapps/sign/prepare'
        : '/api/v1/connections/sign/prepare';
      const body = signOrigin
        ? {
            origin: signOrigin,
            kind: 'HARDWARE',
            connectionRef: connectionRef || 'ledger-nano-x-sim-1',
            network: 'ETHEREUM',
            payloadType,
            payload,
            feeEstimate: '0.001',
          }
        : {
            kind: 'HARDWARE',
            connectionRef: connectionRef || 'ledger-nano-x-sim-1',
            network: 'ETHEREUM',
            payloadType,
            payload,
            feeEstimate: '0.001',
          };
      const res = await api(path, { method: 'POST', body: JSON.stringify(body) });
      const data = res.data as { requestId: string; prepared: unknown };
      setPrepared(data);
      setScreen('confirm');
      setError(null);
    } catch (err) {
      setError(formatApiError(err));
      setScreen('failure');
    } finally {
      setLoading(false);
    }
  };

  const confirmSign = async (confirmed: boolean) => {
    if (!prepared) return;
    try {
      setLoading(true);
      const res = await api('/api/v1/connections/sign/confirm', {
        method: 'POST',
        body: JSON.stringify({ requestId: prepared.requestId, confirmed }),
      });
      setSignResult(res.data);
      setScreen(confirmed ? 'success' : 'failure');
    } catch (err) {
      setError(formatApiError(err));
      setScreen('failure');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <p>
        Prefer the <a href="/web3">premium Web3 Hub</a> for discovery, browser, permissions, and
        signing. This page remains the advanced connections lab.
      </p>
      <h1>Connect wallet</h1>
      <p>
        Hardware wallets, WalletConnect, browser wallets, dApp connectivity, and read-only watch
        addresses.
      </p>
      {loading ? <p role="status">Loading…</p> : null}
      {error ? <p role="alert">{error}</p> : null}

      <nav aria-label="Connections sections">
        {(
          [
            ['connect', 'Connect'],
            ['devices', 'Devices'],
            ['sessions', 'Sessions'],
            ['dapp', 'dApp browser'],
            ['permissions', 'Permissions'],
            ['trusted', 'Trusted'],
            ['history', 'History'],
            ['browser', 'Browser wallets'],
            ['watch', 'Read-only'],
            ['sign', 'Sign'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setScreen(id)}>
            {label}
          </button>
        ))}
        <button type="button" onClick={() => void refresh()}>
          Refresh
        </button>
      </nav>

      {screen === 'connect' ? (
        <section>
          <h2>Connection status</h2>
          <p>
            {connections.length} active/external connections · {capabilities.length} providers
          </p>
          {sessionSummary ? (
            <ul>
              <li>Active sessions: {String(sessionSummary.activeSessions ?? 0)}</li>
              <li>
                Pending dApp requests: {String(sessionSummary.pendingConnectionRequests ?? 0)}
              </li>
              <li>Trusted dApps: {String(sessionSummary.trustedDapps ?? 0)}</li>
              <li>Permission grants: {String(sessionSummary.activePermissionGrants ?? 0)}</li>
            </ul>
          ) : null}
          {web3Status ? (
            <p>
              Web3 platform phase {String(web3Status.phase)} · networks:{' '}
              {Array.isArray(web3Status.supportedNetworks)
                ? (web3Status.supportedNetworks as string[]).join(', ')
                : '—'}
            </p>
          ) : null}
          <ul>
            {(capabilities as Array<{ code: string; name: string; kind: string }>).map((c) => (
              <li key={c.code}>
                {c.name} ({c.kind}/{c.code})
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => void discover()}>
            Discover hardware
          </button>
          <button type="button" onClick={() => void createWc()}>
            New WalletConnect session
          </button>
          <button type="button" onClick={() => setScreen('dapp')}>
            Open dApp browser
          </button>
        </section>
      ) : null}

      {screen === 'devices' ? (
        <section>
          <h2>Hardware wallet dashboard</h2>
          <h3>Discovered</h3>
          <ul>
            {(discovered as Array<{ deviceId: string; vendor: string; model: string }>).map((d) => (
              <li key={d.deviceId}>
                {d.vendor} {d.model} ({d.deviceId}){' '}
                <button type="button" onClick={() => void pair(d.deviceId)}>
                  Pair
                </button>
              </li>
            ))}
          </ul>
          <h3>Paired devices</h3>
          <ul>
            {(
              devices as Array<{ id: string; deviceId: string; status: string; model: string }>
            ).map((d) => (
              <li key={d.id}>
                {d.model} — {d.status} ({d.deviceId})
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {screen === 'sessions' ? (
        <section>
          <h2>Session manager</h2>
          <ul>
            {(
              sessions as Array<{
                id: string;
                status: string;
                peerName?: string;
                qrPayload?: string;
                deepLink?: string;
              }>
            ).map((s) => (
              <li key={s.id}>
                {s.peerName ?? 'Session'} — {s.status}
                {s.qrPayload ? <pre>{s.qrPayload}</pre> : null}
                {s.deepLink ? <p>Deep link: {s.deepLink}</p> : null}
                {s.status === 'PENDING' ? (
                  <button type="button" onClick={() => void approveSession(s.id)}>
                    Approve
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {screen === 'dapp' ? (
        <section>
          <h2>dApp browser & connection manager</h2>
          <label>
            Origin
            <input value={dappOrigin} onChange={(e) => setDappOrigin(e.target.value)} />
          </label>
          <label>
            Name
            <input value={dappName} onChange={(e) => setDappName(e.target.value)} />
          </label>
          <button type="button" onClick={() => void createDappRequest()}>
            Request connection
          </button>
          <label>
            Browse URL
            <input value={dappUrl} onChange={(e) => setDappUrl(e.target.value)} />
          </label>
          <button type="button" onClick={() => void visitDapp()}>
            Visit / bookmark
          </button>

          <h3>Pending connection requests</h3>
          <ul>
            {(
              dappRequests as Array<{
                id: string;
                name: string;
                origin: string;
                status: string;
              }>
            )
              .filter((r) => r.status === 'PENDING')
              .map((r) => (
                <li key={r.id}>
                  {r.name} ({r.origin}) — approval dialog
                  <button type="button" onClick={() => void approveDappRequest(r.id)}>
                    Approve
                  </button>
                  <button type="button" onClick={() => void rejectDappRequest(r.id)}>
                    Reject
                  </button>
                </li>
              ))}
          </ul>

          <h3>Bookmarks</h3>
          <ul>
            {(
              bookmarks as Array<{ id: string; title: string; url: string; isTrusted: boolean }>
            ).map((b) => (
              <li key={b.id}>
                {b.title} — {b.url} {b.isTrusted ? '(trusted)' : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {screen === 'permissions' ? (
        <section>
          <h2>Permission editor</h2>
          <ul>
            {(
              permissions as Array<{
                id: string;
                origin: string;
                permission: string;
                allowed: boolean;
              }>
            ).map((p) => (
              <li key={p.id}>
                {p.origin} · {p.permission} — {p.allowed ? 'allowed' : 'denied'}{' '}
                <button
                  type="button"
                  onClick={() => void togglePermission(p.origin, p.permission, p.allowed)}
                >
                  Toggle
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {screen === 'trusted' ? (
        <section>
          <h2>Trusted dApps</h2>
          <ul>
            {(trustedDapps as Array<{ id: string; name: string; origin: string }>).map((t) => (
              <li key={t.id}>
                {t.name} — {t.origin}{' '}
                <button type="button" onClick={() => void revokeTrusted(t.id)}>
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {screen === 'history' ? (
        <section>
          <h2>Connection history</h2>
          <ul>
            {(
              activity as Array<{
                id: string;
                eventType: string;
                summary: string;
                origin?: string;
                createdAt: string;
              }>
            ).map((a) => (
              <li key={a.id}>
                {a.summary} · {a.eventType}
                {a.origin ? ` · ${a.origin}` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {screen === 'browser' ? (
        <section>
          <h2>Browser wallets</h2>
          <ul>
            {(browser as Array<{ providerId: string; name: string; connected: boolean }>).map(
              (b) => (
                <li key={b.providerId}>
                  {b.name} — {b.connected ? 'connected' : 'available'}{' '}
                  <button type="button" onClick={() => void connectBrowser(b.providerId)}>
                    Connect
                  </button>
                </li>
              ),
            )}
          </ul>
        </section>
      ) : null}

      {screen === 'watch' ? (
        <section>
          <h2>Read-only wallet manager</h2>
          <label>
            Watch address
            <input value={watchAddress} onChange={(e) => setWatchAddress(e.target.value)} />
          </label>
          <button type="button" onClick={() => void addWatch()}>
            Add watch address
          </button>
          <ul>
            {(watch as Array<{ id: string; address: string; network: string; label?: string }>).map(
              (w) => (
                <li key={w.id}>
                  {w.label ?? 'Watch'} — {w.network} {w.address} (no signing)
                </li>
              ),
            )}
          </ul>
        </section>
      ) : null}

      {screen === 'sign' ? (
        <section>
          <h2>Transaction / signature preview</h2>
          <label>
            dApp origin (permission-gated)
            <input value={signOrigin} onChange={(e) => setSignOrigin(e.target.value)} />
          </label>
          <label>
            Connection ref
            <input value={connectionRef} onChange={(e) => setConnectionRef(e.target.value)} />
          </label>
          <label>
            Payload type
            <select
              value={payloadType}
              onChange={(e) =>
                setPayloadType(e.target.value as 'TRANSACTION' | 'MESSAGE' | 'TYPED_DATA')
              }
            >
              <option value="TRANSACTION">Transaction</option>
              <option value="MESSAGE">Message</option>
              <option value="TYPED_DATA">Typed data</option>
            </select>
          </label>
          <label>
            Payload
            <input value={payload} onChange={(e) => setPayload(e.target.value)} />
          </label>
          <button type="button" onClick={() => void prepareSign()}>
            Preview & prepare
          </button>
        </section>
      ) : null}

      {screen === 'confirm' && prepared ? (
        <section>
          <h2>Confirm before signing</h2>
          <pre>{JSON.stringify(prepared, null, 2)}</pre>
          <button type="button" onClick={() => void confirmSign(true)}>
            Confirm sign
          </button>
          <button type="button" onClick={() => void confirmSign(false)}>
            Reject
          </button>
        </section>
      ) : null}

      {screen === 'success' ? (
        <section>
          <h2>Completed</h2>
          <pre>{JSON.stringify(signResult ?? { ok: true }, null, 2)}</pre>
          <button type="button" onClick={() => setScreen('connect')}>
            Back
          </button>
        </section>
      ) : null}

      {screen === 'failure' ? (
        <section>
          <h2>Connection / signing error</h2>
          <p role="alert">{error ?? 'Operation failed'}</p>
          <button type="button" onClick={() => setScreen('connect')}>
            Back
          </button>
        </section>
      ) : null}
    </main>
  );
}
