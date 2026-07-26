import type { ButtonHTMLAttributes, ReactElement } from 'react';
import { tokens } from './tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: tokens.color.accent,
    color: '#FFFFFF',
    border: `1px solid ${tokens.color.accent}`,
  },
  secondary: {
    background: tokens.color.accentMuted,
    color: tokens.color.ink,
    border: `1px solid ${tokens.color.border}`,
  },
  ghost: {
    background: 'transparent',
    color: tokens.color.ink,
    border: `1px solid ${tokens.color.border}`,
  },
};

export function Button({
  variant = 'primary',
  style,
  type = 'button',
  children,
  ...rest
}: ButtonProps): ReactElement {
  return (
    <button
      type={type}
      style={{
        fontFamily: tokens.font.sans,
        fontWeight: 600,
        borderRadius: tokens.radius.sm,
        padding: `${tokens.space.sm} ${tokens.space.md}`,
        cursor: rest.disabled ? 'not-allowed' : 'pointer',
        opacity: rest.disabled ? 0.6 : 1,
        lineHeight: 1.25,
        ...variantStyles[variant],
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}