import type { ReactElement, ReactNode } from 'react';
import { Alert } from './Alert';
import { EmptyState } from './EmptyState';
import { LoadingBlock, Skeleton } from './Skeleton';
import { Button } from './Button';

export interface AsyncStatesProps {
  loading?: boolean;
  loadingMessage?: string;
  error?: string | null;
  errorTitle?: string;
  onRetry?: () => void;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  children?: ReactNode;
}

/**
 * Shared loading / error / empty rendering for list and detail screens.
 * Does not change fetch logic — only presentation.
 */
export function AsyncStates({
  loading = false,
  loadingMessage = 'Loading…',
  error,
  errorTitle = 'Something went wrong',
  onRetry,
  empty = false,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
  children,
}: AsyncStatesProps): ReactElement | null {
  if (loading) {
    return (
      <>
        <LoadingBlock message={loadingMessage} />
        <Skeleton rows={4} label={loadingMessage} />
      </>
    );
  }

  if (error) {
    return (
      <Alert tone="error" title={errorTitle}>
        <p>{error}</p>
        {onRetry ? (
          <Button type="button" variant="secondary" onClick={onRetry} style={{ marginTop: '0.75rem' }}>
            Retry
          </Button>
        ) : null}
      </Alert>
    );
  }

  if (empty) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  return children ? <>{children}</> : null;
}
