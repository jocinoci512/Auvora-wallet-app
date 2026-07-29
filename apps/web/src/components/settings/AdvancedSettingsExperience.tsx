'use client';

import { Alert, Button, EmptyState } from '@auvora/ui';
import Link from 'next/link';
import { useState, type ReactElement } from 'react';
import { useTimedToast } from '../../lib/settings/use-timed-toast';
import { SettingsSectionNav } from './SettingsSectionNav';
import '../../app/settings-experience.css';

const ADVANCED = [
  {
    id: 'dev',
    title: 'Developer Mode',
    detail: 'Unlock verbose diagnostics and experimental tooling.',
  },
  {
    id: 'rpc',
    title: 'RPC Management',
    detail: 'Custom RPC endpoints per network — wiring reserved.',
  },
  {
    id: 'networks',
    title: 'Network Management',
    detail: 'Add or disable networks beyond curated defaults.',
  },
  {
    id: 'experimental',
    title: 'Experimental Features',
    detail: 'Opt-in betas for Web3 and trading surfaces.',
  },
  {
    id: 'logs',
    title: 'Logs',
    detail: 'Client log buffer export for support tickets.',
  },
  {
    id: 'diagnostics',
    title: 'Diagnostics',
    detail: 'Health probes for gateway, RPC, and sync workers.',
  },
] as const;

export function AdvancedSettingsExperience(): ReactElement {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const { toast, showToast } = useTimedToast(2000);

  function toggle(id: string): void {
    setEnabled((prev) => ({ ...prev, [id]: !prev[id] }));
    showToast('Advanced flag is a local placeholder — no production effect');
  }

  return (
    <div className="sc">
      <header className="sc__header">
        <div>
          <p className="sc__eyebrow">
            <Link href="/settings">Security Center</Link>
          </p>
          <h1>Advanced</h1>
          <p className="sc__sub">
            Developer, RPC, network, experimental, logs, and diagnostics placeholders.
          </p>
        </div>
      </header>
      <SettingsSectionNav current="/settings/advanced" />
      {toast ? (
        <Alert tone="info" title="Placeholder">
          {toast}
        </Alert>
      ) : null}

      <section className="sc-panel">
        <Alert tone="warn" title="Use with care">
          Advanced settings can affect reliability. Placeholders do not mutate production RPC or
          network config yet.
        </Alert>
        <ul className="sc-list" style={{ marginTop: '0.85rem' }}>
          {ADVANCED.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <p className="sc-meta">{item.detail}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={enabled[item.id] ? 'primary' : 'secondary'}
                onClick={() => toggle(item.id)}
              >
                {enabled[item.id] ? 'On (local)' : 'Enable placeholder'}
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <EmptyState
        title="Diagnostics coming soon"
        description="When enabled, diagnostics will surface gateway /health and RPC probe summaries."
      />
    </div>
  );
}
