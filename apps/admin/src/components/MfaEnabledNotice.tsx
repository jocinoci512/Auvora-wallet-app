'use client';

import { useSearchParams } from 'next/navigation';
import type { ReactElement } from 'react';
import { Alert } from '@auvora/ui';

export function MfaEnabledNotice(): ReactElement | null {
  const params = useSearchParams();
  if (params.get('mfa') !== 'enabled') return null;
  return (
    <Alert tone="success" title="Authenticator ready">
      Two-factor authentication is now enabled.
    </Alert>
  );
}
