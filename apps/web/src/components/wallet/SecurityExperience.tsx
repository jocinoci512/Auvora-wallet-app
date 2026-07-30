'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import {
  getSecurityPrefs,
  hashPin,
  setSecurityPrefs,
  verifyPin,
} from '../../lib/wallet-experience/security-prefs';
import type { SecurityPrefs } from '../../lib/wallet-experience/types';
import { PlatformShell } from '../platform/PlatformShell';

export function SecurityExperience(): ReactElement {
  const [prefs, setPrefs] = useState<SecurityPrefs>(() => getSecurityPrefs());
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [unlockPin, setUnlockPin] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const current = getSecurityPrefs();
    if (!current.requireAuthForSettings || !current.requireAuthForRecoveryPhrase) {
      const normalized = setSecurityPrefs({
        requireAuthForSettings: true,
        requireAuthForRecoveryPhrase: true,
      });
      setPrefs(normalized);
    } else {
      setPrefs(current);
    }
    if (current.pinEnabled && current.lastUnlockedAt) {
      const elapsed = Date.now() - new Date(current.lastUnlockedAt).getTime();
      if (elapsed > current.autoLockMinutes * 60_000) setLocked(true);
    }
  }, []);

  function patch(next: Partial<SecurityPrefs>): void {
    const saved = setSecurityPrefs(next);
    setPrefs(saved);
  }

  function weakPin(value: string): boolean {
    return ['0000', '1111', '1234', '123456', '654321', '121212', '112233'].includes(value);
  }

  async function enablePin(): Promise<void> {
    if (!/^\d{4,8}$/.test(pin)) {
      setMessage('PIN must be 4–8 digits');
      return;
    }
    if (weakPin(pin)) {
      setMessage('Choose a less obvious PIN. Avoid repeats and simple sequences.');
      return;
    }
    if (pin !== pinConfirm) {
      setMessage('PIN confirmation does not match');
      return;
    }
    const pinHash = await hashPin(pin);
    patch({
      pinEnabled: true,
      pinHash,
      lastUnlockedAt: new Date().toISOString(),
    });
    setPin('');
    setPinConfirm('');
    setMessage('PIN enabled');
    setLocked(false);
  }

  async function unlock(): Promise<void> {
    const ok = await verifyPin(unlockPin);
    if (!ok) {
      setMessage('Incorrect PIN');
      return;
    }
    patch({ lastUnlockedAt: new Date().toISOString() });
    setUnlockPin('');
    setLocked(false);
    setMessage('Unlocked');
  }

  function disablePin(): void {
    if (!window.confirm('Disable PIN protection on this device?')) return;
    patch({ pinEnabled: false, pinHash: null });
    setMessage('PIN disabled');
    setLocked(false);
  }

  if (locked) {
    return (
      <PlatformShell
        title="Session locked"
        subtitle="Enter your PIN to continue."
        reassure="Auto-lock protects idle sessions on this device."
        backHref="/settings/security"
        backLabel="Security Center"
        wide={false}
      >
        <section className="cx-panel">
          <label className="cx-field">
            <span>PIN</span>
            <input
              type="password"
              inputMode="numeric"
              value={unlockPin}
              onChange={(e) => setUnlockPin(e.target.value)}
              autoComplete="one-time-code"
            />
          </label>
          {message ? (
            <div className="cx-alert cx-alert--error" role="alert">
              {message}
            </div>
          ) : null}
          <button type="button" className="cx-btn cx-btn--primary" onClick={() => void unlock()}>
            Unlock
          </button>
        </section>
      </PlatformShell>
    );
  }

  return (
    <PlatformShell
      title="PIN & lock"
      subtitle="PIN, biometrics preference, auto-lock, and address warnings."
      reassure="These controls protect this device. Recovery phrase status lives in Backup."
      backHref="/settings/security"
      backLabel="Security Center"
      actions={
        <Link href="/settings/security" className="cx-btn cx-btn--ghost">
          Security Center
        </Link>
      }
    >
      {message ? (
        <div className="cx-alert cx-alert--info" role="status">
          {message}
        </div>
      ) : null}

      <section className="cx-panel">
        <h2>Session & lock</h2>
        <div className="cx-row">
          <div>
            <strong>Auto-lock</strong>
            <p className="cx-meta">Lock after idle minutes</p>
          </div>
          <label className="cx-field" style={{ maxWidth: 96 }}>
            <span className="cx-sr-only">Auto lock minutes</span>
            <input
              type="number"
              min={1}
              max={60}
              value={prefs.autoLockMinutes}
              onChange={(e) => patch({ autoLockMinutes: Number(e.target.value) || 1 })}
            />
          </label>
        </div>
        <div className="cx-row">
          <div>
            <strong>Session timeout</strong>
            <p className="cx-meta">Require unlock after extended absence</p>
          </div>
          <label className="cx-field" style={{ maxWidth: 96 }}>
            <span className="cx-sr-only">Session timeout minutes</span>
            <input
              type="number"
              min={5}
              max={240}
              value={prefs.sessionTimeoutMinutes}
              onChange={(e) => patch({ sessionTimeoutMinutes: Number(e.target.value) || 5 })}
            />
          </label>
        </div>
        <button type="button" className="cx-btn cx-btn--ghost" onClick={() => setLocked(true)}>
          Lock now
        </button>
      </section>

      <section className="cx-panel">
        <h2>PIN</h2>
        {prefs.pinEnabled ? (
          <>
            <div className="cx-alert cx-alert--info">
              <strong>PIN is enabled</strong>
              <p>Stored as a hash on this device — never as plaintext.</p>
            </div>
            <button type="button" className="cx-btn cx-btn--ghost" onClick={disablePin}>
              Disable PIN
            </button>
          </>
        ) : (
          <>
            <label className="cx-field">
              <span>New PIN</span>
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            <label className="cx-field">
              <span>Confirm PIN</span>
              <input
                type="password"
                inputMode="numeric"
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            <button
              type="button"
              className="cx-btn cx-btn--primary"
              onClick={() => void enablePin()}
            >
              Enable PIN
            </button>
          </>
        )}
      </section>

      <section className="cx-panel">
        <h2>Biometrics</h2>
        <div className="cx-row">
          <div>
            <strong>Prefer device biometrics</strong>
            <p className="cx-meta">
              Saves a preference for Face ID / fingerprint unlock when WebAuthn ships. This toggle
              does not enable biometrics yet.
            </p>
          </div>
          <button
            type="button"
            className={`cx-chip${prefs.biometricEnabled ? ' is-on' : ''}`}
            aria-pressed={prefs.biometricEnabled}
            onClick={() => patch({ biometricEnabled: !prefs.biometricEnabled })}
          >
            {prefs.biometricEnabled ? 'Preferred' : 'Not set'}
          </button>
        </div>
      </section>

      <section className="cx-panel">
        <h2>Require authentication for</h2>
        <div className="cx-row">
          <div>
            <strong>Sending funds</strong>
            <p className="cx-meta">Ask for confirmation before transfers and approvals.</p>
          </div>
          <input
            type="checkbox"
            checked={prefs.requireAuthForSend}
            onChange={(e) => patch({ requireAuthForSend: e.target.checked })}
            aria-label="Require authentication before sending funds"
          />
        </div>
        <div className="cx-row">
          <div>
            <strong>Changing settings</strong>
            <p className="cx-meta">Protect sensitive security settings from casual access.</p>
          </div>
          <span className="cx-badge cx-badge--confirmed">Always required</span>
        </div>
        <div className="cx-row">
          <div>
            <strong>Viewing the recovery phrase</strong>
            <p className="cx-meta">Always re-authenticate before revealing recovery material.</p>
          </div>
          <span className="cx-badge cx-badge--confirmed">Always required</span>
        </div>
      </section>

      <section className="cx-panel">
        <h2>Warnings</h2>
        <div className="cx-row">
          <div>
            <strong>Backup reminders</strong>
            <p className="cx-meta">Nudge for recovery rehearsal</p>
          </div>
          <button
            type="button"
            className={`cx-chip${prefs.backupReminderEnabled ? ' is-on' : ''}`}
            aria-pressed={prefs.backupReminderEnabled}
            onClick={() =>
              patch({
                backupReminderEnabled: !prefs.backupReminderEnabled,
                lastBackupReminderAt: !prefs.backupReminderEnabled
                  ? new Date().toISOString()
                  : prefs.lastBackupReminderAt,
              })
            }
          >
            {prefs.backupReminderEnabled ? 'On' : 'Off'}
          </button>
        </div>
        <div className="cx-row">
          <div>
            <strong>Suspicious address warnings</strong>
            <p className="cx-meta">Surface risk checks on Send</p>
          </div>
          <button
            type="button"
            className={`cx-chip${prefs.suspiciousAddressWarnings ? ' is-on' : ''}`}
            aria-pressed={prefs.suspiciousAddressWarnings}
            onClick={() => patch({ suspiciousAddressWarnings: !prefs.suspiciousAddressWarnings })}
          >
            {prefs.suspiciousAddressWarnings ? 'On' : 'Off'}
          </button>
        </div>
        {prefs.backupReminderEnabled ? (
          <div className="cx-warn">
            <strong>Backup reminder</strong>
            <p>
              Complete a <Link href="/wallets/recovery">recovery rehearsal</Link> if you have not
              verified an offline backup recently.
            </p>
          </div>
        ) : null}
      </section>
    </PlatformShell>
  );
}
