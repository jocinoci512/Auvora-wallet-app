import type { HTMLAttributes, ReactElement, ReactNode } from 'react';
import { cn } from './utils/cn';

export interface ChartFrameProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Metric-style summary row */
  metrics?: Array<{ label: string; value: ReactNode }>;
}

/** Lightweight chart / metric frame — no heavy chart library. */
export function ChartFrame({
  title,
  description,
  children,
  metrics,
  className,
  ...rest
}: ChartFrameProps): ReactElement {
  return (
    <section className={cn('auvora-chart-frame', className)} {...rest}>
      {title || description ? (
        <header className="auvora-chart-frame__header">
          {title ? <h3 className="auvora-chart-frame__title">{title}</h3> : null}
          {description ? <p className="auvora-chart-frame__desc">{description}</p> : null}
        </header>
      ) : null}
      {metrics && metrics.length > 0 ? (
        <div className="metric-grid">
          {metrics.map((m) => (
            <div key={String(m.label)} className="metric-card">
              <span className="metric-card__label">{m.label}</span>
              <span className="metric-card__value">{m.value}</span>
            </div>
          ))}
        </div>
      ) : null}
      {children ? <div className="auvora-chart-frame__body">{children}</div> : null}
    </section>
  );
}
