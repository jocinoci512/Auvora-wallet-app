'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { settingsFetch } from '../../lib/settings/api';
import {
  DEMO_ALERTS,
  DEMO_DEVICES,
  DEMO_SESSIONS,
  computeSecurityScore,
  type SecurityAlert,
  type SecurityScoreFactor,
} from '../../lib/settings/demo';
import { demoConnectedRows } from '../../lib/web3/sessions';
import { getBackupPrefs } from '../../lib/settings/prefs';
import { getSecurityPrefs, setSecurityPrefs } from '../../lib/wallet-experience/security-prefs';
import { PlatformCardLink, PlatformShell } from '../platform/PlatformShell';
import { SettingsSectionNav } from './SettingsSectionNav';

const WHY: Record<string, string> = {
  pin: 'A PIN stops casual access if your device is unlocked nearby.',
  backup: 'A verified recovery phrase is the only way to restore self-custody wallets.',
  biometric: 'Biometrics speed unlock without weakening your PIN or phrase.',
  devices: 'Unknown or untrusted devices are a common path to account takeover.',
  dapps:
    'Open dApp transaction grants can move funds after you approve each send — review regularly.',
  review: 'A recent review helps you catch drift before it turns into risk.',
  reminders: 'Gentle reminders keep recovery hygiene from drifting.',
};

export function SecurityCenterExperience(): ReactElement {
  const [ready, setReady] = useState(false);
  const [live, setLive] = useState(false);
  const [sessionCount, setSessionCount] = useState(DEMO_SESSIONS.length);
  const [deviceCount, setDeviceCount] = useState(DEMO_DEVICES.length);
  const [dappCount, setDappCount] = useState(demoConnectedRows().length);
  const [alerts, setAlerts] = useState<SecurityAlert[]>(DEMO_ALERTS);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [biometric, setBiometric] = useState(false);
  const [backupOk, setBackupOk] = useState(false);
  const [backupReminders, setBackupReminders] = useState(true);
  const [lastReviewAt, setLastReviewAt] = useState<string | null>(null);
  const [hideSensitiveInfo, setHideSensitiveInfo] = useState(false);
  const [notificationPrivacy, setNotificationPrivacy] = useState(true);
  const [clipboardTimeoutSeconds, setClipboardTimeoutSeconds] = useState(30);
  const [requireAuthForSend, setRequireAuthForSend] = useState(true);
  const [requireAuthForSettings, setRequireAuthForSettings] = useState(true);
  const [requireAuthForRecoveryPhrase, setRequireAuthForRecoveryPhrase] = useState(true);
  const [emergencyNotificationsMuted, setEmergencyNotificationsMuted] = useState(false);

  useEffect(() => {
    const sec = getSecurityPrefs();
    const backup = getBackupPrefs();
    setPinEnabled(sec.pinEnabled);
    setBiometric(sec.biometricEnabled);
    setBackupOk(backup.phraseVerified);
    setBackupReminders(backup.reminderEnabled || sec.backupReminderEnabled);
    setLastReviewAt(sec.lastSecurityReviewAt);
    setHideSensitiveInfo(sec.hideSensitiveInfo);
    setNotificationPrivacy(sec.notificationPrivacy);
    setClipboardTimeoutSeconds(sec.clipboardTimeoutSeconds);
    setRequireAuthForSend(sec.requireAuthForSend);
    setRequireAuthForSettings(sec.requireAuthForSettings);
    setRequireAuthForRecoveryPhrase(sec.requireAuthForRecoveryPhrase);
    setEmergencyNotificationsMuted(sec.emergencyNotificationsMuted);

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
        label: 'Biometrics ready',
        ok: biometric,
        weight: 10,
        href: '/security',
        action: 'Open biometrics',
      },
      {
        id: 'devices',
        label: 'No untrusted devices',
        ok: live
          ? deviceCount <= 2
          : DEMO_DEVICES.every((device) => device.trusted || device.current),
        weight: 15,
        href: '/settings/devices',
        action: 'Review devices',
      },
      {
        id: 'dapps',
        label: 'dApp permissions reviewed',
        ok: live ? dappCount <= 1 : demoConnectedRows().every((dapp) => dapp.permissions <= 2),
        weight: 15,
        href: '/web3/permissions',
        action: dappCount <= 1 ? 'Open Web3' : 'Review permissions',
      },
      {
        id: 'review',
        label: 'Security review completed recently',
        ok: !!lastReviewAt && Date.now() - new Date(lastReviewAt).getTime() <= 30 * 86_400_000,
        weight: 10,
        href: '/settings/security',
        action: 'Mark review complete',
      },
      {
        id: 'reminders',
        label: 'Backup reminders on',
        ok: backupReminders,
        weight: 5,
        href: '/settings/backup',
        action: 'Backup settings',
      },
    ],
    [pinEnabled, backupOk, biometric, deviceCount, dappCount, backupReminders, live, lastReviewAt],
  );

  const score = computeSecurityScore(factors);
  const recommended = factors.filter((f) => !f.ok);
  const statusLabel =
    score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 55 ? 'Fair' : 'Needs attention';

  function markReviewNow(): void {
    const next = new Date().toISOString();
    setSecurityPrefs({ lastSecurityReviewAt: next });
    setLastReviewAt(next);
  }

  function emergencyLock(): void {
    setSecurityPrefs({
      emergencyNotificationsMuted: true,
      lastSecurityReviewAt: new Date().toISOString(),
    });
    setEmergencyNotificationsMuted(true);
    setAlerts((prev) => [
      {
        id: `alert-${Date.now()}`,
        title: 'Emergency mode enabled',
        detail:
          'Security-sensitive notifications were muted and the session should be re-authenticated next.',
        severity: 'warn',
        timestamp: new Date().toISOString(),
      },
      ...prev,
    ]);
  }

  return (
    <PlatformShell
      title="Security Center"
      subtitle="One place for score, recovery, devices, sessions, and permissions."
      reassure="Your assets stay under your control — we only recommend what improves protection."
      backHref="/settings"
      backLabel="Settings"
      nav={<SettingsSectionNav current="/settings/security" />}
      actions={
        <>
          <Link href="/security" className="cx-btn cx-btn--ghost">
            PIN & lock
          </Link>
          <Link href="/notifications" className="cx-btn cx-btn--primary">
            Alerts inbox
          </Link>
        </>
      }
    >
      {ready && !live ? (
        <div className="cx-alert cx-alert--info">
          Live sessions are unavailable — curated Security Center data is shown for preview. Scores
          and connected-app counts are not a verified-safe guarantee.
        </div>
      ) : null}

      {!ready ? (
        <div className="cx-skeleton" aria-busy="true" aria-label="Loading security status">
          <div className="cx-skeleton__row cx-skeleton__row--lg" />
          <div className="cx-skeleton__row" />
          <div className="cx-skeleton__row" />
          <div className="cx-skeleton__row" />
        </div>
      ) : null}

      <section className="cx-panel">
        <h2>Overall security score</h2>
        <div className="cx-score-row">
          <div
            className="cx-score-ring"
            style={{ ['--cx-score' as string]: score }}
            aria-label={`Security score ${score} percent`}
          >
            <strong>{score}</strong>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p className="cx-meta">
              Score reflects PIN, backup verification, biometrics, devices, and dApp hygiene.
            </p>
            <p className="cx-meta" style={{ marginTop: '0.35rem' }}>
              Status: {statusLabel} ·{' '}
              {lastReviewAt
                ? `Last review ${new Date(lastReviewAt).toLocaleString()}`
                : 'No review logged yet'}
            </p>
            <div className="cx-kpi" style={{ marginTop: '0.85rem' }}>
              <div className="cx-kpi__card">
                <span>Sessions</span>
                <strong>{sessionCount}</strong>
              </div>
              <div className="cx-kpi__card">
                <span>Devices</span>
                <strong>{deviceCount}</strong>
              </div>
              <div className="cx-kpi__card">
                <span>dApps</span>
                <strong>{dappCount}</strong>
              </div>
              <div className="cx-kpi__card">
                <span>Alerts</span>
                <strong>{alerts.length}</strong>
              </div>
            </div>
            <div className="cx-platform__actions" style={{ marginTop: '0.85rem' }}>
              <button type="button" className="cx-btn cx-btn--ghost" onClick={markReviewNow}>
                Mark review complete
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="cx-panel">
        <h2>Health checklist</h2>
        <p>Each item shows why it matters, your current level, and how to improve.</p>
        <ul className="cx-list">
          {factors.map((f) => (
            <li key={f.id}>
              <div>
                <strong>
                  {f.ok ? '✓ ' : '○ '}
                  {f.label}
                </strong>
                <p className="cx-meta">{WHY[f.id]}</p>
                <p className="cx-meta">
                  Protection: {f.ok ? 'On' : 'Needs attention'} · Impact ~{f.weight} pts
                </p>
              </div>
              <Link href={f.href} className="cx-btn cx-btn--ghost">
                {f.action}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="cx-panel">
        <h2>Recommended actions</h2>
        {recommended.length === 0 ? (
          <div className="cx-empty">
            <h2>You are in good shape</h2>
            <p>No critical security actions right now.</p>
          </div>
        ) : (
          <ul className="cx-list">
            {recommended.map((f) => (
              <li key={f.id}>
                <div>
                  <strong>{f.label}</strong>
                  <p className="cx-meta">{WHY[f.id]}</p>
                </div>
                <Link href={f.href} className="cx-btn cx-btn--primary">
                  {f.action}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="cx-card-grid">
        <PlatformCardLink
          href="/settings/devices"
          title="Connected devices"
          detail="Trusted devices · last login"
        />
        <PlatformCardLink
          href="/settings/devices#sessions"
          title="Active sessions"
          detail="Revoke · timeouts · logout all"
        />
        <PlatformCardLink
          href="/web3/permissions"
          title="Connected dApps"
          detail="Permissions · revoke · review risk"
        />
        <PlatformCardLink
          href="/settings/privacy"
          title="Privacy controls"
          detail={hideSensitiveInfo ? 'Sensitive info hidden' : 'Privacy review available'}
        />
        <PlatformCardLink
          href="/security"
          title="PIN · biometrics · lock"
          detail={pinEnabled ? 'PIN enabled' : 'PIN not enabled'}
        />
        <PlatformCardLink
          href="/settings/backup"
          title="Recovery options"
          detail={backupOk ? 'Phrase verified' : 'Needs verification'}
        />
        <PlatformCardLink
          href="/wallets/hardware"
          title="Hardware wallets"
          detail="Ledger / future connectors"
        />
        <PlatformCardLink
          href="/address-book"
          title="Trusted contacts"
          detail="Future-ready address book"
        />
        <PlatformCardLink
          href="/activity"
          title="Approval history"
          detail="Sends, swaps, and signs"
        />
      </div>

      <section className="cx-panel">
        <h2>Authentication requirements</h2>
        <ul className="cx-list">
          <li>
            <div>
              <strong>Opening the app</strong>
              <p className="cx-meta">
                {biometric ? 'Biometric preference is on' : 'PIN or session unlock applies'}
              </p>
            </div>
            <span className="cx-badge cx-badge--confirmed">
              {biometric ? 'Biometric ready' : 'PIN fallback'}
            </span>
          </li>
          <li>
            <div>
              <strong>Sending funds</strong>
              <p className="cx-meta">Require confirmation before any high-risk transfer.</p>
            </div>
            <span
              className={`cx-badge ${requireAuthForSend ? 'cx-badge--confirmed' : 'cx-badge--pending'}`}
            >
              {requireAuthForSend ? 'Required' : 'Relaxed'}
            </span>
          </li>
          <li>
            <div>
              <strong>Changing settings</strong>
              <p className="cx-meta">Protect sensitive settings from casual access.</p>
            </div>
            <span
              className={`cx-badge ${requireAuthForSettings ? 'cx-badge--confirmed' : 'cx-badge--pending'}`}
            >
              {requireAuthForSettings ? 'Required' : 'Relaxed'}
            </span>
          </li>
          <li>
            <div>
              <strong>Viewing the recovery phrase</strong>
              <p className="cx-meta">The phrase should never be shown without re-authentication.</p>
            </div>
            <span
              className={`cx-badge ${
                requireAuthForRecoveryPhrase ? 'cx-badge--confirmed' : 'cx-badge--pending'
              }`}
            >
              {requireAuthForRecoveryPhrase ? 'Required' : 'Relaxed'}
            </span>
          </li>
        </ul>
      </section>

      <section className="cx-panel">
        <h2>Privacy & emergency</h2>
        <ul className="cx-list">
          <li>
            <div>
              <strong>Sensitive information</strong>
              <p className="cx-meta">
                {hideSensitiveInfo
                  ? 'Hidden on this device where possible.'
                  : 'Visible until you turn on hiding.'}
              </p>
            </div>
            <Link href="/settings/privacy" className="cx-btn cx-btn--ghost">
              Review privacy
            </Link>
          </li>
          <li>
            <div>
              <strong>Notification privacy</strong>
              <p className="cx-meta">
                {notificationPrivacy
                  ? 'Balances stay out of previews.'
                  : 'Notifications may show more detail.'}
              </p>
            </div>
            <span className="cx-badge cx-badge--confirmed">
              {notificationPrivacy ? 'Protected' : 'Open'}
            </span>
          </li>
          <li>
            <div>
              <strong>Clipboard timeout</strong>
              <p className="cx-meta">
                Copied sensitive values are expected to clear after {clipboardTimeoutSeconds}s.
              </p>
            </div>
            <Link href="/settings/privacy" className="cx-btn cx-btn--ghost">
              Manage
            </Link>
          </li>
          <li>
            <div>
              <strong>Emergency mode</strong>
              <p className="cx-meta">
                {emergencyNotificationsMuted
                  ? 'Emergency notification muting is active.'
                  : 'Lock quickly and mute sensitive notification previews if something feels wrong.'}
              </p>
            </div>
            <button type="button" className="cx-btn cx-btn--primary" onClick={emergencyLock}>
              {emergencyNotificationsMuted ? 'Emergency mode active' : 'Lock down now'}
            </button>
          </li>
        </ul>
      </section>

      <section className="cx-panel">
        <h2>Risk alerts & suspicious activity</h2>
        {alerts.length === 0 ? (
          <div className="cx-empty">
            <h2>No alerts</h2>
            <p>Security notifications will appear here.</p>
          </div>
        ) : (
          <ul className="cx-list">
            {alerts.map((a) => (
              <li key={a.id}>
                <div>
                  <strong>{a.title}</strong>
                  <p className="cx-meta">{a.detail}</p>
                  <p className="cx-meta">{new Date(a.timestamp).toLocaleString()}</p>
                </div>
                <span
                  className={`cx-badge ${
                    a.severity === 'critical'
                      ? 'cx-badge--failed'
                      : a.severity === 'warn'
                        ? 'cx-badge--pending'
                        : 'cx-badge--confirmed'
                  }`}
                >
                  {a.severity}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="cx-platform__actions" style={{ marginTop: '0.85rem' }}>
          <button type="button" className="cx-btn cx-btn--ghost" onClick={() => setAlerts([])}>
            Dismiss preview alerts
          </button>
          <Link href="/settings/notifications" className="cx-btn cx-btn--ghost">
            Alert preferences
          </Link>
        </div>
      </section>
    </PlatformShell>
  );
}
