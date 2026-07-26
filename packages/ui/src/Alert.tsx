import type { HTMLAttributes, ReactElement, ReactNode } from 'react';

export type AlertTone = 'error' | 'warn' | 'success' | 'info';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone?: AlertTone;
  title?: string;
  children: ReactNode;
}

export function Alert({
  tone = 'info',
  title,
  children,
  className,
  role,
  ...rest
}: AlertProps): ReactElement {
  const computedRole = role ?? (tone === 'error' || tone === 'warn' ? 'alert' : 'status');
  const classes = ['auvora-alert', `auvora-alert--${tone}`, className].filter(Boolean).join(' ');

  return (
    <div className={classes} role={computedRole} {...rest}>
      {title ? <strong className="auvora-alert__title">{title}</strong> : null}
      <div className="auvora-alert__body">{children}</div>
    </div>
  );
}
