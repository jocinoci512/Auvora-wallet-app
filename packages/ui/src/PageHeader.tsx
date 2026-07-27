import type { HTMLAttributes, ReactElement, ReactNode } from 'react';

export interface PageHeaderProps extends HTMLAttributes<HTMLElement> {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children?: ReactNode;
}

/** Consistent page title row used by Web + Admin surfaces. */
export function PageHeader({
  title,
  subtitle,
  actions,
  children,
  className,
  ...rest
}: PageHeaderProps): ReactElement {
  const classes = ['auvora-page-header', className].filter(Boolean).join(' ');
  return (
    <header className={classes} {...rest}>
      <div className="auvora-page-header__row">
        <div className="auvora-page-header__titles">
          <h1 className="auvora-page-header__title">{title}</h1>
          {subtitle ? <p className="auvora-page-header__subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="auvora-page-header__actions">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}
