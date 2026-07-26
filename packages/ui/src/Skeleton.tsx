import type { HTMLAttributes, ReactElement } from 'react';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  rows?: number;
  label?: string;
}

export function Skeleton({
  rows = 3,
  label = 'Loading',
  className,
  ...rest
}: SkeletonProps): ReactElement {
  const classes = ['auvora-skeleton', className].filter(Boolean).join(' ');
  return (
    <div className={classes} role="status" aria-live="polite" aria-busy="true" {...rest}>
      <span className="auvora-sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="auvora-skeleton__row"
          style={{ width: `${92 - (index % 3) * 12}%` }}
        />
      ))}
    </div>
  );
}

export interface LoadingBlockProps extends HTMLAttributes<HTMLParagraphElement> {
  message?: string;
}

export function LoadingBlock({
  message = 'Loading…',
  className,
  ...rest
}: LoadingBlockProps): ReactElement {
  const classes = ['auvora-loading', className].filter(Boolean).join(' ');
  return (
    <p className={classes} role="status" aria-live="polite" {...rest}>
      {message}
    </p>
  );
}
