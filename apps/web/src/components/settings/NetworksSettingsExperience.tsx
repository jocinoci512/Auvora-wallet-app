'use client';

import { Alert, Button } from '@auvora/ui';
import { useEffect, useState, type ReactElement } from 'react';
import { getAccountPrefs, setAccountPrefs } from '../../lib/settings/prefs';
import { useTimedToast } from '../../lib/settings/use-timed-toast';
import { PlatformShell } from '../platform/PlatformShell';
import { SettingsSectionNav } from './SettingsSectionNav';

const NETWORKS = [
  { id: 'ETHEREUM', status: 'Healthy', detail: 'rpc-preview · 42ms' },
  { id: 'BITCOIN', status: 'Healthy', detail: 'rpc-preview · 58ms' },
  { id: 'SOLANA', status: 'Degraded', detail: 'rpc-preview · 210ms' },
  { id: 'POLYGON', status: 'Healthy', detail: 'rpc-preview · 51ms' },
] as const;

export function NetworksSettingsExperience(): ReactElement {
  const [network, setNetwork] = useState('ETHEREUM');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [cacheResetAt, setCacheResetAt] = useState<string | null>(null);
  const { toast, showToast } = useTimedToast(1600);

  useEffect(() => {
    setNetwork(getAccountPrefs().defaultNetwork);
  }, []);

  return (
    <PlatformShell
      title="Networks"
      subtitle="Choose a default network for new actions. Status is preview health — not a live SLA."
      reassure="Advanced RPC options stay collapsed until you need them."
      backHref="/settings"
      backLabel="Settings"
      nav={<SettingsSectionNav current="/settings/networks" />}
    >
      {toast ? (
        <Alert tone="success" title="Saved">
          {toast}
        </Alert>
      ) : null}

      <section className="cx-panel">
        <h2>Default network</h2>
        <ul className="cx-list">
          {NETWORKS.map((n) => (
            <li key={n.id}>
              <label style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <input
                  type="radio"
                  name="default-network"
                  checked={network === n.id}
                  onChange={() => {
                    setNetwork(n.id);
                    setAccountPrefs({ defaultNetwork: n.id });
                    showToast(`Default network · ${n.id}`);
                  }}
                  aria-label={`Use ${n.id}`}
                />
                <span>
                  <strong>{n.id}</strong>
                  <p className="cx-meta">
                    {n.status} · {n.detail}
                  </p>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="cx-panel">
        <button
          type="button"
          className="cx-chip"
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((v) => !v)}
        >
          {advancedOpen ? 'Hide advanced' : 'Show advanced'}
        </button>
        {advancedOpen ? (
          <div style={{ marginTop: '0.75rem' }}>
            <p className="cx-meta">
              Custom RPC endpoints are not available in this preview. Reset clears local preview
              cache only.
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                const at = new Date().toISOString();
                setCacheResetAt(at);
                showToast('Network cache reset (preview)');
              }}
            >
              Reset network cache
            </Button>
            {cacheResetAt ? (
              <p className="cx-meta">Last reset · {new Date(cacheResetAt).toLocaleString()}</p>
            ) : null}
          </div>
        ) : null}
      </section>
    </PlatformShell>
  );
}
