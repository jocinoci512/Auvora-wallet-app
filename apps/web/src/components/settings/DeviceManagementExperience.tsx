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

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function DeviceManagementExperience(): ReactElement {
  const [devices, setDevices] = useState<DemoDevice[]>(DEMO_DEVICES);
  const [sessions, setSessions] = useState<DemoSession[]>(DEMO_SESSIONS);
  const [live, setLive] = useState(false);
  const { toast, showToast } = useTimedToast();
  const [busyId, setBusyId] = useState<string | null>(null);
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
        const mappedS = mapSessions(s);
        const mappedD = mapDevices(d);
        if (mappedS.length) {
          setSessions(mappedS);
          setLive(true);
        }
        if (mappedD.length) {
          setDevices(mappedD);
          setLive(true);
        }
      } catch {
        /* demo */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function revokeSession(id: string): Promise<void> {
    setBusyId(id);
    try {
      if (live) {
        await settingsFetch(`/api/v1/me/sessions/${id}`, { method: 'DELETE' });
      }
      setSessions((prev) => prev.filter((s) => s.id !== id));
      showToast('Session revoked');
    } catch {
      showToast('Could not revoke session');
    } finally {
      setBusyId(null);
    }
  }

  async function logoutAll(): Promise<void> {
    setBusyId('all');
    try {
      const others = sessions.filter((x) => !x.current);
      for (const s of others) {
        if (live) {
          await settingsFetch(`/api/v1/me/sessions/${s.id}`, { method: 'DELETE' }).catch(
            () => null,
          );
        }
      }
      setSessions((prev) => prev.filter((s) => s.current));
      showToast('Logged out other devices');
    } finally {
      setBusyId(null);
    }
  }

  function saveTimeouts(): void {
    const nextLock = clamp(autoLock, 1, 120);
    const nextIdle = clamp(idleTimeout, 5, 1440);
    setAutoLock(nextLock);
    setIdleTimeout(nextIdle);
    setSecurityPrefs({ autoLockMinutes: nextLock, sessionTimeoutMinutes: nextIdle });
    showToast('Timeout settings saved');
  }

  return (
    <PlatformShell
      title="Devices & sessions"
      subtitle="Current device, trusted devices, last login, platform, browser, approximate location, and remote logout."
      reassure="Revoking a session signs that device out without touching this one."
      backHref="/settings"
      backLabel="Settings"
      nav={<SettingsSectionNav current="/settings/devices" />}
      actions={
        <button
          type="button"
          className="cx-btn cx-btn--ghost"
          disabled={busyId === 'all'}
          onClick={() => void logoutAll()}
        >
          Logout all other devices
        </button>
      }
    >
      {toast ? (
        <Alert tone={toast.startsWith('Could') ? 'error' : 'success'} title="Updated">
          {toast}
        </Alert>
      ) : null}

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
                <StatusBadge
                  status={d.trusted ? 'active' : 'pending'}
                  label={d.trusted ? 'Trusted' : 'Untrusted'}
                />
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
                    onClick={() => void revokeSession(s.id)}
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
