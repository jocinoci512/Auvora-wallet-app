'use client';

import type { ReactElement, ReactNode } from 'react';
import { Button } from '@auvora/ui';
import Link from 'next/link';

export interface WizardStep {
  id: string;
  label: string;
}

export interface WizardShellProps {
  title: string;
  subtitle?: string;
  steps: WizardStep[];
  currentStepId: string;
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
  footer?: ReactNode;
}

export function WizardShell({
  title,
  subtitle,
  steps,
  currentStepId,
  children,
  backHref = '/wallets/onboarding',
  backLabel = 'Onboarding',
  footer,
}: WizardShellProps): ReactElement {
  const currentIndex = Math.max(
    0,
    steps.findIndex((s) => s.id === currentStepId),
  );
  const progress = steps.length ? ((currentIndex + 1) / steps.length) * 100 : 0;

  return (
    <div className="wx" role="main">
      <header className="wx__header">
        <div>
          <p className="wx__eyebrow">
            <Link href={backHref}>{backLabel}</Link>
          </p>
          <h1>{title}</h1>
          {subtitle ? <p className="wx__sub">{subtitle}</p> : null}
        </div>
        <div className="wx__progress" aria-hidden="true">
          <div className="wx__progress-bar" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <ol className="wx__steps" aria-label="Progress">
        {steps.map((step, i) => {
          const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo';
          return (
            <li
              key={step.id}
              className={`wx__step wx__step--${state}`}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <span className="wx__step-dot">{i + 1}</span>
              <span className="wx__step-label">{step.label}</span>
            </li>
          );
        })}
      </ol>

      <div className="wx__body">{children}</div>
      {footer ? <footer className="wx__footer">{footer}</footer> : null}
    </div>
  );
}

export function WizardActions({
  onBack,
  onNext,
  nextLabel = 'Continue',
  backLabel = 'Back',
  nextDisabled,
  nextLoading,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  backLabel?: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
}): ReactElement {
  return (
    <div className="wx__actions">
      {onBack ? (
        <Button type="button" variant="ghost" onClick={onBack}>
          {backLabel}
        </Button>
      ) : (
        <span />
      )}
      {onNext ? (
        <Button type="button" onClick={onNext} disabled={nextDisabled || nextLoading}>
          {nextLoading ? 'Working…' : nextLabel}
        </Button>
      ) : null}
    </div>
  );
}
