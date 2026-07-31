'use client';

import { Alert, Switch } from '@auvora/ui';
import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import {
  getNotifPrefs,
  setNotifPrefs,
  type NotificationPrefsLocal,
} from '../../lib/settings/prefs';
import { useTimedToast } from '../../lib/settings/use-timed-toast';
import { PlatformShell } from '../platform/PlatformShell';
import { SettingsSectionNav } from './SettingsSectionNav';

const LABELS: {
  key: keyof NotificationPrefsLocal;
  title: string;
  detail: string;
}[] = [
  {
    key: 'incomingTransactions',
    title: 'Incoming transactions',
    detail: 'Know when funds or assets arrive in this wallet',
  },
  {
    key: 'outgoingTransactions',
    title: 'Outgoing transactions',
    detail: 'Confirm when you send from this device',
  },
  {
    key: 'pendingConfirmations',
    title: 'Pending confirmations',
    detail: 'Stay aware while a transfer is still confirming on-chain',
  },
  {
    key: 'transactionConfirmations',
    title: 'Completed confirmations',
    detail: 'Hear when a pending transfer finishes confirming',
  },
  {
    key: 'failedTransactions',
    title: 'Failed transactions',
    detail: 'Know when a send or dApp request fails so you can retry safely',
  },
  {
    key: 'priceAlerts',
    title: 'Price alerts',
    detail: 'Custom targets you create for assets or portfolio moves',
  },
  {
    key: 'largeBalanceChanges',
    title: 'Large balance changes',
    detail: 'Notable swings so unexpected movement is visible',
  },
  {
    key: 'securityAlerts',
    title: 'Security alerts',
    detail: 'Devices, sessions, and protection events that need attention',
  },
  {
    key: 'walletConnections',
    title: 'Wallet connections',
    detail: 'New dApp connections and permission changes',
  },
  {
    key: 'softwareUpdates',
    title: 'Software updates',
    detail: 'App releases and important product notes — not marketing spam',
  },
  {
    key: 'networkOutages',
    title: 'Network outages',
    detail: 'When a network you use looks degraded (preview health)',
  },
];

export function NotificationSettingsExperience(): ReactElement {
  const [prefs, setPrefs] = useState<NotificationPrefsLocal>(() => getNotifPrefs());
  const { toast, showToast } = useTimedToast(1600);

  useEffect(() => {
    setPrefs(getNotifPrefs());
  }, []);

  function patch(key: keyof NotificationPrefsLocal, value: boolean): void {
    const saved = setNotifPrefs({ [key]: value });
    setPrefs(saved);
    showToast('Notification preference saved');
  }

  return (
    <PlatformShell
      title="Notification preferences"
      subtitle="Every toggle has a purpose — silence anything that does not help you act."
      reassure="Local toggles on this device. Preview inbox only — not push delivery."
      backHref="/settings"
      backLabel="Settings"
      nav={<SettingsSectionNav current="/settings/notifications" />}
      actions={
        <>
          <Link href="/settings/alerts" className="cx-btn cx-btn--primary">
            Price alerts
          </Link>
          <Link href="/notifications" className="cx-btn cx-btn--ghost">
            Notification center
          </Link>
        </>
      }
    >
      {toast ? (
        <Alert tone="success" title="Saved">
          {toast}
        </Alert>
      ) : null}

      <section className="cx-panel">
        <h2>Categories</h2>
        <ul className="cx-list">
          {LABELS.map((row) => (
            <li key={row.key}>
              <div>
                <strong>{row.title}</strong>
                <p className="cx-meta">{row.detail}</p>
              </div>
              <Switch
                checked={Boolean(prefs[row.key])}
                onCheckedChange={(v) => patch(row.key, v)}
                aria-label={row.title}
              />
            </li>
          ))}
        </ul>
      </section>
    </PlatformShell>
  );
}
