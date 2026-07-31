'use client';

import { Alert } from '@auvora/ui';
import { useMemo, useState, type ReactElement } from 'react';
import { ReleaseConfig } from '../../lib/release/config';
import { useTimedToast } from '../../lib/settings/use-timed-toast';
import { PlatformShell } from '../platform/PlatformShell';
import { SettingsSectionNav } from './SettingsSectionNav';

const CATEGORIES = [
  { id: 'bug', label: 'Bug' },
  { id: 'suggestion', label: 'Suggestion' },
  { id: 'confusingUx', label: 'Confusing UX' },
  { id: 'performance', label: 'Performance' },
  { id: 'security', label: 'Security concern' },
  { id: 'accessibility', label: 'Accessibility' },
] as const;

type CategoryId = (typeof CATEGORIES)[number]['id'];

const KEY = 'auvora_beta_feedback_v1';

type Report = {
  id: string;
  category: CategoryId;
  summary: string;
  details: string;
  includeDiagnostics: boolean;
  diagnostics?: Record<string, string | boolean | number>;
  createdAt: string;
};

function loadReports(): Report[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Report[];
  } catch {
    return [];
  }
}

function saveReports(reports: Report[]) {
  localStorage.setItem(KEY, JSON.stringify(reports.slice(0, 50)));
}

export function BetaFeedbackExperience(): ReactElement {
  const [category, setCategory] = useState<CategoryId>('bug');
  const [summary, setSummary] = useState('');
  const [details, setDetails] = useState('');
  const [includeDiagnostics, setIncludeDiagnostics] = useState(false);
  const [reports, setReports] = useState<Report[]>(() => loadReports());
  const { toast, showToast } = useTimedToast(2000);

  const diagnostics = useMemo(
    () => ({
      channel: ReleaseConfig.releaseChannel,
      version: ReleaseConfig.marketingVersion,
      buildLabel: ReleaseConfig.buildLabel,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 120) : 'n/a',
      online: typeof navigator !== 'undefined' ? navigator.onLine : true,
      privacyNote: 'No recovery phrase, private keys, or PIN included.',
    }),
    [],
  );

  function submit() {
    if (summary.trim().length < 4) {
      showToast('Add a short summary first');
      return;
    }
    const report: Report = {
      id: crypto.randomUUID(),
      category,
      summary: summary.trim(),
      details: details.trim(),
      includeDiagnostics,
      diagnostics: includeDiagnostics ? diagnostics : undefined,
      createdAt: new Date().toISOString(),
    };
    const next = [report, ...reports];
    saveReports(next);
    setReports(next);
    setSummary('');
    setDetails('');
    setIncludeDiagnostics(false);
    showToast('Report saved on this device — nothing uploaded');
  }

  return (
    <PlatformShell
      title="Alpha feedback"
      subtitle="Version 1.0 Alpha reports stay on this device until you copy them. Never include your recovery phrase."
      backHref="/settings"
      backLabel="Settings"
      nav={<SettingsSectionNav current="/settings/feedback" />}
    >
      {toast ? (
        <Alert tone="success" title="Saved">
          {toast}
        </Alert>
      ) : null}

      <section className="cx-panel">
        <h2>New report</h2>
        <label className="cx-field">
          <span>Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CategoryId)}
            aria-label="Feedback category"
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="cx-field">
          <span>Summary</span>
          <input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="What went wrong or felt unclear?"
          />
        </label>
        <label className="cx-field">
          <span>Details</span>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={5}
            placeholder="Steps, expected result, device notes"
          />
        </label>
        <label className="cx-row" style={{ alignItems: 'flex-start', gap: '0.75rem' }}>
          <input
            type="checkbox"
            checked={includeDiagnostics}
            onChange={(e) => setIncludeDiagnostics(e.target.checked)}
            aria-label="Include diagnostics"
          />
          <span>
            <strong>Include diagnostics</strong>
            <p className="cx-meta">Optional browser flags only — never keys or phrases.</p>
          </span>
        </label>
        <button type="button" className="cx-btn cx-btn--primary" onClick={submit}>
          Save report
        </button>
      </section>

      <section className="cx-panel">
        <h2>Saved on this device</h2>
        {reports.length === 0 ? (
          <p className="cx-meta">No reports yet.</p>
        ) : (
          <ul className="cx-list">
            {reports.slice(0, 10).map((r) => (
              <li key={r.id}>
                <strong>{r.summary}</strong>
                <p className="cx-meta">
                  {CATEGORIES.find((c) => c.id === r.category)?.label} · {r.createdAt}
                </p>
                <button
                  type="button"
                  className="cx-btn cx-btn--ghost"
                  onClick={async () => {
                    await navigator.clipboard.writeText(JSON.stringify(r, null, 2));
                    showToast('Report copied');
                  }}
                >
                  Copy JSON
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PlatformShell>
  );
}
