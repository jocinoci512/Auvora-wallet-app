import type { HTMLAttributes, ReactElement } from 'react';
import { Button } from './Button';
import { cn } from './utils/cn';

export interface PaginationProps extends HTMLAttributes<HTMLElement> {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  page,
  pageCount,
  onPageChange,
  className,
  ...rest
}: PaginationProps): ReactElement {
  const safeCount = Math.max(1, pageCount);
  const safePage = Math.min(Math.max(1, page), safeCount);

  return (
    <nav className={cn('auvora-pagination', className)} aria-label="Pagination" {...rest}>
      <Button
        variant="ghost"
        size="sm"
        disabled={safePage <= 1}
        onClick={() => onPageChange(safePage - 1)}
        aria-label="Previous page"
      >
        Previous
      </Button>
      <span className="auvora-pagination__status" aria-live="polite">
        Page {safePage} of {safeCount}
      </span>
      <Button
        variant="ghost"
        size="sm"
        disabled={safePage >= safeCount}
        onClick={() => onPageChange(safePage + 1)}
        aria-label="Next page"
      >
        Next
      </Button>
    </nav>
  );
}
