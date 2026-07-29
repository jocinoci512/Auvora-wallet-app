'use client';

import { Alert, Button, Switch } from '@auvora/ui';
import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import { applyLocaleDocumentPrefs } from '../../lib/i18n/locale-document';
import { getAccountPrefs, setAccountPrefs, type AccountPrefs } from '../../lib/settings/prefs';
import { useTimedToast } from '../../lib/settings/use-timed-toast';
import { SettingsSectionNav } from './SettingsSectionNav';
import '../../app/settings-experience.css';

export function PreferencesExperience(): ReactElement {
  const [prefs, setPrefs] = useState<AccountPrefs>(() => getAccountPrefs());
  const { toast, showToast } = useTimedToast(1600);

  useEffect(() => {
    setPrefs(getAccountPrefs());
  }, []);

  function patch(next: Partial<AccountPrefs>): void {
    const saved = setAccountPrefs(next);
    setPrefs(saved);
    showToast('Preferences saved');
    applyLocaleDocumentPrefs();
  }

  return (
    <div className="sc">
      <header className="sc__header">
        <div>
          <p className="sc__eyebrow">
            <Link href="/settings">Security Center</Link>
          </p>
          <h1>Preferences</h1>
          <p className="sc__sub">
            Theme, language, currency, default network, fiat display, date/time formats,
            accessibility.
          </p>
        </div>
      </header>
      <SettingsSectionNav current="/settings/preferences" />
      {toast ? (
        <Alert tone="success" title="Saved">
          {toast}
        </Alert>
      ) : null}

      <section className="sc-panel">
        <h2>Display</h2>
        <div className="sc-toolbar">
          <label className="sc-field">
            <span>Default network</span>
            <select
              value={prefs.defaultNetwork}
              onChange={(e) => patch({ defaultNetwork: e.target.value })}
              aria-label="Default network"
            >
              <option value="ETHEREUM">Ethereum</option>
              <option value="POLYGON">Polygon</option>
              <option value="SOLANA">Solana</option>
              <option value="BITCOIN">Bitcoin</option>
            </select>
          </label>
          <label className="sc-field">
            <span>Date format</span>
            <select
              value={prefs.dateFormat}
              onChange={(e) => patch({ dateFormat: e.target.value as AccountPrefs['dateFormat'] })}
              aria-label="Date format"
            >
              <option value="MDY">MM/DD/YYYY</option>
              <option value="DMY">DD/MM/YYYY</option>
              <option value="YMD">YYYY-MM-DD</option>
            </select>
          </label>
          <label className="sc-field">
            <span>Time format</span>
            <select
              value={prefs.timeFormat}
              onChange={(e) => patch({ timeFormat: e.target.value as AccountPrefs['timeFormat'] })}
              aria-label="Time format"
            >
              <option value="12h">12-hour</option>
              <option value="24h">24-hour</option>
            </select>
          </label>
        </div>
        <div className="sc-row">
          <div>
            <strong>Fiat display</strong>
            <p className="sc-meta">Show currency ({prefs.currency}) alongside crypto balances.</p>
          </div>
          <Switch
            checked={prefs.fiatDisplay}
            onCheckedChange={(v) => patch({ fiatDisplay: v })}
            aria-label="Fiat display"
          />
        </div>
        <p className="sc-meta">
          Theme & language live under Account · use the nav Theme toggle for light / dark / system.
        </p>
        <Link href="/settings/account">
          <Button type="button" variant="secondary">
            Account locale
          </Button>
        </Link>
      </section>

      <section className="sc-panel">
        <h2>Accessibility</h2>
        <div className="sc-row">
          <div>
            <strong>Reduce motion</strong>
            <p className="sc-meta">Prefer reduced animations across settings shells.</p>
          </div>
          <Switch
            checked={prefs.reduceMotion}
            onCheckedChange={(v) => patch({ reduceMotion: v })}
            aria-label="Reduce motion"
          />
        </div>
        <div className="sc-row">
          <div>
            <strong>High contrast</strong>
            <p className="sc-meta">Placeholder flag for future contrast theme mode.</p>
          </div>
          <Switch
            checked={prefs.highContrast}
            onCheckedChange={(v) => patch({ highContrast: v })}
            aria-label="High contrast"
          />
        </div>
      </section>
    </div>
  );
}
