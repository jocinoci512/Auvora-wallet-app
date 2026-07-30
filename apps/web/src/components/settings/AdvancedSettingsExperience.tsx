'use client';

import { Alert, Button, EmptyState } from '@auvora/ui';
import { useCallback, useState, type ReactElement } from 'react';
import { env } from '../../env';
import { clearOfflineCache } from '../../lib/offline/cache';
import { withGetRetry, isTransientHttpError } from '../../lib/reliability/get-retry';
import { useTimedToast } from '../../lib/settings/use-timed-toast';
import { PlatformShell } from '../platform/PlatformShell';
import { SettingsSectionNav } from './SettingsSectionNav';

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
] as const;

type HealthProbe = {
  ok: boolean;
  status: number | null;
  latencyMs: number;
  detail: string;
  at: string;
};

export function AdvancedSettingsExperience(): ReactElement {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [probe, setProbe] = useState<HealthProbe | null>(null);
  const [probing, setProbing] = useState(false);
  const { toast, showToast } = useTimedToast(2200);

  function toggle(id: string): void {
    setEnabled((prev) => ({ ...prev, [id]: !prev[id] }));
    showToast('Advanced flag is a local placeholder — no production effect');
  }

  const runHealthProbe = useCallback(async () => {
    setProbing(true);
    const started = performance.now();
    try {
      const result = await withGetRetry(
        async () => {
          const res = await fetch(`${env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')}/health`, {
            method: 'GET',
            cache: 'no-store',
            signal: AbortSignal.timeout(8_000),
          });
          return res;
        },
        { maxAttempts: 2, retryIf: isTransientHttpError },
      );
      const latencyMs = Math.round(performance.now() - started);
      const body = await result.text().catch(() => '');
      setProbe({
        ok: result.ok,
        status: result.status,
        latencyMs,
        detail: result.ok
          ? `Gateway responded ${result.status}${body ? ` — ${body.slice(0, 120)}` : ''}`
          : `Gateway returned ${result.status}. Preview clients may still work offline from cache.`,
        at: new Date().toISOString(),
      });
    } catch (error) {
      const latencyMs = Math.round(performance.now() - started);
      setProbe({
        ok: false,
        status: null,
        latencyMs,
        detail:
          error instanceof Error
            ? `Unreachable (${error.message}). Showing honest offline preview — not a live multi-region claim.`
            : 'Unreachable. Cached portfolio and settings remain available on this device.',
        at: new Date().toISOString(),
      });
    } finally {
      setProbing(false);
    }
  }, []);

  function clearCaches(): void {
    const n = clearOfflineCache();
    showToast(`Cleared ${n} offline cache entries on this browser`);
  }

  return (
    <PlatformShell
      title="Advanced"
      subtitle="Developer flags, local cache tools, and gateway health probes."
      reassure="These flags stay local — they do not change production RPC or network config yet."
      backHref="/settings"
      backLabel="Settings"
      nav={<SettingsSectionNav current="/settings/advanced" />}
    >
      {toast ? (
        <Alert tone="info" title="Local only">
          {toast}
        </Alert>
      ) : null}

      <section className="cx-panel">
        <Alert tone="warn" title="Use with care">
          Advanced settings can affect reliability. Placeholders do not mutate production RPC or
          network config yet.
        </Alert>
        <ul className="cx-list" style={{ marginTop: '0.85rem' }}>
          {ADVANCED.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <p className="cx-meta">{item.detail}</p>
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

      <section className="cx-panel" style={{ marginTop: '1rem' }}>
        <h2>Diagnostics</h2>
        <p className="cx-meta">
          Probe gateway <code>/health</code> with capped GET retries. Failures stay honest — no fake
          multi-region success.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
          <Button type="button" size="sm" onClick={() => void runHealthProbe()} disabled={probing}>
            {probing ? 'Probing…' : 'Run health probe'}
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={clearCaches}>
            Clear offline cache
          </Button>
        </div>
        {probe ? (
          <Alert
            tone={probe.ok ? 'success' : 'warn'}
            title={probe.ok ? 'Reachable' : 'Unreachable / degraded'}
          >
            {probe.detail} · {probe.latencyMs} ms · {probe.at}
          </Alert>
        ) : (
          <EmptyState
            title="No probe yet"
            description="Run a health probe when you need support diagnostics. Results stay in this session."
          />
        )}
      </section>
    </PlatformShell>
  );
}
