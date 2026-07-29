'use client';

import { Alert, Button, StatusBadge, Switch } from '@auvora/ui';
import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import { getSecurityPrefs, setSecurityPrefs } from '../../lib/wallet-experience/security-prefs';
import { getBackupPrefs, setBackupPrefs, type BackupPrefs } from '../../lib/settings/prefs';
import { useTimedToast } from '../../lib/settings/use-timed-toast';
import { SettingsSectionNav } from './SettingsSectionNav';
import '../../app/settings-experience.css';

export function BackupRecoverySettingsExperience(): ReactElement {
  const [prefs, setPrefs] = useState<BackupPrefs>(() => getBackupPrefs());
  const { toast, showToast } = useTimedToast(1600);

  const [reminderOn, setReminderOn] = useState(true);

  useEffect(() => {
    const b = getBackupPrefs();
    setPrefs(b);
    setReminderOn(b.reminderEnabled || getSecurityPrefs().backupReminderEnabled);
  }, []);

  function patch(next: Partial<BackupPrefs>): void {
    const saved = setBackupPrefs(next);
    setPrefs(saved);
    if (typeof next.reminderEnabled === 'boolean') {
      setReminderOn(next.reminderEnabled);
      setSecurityPrefs({ backupReminderEnabled: next.reminderEnabled });
    }
    showToast('Backup preference saved');
  }

  function markVerified(): void {
    patch({ phraseVerified: true, lastVerifiedAt: new Date().toISOString() });
  }

  return (
    <div className="sc">
      <header className="sc__header">
        <div>
          <p className="sc__eyebrow">
            <Link href="/settings">Security Center</Link>
          </p>
          <h1>Backup & recovery</h1>
          <p className="sc__sub">
            Recovery phrase status, reminders, verification, education, and guided recovery.
          </p>
        </div>
        <Link href="/wallets/recovery">
          <Button type="button">Open recovery rehearsal</Button>
        </Link>
      </header>
      <SettingsSectionNav current="/settings/backup" />
      {toast ? (
        <Alert tone="success" title="Saved">
          {toast}
        </Alert>
      ) : null}

      <section className="sc-panel">
        <h2>Recovery phrase status</h2>
        <div className="sc-row">
          <div>
            <strong>Verification</strong>
            <p className="sc-meta">
              {prefs.phraseVerified
                ? `Verified ${prefs.lastVerifiedAt ? new Date(prefs.lastVerifiedAt).toLocaleString() : ''}`
                : 'Not verified — complete recovery rehearsal'}
            </p>
          </div>
          <StatusBadge
            status={prefs.phraseVerified ? 'active' : 'pending'}
            label={prefs.phraseVerified ? 'Verified' : 'Action needed'}
          />
        </div>
        <div className="sc-row">
          <div>
            <strong>Backup reminders</strong>
            <p className="sc-meta">Periodic nudges until verification is complete.</p>
          </div>
          <Switch
            checked={reminderOn}
            onCheckedChange={(v) => patch({ reminderEnabled: v })}
            aria-label="Backup reminders"
          />
        </div>
        <div className="sc-actions">
          <Button type="button" onClick={markVerified} disabled={prefs.phraseVerified}>
            Mark verified (local)
          </Button>
          <Link href="/wallets/recovery">
            <Button type="button" variant="secondary">
              Practice recovery
            </Button>
          </Link>
        </div>
      </section>

      <section className="sc-panel">
        <h2>Education</h2>
        <Alert tone="info" title="Never share your phrase">
          Auvora never asks for your recovery phrase in chat, email, or dApp popups. Store offline
          copies in separate locations. Hardware wallets keep keys offline.
        </Alert>
        <Alert tone="warn" title="Recovery guidance" style={{ marginTop: '0.75rem' }}>
          If you lose device access, use Import / Restore with your phrase. Verify spelling and word
          order carefully — incorrect phrases unlock empty wallets.
        </Alert>
      </section>
    </div>
  );
}
