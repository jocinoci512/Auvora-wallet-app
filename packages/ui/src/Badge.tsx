import type { HTMLAttributes, ReactElement } from 'react';
import { cn } from './utils/cn';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = 'neutral', className, ...rest }: BadgeProps): ReactElement {
  return <span className={cn('auvora-badge', `auvora-badge--${tone}`, className)} {...rest} />;
}
