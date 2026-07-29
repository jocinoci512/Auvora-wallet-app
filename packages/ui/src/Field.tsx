import type { HTMLAttributes, ReactElement, ReactNode } from 'react';
import { Label } from './Label';

export interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  label?: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
  ...rest
}: FieldProps): ReactElement {
  const classes = ['auvora-field', className].filter(Boolean).join(' ');
  return (
    <div className={classes} {...rest}>
      {label ? <Label htmlFor={htmlFor}>{label}</Label> : null}
      {children}
      {error ? (
        <p className="auvora-field-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="auvora-hint">{hint}</p>
      ) : null}
    </div>
  );
}

export interface FormHintProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
}

export function FormHint({ className, children, ...rest }: FormHintProps): ReactElement {
  const classes = ['auvora-hint', className].filter(Boolean).join(' ');
  return (
    <p className={classes} {...rest}>
      {children}
    </p>
  );
}

export interface FormErrorProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
}

export function FormError({ className, children, ...rest }: FormErrorProps): ReactElement {
  const classes = ['auvora-field-error', className].filter(Boolean).join(' ');
  return (
    <p className={classes} role="alert" {...rest}>
      {children}
    </p>
  );
}
