'use client';

import { Alert, Button, Switch } from '@auvora/ui';
import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import { getPrivacyPrefs, setPrivacyPrefs, type PrivacyPrefs } from '../../lib/settings/prefs';
import { useTimedToast } from '../../lib/settings/use-timed-toast';
import { SettingsSectionNav } from './SettingsSectionNav';
import '../../app/settings-experience.css';

export function PrivacyCenterExperience(): ReactElement {
  const [prefs, setPrefs] = useState<PrivacyPrefs>(() => getPrivacyPrefs());
  const { toast, showToast } = useTimedToast(1600);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setPrefs(getPrivacyPrefs());
  }, []);

  function patch(next: Partial<PrivacyPrefs>): void {
    const saved = setPrivacyPrefs(next);
    setPrefs(saved);
    showToast('Privacy preference updated');
  }

  return (
    <div className="sc">
      <header className="sc__header">
        <div>
          <p className="sc__eyebrow">
            <Link href="/settings">Security Center</Link>
          </p>
          <h1>Privacy Center</h1>
          <p className="sc__sub">
            Analytics, crash reporting, cookies, personalization, and data controls.
          </p>
        </div>
      </header>
      <SettingsSectionNav current="/settings/privacy" />
      {toast ? (
        <Alert tone="success" title="Saved">
          {toast}
        </Alert>
      ) : null}

      <section className="sc-panel">
        <h2>Data preferences</h2>
        <div className="sc-row">
          <div>
            <strong>Analytics</strong>
            <p className="sc-meta">Help improve Auvora with anonymous usage metrics.</p>
          </div>
          <Switch
            checked={prefs.analytics}
            onCheckedChange={(v) => patch({ analytics: v })}
            aria-label="Analytics preferences"
          />
        </div>
        <div className="sc-row">
          <div>
            <strong>Crash reporting</strong>
            <p className="sc-meta">Send diagnostic stacks when the app fails unexpectedly.</p>
          </div>
          <Switch
            checked={prefs.crashReporting}
            onCheckedChange={(v) => patch({ crashReporting: v })}
            aria-label="Crash reporting preferences"
          />
        </div>
        <div className="sc-row">
          <div>
            <strong>Personalization</strong>
            <p className="sc-meta">Tailor discovery and recommendations to your activity.</p>
          </div>
          <Switch
            checked={prefs.personalization}
            onCheckedChange={(v) => patch({ personalization: v })}
            aria-label="Personalization options"
          />
        </div>
      </section>

      <section className="sc-panel">
        <h2>Cookies (web)</h2>
        <div className="sc-row">
          <div>
            <strong>Essential cookies</strong>
            <p className="sc-meta">Required for session and security — always on.</p>
          </div>
          <Switch checked={prefs.cookiesEssential} disabled aria-label="Essential cookies" />
        </div>
        <div className="sc-row">
          <div>
            <strong>Analytics cookies</strong>
            <p className="sc-meta">Optional measurement cookies for the web app.</p>
          </div>
          <Switch
            checked={prefs.cookiesAnalytics}
            onCheckedChange={(v) => patch({ cookiesAnalytics: v })}
            aria-label="Analytics cookies"
          />
        </div>
      </section>

      <section className="sc-panel">
        <h2>Policy & data</h2>
        <div className="sc-actions">
          <a href="https://auvora.example/privacy" target="_blank" rel="noopener noreferrer">
            <Button type="button" variant="secondary">
              Privacy policy
            </Button>
          </a>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              showToast('Data export placeholder — request queued for future API', 2200);
            }}
          >
            Export data (placeholder)
          </Button>
          <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)}>
            Delete account (placeholder)
          </Button>
        </div>
        {confirmDelete ? (
          <Alert tone="warn" title="Confirm deletion placeholder">
            Account deletion is not enabled in this environment. Contact support to proceed when
            available.
            <div className="sc-actions" style={{ marginTop: '0.75rem' }}>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
            </div>
          </Alert>
        ) : null}
      </section>
    </div>
  );
}
