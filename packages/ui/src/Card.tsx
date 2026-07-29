import type { HTMLAttributes, ReactElement, ReactNode } from 'react';
import { cn } from './utils/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, padding = 'md', className, ...rest }: CardProps): ReactElement {
  return (
    <div className={cn('auvora-card', `auvora-card--pad-${padding}`, className)} {...rest}>
      {children}
    </div>
  );
}

export interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function CardHeader({
  title,
  description,
  actions,
  className,
  ...rest
}: CardHeaderProps): ReactElement {
  return (
    <div className={cn('auvora-card__header', className)} {...rest}>
      <div>
        <div className="auvora-card__title">{title}</div>
        {description ? <div className="auvora-card__desc">{description}</div> : null}
      </div>
      {actions ? <div className="auvora-card__actions">{actions}</div> : null}
    </div>
  );
}
