'use client';

import type { ReactElement } from 'react';
import type { AppIssue } from '../../lib/dashboard/status-copy';
import { AppIssuePanel } from '../status/AppIssuePanel';

type AuthStatus =
  'expired' | 'revoked' | 'locked' | 'suspended' | 'offline' | 'unavailable' | 'rate_limited';

const COPY: Record<
  AuthStatus,
  {
    kind: AppIssue;
    primaryHref: string;
    primaryLabel: string;
    secondaryHref: string;
    secondaryLabel: string;
  }
> = {
  expired: {
    kind: 'session',
    primaryHref: '/auth/login',
    primaryLabel: 'Sign in',
    secondaryHref: '/dashboard',
    secondaryLabel: 'Back to wallet',
  },
  revoked: {
    kind: 'revoked',
    primaryHref: '/auth/login',
    primaryLabel: 'Sign in',
    secondaryHref: '/dashboard',
    secondaryLabel: 'Back to wallet',
  },
  locked: {
    kind: 'locked',
    primaryHref: '/auth/forgot-password',
    primaryLabel: 'Reset password',
    secondaryHref: '/auth/login',
    secondaryLabel: 'Sign in',
  },
  suspended: {
    kind: 'suspended',
    primaryHref: 'mailto:support@auvorawallet.com',
    primaryLabel: 'Contact support',
    secondaryHref: '/auth/login',
    secondaryLabel: 'Sign in',
  },
  offline: {
    kind: 'offline',
    primaryHref: '/dashboard',
    primaryLabel: 'Retry wallet',
    secondaryHref: '/auth/login',
    secondaryLabel: 'Sign in',
  },
  unavailable: {
    kind: 'backend',
    primaryHref: '/status',
    primaryLabel: 'Check status',
    secondaryHref: '/dashboard',
    secondaryLabel: 'Back to wallet',
  },
  rate_limited: {
    kind: 'rate_limited',
    primaryHref: '/auth/login',
    primaryLabel: 'Try again',
    secondaryHref: '/dashboard',
    secondaryLabel: 'Back to wallet',
  },
};

export function AuthStatusExperience({ status }: { status: AuthStatus }): ReactElement {
  const cfg = COPY[status];
  return (
    <AppIssuePanel
      kind={cfg.kind}
      primaryHref={cfg.primaryHref}
      primaryLabel={cfg.primaryLabel}
      secondaryHref={cfg.secondaryHref}
      secondaryLabel={cfg.secondaryLabel}
    />
  );
}
