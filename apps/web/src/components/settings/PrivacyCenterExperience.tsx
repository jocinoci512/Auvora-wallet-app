'use client';

import { Alert, Button, Switch } from '@auvora/ui';
import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import { clearAssistantHistoryStorage } from '../../lib/insights/demo';
import {
  getIntelligencePrefs,
  setIntelligencePrefs,
  GUIDANCE_DISCLAIMER,
  type GuidanceLevel,
  type IntelligencePrefs,
} from '../../lib/intelligence/guidance';
import { getPrivacyPrefs, setPrivacyPrefs, type PrivacyPrefs } from '../../lib/settings/prefs';
import { getSecurityPrefs, setSecurityPrefs } from '../../lib/wallet-experience/security-prefs';
import { useTimedToast } from '../../lib/settings/use-timed-toast';
import { PlatformShell } from '../platform/PlatformShell';
import { SettingsSectionNav } from './SettingsSectionNav';

export function PrivacyCenterExperience(): ReactElement {
  const [prefs, setPrefs] = useState<PrivacyPrefs>(() => getPrivacyPrefs());
  const [intel, setIntel] = useState<IntelligencePrefs>(() => getIntelligencePrefs());
  const [hideSensitiveInfo, setHideSensitiveInfo] = useState(false);
  const [notificationPrivacy, setNotificationPrivacy] = useState(true);
  const [clipboardTimeoutSeconds, setClipboardTimeoutSeconds] = useState(30);
  const { toast, showToast } = useTimedToast(1600);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setPrefs(getPrivacyPrefs());
    setIntel(getIntelligencePrefs());
    const sec = getSecurityPrefs();
    setHideSensitiveInfo(sec.hideSensitiveInfo);
    setNotificationPrivacy(sec.notificationPrivacy);
    setClipboardTimeoutSeconds(sec.clipboardTimeoutSeconds);
  }, []);

  function patch(next: Partial<PrivacyPrefs>): void {
    const saved = setPrivacyPrefs(next);
    setPrefs(saved);
    showToast('Privacy preference updated');
  }

  function patchIntel(next: Partial<IntelligencePrefs>): void {
    const saved = setIntelligencePrefs(next);
    setIntel(saved);
    showToast('Guidance preference updated');
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
        <h2>Wallet privacy</h2>
        <div className="cx-row">
          <div>
            <strong>Hide sensitive information</strong>
            <p className="cx-meta">Reduce visible account details on shared or public screens.</p>
          </div>
          <Switch
            checked={hideSensitiveInfo}
            onCheckedChange={(v) => {
              setSecurityPrefs({ hideSensitiveInfo: v });
              setHideSensitiveInfo(v);
              showToast('Wallet privacy updated');
            }}
            aria-label="Hide sensitive information"
          />
        </div>
        <div className="cx-row">
          <div>
            <strong>Notification privacy</strong>
            <p className="cx-meta">
              Hide balances and detailed amounts in notifications when possible.
            </p>
          </div>
          <Switch
            checked={notificationPrivacy}
            onCheckedChange={(v) => {
              setSecurityPrefs({ notificationPrivacy: v });
              setNotificationPrivacy(v);
              showToast('Notification privacy updated');
            }}
            aria-label="Notification privacy"
          />
        </div>
        <div className="cx-row">
          <div>
            <strong>Clipboard timeout</strong>
            <p className="cx-meta">Clear copied sensitive values after a short delay.</p>
          </div>
          <label className="cx-field" style={{ maxWidth: 108 }}>
            <span className="cx-sr-only">Clipboard timeout seconds</span>
            <input
              type="number"
              min={15}
              max={120}
              step={15}
              value={clipboardTimeoutSeconds}
              onChange={(e) => setClipboardTimeoutSeconds(Number(e.target.value) || 30)}
              onBlur={() => {
                const next = Math.min(120, Math.max(15, clipboardTimeoutSeconds));
                setClipboardTimeoutSeconds(next);
                setSecurityPrefs({ clipboardTimeoutSeconds: next });
                showToast('Clipboard timeout updated');
              }}
            />
          </label>
        </div>
      </section>

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
        <h2>Auvora Intelligence</h2>
        <p className="cx-meta">
          Guidance appears in context — fees, security prompts, portfolio notes — not as a chatbot
          takeover. {GUIDANCE_DISCLAIMER}
        </p>
        <label className="cx-field">
          <span>Guidance level</span>
          <select
            value={intel.guidanceLevel}
            onChange={(e) => patchIntel({ guidanceLevel: e.target.value as GuidanceLevel })}
            aria-label="Guidance level"
          >
            <option value="minimal">Less guidance — security and failures only</option>
            <option value="balanced">Balanced (recommended)</option>
            <option value="full">More guidance — extra educational hints</option>
          </select>
        </label>
        <div className="cx-row">
          <div>
            <strong>Educational hints</strong>
            <p className="cx-meta">
              Optional tips after key moments (import, biometrics, first transfer).
            </p>
          </div>
          <Switch
            checked={intel.educationalHints}
            onCheckedChange={(v) => patchIntel({ educationalHints: v })}
            aria-label="Educational hints"
          />
        </div>
        <div className="cx-row">
          <div>
            <strong>Allow external AI services</strong>
            <p className="cx-meta">
              Off by default. When off, guidance stays on this device and never sends wallet data to
              external AI.
            </p>
          </div>
          <Switch
            checked={intel.allowExternalAi}
            onCheckedChange={(v) => patchIntel({ allowExternalAi: v })}
            aria-label="Allow external AI services"
          />
        </div>
        <div className="cx-row">
          <div>
            <strong>In-app Q&amp;A surface</strong>
            <p className="cx-meta">
              Allow the optional on-device question matcher (never moves funds).
            </p>
          </div>
          <Switch
            checked={prefs.aiAssistant}
            onCheckedChange={(v) => patch({ aiAssistant: v })}
            aria-label="Auvora Intelligence Q and A"
          />
        </div>
        <div className="cx-row">
          <div>
            <strong>Keep local Q&amp;A history</strong>
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
            aria-label="Local Q and A history"
          />
        </div>
        <div className="cx-platform__actions">
          <a className="cx-btn cx-btn--ghost" href="/assistant">
            Open Q&amp;A
          </a>
          <a className="cx-btn cx-btn--ghost" href="/learn">
            Learning Center
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
