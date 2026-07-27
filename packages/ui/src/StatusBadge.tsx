import type { HTMLAttributes, ReactElement } from 'react';

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: string;
  label?: string;
}

/** Status pill with normalized CSS modifier from status string. */
export function StatusBadge({ status, label, className, ...rest }: StatusBadgeProps): ReactElement {
  const modifier = status.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const classes = ['status-badge', `status-badge--${modifier}`, className].filter(Boolean).join(' ');
  return (
    <span className={classes} {...rest}>
      {label ?? status}
    </span>
  );
}
