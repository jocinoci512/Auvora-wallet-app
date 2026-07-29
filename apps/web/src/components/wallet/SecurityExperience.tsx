'use client';

import { Alert, Button, Switch } from '@auvora/ui';
import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import {
  getSecurityPrefs,
  hashPin,
  setSecurityPrefs,
  verifyPin,
} from '../../lib/wallet-experience/security-prefs';
import type { SecurityPrefs } from '../../lib/wallet-experience/types';
import '../../app/wallet-experience.css';

export function SecurityExperience(): ReactElement {
  const [prefs, setPrefs] = useState<SecurityPrefs>(() => getSecurityPrefs());
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [unlockPin, setUnlockPin] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const current = getSecurityPrefs();
    setPrefs(current);
    if (current.pinEnabled && current.lastUnlockedAt) {
      const elapsed = Date.now() - new Date(current.lastUnlockedAt).getTime();
      if (elapsed > current.autoLockMinutes * 60_000) setLocked(true);
    }
  }, []);

  function patch(next: Partial<SecurityPrefs>): void {
    const saved = setSecurityPrefs(next);
    setPrefs(saved);
  }

  async function enablePin(): Promise<void> {
    if (!/^\d{4,8}$/.test(pin)) {
      setMessage('PIN must be 4–8 digits');
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
    patch({ pinEnabled: false, pinHash: null });
    setMessage('PIN disabled');
    setLocked(false);
  }

  if (locked) {
    return (
      <div className="wx" role="main">
        <section className="wx-panel wx-panel--center">
          <h1>Session locked</h1>
          <p className="wx__sub">Enter your PIN to continue. Auto-lock protects idle sessions.</p>
          <label className="wx-field">
            <span>PIN</span>
            <input
              type="password"
              inputMode="numeric"
              value={unlockPin}
              onChange={(e) => setUnlockPin(e.target.value)}
              autoComplete="off"
            />
          </label>
          {message ? (
            <Alert tone="error" title="Unlock">
              {message}
            </Alert>
          ) : null}
          <Button type="button" onClick={() => void unlock()}>
            Unlock
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="wx" role="main">
      <header className="wx__header">
        <div>
          <p className="wx__eyebrow">
            <Link href="/settings/security">Security Center</Link>
            {' · '}
            <Link href="/wallets">Wallets</Link>
          </p>
          <h1>Security</h1>
          <p className="wx__sub">
            PIN, biometric placeholders, auto-lock, backup reminders, and risk warnings.
          </p>
        </div>
        <Link href="/settings/security">
          <Button type="button" variant="secondary">
            Open Security Center
          </Button>
        </Link>
      </header>

      {message ? (
        <Alert tone="info" title="Updated">
          {message}
        </Alert>
      ) : null}

      <section className="wx-panel">
        <h2>Session & lock</h2>
        <div className="wx-setting-row">
          <div>
            <strong>Auto-lock</strong>
            <p className="wx-meta">Lock after idle minutes</p>
          </div>
          <label className="wx-field wx-field--narrow">
            <span className="wx-sr-only">Auto lock minutes</span>
            <input
              type="number"
              min={1}
              max={60}
              value={prefs.autoLockMinutes}
              onChange={(e) => patch({ autoLockMinutes: Number(e.target.value) || 1 })}
            />
          </label>
        </div>
        <div className="wx-setting-row">
          <div>
            <strong>Session timeout</strong>
            <p className="wx-meta">Require unlock after extended absence</p>
          </div>
          <label className="wx-field wx-field--narrow">
            <span className="wx-sr-only">Session timeout minutes</span>
            <input
              type="number"
              min={5}
              max={240}
              value={prefs.sessionTimeoutMinutes}
              onChange={(e) => patch({ sessionTimeoutMinutes: Number(e.target.value) || 5 })}
            />
          </label>
        </div>
        <Button type="button" variant="secondary" onClick={() => setLocked(true)}>
          Lock now
        </Button>
      </section>

      <section className="wx-panel">
        <h2>PIN management</h2>
        {prefs.pinEnabled ? (
          <>
            <Alert tone="success" title="PIN is enabled">
              Stored as a salted SHA-256 hash in local storage for this preview — never plaintext.
            </Alert>
            <Button type="button" variant="danger" onClick={disablePin}>
              Disable PIN
            </Button>
          </>
        ) : (
          <div className="wx-form-stack">
            <label className="wx-field">
              <span>New PIN</span>
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="wx-field">
              <span>Confirm PIN</span>
              <input
                type="password"
                inputMode="numeric"
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value)}
                autoComplete="off"
              />
            </label>
            <Button type="button" onClick={() => void enablePin()}>
              Enable PIN
            </Button>
          </div>
        )}
      </section>

      <section className="wx-panel">
        <h2>Biometrics (placeholder)</h2>
        <div className="wx-setting-row">
          <div>
            <strong>Use device biometrics</strong>
            <p className="wx-meta">
              Architecture stub for WebAuthn / platform authenticator — enable when hardware is
              available.
            </p>
          </div>
          <Switch
            checked={prefs.biometricEnabled}
            onCheckedChange={(v) => patch({ biometricEnabled: v })}
            aria-label="Toggle biometric unlock placeholder"
          />
        </div>
      </section>

      <section className="wx-panel">
        <h2>Backup & risk</h2>
        <div className="wx-setting-row">
          <div>
            <strong>Backup reminders</strong>
            <p className="wx-meta">Nudge for recovery rehearsal</p>
          </div>
          <Switch
            checked={prefs.backupReminderEnabled}
            onCheckedChange={(v) =>
              patch({
                backupReminderEnabled: v,
                lastBackupReminderAt: v ? new Date().toISOString() : prefs.lastBackupReminderAt,
              })
            }
            aria-label="Toggle backup reminders"
          />
        </div>
        <div className="wx-setting-row">
          <div>
            <strong>Suspicious address warnings</strong>
            <p className="wx-meta">Surface risk heuristics on Send</p>
          </div>
          <Switch
            checked={prefs.suspiciousAddressWarnings}
            onCheckedChange={(v) => patch({ suspiciousAddressWarnings: v })}
            aria-label="Toggle suspicious address warnings"
          />
        </div>
        {prefs.backupReminderEnabled ? (
          <Alert tone="warn" title="Backup reminder">
            Complete a <Link href="/wallets/recovery">recovery rehearsal</Link> if you have not
            verified an offline backup recently.
          </Alert>
        ) : null}
      </section>
    </div>
  );
}
