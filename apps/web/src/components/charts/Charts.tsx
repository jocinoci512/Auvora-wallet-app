'use client';

import { useId, useMemo, type ReactElement } from 'react';

export type SparkPoint = { t?: string; v: number };

export interface LineChartProps {
  data: SparkPoint[];
  height?: number;
  className?: string;
  stroke?: string;
  fill?: boolean;
  ariaLabel?: string;
}

export function LineChart({
  data,
  height = 120,
  className,
  stroke = 'var(--auvora-color-primary)',
  fill = true,
  ariaLabel = 'Line chart',
}: LineChartProps): ReactElement {
  const rawId = useId();
  const id = rawId.replace(/:/g, '');
  const { path, area, min, max } = useMemo(() => {
    if (!data.length) {
      return { path: '', area: '', min: 0, max: 0 };
    }
    const values = data.map((d) => d.v);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const span = hi - lo || 1;
    const w = 100;
    const h = 100;
    const coords = data.map((d, i) => {
      const x = data.length === 1 ? w / 2 : (i / (data.length - 1)) * w;
      const y = h - ((d.v - lo) / span) * (h * 0.82) - h * 0.09;
      return { x, y };
    });
    const line = coords
      .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(2)} ${c.y.toFixed(2)}`)
      .join(' ');
    const areaPath = `${line} L${coords[coords.length - 1]!.x.toFixed(2)} ${h} L${coords[0]!.x.toFixed(2)} ${h} Z`;
    return { path: line, area: areaPath, min: lo, max: hi };
  }, [data]);

  return (
    <svg
      className={['auvora-chart', 'auvora-chart--line', className].filter(Boolean).join(' ')}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      role="img"
      aria-label={`${ariaLabel}. Range ${min.toFixed(0)} to ${max.toFixed(0)}.`}
      style={{ height }}
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && area ? (
        <path className="auvora-chart__area" d={area} fill={`url(#${id}-fill)`} />
      ) : null}
      {path ? (
        <path
          className="auvora-chart__line"
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth="1.75"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </svg>
  );
}

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSub?: string;
  className?: string;
  ariaLabel?: string;
}

export function DonutChart({
  slices,
  size = 160,
  thickness = 18,
  centerLabel,
  centerSub,
  className,
  ariaLabel,
}: DonutChartProps): ReactElement {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const summary =
    ariaLabel ??
    (slices.length
      ? `Allocation: ${slices
          .map((s) => `${s.label} ${((s.value / total) * 100).toFixed(0)}%`)
          .join(', ')}`
      : 'Allocation chart');

  return (
    <div
      className={['auvora-donut', className].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={summary}
      >
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {slices.map((slice) => {
            const len = (slice.value / total) * c;
            const el = (
              <circle
                key={slice.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={slice.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                className="auvora-donut__arc"
              />
            );
            offset += len;
            return el;
          })}
        </g>
      </svg>
      {(centerLabel || centerSub) && (
        <div className="auvora-donut__center">
          {centerLabel ? <strong>{centerLabel}</strong> : null}
          {centerSub ? <span>{centerSub}</span> : null}
        </div>
      )}
    </div>
  );
}
