import type { InputHTMLAttributes, ReactElement } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ className, invalid, ...rest }: InputProps): ReactElement {
  const classes = ['auvora-input', className].filter(Boolean).join(' ');
  return <input className={classes} aria-invalid={invalid || undefined} {...rest} />;
}
