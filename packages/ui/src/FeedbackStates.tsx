import type { HTMLAttributes, ReactElement, ReactNode } from 'react';
import { EmptyState } from './EmptyState';
import { cn } from './utils/cn';

export interface FeedbackStateProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function SuccessState({
  title,
  description,
  action,
  className,
  ...rest
}: FeedbackStateProps): ReactElement {
  return (
    <EmptyState
      title={title}
      description={description}
      action={action}
      className={cn('auvora-empty--success', className)}
      {...rest}
    />
  );
}

export function ErrorState({
  title,
  description,
  action,
  className,
  ...rest
}: FeedbackStateProps): ReactElement {
  return (
    <EmptyState
      title={title}
      description={description}
      action={action}
      className={cn('auvora-empty--error', className)}
      {...rest}
    />
  );
}

export function OfflineState({
  title = 'You are offline',
  description = 'Cached data may still be available. Reconnect to sync the latest balances and activity.',
  action,
  className,
  ...rest
}: Partial<FeedbackStateProps> & HTMLAttributes<HTMLDivElement>): ReactElement {
  return (
    <EmptyState
      title={title}
      description={description}
      action={action}
      className={cn('auvora-empty--offline', className)}
      {...rest}
    />
  );
}
