import type { HTMLAttributes, ReactElement, ReactNode } from 'react';
import { cn } from './utils/cn';

export interface BreadcrumbItem {
  label: ReactNode;
  href?: string;
  current?: boolean;
}

export interface BreadcrumbsProps extends HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[];
  /** Render link; apps pass Next Link wrapper */
  renderLink?: (item: BreadcrumbItem, index: number) => ReactNode;
}

export function Breadcrumbs({
  items,
  renderLink,
  className,
  ...rest
}: BreadcrumbsProps): ReactElement {
  return (
    <nav className={cn('auvora-breadcrumbs', className)} aria-label="Breadcrumb" {...rest}>
      <ol className="auvora-breadcrumbs__list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1 || item.current;
          return (
            <li key={index} className="auvora-breadcrumbs__item">
              {isLast || !item.href ? (
                <span aria-current={isLast ? 'page' : undefined}>{item.label}</span>
              ) : renderLink ? (
                renderLink(item, index)
              ) : (
                <a href={item.href}>{item.label}</a>
              )}
              {!isLast ? (
                <span className="auvora-breadcrumbs__sep" aria-hidden>
                  /
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
