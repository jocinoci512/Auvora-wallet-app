'use client';

import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';

export interface OnboardingStep {
  id: string;
  label: string;
}

export function OnboardingShell({
  title,
  subtitle,
  steps,
  currentStepId,
  children,
  eyebrowHref = '/wallets/onboarding',
  eyebrowLabel = 'Onboarding',
  reassure,
}: {
  title: string;
  subtitle?: string;
  steps: OnboardingStep[];
  currentStepId: string;
  children: ReactNode;
  eyebrowHref?: string;
  eyebrowLabel?: string;
  reassure?: string;
}): ReactElement {
  const currentIndex = Math.max(
    0,
    steps.findIndex((s) => s.id === currentStepId),
  );
  const progress = steps.length ? ((currentIndex + 1) / steps.length) * 100 : 0;

  return (
    <div className="ob" role="main">
      <div className="ob-atmosphere" aria-hidden />
      <header className="ob__header">
        <p className="ob__eyebrow">
          <Link href={eyebrowHref}>{eyebrowLabel}</Link>
        </p>
        <h1 className="ob__title">{title}</h1>
        {subtitle ? <p className="ob__sub">{subtitle}</p> : null}
        {reassure ? <p className="ob__reassure">{reassure}</p> : null}
        <div
          className="ob__progress"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={currentIndex + 1}
          aria-label={`Step ${currentIndex + 1} of ${steps.length}`}
        >
          <div className="ob__progress-bar" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <ol className="ob__steps" aria-label="Progress">
        {steps.map((step, i) => {
          const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo';
          return (
            <li
              key={step.id}
              className={`ob__step ob__step--${state}`}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <span className="ob__step-dot" aria-hidden>
                {state === 'done' ? '✓' : i + 1}
              </span>
              <span className="ob__step-label">{step.label}</span>
            </li>
          );
        })}
      </ol>

      <div className="ob__body">{children}</div>
    </div>
  );
}

export function ObActions({
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
    <div className="ob__actions">
      <div className="ob__actions-main">
        {onBack ? (
          <button type="button" className="ob-btn ob-btn--ghost" onClick={onBack}>
            {backLabel}
          </button>
        ) : (
          <span />
        )}
        {onNext ? (
          <button
            type="button"
            className="ob-btn ob-btn--primary"
            onClick={onNext}
            disabled={nextDisabled || nextLoading}
          >
            {nextLoading ? 'Working…' : nextLabel}
          </button>
        ) : null}
      </div>
      {secondary ? <div className="ob__actions-secondary">{secondary}</div> : null}
    </div>
  );
}
