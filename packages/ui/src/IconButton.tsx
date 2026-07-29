import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';

export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: IconButtonSize;
  children: ReactNode;
}

export function IconButton({
  label,
  size = 'md',
  className,
  type = 'button',
  children,
  ...rest
}: IconButtonProps): ReactElement {
  const classes = ['auvora-icon-btn', size !== 'md' ? `auvora-icon-btn--${size}` : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      aria-label={label}
      title={rest.title ?? label}
      {...rest}
    >
      {children}
    </button>
  );
}
