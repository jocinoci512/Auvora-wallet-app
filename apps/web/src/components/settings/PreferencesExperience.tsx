'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import { applyLocaleDocumentPrefs } from '../../lib/i18n/locale-document';
import { getAccountPrefs, setAccountPrefs, type AccountPrefs } from '../../lib/settings/prefs';
import { useTimedToast } from '../../lib/settings/use-timed-toast';
import { getUserPrefs, setUserPrefs, type ThemePref } from '../../lib/wallet-experience/user-prefs';
import { PlatformShell } from '../platform/PlatformShell';
import { SettingsSectionNav } from './SettingsSectionNav';

function applyTheme(theme: ThemePref): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme;
  root.setAttribute('data-theme', resolved);
  try {
    localStorage.setItem('auvora-theme', theme);
  } catch {
    /* ignore */
  }
}

export function PreferencesExperience(): ReactElement {
  const [prefs, setPrefs] = useState<AccountPrefs>(() => getAccountPrefs());
  const [theme, setTheme] = useState<ThemePref>('system');
  const [privacyMode, setPrivacyMode] = useState(false);
  const [compact, setCompact] = useState(false);
  const { toast, showToast } = useTimedToast(1600);

  useEffect(() => {
    setPrefs(getAccountPrefs());
    const u = getUserPrefs();
    setTheme(u.theme);
    setPrivacyMode(u.privacyMode);
    setCompact(u.portfolioCompact);
  }, []);

  function patch(next: Partial<AccountPrefs>): void {
    const saved = setAccountPrefs(next);
    setPrefs(saved);
    if (next.currency) setUserPrefs({ currency: next.currency as 'USD' | 'EUR' | 'GBP' | 'JPY' });
    if (next.language) setUserPrefs({ language: next.language });
    if (next.defaultNetwork) setUserPrefs({ defaultNetwork: next.defaultNetwork.toLowerCase() });
    showToast('Preferences saved');
    applyLocaleDocumentPrefs();
  }

  function patchTheme(next: ThemePref): void {
    setTheme(next);
    setUserPrefs({ theme: next });
    applyTheme(next);
    showToast('Theme updated');
  }

  return (
    <PlatformShell
      title="Appearance & personalization"
      subtitle="Theme, currency, network, balance display, and accessibility."
      reassure="Changes apply on this device and stay in sync with onboarding preferences."
      backHref="/settings"
      backLabel="Settings"
      nav={<SettingsSectionNav current="/settings/preferences" />}
    >
      {toast ? (
        <div className="cx-alert cx-alert--info" role="status">
          {toast}
        </div>
      ) : null}

      <section className="cx-panel" id="appearance">
        <h2>Theme</h2>
        <div className="cx-chips">
          {(['system', 'light', 'dark'] as ThemePref[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`cx-chip${theme === t ? ' is-on' : ''}`}
              onClick={() => patchTheme(t)}
            >
              {t[0]!.toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <p className="cx-meta">
          Theme follows system, or stays light / dark on this device. Transitions are smooth; custom
          accent colors are prepared for a later release (Lagoon remains the brand accent).
        </p>
      </section>

      <section className="cx-panel">
        <h2>Display</h2>
        <label className="cx-field">
          <span>Preferred currency</span>
          <select
            value={prefs.currency}
            onChange={(e) => patch({ currency: e.target.value })}
            aria-label="Currency"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="JPY">JPY</option>
          </select>
        </label>
        <label className="cx-field">
          <span>Language</span>
          <select
            value={prefs.language}
            onChange={(e) => patch({ language: e.target.value })}
            aria-label="Language"
          >
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
          </select>
        </label>
        <label className="cx-field">
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
        <label className="cx-field">
          <span>Date format</span>
          <select
            value={prefs.dateFormat}
            onChange={(e) => patch({ dateFormat: e.target.value as AccountPrefs['dateFormat'] })}
          >
            <option value="MDY">MM/DD/YYYY</option>
            <option value="DMY">DD/MM/YYYY</option>
            <option value="YMD">YYYY-MM-DD</option>
          </select>
        </label>
        <label className="cx-field">
          <span>Time format</span>
          <select
            value={prefs.timeFormat}
            onChange={(e) => patch({ timeFormat: e.target.value as AccountPrefs['timeFormat'] })}
          >
            <option value="12h">12-hour</option>
            <option value="24h">24-hour</option>
          </select>
        </label>
        <div className="cx-row">
          <div>
            <strong>Fiat display</strong>
            <p className="cx-meta">Show currency alongside crypto balances.</p>
          </div>
          <button
            type="button"
            className={`cx-chip${prefs.fiatDisplay ? ' is-on' : ''}`}
            onClick={() => patch({ fiatDisplay: !prefs.fiatDisplay })}
            aria-pressed={prefs.fiatDisplay}
          >
            {prefs.fiatDisplay ? 'On' : 'Off'}
          </button>
        </div>
        <div className="cx-row">
          <div>
            <strong>Hide balances</strong>
            <p className="cx-meta">Privacy mode for shared screens.</p>
          </div>
          <button
            type="button"
            className={`cx-chip${privacyMode ? ' is-on' : ''}`}
            onClick={() => {
              const next = !privacyMode;
              setPrivacyMode(next);
              setUserPrefs({ privacyMode: next });
              showToast('Display preference saved');
            }}
            aria-pressed={privacyMode}
          >
            {privacyMode ? 'Hidden' : 'Visible'}
          </button>
        </div>
        <div className="cx-row">
          <div>
            <strong>Compact portfolio</strong>
            <p className="cx-meta">Denser dashboard widgets when available.</p>
          </div>
          <button
            type="button"
            className={`cx-chip${compact ? ' is-on' : ''}`}
            onClick={() => {
              const next = !compact;
              setCompact(next);
              setUserPrefs({ portfolioCompact: next });
              showToast('Layout preference saved');
            }}
            aria-pressed={compact}
          >
            {compact ? 'Compact' : 'Comfortable'}
          </button>
        </div>
      </section>

      <section className="cx-panel" id="accessibility">
        <h2>Accessibility</h2>
        <label className="cx-field">
          <span>Text scale ({prefs.textScale?.toFixed?.(2) ?? '1.00'}×)</span>
          <input
            type="range"
            min={0.85}
            max={1.35}
            step={0.05}
            value={prefs.textScale ?? 1}
            onChange={(e) => {
              const textScale = Number(e.target.value);
              patch({ textScale });
              if (typeof document !== 'undefined') {
                document.documentElement.style.setProperty(
                  '--auvora-text-scale',
                  String(textScale),
                );
              }
            }}
            aria-label="Text scale"
          />
        </label>
        <div className="cx-row">
          <div>
            <strong>Reduce motion</strong>
            <p className="cx-meta">Prefer reduced animations across Auvora.</p>
          </div>
          <button
            type="button"
            className={`cx-chip${prefs.reduceMotion ? ' is-on' : ''}`}
            onClick={() => patch({ reduceMotion: !prefs.reduceMotion })}
            aria-pressed={prefs.reduceMotion}
          >
            {prefs.reduceMotion ? 'On' : 'Off'}
          </button>
        </div>
        <div className="cx-row">
          <div>
            <strong>High contrast</strong>
            <p className="cx-meta">Stronger borders and text contrast when enabled.</p>
          </div>
          <button
            type="button"
            className={`cx-chip${prefs.highContrast ? ' is-on' : ''}`}
            onClick={() => patch({ highContrast: !prefs.highContrast })}
            aria-pressed={prefs.highContrast}
          >
            {prefs.highContrast ? 'On' : 'Off'}
          </button>
        </div>
        <div className="cx-row">
          <div>
            <strong>Large touch targets</strong>
            <p className="cx-meta">Comfortable tap areas for primary controls (WCAG-oriented).</p>
          </div>
          <button
            type="button"
            className={`cx-chip${prefs.largeTouchTargets ? ' is-on' : ''}`}
            onClick={() => patch({ largeTouchTargets: !prefs.largeTouchTargets })}
            aria-pressed={Boolean(prefs.largeTouchTargets)}
          >
            {prefs.largeTouchTargets ? 'On' : 'Off'}
          </button>
        </div>
        <Link href="/settings/account" className="cx-link">
          Account profile & locale details
        </Link>
      </section>

      <section className="cx-panel">
        <h2>Regional & global</h2>
        <p className="cx-meta">
          Currency, language, and date/time formats above apply on this device. Full localization
          (translated UI strings) and right-to-left layouts are on the global roadmap — English is
          the production default until language packs ship. Time zones follow your device clock.
        </p>
        <p className="cx-meta">
          Legal notices for your region will appear in{' '}
          <Link href="/legal" className="cx-link">
            Legal
          </Link>{' '}
          once counsel publishes jurisdiction-specific terms.
        </p>
      </section>
    </PlatformShell>
  );
}
