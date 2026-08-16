'use client';

import { Alert } from '@auvora/ui';
import { useEffect, useState, type ReactElement } from 'react';
import { SUPPORTED_NETWORKS } from '../../lib/product/networks';
import { getAccountPrefs, setAccountPrefs } from '../../lib/settings/prefs';
import { useTimedToast } from '../../lib/settings/use-timed-toast';
import { PlatformShell } from '../platform/PlatformShell';
import { SettingsSectionNav } from './SettingsSectionNav';
import { FeedbackToast } from '../status/FeedbackToast';

export function NetworksSettingsExperience(): ReactElement {
  const [network, setNetwork] = useState('ethereum');
  const { toast, tone, showToast } = useTimedToast(1600);

  useEffect(() => {
    const stored = getAccountPrefs().defaultNetwork.toLowerCase();
    const match = SUPPORTED_NETWORKS.find(
      (n) => n.id === stored || n.symbol.toLowerCase() === stored,
    );
    setNetwork(match?.id ?? 'ethereum');
  }, []);

  return (
    <PlatformShell
      title="Networks"
      subtitle="Auvora currently supports these six networks. Custom RPC endpoints are not available."
      reassure="Choosing a default only affects new actions on this device."
      backHref="/settings"
      backLabel="Settings"
      nav={<SettingsSectionNav current="/settings/networks" />}
    >
      {toast ? <FeedbackToast message={toast} tone={tone} /> : null}

      <section className="cx-panel">
        <h2>Supported networks</h2>
        <ul className="cx-list">
          {SUPPORTED_NETWORKS.map((n) => (
            <li key={n.id}>
              <label style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <input
                  type="radio"
                  name="default-network"
                  checked={network === n.id}
                  onChange={() => {
                    setNetwork(n.id);
                    setAccountPrefs({ defaultNetwork: n.id.toUpperCase() });
                    showToast(`Default network · ${n.label}`, { tone: 'success' });
                  }}
                  aria-label={`Use ${n.label}`}
                />
                <span>
                  <strong>
                    {n.label} ({n.symbol})
                  </strong>
                  <p className="cx-meta">Supported</p>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <Alert tone="info" title="No custom networks">
          Additional chains and custom RPC URLs are not enabled in this release.
        </Alert>
      </section>
    </PlatformShell>
  );
}
