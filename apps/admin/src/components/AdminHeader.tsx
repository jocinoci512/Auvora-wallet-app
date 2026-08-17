'use client';

import { useRouter } from 'next/navigation';
import type { ReactElement } from 'react';
import { Button, ThemeToggle } from '@auvora/ui';
import { RealtimeStatusBadge } from './RealtimeActivityFeed';
import { useAdminIdentity } from '../lib/admin-identity';
import { useAdminNav } from '../lib/admin-nav';
import { useAdminRealtimeContext } from '../lib/admin-realtime-context';
import { displayName, safeEnvLabel } from '../lib/admin-format';
import { primaryRole, roleLabel } from '../lib/admin-rbac';
import { adminLogout } from '../lib/admin-session';

export function AdminHeader(): ReactElement {
  const router = useRouter();
  const identity = useAdminIdentity();
  const { open, toggle } = useAdminNav();
  const { status } = useAdminRealtimeContext();
  const operator = identity?.operator;
  const role = primaryRole(operator);
  const envLabel = safeEnvLabel();

  return (
    <header className="admin-header">
      <div className="admin-header__identity">
        <Button
          type="button"
          variant="ghost"
          className="admin-header__menu"
          aria-expanded={open}
          aria-controls="admin-navigation"
          onClick={toggle}
        >
          Menu
        </Button>
        <div className="admin-header__who">
          <span className="admin-header__name">
            {operator ? displayName(operator) : 'Administrator'}
          </span>
          <span className="admin-header__email">{operator?.email ?? ''}</span>
        </div>
      </div>
      <div className="admin-header__meta" aria-label="Session context">
        <span className="admin-chip">{roleLabel(role)}</span>
        <span className="admin-chip admin-chip--quiet">{envLabel}</span>
        <span className="admin-chip admin-chip--quiet">
          MFA {operator?.mfaEnrolled ? 'enrolled' : 'not enrolled'}
        </span>
        <RealtimeStatusBadge status={status} />
        <span className="auvora-sr-only" aria-live="polite">
          Realtime {status}
        </span>
      </div>
      <div className="admin-header__actions">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            void adminLogout().finally(() => router.replace('/login'));
          }}
        >
          Sign out
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
