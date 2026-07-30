'use client';

import { Alert, Button, Switch } from '@auvora/ui';
import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import { clearAssistantHistoryStorage } from '../../lib/insights/demo';
import { getPrivacyPrefs, setPrivacyPrefs, type PrivacyPrefs } from '../../lib/settings/prefs';
import { useTimedToast } from '../../lib/settings/use-timed-toast';
import { PlatformShell } from '../platform/PlatformShell';
import { SettingsSectionNav } from './SettingsSectionNav';

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
    <PlatformShell
      title="Privacy Center"
      subtitle="Analytics, Assistant, crash reporting, cookies, personalization, and data controls."
      reassure="Privacy choices are local first — share only what you intend to share."
      backHref="/settings"
      backLabel="Settings"
      nav={<SettingsSectionNav current="/settings/privacy" />}
    >
      {toast ? (
        <Alert tone="success" title="Saved">
          {toast}
        </Alert>
      ) : null}

      <section className="cx-panel">
        <h2>Data preferences</h2>
        <div className="cx-row">
          <div>
            <strong>Analytics</strong>
            <p className="cx-meta">Help improve Auvora with anonymous usage metrics.</p>
          </div>
          <Switch
            checked={prefs.analytics}
            onCheckedChange={(v) => patch({ analytics: v })}
            aria-label="Analytics preferences"
          />
        </div>
        <div className="cx-row">
          <div>
            <strong>Crash reporting</strong>
            <p className="cx-meta">Send diagnostic stacks when the app fails unexpectedly.</p>
          </div>
          <Switch
            checked={prefs.crashReporting}
            onCheckedChange={(v) => patch({ crashReporting: v })}
            aria-label="Crash reporting preferences"
          />
        </div>
        <div className="cx-row">
          <div>
            <strong>Personalization</strong>
            <p className="cx-meta">Tailor discovery and recommendations to your activity.</p>
          </div>
          <Switch
            checked={prefs.personalization}
            onCheckedChange={(v) => patch({ personalization: v })}
            aria-label="Personalization options"
          />
        </div>
      </section>

      <section className="cx-panel">
        <h2>Auvora Assistant</h2>
        <p className="cx-meta">
          On-device matching maps questions to curated educational guides. Keys and recovery phrases
          are never collected. Answers educate — they never move funds or recommend trades.
        </p>
        <div className="cx-row">
          <div>
            <strong>Assistant suggestions</strong>
            <p className="cx-meta">Allow the in-app assistant on this device.</p>
          </div>
          <Switch
            checked={prefs.aiAssistant}
            onCheckedChange={(v) => patch({ aiAssistant: v })}
            aria-label="Auvora Assistant"
          />
        </div>
        <div className="cx-row">
          <div>
            <strong>Keep chat history locally</strong>
            <p className="cx-meta">
              Store recent questions on this device only. Turning this off clears stored history.
            </p>
          </div>
          <Switch
            checked={prefs.aiChatHistory}
            onCheckedChange={(v) => {
              if (!v) clearAssistantHistoryStorage();
              patch({ aiChatHistory: v });
            }}
            aria-label="Local assistant chat history"
          />
        </div>
        <div className="cx-platform__actions">
          <a className="cx-btn cx-btn--ghost" href="/assistant">
            Open Assistant
          </a>
          <a className="cx-btn cx-btn--ghost" href="/learn">
            Education Hub
          </a>
        </div>
      </section>

      <section className="cx-panel">
        <h2>Cookies (web)</h2>
        <div className="cx-row">
          <div>
            <strong>Essential cookies</strong>
            <p className="cx-meta">Required for session and security — always on.</p>
          </div>
          <Switch checked={prefs.cookiesEssential} disabled aria-label="Essential cookies" />
        </div>
        <div className="cx-row">
          <div>
            <strong>Analytics cookies</strong>
            <p className="cx-meta">Optional measurement cookies for the web app.</p>
          </div>
          <Switch
            checked={prefs.cookiesAnalytics}
            onCheckedChange={(v) => patch({ cookiesAnalytics: v })}
            aria-label="Analytics cookies"
          />
        </div>
      </section>

      <section className="cx-panel">
        <h2>Policy & data</h2>
        <div className="cx-platform__actions">
          <Link href="/legal/privacy" className="cx-btn cx-btn--primary">
            Privacy policy
          </Link>
          <Link href="/legal/terms" className="cx-btn cx-btn--ghost">
            Terms of use
          </Link>
          <Link href="/trust" className="cx-btn cx-btn--ghost">
            Trust & transparency
          </Link>
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
            <div className="cx-platform__actions" style={{ marginTop: '0.75rem' }}>
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
    </PlatformShell>
  );
}
