import type {
  HTMLAttributes,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
  ReactElement,
  ReactNode,
} from 'react';
import { cn } from './utils/cn';

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  children: ReactNode;
  caption?: string;
}

export function Table({ children, caption, className, ...rest }: TableProps): ReactElement {
  return (
    <div className="auvora-table-scroll table-scroll">
      <table className={cn('auvora-table', 'data-table', className)} {...rest}>
        {caption ? <caption className="auvora-sr-only">{caption}</caption> : null}
        {children}
      </table>
    </div>
  );
}

export function THead({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>): ReactElement {
  return (
    <thead className={cn('auvora-table__head', className)} {...rest}>
      {children}
    </thead>
  );
}

export function TBody({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>): ReactElement {
  return (
    <tbody className={cn('auvora-table__body', className)} {...rest}>
      {children}
    </tbody>
  );
}

export function TR({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLTableRowElement>): ReactElement {
  return (
    <tr className={cn('auvora-table__row', className)} {...rest}>
      {children}
    </tr>
  );
}

export function TH({
  children,
  className,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement>): ReactElement {
  return (
    <th className={cn('auvora-table__th', className)} scope="col" {...rest}>
      {children}
    </th>
  );
}

export function TD({
  children,
  className,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement>): ReactElement {
  return (
    <td className={cn('auvora-table__td', className)} {...rest}>
      {children}
    </td>
  );
}
