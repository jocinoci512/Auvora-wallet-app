import type { HTMLAttributes, ReactElement } from 'react';
import { cn } from './utils/cn';

export interface LoaderProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export function Loader({
  size = 'md',
  label = 'Loading',
  className,
  ...rest
}: LoaderProps): ReactElement {
  return (
    <div
      className={cn('auvora-loader', `auvora-loader--${size}`, className)}
      role="status"
      aria-live="polite"
      {...rest}
    >
      <span className="auvora-loader__spin" aria-hidden />
      <span className="auvora-sr-only">{label}</span>
    </div>
  );
}
