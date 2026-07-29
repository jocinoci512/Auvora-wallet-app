import type { ReactElement, TextareaHTMLAttributes } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea({ className, invalid, ...rest }: TextareaProps): ReactElement {
  const classes = ['auvora-textarea', className].filter(Boolean).join(' ');
  return <textarea className={classes} aria-invalid={invalid || undefined} {...rest} />;
}
