'use client';

import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import { useRef, useState, type ReactElement } from 'react';
import { truncateMiddle } from '../../lib/wallet-experience/validation';

export function PublicAddress({
  value,
  copyEnabled = true,
  label = 'Wallet address',
  copyLabel = 'Copy address',
}: {
  value: string;
  copyEnabled?: boolean;
  label?: string;
  copyLabel?: string;
}): ReactElement {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  async function copy(): Promise<void> {
    if (!copyEnabled) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current != null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setExpanded(true);
    }
  }

  return (
    <div className="wf-addr">
      <span className="wf-kicker">{label}</span>
      <div className="wf-addr__row">
        <code title={value}>{expanded ? value : truncateMiddle(value)}</code>
        <button
          type="button"
          className="cx-btn cx-btn--ghost"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Hide full address' : 'Show full address'}
        >
          {expanded ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
          {expanded ? 'Hide' : 'Show full'}
        </button>
        {copyEnabled ? (
          <button
            type="button"
            className="cx-btn cx-btn--ghost"
            onClick={() => void copy()}
            aria-label={copyLabel}
          >
            <Copy size={16} aria-hidden /> {copied ? 'Copied' : copyLabel}
          </button>
        ) : null}
      </div>
      {copied ? (
        <span className="cx-inline-ok" role="status" aria-live="polite">
          <Check size={14} aria-hidden /> Copied to clipboard
        </span>
      ) : null}
    </div>
  );
}
