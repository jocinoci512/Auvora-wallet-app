'use client';

import { Alert, Button, EmptyState, StatusBadge } from '@auvora/ui';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { getSecurityPrefs } from '../../lib/wallet-experience/security-prefs';
import { settingsFetch } from '../../lib/settings/api';
import {
  DEMO_ALERTS,
  DEMO_DAPPS,
  DEMO_DEVICES,
  DEMO_SESSIONS,
  computeSecurityScore,
  type SecurityAlert,
  type SecurityScoreFactor,
} from '../../lib/settings/demo';
import { getBackupPrefs } from '../../lib/settings/prefs';
import { SettingsSectionNav } from './SettingsSectionNav';
import '../../app/settings-experience.css';

export function SecurityCenterExperience(): ReactElement {
  const [ready, setReady] = useState(false);
  const [live, setLive] = useState(false);
  const [sessionCount, setSessionCount] = useState(DEMO_SESSIONS.length);
  const [deviceCount, setDeviceCount] = useState(DEMO_DEVICES.length);
  const [dappCount, setDappCount] = useState(DEMO_DAPPS.length);
  const [alerts, setAlerts] = useState<SecurityAlert[]>(DEMO_ALERTS);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [biometric, setBiometric] = useState(false);
  const [backupOk, setBackupOk] = useState(false);
  const [backupReminders, setBackupReminders] = useState(true);

  useEffect(() => {
    const sec = getSecurityPrefs();
    const backup = getBackupPrefs();
    setPinEnabled(sec.pinEnabled);
    setBiometric(sec.biometricEnabled);
    setBackupOk(backup.phraseVerified);
    setBackupReminders(backup.reminderEnabled || sec.backupReminderEnabled);

    let cancelled = false;
    void (async () => {
      try {
        const [sessions, devices, summary] = await Promise.all([
          settingsFetch<unknown[]>('/api/v1/me/sessions').catch(() => null),
          settingsFetch<unknown[]>('/api/v1/me/devices').catch(() => null),
          settingsFetch<{ activeSessions?: number }>(
            '/api/v1/connections/dapps/sessions/summary',
          ).catch(() => null),
        ]);
        if (cancelled) return;
        if (Array.isArray(sessions)) {
          setSessionCount(sessions.length);
          setLive(true);
        }
        if (Array.isArray(devices)) {
          setDeviceCount(devices.length);
          setLive(true);
        }
        if (summary) {
          setDappCount(Number(summary.activeSessions ?? 0));
          setLive(true);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const factors: SecurityScoreFactor[] = useMemo(
    () => [
      {
        id: 'pin',
        label: 'Password / PIN enabled',
        ok: pinEnabled,
        weight: 25,
        href: '/security',
        action: pinEnabled ? 'Manage PIN' : 'Enable PIN',
      },
      {
        id: 'backup',
        label: 'Recovery phrase verified',
        ok: backupOk,
        weight: 25,
        href: '/settings/backup',
        action: backupOk ? 'Review backup' : 'Verify backup',
      },
      {
        id: 'biometric',
        label: 'Biometrics configured (placeholder)',
        ok: biometric,
        weight: 10,
        href: '/security',
        action: 'Open security',
      },
      {
        id: 'devices',
        label: 'Trusted devices reviewed',
        ok: deviceCount > 0,
        weight: 15,
        href: '/settings/devices',
        action: 'Manage devices',
      },
      {
        id: 'dapps',
        label: 'dApp permissions reviewed',
        ok: dappCount === 0,
        weight: 15,
        href: '/settings/dapps',
        action: dappCount === 0 ? 'Browse dApps' : 'Review dApps',
      },
      {
        id: 'reminders',
        label: 'Backup reminders on',
        ok: backupReminders,
        weight: 10,
        href: '/settings/backup',
        action: 'Backup settings',
      },
    ],
    [pinEnabled, backupOk, biometric, deviceCount, dappCount, backupReminders],
  );

  const score = computeSecurityScore(factors);
  const recommended = factors.filter((f) => !f.ok);

  return (
    <div className="sc">
      <header className="sc__header">
        <div>
          <p className="sc__eyebrow">
            <Link href="/">Dashboard</Link>
          </p>
          <h1>Security Center</h1>
          <p className="sc__sub">
            Stay in control of wallets, devices, sessions, permissions, and recovery — with clear
            next actions.
          </p>
        </div>
        <div className="sc-actions">
          <Link href="/security">
            <Button type="button" variant="secondary">
              PIN & lock
            </Button>
          </Link>
          <Link href="/settings/account">
            <Button type="button">Account</Button>
          </Link>
        </div>
      </header>

      <SettingsSectionNav current="/settings" />

      {ready && !live ? (
        <Alert tone="info" title="Preview security data">
          Auth / connections sessions unavailable — curated Security Center data shown.
        </Alert>
      ) : null}

      <section className="sc-panel">
        <h2>Overall security score</h2>
        <div className="sc-score" style={{ ['--sc-score' as string]: score }}>
          <div className="sc-score__ring" aria-label={`Security score ${score} percent`}>
            <strong>{score}</strong>
          </div>
          <div>
            <p className="sc-meta">
              Score reflects PIN, backup verification, biometrics architecture, devices, and dApp
              hygiene.
            </p>
            <div className="sc-kpi" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
              <div className="sc-kpi__card">
                <span>Sessions</span>
                <strong>{sessionCount}</strong>
              </div>
              <div className="sc-kpi__card">
                <span>Devices</span>
                <strong>{deviceCount}</strong>
              </div>
              <div className="sc-kpi__card">
                <span>Connected dApps</span>
                <strong>{dappCount}</strong>
              </div>
              <div className="sc-kpi__card">
                <span>Alerts</span>
                <strong>{alerts.length}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="sc-panel">
        <h2>Recommended actions</h2>
        {recommended.length === 0 ? (
          <EmptyState
            title="You are in good shape"
            description="No critical security actions right now."
          />
        ) : (
          <ul className="sc-list">
            {recommended.map((f) => (
              <li key={f.id}>
                <div>
                  <strong>{f.label}</strong>
                  <p className="sc-meta">Improves score by ~{f.weight} points</p>
                </div>
                <Link href={f.href}>
                  <Button type="button" size="sm">
                    {f.action}
                  </Button>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="sc-grid">
        <Link className="sc-card" href="/settings/devices">
          <strong>Device management</strong>
          <p className="sc-meta">Current & trusted devices · last login</p>
        </Link>
        <Link className="sc-card" href="/settings/devices#sessions">
          <strong>Active sessions</strong>
          <p className="sc-meta">Revoke · timeouts · logout all</p>
        </Link>
        <Link className="sc-card" href="/settings/dapps">
          <strong>Connected dApps</strong>
          <p className="sc-meta">Permissions overview · disconnect</p>
        </Link>
        <Link className="sc-card" href="/security">
          <strong>Password / PIN</strong>
          <p className="sc-meta">
            {pinEnabled ? 'Enabled' : 'Not enabled'} · biometric architecture
          </p>
        </Link>
        <Link className="sc-card" href="/settings/backup">
          <strong>Backup & recovery</strong>
          <p className="sc-meta">{backupOk ? 'Verified' : 'Needs verification'}</p>
        </Link>
        <Link className="sc-card" href="/web3/permissions">
          <strong>Permission overview</strong>
          <p className="sc-meta">Deep link to Web3 permission center</p>
        </Link>
      </div>

      <section className="sc-panel">
        <h2>Security alerts</h2>
        {alerts.length === 0 ? (
          <EmptyState title="No alerts" description="Security notifications will appear here." />
        ) : (
          <ul className="sc-list">
            {alerts.map((a) => (
              <li key={a.id}>
                <div>
                  <strong>{a.title}</strong>
                  <p className="sc-meta">{a.detail}</p>
                  <p className="sc-meta">{new Date(a.timestamp).toLocaleString()}</p>
                </div>
                <StatusBadge
                  status={
                    a.severity === 'critical'
                      ? 'failed'
                      : a.severity === 'warn'
                        ? 'pending'
                        : 'active'
                  }
                  label={a.severity}
                />
              </li>
            ))}
          </ul>
        )}
        <div className="sc-actions" style={{ marginTop: '0.75rem' }}>
          <Button type="button" size="sm" variant="ghost" onClick={() => setAlerts([])}>
            Dismiss preview alerts
          </Button>
          <Link href="/settings/notifications">
            <Button type="button" size="sm" variant="secondary">
              Alert preferences
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
