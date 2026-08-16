'use client';

import { Alert, Button, EmptyState, StatusBadge } from '@auvora/ui';
import { useEffect, useState, type ReactElement } from 'react';
import { getSecurityPrefs, setSecurityPrefs } from '../../lib/wallet-experience/security-prefs';
import { mapDevices, mapSessions, settingsFetch } from '../../lib/settings/api';
import {
  DEMO_DEVICES,
  DEMO_SESSIONS,
  type DemoDevice,
  type DemoSession,
} from '../../lib/settings/demo';
import { useTimedToast } from '../../lib/settings/use-timed-toast';
import { PlatformShell } from '../platform/PlatformShell';
import { SettingsSectionNav } from './SettingsSectionNav';
import { FeedbackToast } from '../status/FeedbackToast';

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function DeviceManagementExperience(): ReactElement {
  const [devices, setDevices] = useState<DemoDevice[]>(DEMO_DEVICES);
  const [sessions, setSessions] = useState<DemoSession[]>(DEMO_SESSIONS);
  const [live, setLive] = useState(false);
  const { toast, tone, showToast } = useTimedToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    type: 'session' | 'device' | 'all';
    id?: string;
  } | null>(null);
  const [autoLock, setAutoLock] = useState(5);
  const [idleTimeout, setIdleTimeout] = useState(30);

  useEffect(() => {
    const sec = getSecurityPrefs();
    setAutoLock(sec.autoLockMinutes);
    setIdleTimeout(sec.sessionTimeoutMinutes);
    let cancelled = false;
    void (async () => {
      try {
        const [s, d] = await Promise.all([
          settingsFetch<unknown>('/api/v1/me/sessions').catch(() => null),
          settingsFetch<unknown>('/api/v1/me/devices').catch(() => null),
        ]);
        if (cancelled) return;
        const sessionsOk = Array.isArray(s);
        const devicesOk = Array.isArray(d);
        if (sessionsOk || devicesOk) {
          setLive(true);
          setSessions(sessionsOk ? mapSessions(s) : []);
          setDevices(devicesOk ? mapDevices(d) : []);
        }
      } catch {
        /* keep labeled demo fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function revokeSession(id: string): Promise<void> {
    if (!live) {
      showToast('Sign in required — sample devices cannot be revoked', { tone: 'warn' });
      return;
    }
    setBusyId(id);
    try {
      await settingsFetch(`/api/v1/me/sessions/${id}`, { method: 'DELETE' });
      setSessions((prev) => prev.filter((s) => s.id !== id));
      showToast('Session revoked', { tone: 'success' });
    } catch {
      showToast('Could not revoke session', { tone: 'error' });
    } finally {
      setBusyId(null);
      setConfirm(null);
    }
  }

  async function revokeDevice(id: string): Promise<void> {
    if (!live) {
      showToast('Sign in required — sample devices cannot be revoked', { tone: 'warn' });
      return;
    }
    setBusyId(id);
    try {
      await settingsFetch(`/api/v1/me/devices/${id}`, { method: 'DELETE' });
      setDevices((prev) => prev.filter((d) => d.id !== id));
      showToast('Device revoked', { tone: 'success' });
    } catch {
      showToast('Could not revoke device', { tone: 'error' });
    } finally {
      setBusyId(null);
      setConfirm(null);
    }
  }

  async function logoutAll(): Promise<void> {
    if (!live) {
      showToast('Sign in to manage live sessions', { tone: 'warn' });
      return;
    }
    setBusyId('all');
    try {
      const others = sessions.filter((x) => !x.current);
      for (const s of others) {
        await settingsFetch(`/api/v1/me/sessions/${s.id}`, { method: 'DELETE' }).catch(() => null);
      }
      setSessions((prev) => prev.filter((s) => s.current));
      showToast('Signed out other devices', { tone: 'success' });
    } finally {
      setBusyId(null);
      setConfirm(null);
    }
  }

  function saveTimeouts(): void {
    const nextLock = clamp(autoLock, 1, 120);
    const nextIdle = clamp(idleTimeout, 5, 1440);
    setAutoLock(nextLock);
    setIdleTimeout(nextIdle);
    setSecurityPrefs({ autoLockMinutes: nextLock, sessionTimeoutMinutes: nextIdle });
    showToast('Timeout settings saved', { tone: 'success' });
  }

  return (
    <PlatformShell
      title="Devices & sessions"
      subtitle="Account sessions for the Auvora identity layer. This does not sync private keys or imply encrypted wallet-secret restore."
      reassure="Revoking a session signs that device out. This device stays signed in."
      backHref="/settings"
      backLabel="Settings"
      nav={<SettingsSectionNav current="/settings/devices" />}
      actions={
        <button
          type="button"
          className="cx-btn cx-btn--ghost"
          disabled={busyId === 'all'}
          onClick={() => setConfirm({ type: 'all' })}
        >
          Logout all other devices
        </button>
      }
    >
      {toast ? <FeedbackToast message={toast} tone={tone} /> : null}

      {confirm ? (
        <div
          className="cx-alert cx-alert--warn"
          role="alertdialog"
          aria-labelledby="as-revoke-title"
        >
          <strong id="as-revoke-title">
            {confirm.type === 'all'
              ? 'Sign out other devices?'
              : confirm.type === 'device'
                ? 'Revoke this device?'
                : 'Sign this session out?'}
          </strong>
          <p className="cx-meta">
            {confirm.type === 'all'
              ? 'This browser stays signed in. Other account sessions will end.'
              : 'You can sign in again later. Wallet keys on this device are not deleted.'}
          </p>
          <div className="cx-platform__actions" style={{ marginTop: '0.75rem' }}>
            <button
              type="button"
              className="cx-btn cx-btn--primary"
              disabled={busyId !== null}
              onClick={() => {
                if (confirm.type === 'all') void logoutAll();
                else if (confirm.type === 'device' && confirm.id) void revokeDevice(confirm.id);
                else if (confirm.type === 'session' && confirm.id) void revokeSession(confirm.id);
              }}
            >
              Confirm
            </button>
            <button type="button" className="cx-btn cx-btn--ghost" onClick={() => setConfirm(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {!live ? (
        <Alert tone="info" title="Preview devices">
          Showing sample devices until you sign in. These are account sessions — not wallet keys.
        </Alert>
      ) : (
        <Alert tone="success" title="Live account devices">
          Devices and sessions below come from your Auvora account. Revocation is real. Encrypted
          wallet-secret sync is not implied.
        </Alert>
      )}

      <section className="cx-panel">
        <h2>Devices</h2>
        {devices.length === 0 ? (
          <EmptyState title="No devices" description="Signed-in devices will appear here." />
        ) : (
          <ul className="cx-list">
            {devices.map((d) => (
              <li key={d.id}>
                <div>
                  <strong>
                    {d.label} {d.current ? '(current)' : ''}
                  </strong>
                  <p className="cx-meta">
                    {d.platform} · {d.browser} · {d.location}
                  </p>
                  <p className="cx-meta">Last login {new Date(d.lastLogin).toLocaleString()}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <StatusBadge
                    status={d.trusted ? 'active' : 'pending'}
                    label={d.trusted ? 'Trusted' : 'Untrusted'}
                  />
                  {live && !d.current ? (
                    <Button
                      variant="secondary"
                      disabled={busyId === d.id}
                      onClick={() => setConfirm({ type: 'device', id: d.id })}
                    >
                      Revoke
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="cx-panel" id="sessions">
        <h2>Sessions</h2>
        {sessions.length === 0 ? (
          <EmptyState title="No sessions" description="Active sessions will appear here." />
        ) : (
          <ul className="cx-list">
            {sessions.map((s) => (
              <li key={s.id}>
                <div>
                  <strong>
                    {s.deviceLabel} {s.current ? '(this session)' : ''}
                  </strong>
                  <p className="cx-meta">
                    {s.platform} · {s.browser} · {s.location}
                  </p>
                  <p className="cx-meta">
                    Last active {new Date(s.lastActive).toLocaleString()} · Expires{' '}
                    {new Date(s.expiresAt).toLocaleString()}
                  </p>
                </div>
                {!s.current ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    disabled={busyId === s.id}
                    onClick={() => setConfirm({ type: 'session', id: s.id })}
                  >
                    Revoke
                  </Button>
                ) : (
                  <StatusBadge status="active" label="Current" />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="cx-panel">
        <h2>Automatic timeouts</h2>
        <div className="cx-toolbar">
          <label className="cx-field">
            <span>Auto-lock (minutes)</span>
            <input
              type="number"
              min={1}
              max={120}
              value={autoLock}
              onChange={(e) => setAutoLock(Number(e.target.value))}
              aria-label="Auto-lock minutes"
            />
          </label>
          <label className="cx-field">
            <span>Idle / session timeout (minutes)</span>
            <input
              type="number"
              min={5}
              max={1440}
              value={idleTimeout}
              onChange={(e) => setIdleTimeout(Number(e.target.value))}
              aria-label="Idle timeout minutes"
            />
          </label>
          <Button type="button" onClick={saveTimeouts}>
            Save
          </Button>
        </div>
        <p className="cx-meta">
          Use the header action to log out all other devices while keeping this session.
        </p>
      </section>
    </PlatformShell>
  );
}
