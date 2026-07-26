import type { HTMLAttributes, ReactElement, ReactNode } from 'react';

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({
  title,
  description,
  action,
  className,
  ...rest
}: EmptyStateProps): ReactElement {
  const classes = ['auvora-empty', className].filter(Boolean).join(' ');
  return (
    <div className={classes} {...rest}>
      <p className="auvora-empty__title">{title}</p>
      {description ? <p className="auvora-empty__description">{description}</p> : null}
      {action ? <div className="auvora-empty__action">{action}</div> : null}
    </div>
  );
}
