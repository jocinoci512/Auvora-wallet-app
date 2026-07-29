import type { HTMLAttributes, ReactElement } from 'react';
import { cn } from './utils/cn';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  name?: string;
  src?: string;
  size?: AvatarSize;
}

function initials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export function Avatar({ name, src, size = 'md', className, ...rest }: AvatarProps): ReactElement {
  return (
    <span
      className={cn('auvora-avatar', `auvora-avatar--${size}`, className)}
      role="img"
      aria-label={name ?? 'Avatar'}
      {...rest}
    >
      {src ? (
        <img className="auvora-avatar__img" src={src} alt="" />
      ) : (
        <span className="auvora-avatar__fallback" aria-hidden>
          {initials(name)}
        </span>
      )}
    </span>
  );
}
