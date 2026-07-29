'use client';

import { Alert, Button, Switch } from '@auvora/ui';
import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import {
  getNotifPrefs,
  setNotifPrefs,
  type NotificationPrefsLocal,
} from '../../lib/settings/prefs';
import { useTimedToast } from '../../lib/settings/use-timed-toast';
import { SettingsSectionNav } from './SettingsSectionNav';
import '../../app/settings-experience.css';

const LABELS: { key: keyof NotificationPrefsLocal; title: string; detail: string }[] = [
  { key: 'transactions', title: 'Transactions', detail: 'Sends, receives, and confirmations' },
  { key: 'priceAlerts', title: 'Price alerts', detail: 'Watchlist and threshold moves' },
  {
    key: 'securityAlerts',
    title: 'Security alerts',
    detail: 'New devices, sessions, phishing cues',
  },
  {
    key: 'marketing',
    title: 'Marketing (placeholder)',
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
    <div className="sc">
      <header className="sc__header">
        <div>
          <p className="sc__eyebrow">
            <Link href="/settings">Security Center</Link>
          </p>
          <h1>Notification preferences</h1>
          <p className="sc__sub">
            Centralize alerts for transactions, prices, security, product, and Web3.
          </p>
        </div>
        <Link href="/notifications/preferences">
          <Button type="button" variant="secondary">
            Server preferences
          </Button>
        </Link>
      </header>
      <SettingsSectionNav current="/settings/notifications" />
      {toast ? (
        <Alert tone="success" title="Saved">
          {toast}
        </Alert>
      ) : null}

      <section className="sc-panel">
        {LABELS.map((row) => (
          <div className="sc-row" key={row.key}>
            <div>
              <strong>{row.title}</strong>
              <p className="sc-meta">{row.detail}</p>
            </div>
            <Switch
              checked={prefs[row.key]}
              onCheckedChange={(v) => patch(row.key, v)}
              aria-label={row.title}
            />
          </div>
        ))}
      </section>
    </div>
  );
}
