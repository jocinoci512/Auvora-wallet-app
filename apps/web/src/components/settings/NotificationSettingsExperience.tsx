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

const LABELS: { key: keyof NotificationPrefsLocal; title: string; detail: string }[] = [
  { key: 'transactions', title: 'Transactions', detail: 'Sends, receives, and confirmations' },
  {
    key: 'largeTransfers',
    title: 'Large transfers',
    detail: 'Notable incoming or outgoing amounts',
  },
  { key: 'priceAlerts', title: 'Price alerts', detail: 'Watchlist and threshold moves' },
  {
    key: 'securityAlerts',
    title: 'Security alerts',
    detail: 'New devices, sessions, phishing cues, unusual approvals',
  },
  {
    key: 'stakingRewards',
    title: 'Staking rewards',
    detail: 'Reward credits and staking status updates',
  },
  {
    key: 'highNetworkFees',
    title: 'High network fees',
    detail: 'When gas is elevated vs your usual window',
  },
  {
    key: 'insightAlerts',
    title: 'Portfolio insights',
    detail: 'Concentration, idle assets, milestones — educational tips',
  },
  {
    key: 'portfolioHealth',
    title: 'Portfolio health',
    detail: 'Recommendations that improve your health score',
  },
  {
    key: 'marketing',
    title: 'Marketing',
    detail: 'Optional campaigns — off by default',
  },
  { key: 'productUpdates', title: 'Product updates', detail: 'Release notes and feature launches' },
  {
    key: 'web3Activity',
    title: 'Web3 activity',
    detail: 'Connections, signatures, permission changes',
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
      subtitle="Transactions, smart alerts, insights, security, staking, product, and Web3 — you control each."
      reassure="Local toggles apply immediately on this device; server prefs sync when signed in."
      backHref="/settings"
      backLabel="Settings"
      nav={<SettingsSectionNav current="/settings/notifications" />}
      actions={
        <>
          <Link href="/notifications" className="cx-btn cx-btn--ghost">
            Notification center
          </Link>
          <Link href="/notifications/preferences" className="cx-btn cx-btn--primary">
            Server preferences
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
        {LABELS.map((row) => (
          <div className="cx-row" key={row.key}>
            <div>
              <strong>{row.title}</strong>
              <p className="cx-meta">{row.detail}</p>
            </div>
            <Switch
              checked={prefs[row.key]}
              onCheckedChange={(v) => patch(row.key, v)}
              aria-label={row.title}
            />
          </div>
        ))}
      </section>
    </PlatformShell>
  );
}
