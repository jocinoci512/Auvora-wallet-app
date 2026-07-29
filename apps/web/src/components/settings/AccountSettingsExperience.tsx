'use client';

import { Alert, Button } from '@auvora/ui';
import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import { settingsFetch } from '../../lib/settings/api';
import { OFFLINE_CACHE_NS, withOfflineCache } from '../../lib/offline/cache';
import { getAccountPrefs, setAccountPrefs, type AccountPrefs } from '../../lib/settings/prefs';
import { useTimedToast } from '../../lib/settings/use-timed-toast';
import { SettingsSectionNav } from './SettingsSectionNav';
import '../../app/settings-experience.css';

type MeProfile = {
  firstName?: string | null;
  lastName?: string | null;
  preferredLanguage?: string;
  timeZone?: string;
  country?: string | null;
};

export function AccountSettingsExperience(): ReactElement {
  const [prefs, setPrefs] = useState<AccountPrefs>(() => getAccountPrefs());
  const { toast, showToast } = useTimedToast();
  const [live, setLive] = useState(false);

  useEffect(() => {
    setPrefs(getAccountPrefs());
    let cancelled = false;
    void (async () => {
      try {
        const result = await withOfflineCache(
          OFFLINE_CACHE_NS.me,
          'profile',
          () => settingsFetch<MeProfile>('/api/v1/me'),
          1000 * 60 * 60,
        );
        if (cancelled || !result.data) return;
        const me = result.data;
        if (!result.fromCache) setLive(true);
        else setLive(false);
        const name = [me.firstName, me.lastName].filter(Boolean).join(' ').trim();
        setPrefs(
          setAccountPrefs({
            displayName: name || getAccountPrefs().displayName,
            language: me.preferredLanguage ?? getAccountPrefs().language,
            timeZone: me.timeZone ?? getAccountPrefs().timeZone,
            region: me.country ?? getAccountPrefs().region,
          }),
        );
      } catch {
        /* demo prefs */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function patch(next: Partial<AccountPrefs>): void {
    const saved = setAccountPrefs(next);
    setPrefs(saved);
    showToast('Account preferences saved');
    if (live) {
      const parts = saved.displayName.trim().split(/\s+/);
      const firstName = parts[0] || undefined;
      const lastName = parts.length > 1 ? parts.slice(1).join(' ') : undefined;
      void settingsFetch('/api/v1/me', {
        method: 'PATCH',
        body: JSON.stringify({
          firstName,
          lastName,
          preferredLanguage: saved.language,
          timeZone: saved.timeZone,
          country: saved.region.slice(0, 8),
        }),
      }).catch(() => undefined);
    }
  }

  return (
    <div className="sc">
      <header className="sc__header">
        <div>
          <p className="sc__eyebrow">
            <Link href="/settings">Security Center</Link>
          </p>
          <h1>Account</h1>
          <p className="sc__sub">
            Profile, wallet nicknames, locale, currency, and appearance defaults.
          </p>
        </div>
      </header>
      <SettingsSectionNav current="/settings/account" />
      {toast ? (
        <Alert tone="success" title="Saved">
          {toast}
        </Alert>
      ) : null}

      <section className="sc-panel">
        <h2>Profile</h2>
        <div className="sc-toolbar">
          <label className="sc-field">
            <span>Display name</span>
            <input
              value={prefs.displayName}
              onChange={(e) => setPrefs({ ...prefs, displayName: e.target.value })}
              onBlur={() => patch({ displayName: prefs.displayName })}
              aria-label="Display name"
            />
          </label>
          <label className="sc-field">
            <span>Wallet nickname</span>
            <input
              value={prefs.walletNickname}
              onChange={(e) => setPrefs({ ...prefs, walletNickname: e.target.value })}
              onBlur={() => patch({ walletNickname: prefs.walletNickname })}
              aria-label="Wallet nickname"
            />
          </label>
          <label className="sc-field">
            <span>Default wallet</span>
            <select
              value={prefs.defaultWalletId}
              onChange={(e) => patch({ defaultWalletId: e.target.value })}
              aria-label="Default wallet"
            >
              <option value="wallet-primary">Primary</option>
              <option value="wallet-hardware">Hardware</option>
              <option value="wallet-watch">Watch-only</option>
            </select>
          </label>
        </div>
      </section>

      <section className="sc-panel">
        <h2>Locale & currency</h2>
        <div className="sc-toolbar">
          <label className="sc-field">
            <span>Language</span>
            <select
              value={prefs.language}
              onChange={(e) => patch({ language: e.target.value })}
              aria-label="Language"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
            </select>
          </label>
          <label className="sc-field">
            <span>Region</span>
            <select
              value={prefs.region}
              onChange={(e) => patch({ region: e.target.value })}
              aria-label="Region"
            >
              <option value="US">United States</option>
              <option value="EU">Europe</option>
              <option value="GB">United Kingdom</option>
              <option value="SG">Singapore</option>
            </select>
          </label>
          <label className="sc-field">
            <span>Currency</span>
            <select
              value={prefs.currency}
              onChange={(e) => patch({ currency: e.target.value })}
              aria-label="Currency"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </label>
          <label className="sc-field">
            <span>Time zone</span>
            <input
              value={prefs.timeZone}
              onChange={(e) => setPrefs({ ...prefs, timeZone: e.target.value })}
              onBlur={() => patch({ timeZone: prefs.timeZone })}
              aria-label="Time zone"
            />
          </label>
        </div>
      </section>

      <section className="sc-panel">
        <h2>Theme & appearance</h2>
        <p className="sc-meta">
          Theme is controlled from the navigation Theme toggle (system / light / dark). Open
          preferences for accessibility options.
        </p>
        <div className="sc-actions">
          <Link href="/settings/preferences">
            <Button type="button">Open preferences</Button>
          </Link>
          <Link href="/settings/notifications">
            <Button type="button" variant="secondary">
              Notification preferences
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
