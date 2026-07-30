'use client';

import { useEffect, useState, type ReactElement } from 'react';
import {
  arrivalLabel,
  fmtAmount,
  providerLabel,
  quoteExpired,
  secondsRemaining,
  totalFeesUsd,
  type AssetQuote,
} from '../../lib/trading/quote-engine';

export function QuotePanel({
  quote,
  onRefresh,
  refreshing,
}: {
  quote: AssetQuote;
  onRefresh?: () => void;
  refreshing?: boolean;
}): ReactElement {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [quote.id]);

  const expired = quoteExpired(quote);
  const secs = secondsRemaining(quote);

  return (
    <section className="cx-panel" aria-live="polite">
      <div className="cx-confirm">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <strong>{expired ? 'Quote expired' : `Quote · ${providerLabel(quote.provider)}`}</strong>
          <span
            className="cx-meta"
            style={{ fontWeight: 700, color: secs <= 5 ? 'var(--cx-danger, #b42318)' : undefined }}
          >
            {expired ? 'Expired' : `${secs}s`}
          </span>
        </div>
        <dl>
          <div>
            <dt>You send</dt>
            <dd>
              {fmtAmount(quote.fromAmount)} {quote.fromAsset}
            </dd>
          </div>
          <div>
            <dt>You receive</dt>
            <dd>
              {fmtAmount(quote.toAmount)} {quote.toAsset}
            </dd>
          </div>
          {(quote.op === 'swap' || quote.op === 'bridge') && (
            <div>
              <dt>Minimum received</dt>
              <dd>
                {fmtAmount(quote.minReceived)} {quote.toAsset}
              </dd>
            </div>
          )}
          {quote.op === 'swap' && quote.slippageBps != null && (
            <div>
              <dt>Slippage</dt>
              <dd>{(quote.slippageBps / 100).toFixed(2)}%</dd>
            </div>
          )}
          {quote.destNetwork && (
            <div>
              <dt>Route</dt>
              <dd>
                {quote.sourceNetwork} → {quote.destNetwork}
              </dd>
            </div>
          )}
          <div>
            <dt>Estimated arrival</dt>
            <dd>{arrivalLabel(quote.estimatedSeconds)}</dd>
          </div>
          {quote.fees.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.asset === '%' ? `${f.amount}%` : `${fmtAmount(f.amount)} ${f.asset}`}</dd>
            </div>
          ))}
          <div>
            <dt>Total fees (est.)</dt>
            <dd>${totalFeesUsd(quote).toFixed(2)}</dd>
          </div>
        </dl>
        {quote.routeSummary ? <p className="cx-meta">{quote.routeSummary}</p> : null}
        {onRefresh ? (
          <button
            type="button"
            className="cx-btn cx-btn--ghost"
            onClick={onRefresh}
            disabled={refreshing}
            style={{ marginTop: 8 }}
          >
            {refreshing ? 'Refreshing…' : 'Refresh quote'}
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function QuoteChecklist({
  feesChecked,
  detailsChecked,
  onFees,
  onDetails,
  actionLabel,
}: {
  feesChecked: boolean;
  detailsChecked: boolean;
  onFees: (v: boolean) => void;
  onDetails: (v: boolean) => void;
  actionLabel: string;
}): ReactElement {
  return (
    <div className="cx-panel" style={{ display: 'grid', gap: 10 }}>
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <input
          type="checkbox"
          checked={feesChecked}
          onChange={(e) => onFees(e.target.checked)}
          style={{ width: 20, height: 20, marginTop: 2 }}
        />
        <span>I understand the fees listed above</span>
      </label>
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <input
          type="checkbox"
          checked={detailsChecked}
          onChange={(e) => onDetails(e.target.checked)}
          style={{ width: 20, height: 20, marginTop: 2 }}
        />
        <span>I confirm this {actionLabel} details</span>
      </label>
    </div>
  );
}
