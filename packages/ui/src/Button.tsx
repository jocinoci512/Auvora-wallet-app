import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  type = 'button',
  children,
  disabled,
  ...rest
}: ButtonProps): ReactElement {
  const classes = [
    'auvora-btn',
    `auvora-btn--${variant}`,
    size !== 'md' ? `auvora-btn--${size}` : '',
    loading ? 'auvora-btn--loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="auvora-btn__spinner" aria-hidden /> : null}
      <span className="auvora-btn__label">{children}</span>
    </button>
  );
}
