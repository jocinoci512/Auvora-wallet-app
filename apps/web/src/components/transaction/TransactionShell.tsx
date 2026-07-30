'use client';

import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';

export interface TxStep {
  id: string;
  label: string;
}

export function TransactionShell({
  title,
  subtitle,
  steps,
  currentStepId,
  children,
  backHref = '/dashboard',
  backLabel = 'Wallet',
  reassure,
}: {
  title: string;
  subtitle?: string;
  steps?: TxStep[];
  currentStepId?: string;
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
  reassure?: string;
}): ReactElement {
  const list = steps ?? [];
  const found = list.findIndex((s) => s.id === currentStepId);
  const currentIndex = found >= 0 ? found : 0;
  const progress = list.length ? ((currentIndex + 1) / list.length) * 100 : 0;

  return (
    <div className="cx">
      <div className="cx-atmosphere" aria-hidden />
      <header className="cx__header">
        <p className="cx__eyebrow">
          <Link href={backHref}>{backLabel}</Link>
        </p>
        <h1 className="cx__title">{title}</h1>
        {subtitle ? <p className="cx__sub">{subtitle}</p> : null}
        {reassure ? <p className="cx__reassure">{reassure}</p> : null}
        {list.length ? (
          <div
            className="cx__progress"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={list.length}
            aria-valuenow={currentIndex + 1}
            aria-label={`Step ${currentIndex + 1} of ${list.length}`}
          >
            <div className="cx__progress-bar" style={{ width: `${progress}%` }} />
          </div>
        ) : null}
      </header>
      {list.length ? (
        <ol className="cx__steps" aria-label="Progress">
          {list.map((step, i) => {
            const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo';
            return (
              <li
                key={step.id}
                className={`cx__step cx__step--${state}`}
                aria-current={state === 'current' ? 'step' : undefined}
              >
                <span className="cx__step-dot" aria-hidden>
                  {state === 'done' ? '✓' : i + 1}
                </span>
                <span className="cx__step-label">{step.label}</span>
              </li>
            );
          })}
        </ol>
      ) : null}
      <div className="cx__body">{children}</div>
    </div>
  );
}

export function CxActions({
  onBack,
  onNext,
  nextLabel = 'Continue',
  backLabel = 'Back',
  nextDisabled,
  nextLoading,
  secondary,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  backLabel?: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  secondary?: ReactNode;
}): ReactElement {
  return (
    <div className="cx__actions">
      <div className="cx__actions-main">
        {onBack ? (
          <button type="button" className="cx-btn cx-btn--ghost" onClick={onBack}>
            {backLabel}
          </button>
        ) : (
          <span />
        )}
        {onNext ? (
          <button
            type="button"
            className="cx-btn cx-btn--primary"
            onClick={onNext}
            disabled={nextDisabled || nextLoading}
          >
            {nextLoading ? 'Working…' : nextLabel}
          </button>
        ) : null}
      </div>
      {secondary ? <div className="cx__actions-secondary">{secondary}</div> : null}
    </div>
  );
}

export function CxProgressTrack({
  progress,
  label,
  stages,
}: {
  progress: number;
  label: string;
  stages?: string[];
}): ReactElement {
  const idx = Math.min(
    (stages?.length ?? 1) - 1,
    Math.floor((progress / 100) * (stages?.length ?? 1)),
  );
  return (
    <div className="cx-track" aria-busy="true" aria-live="polite">
      <p className="cx-track__label">{label}</p>
      <div className="cx__progress" aria-hidden>
        <div className="cx__progress-bar" style={{ width: `${Math.min(100, progress)}%` }} />
      </div>
      {stages?.length ? (
        <ol className="cx-track__stages">
          {stages.map((s, i) => (
            <li key={s} className={i <= idx ? 'is-on' : undefined}>
              {s}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

export function humanizeError(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  const t = raw.toLowerCase();
  if (t.includes('401') || t.includes('unauthorized')) {
    return 'Sign-in is required. Save your access token, then try again.';
  }
  if (
    t.includes('user rejected') ||
    t.includes('user denied') ||
    t.includes('rejected by user') ||
    t.includes('action_rejected')
  ) {
    return 'You cancelled the request in your wallet. Nothing was sent.';
  }
  if (t.includes('wallet locked') || t.includes('locked')) {
    return 'Unlock your wallet and try again.';
  }
  if (
    t.includes('timeout') ||
    t.includes('network') ||
    t.includes('failed to fetch') ||
    t.includes('econnrefused')
  ) {
    return 'We could not reach the network. Check your connection and retry.';
  }
  if (t.includes('429') || t.includes('rate limit') || t.includes('too many')) {
    return 'The network is busy. Wait a moment, then try again.';
  }
  if (t.includes('wrong network') || t.includes('chain mismatch') || t.includes('switch chain')) {
    return 'This wallet is on a different network. Switch networks, then continue.';
  }
  if (
    t.includes('gas') &&
    (t.includes('estimate') || t.includes('required') || t.includes('limit'))
  ) {
    return 'We could not estimate the network fee. Try a smaller amount or another speed.';
  }
  if (t.includes('nonce')) {
    return 'Another transaction is still pending. Wait for it to finish, then retry.';
  }
  if (t.includes('allowance') || t.includes('approval') || t.includes('permit')) {
    return 'This token needs approval before the trade. Confirm the approval, then try again.';
  }
  if (t.includes('insufficient') || t.includes('balance')) {
    return 'There is not enough balance for this amount plus fees.';
  }
  if (t.includes('expired') || t.includes('quote expired')) {
    return 'This quote expired. Refresh for an updated price.';
  }
  if (t.includes('liquidity')) {
    return 'There isn’t enough liquidity right now. Try a smaller amount or another pair.';
  }
  if (t.includes('slippage') || t.includes('price impact')) {
    return 'The price moved beyond your slippage limit. Try again or widen slippage.';
  }
  if (t.includes('kyc') || t.includes('compliance') || t.includes('identity')) {
    return 'Identity verification is required for this amount. Complete verification, then retry.';
  }
  if (t.includes('revert') || t.includes('execution reverted') || t.includes('call exception')) {
    return 'The network rejected this transaction. Review the details and try again.';
  }
  if (
    t.includes('bridge') &&
    (t.includes('stuck') || t.includes('refund') || t.includes('timeout'))
  ) {
    return 'The bridge transfer is delayed. Keep this receipt — funds can usually be claimed or refunded.';
  }
  if (t.includes('checksum') || t.includes('invalid address')) {
    return 'That address does not look right. Double-check the network and characters.';
  }
  if (raw.length > 160) return fallback;
  // Avoid dumping hex / ABI-looking noise
  if (/0x[a-f0-9]{64}/i.test(raw) && raw.length > 80) return fallback;
  return raw;
}
