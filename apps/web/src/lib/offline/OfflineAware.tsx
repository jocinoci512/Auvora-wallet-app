'use client';

import { Button, OfflineState } from '@auvora/ui';
import type { ReactElement, ReactNode } from 'react';
import { useOnlineStatus } from './online-status';

type Props = {
  children: ReactNode;
  /** When offline and no children should render, show OfflineState instead. */
  blockWhenOffline?: boolean;
  onRetry?: () => void;
};

/** Soft gate for screens that need a network for primary actions. */
export function OfflineAware({ children, blockWhenOffline = false, onRetry }: Props): ReactElement {
  const { online } = useOnlineStatus();

  if (!online && blockWhenOffline) {
    return (
      <OfflineState
        title="You’re offline"
        description="Auvora can’t reach the network right now. Your recovery phrase stays on this device — reconnect when you’re ready to sync balances and activity."
        action={
          onRetry ? (
            <Button type="button" variant="secondary" onClick={onRetry}>
              Retry
            </Button>
          ) : undefined
        }
      />
    );
  }

  return <>{children}</>;
}
