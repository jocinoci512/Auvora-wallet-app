'use client';

import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import { getCachedUser, loadMe, type AuthUser } from '../../lib/auth/session';
import { settingsFetch } from '../../lib/settings/api';
import { OFFLINE_CACHE_NS, withOfflineCache } from '../../lib/offline/cache';
import { getAccountPrefs, setAccountPrefs, type AccountPrefs } from '../../lib/settings/prefs';
import { useTimedToast } from '../../lib/settings/use-timed-toast';
import { PlatformShell } from '../platform/PlatformShell';
import { SettingsSectionNav } from './SettingsSectionNav';
import { FeedbackToast } from '../status/FeedbackToast';

type MeProfile = {
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  emailVerified?: boolean;
  createdAt?: string;
  preferredLanguage?: string;
  timeZone?: string;
  country?: string | null;
};

export function AccountSettingsExperience(): ReactElement {
  const [prefs, setPrefs] = useState<AccountPrefs>(() => getAccountPrefs());
  const { toast, tone, showToast } = useTimedToast();
  const [live, setLive] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  useEffect(() => {
    setPrefs(getAccountPrefs());
    setUser(getCachedUser());
    let cancelled = false;
    void (async () => {
      const meAuth = await loadMe().catch(() => null);
      if (!cancelled && meAuth) setUser(meAuth);
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
        if (me.createdAt) setCreatedAt(me.createdAt);
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
        /* local prefs */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function patch(next: Partial<AccountPrefs>): void {
    const saved = setAccountPrefs(next);
    setPrefs(saved);
    showToast('Account preferences saved', { tone: 'success' });
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
    <PlatformShell
      title="Account"
      subtitle="Auvora Account identity — not your wallet keys."
      reassure="Signing in never sends private keys or a recovery phrase to Auvora."
      backHref="/settings"
      backLabel="Settings"
      nav={<SettingsSectionNav current="/settings/account" />}
    >
      {toast ? <FeedbackToast message={toast} tone={tone} /> : null}

      <section className="cx-panel">
        <h2>Profile</h2>
        <ul className="cx-list">
          <li>
            <div>
              <strong>Email</strong>
              <p className="cx-meta">
                {user?.email ?? 'Sign in to see the email on this account.'}
              </p>
            </div>
          </li>
          <li>
            <div>
              <strong>Verification</strong>
              <p className="cx-meta">
                {user
                  ? user.emailVerified
                    ? 'Email verified'
                    : 'Email not verified yet'
                  : 'Unknown until you sign in'}
              </p>
            </div>
          </li>
          {createdAt ? (
            <li>
              <div>
                <strong>Created</strong>
                <p className="cx-meta">{new Date(createdAt).toLocaleDateString()}</p>
              </div>
            </li>
          ) : null}
          <li>
            <div>
              <strong>This device</strong>
              <p className="cx-meta">Web companion · this browser</p>
            </div>
          </li>
        </ul>
        {!user ? (
          <div className="cx-platform__actions">
            <Link href="/auth/login" className="cx-btn cx-btn--primary">
              Sign in
            </Link>
          </div>
        ) : null}
      </section>

      <section className="cx-panel">
        <h2>Display name</h2>
        <div className="cx-toolbar">
          <label className="cx-field">
            <span>Display name</span>
            <input
              value={prefs.displayName}
              onChange={(e) => setPrefs({ ...prefs, displayName: e.target.value })}
              onBlur={() => patch({ displayName: prefs.displayName })}
              aria-label="Display name"
            />
          </label>
          <label className="cx-field">
            <span>Wallet nickname (this device)</span>
            <input
              value={prefs.walletNickname}
              onChange={(e) => setPrefs({ ...prefs, walletNickname: e.target.value })}
              onBlur={() => patch({ walletNickname: prefs.walletNickname })}
              aria-label="Wallet nickname"
            />
          </label>
        </div>
      </section>

      <section className="cx-panel">
        <h2>Related</h2>
        <p className="cx-meta">
          Theme and currency live in Preferences. Sessions live in Security.
        </p>
        <div className="cx-platform__actions">
          <Link href="/settings/preferences">
            <Button type="button">Preferences</Button>
          </Link>
          <Link href="/settings/security">
            <Button type="button" variant="secondary">
              Security
            </Button>
          </Link>
        </div>
      </section>
    </PlatformShell>
  );
}
