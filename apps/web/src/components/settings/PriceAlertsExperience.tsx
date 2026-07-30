'use client';

import { Alert, Button, EmptyState } from '@auvora/ui';
import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import {
  createPriceAlert,
  deletePriceAlert,
  evaluatePriceAlerts,
  listPriceAlerts,
  updatePriceAlert,
  type PriceAlert,
  type PriceAlertDirection,
  type PriceAlertKind,
} from '../../lib/settings/price-alerts';
import { useTimedToast } from '../../lib/settings/use-timed-toast';
import { PlatformShell } from '../platform/PlatformShell';
import { SettingsSectionNav } from './SettingsSectionNav';

export function PriceAlertsExperience(): ReactElement {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [kind, setKind] = useState<PriceAlertKind>('assetTarget');
  const [symbol, setSymbol] = useState('BTC');
  const [direction, setDirection] = useState<PriceAlertDirection>('above');
  const [threshold, setThreshold] = useState('70000');
  const { toast, showToast } = useTimedToast(1800);

  useEffect(() => {
    setAlerts(listPriceAlerts());
  }, []);

  function refresh(): void {
    setAlerts(listPriceAlerts());
  }

  return (
    <PlatformShell
      title="Price alerts"
      subtitle="Create, pause, and delete targets. Evaluation uses preview prices on this device."
      reassure="Not live market data and not push notifications — Check now evaluates locally."
      backHref="/settings/notifications"
      backLabel="Notifications"
      nav={<SettingsSectionNav current="/settings/alerts" />}
      actions={
        <Link href="/notifications" className="cx-btn cx-btn--ghost">
          Notification center
        </Link>
      }
    >
      {toast ? (
        <Alert tone="success" title="Updated">
          {toast}
        </Alert>
      ) : null}

      <section className="cx-panel">
        <h2>Your alerts</h2>
        <div className="cx-platform__actions" style={{ marginBottom: '0.75rem' }}>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              const result = evaluatePriceAlerts();
              refresh();
              showToast(
                result.fired === 0
                  ? 'No alerts triggered against preview prices'
                  : `${result.fired} alert${result.fired === 1 ? '' : 's'} fired (preview)`,
              );
            }}
          >
            Check now
          </Button>
        </div>
        {alerts.length === 0 ? (
          <EmptyState title="No alerts" description="Create a target below." />
        ) : (
          <ul className="cx-list">
            {alerts.map((a) => (
              <li key={a.id}>
                <div>
                  <strong>{a.title}</strong>
                  <p className="cx-meta">
                    {a.assetSymbol} · {a.kind} · {a.direction} {a.threshold}
                    {a.paused ? ' · Paused' : ''}
                  </p>
                </div>
                <div className="cx-platform__actions">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      updatePriceAlert({ ...a, paused: !a.paused });
                      refresh();
                    }}
                  >
                    {a.paused ? 'Resume' : 'Pause'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      deletePriceAlert(a.id);
                      refresh();
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="cx-panel">
        <h2>New alert</h2>
        <div className="cx-toolbar">
          <label className="cx-field">
            <span>Type</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as PriceAlertKind)}
              aria-label="Alert type"
            >
              <option value="assetTarget">Asset target</option>
              <option value="assetPercent">Percent move</option>
              <option value="portfolioThreshold">Portfolio threshold</option>
            </select>
          </label>
          <label className="cx-field">
            <span>Asset</span>
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)} aria-label="Asset">
              <option value="BTC">BTC</option>
              <option value="ETH">ETH</option>
              <option value="SOL">SOL</option>
              <option value="PORTFOLIO">Portfolio</option>
            </select>
          </label>
          <label className="cx-field">
            <span>Direction</span>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as PriceAlertDirection)}
              aria-label="Direction"
            >
              <option value="above">Above</option>
              <option value="below">Below</option>
              <option value="either">Either</option>
            </select>
          </label>
          <label className="cx-field">
            <span>Threshold</span>
            <input
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              inputMode="decimal"
              aria-label="Threshold"
            />
          </label>
        </div>
        <Button
          type="button"
          onClick={() => {
            const n = Number(threshold);
            if (!Number.isFinite(n) || n <= 0) {
              showToast('Enter a positive threshold');
              return;
            }
            const resolvedKind =
              symbol === 'PORTFOLIO' || kind === 'portfolioThreshold' ? 'portfolioThreshold' : kind;
            createPriceAlert({
              kind: resolvedKind,
              title: `${symbol} ${direction} ${n}`,
              assetSymbol: symbol,
              threshold: n,
              direction,
            });
            refresh();
            showToast('Alert created');
          }}
        >
          Create alert
        </Button>
      </section>
    </PlatformShell>
  );
}
