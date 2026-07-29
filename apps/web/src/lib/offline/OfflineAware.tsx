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
