import type { HTMLAttributes, LiHTMLAttributes, ReactElement, ReactNode } from 'react';
import { cn } from './utils/cn';

export interface ListProps extends HTMLAttributes<HTMLUListElement> {
  children: ReactNode;
  divided?: boolean;
}

export function List({ children, divided = false, className, ...rest }: ListProps): ReactElement {
  return (
    <ul className={cn('auvora-list', divided && 'auvora-list--divided', className)} {...rest}>
      {children}
    </ul>
  );
}

export interface ListItemProps extends LiHTMLAttributes<HTMLLIElement> {
  children: ReactNode;
}

export function ListItem({ children, className, ...rest }: ListItemProps): ReactElement {
  return (
    <li className={cn('auvora-list__item', className)} {...rest}>
      {children}
    </li>
  );
}
