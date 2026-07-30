'use client';

import { StatusBadge, Switch } from '@auvora/ui';
import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import { getSecurityPrefs, setSecurityPrefs } from '../../lib/wallet-experience/security-prefs';
import { getBackupPrefs, setBackupPrefs, type BackupPrefs } from '../../lib/settings/prefs';
import { useTimedToast } from '../../lib/settings/use-timed-toast';
import { PlatformShell } from '../platform/PlatformShell';
import { SettingsSectionNav } from './SettingsSectionNav';

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

  return (
    <PlatformShell
      title="Backup & recovery"
      subtitle="See whether your recovery phrase is verified, and practice recovery safely."
      reassure="Your phrase never leaves this device. Practice recovery before you need it."
      backHref="/settings"
      backLabel="Settings"
      nav={<SettingsSectionNav current="/settings/backup" />}
      actions={
        <Link href="/wallets/recovery" className="cx-btn cx-btn--primary">
          Practice recovery
        </Link>
      }
    >
      {toast ? (
        <div className="cx-alert cx-alert--info" role="status">
          {toast}
        </div>
      ) : null}

      <section className="cx-panel">
        <h2>Recovery phrase status</h2>
        <div className="cx-row">
          <div>
            <strong>Verification</strong>
            <p className="cx-meta">
              {prefs.phraseVerified
                ? `Verified ${prefs.lastVerifiedAt ? new Date(prefs.lastVerifiedAt).toLocaleString() : ''}`
                : 'Not verified — complete recovery rehearsal to raise your security score'}
            </p>
          </div>
          <StatusBadge
            status={prefs.phraseVerified ? 'active' : 'pending'}
            label={prefs.phraseVerified ? 'Verified' : 'Action needed'}
          />
        </div>
        <div className="cx-row">
          <div>
            <strong>Backup reminders</strong>
            <p className="cx-meta">Periodic nudges until verification is complete.</p>
          </div>
          <Switch
            checked={reminderOn}
            onCheckedChange={(v) => patch({ reminderEnabled: v })}
            aria-label="Backup reminders"
          />
        </div>
        <div className="cx-warn" style={{ marginTop: '0.75rem' }}>
          <strong>How verification works</strong>
          <p>
            Complete the recovery rehearsal. Verification is recorded only after you finish that
            guided flow — not from a one-tap shortcut.
          </p>
        </div>
        <div className="cx-platform__actions">
          <Link href="/wallets/recovery" className="cx-btn cx-btn--primary">
            {prefs.phraseVerified ? 'Practice again' : 'Start recovery rehearsal'}
          </Link>
        </div>
      </section>

      <section className="cx-panel">
        <h2>Stay safe</h2>
        <div className="cx-alert cx-alert--info">
          <strong>Never share your phrase</strong>
          <p>
            Auvora never asks for your recovery phrase in chat, email, or dApp popups. Keep offline
            copies in separate places. Hardware wallets keep keys offline.
          </p>
        </div>
        <div className="cx-warn" style={{ marginTop: '0.75rem' }}>
          <strong>If you lose this device</strong>
          <p>
            Use Import / Restore with your phrase. Check spelling and word order carefully —
            incorrect phrases unlock empty wallets.
          </p>
        </div>
      </section>
    </PlatformShell>
  );
}
